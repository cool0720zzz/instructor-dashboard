// Polyfill File for undici/fetch in Electron main process
if (typeof globalThis.File === 'undefined') {
  const { Blob } = require('buffer');
  globalThis.File = class File extends Blob {
    #name;
    constructor(bits, name, opts) { super(bits, opts); this.#name = name; }
    get name() { return this.#name; }
  };
}

const { app, ipcMain, BrowserWindow } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const {
  createMainWindow, getMainWindow,
  registerWindowIpc,
} = require('./window');
const { createTray } = require('./tray');
const { validateAndLoad, revalidateIfNeeded } = require('./license');
const channels = require('../../shared/ipc-channels');

const isDev = !app.isPackaged;

// ─── Auto-updater ───
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// Track update state so settings modal can query it
let updateState = 'idle'; // idle | checking | available | downloading | downloaded | error
let updateError = null;

autoUpdater.on('checking-for-update', () => {
  updateState = 'checking';
  _broadcastUpdateStatus();
});

autoUpdater.on('update-available', () => {
  updateState = 'available';
  _broadcastUpdateStatus();
  const win = getMainWindow();
  if (win && !win.isDestroyed()) win.webContents.send('update-available');
});

autoUpdater.on('update-not-available', () => {
  updateState = 'idle';
  _broadcastUpdateStatus();
});

autoUpdater.on('download-progress', () => {
  updateState = 'downloading';
  _broadcastUpdateStatus();
});

autoUpdater.on('update-downloaded', () => {
  updateState = 'downloaded';
  _broadcastUpdateStatus();
  const win = getMainWindow();
  if (win && !win.isDestroyed()) win.webContents.send('update-downloaded');
});

autoUpdater.on('error', (err) => {
  updateState = 'error';
  updateError = err?.message || 'Unknown error';
  _broadcastUpdateStatus();
});

function _broadcastUpdateStatus() {
  try {
    const allWins = BrowserWindow.getAllWindows();
    for (const w of allWins) {
      if (!w.isDestroyed()) {
        w.webContents.send('update-status-changed', { state: updateState, error: updateError });
      }
    }
  } catch { /* ignore */ }
}

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-update-status', () => {
  return { state: updateState, error: updateError };
});

ipcMain.handle('check-for-update', async () => {
  try {
    updateState = 'checking';
    updateError = null;
    const result = await autoUpdater.checkForUpdatesAndNotify();
    return { success: true, version: result?.updateInfo?.version || null };
  } catch (err) {
    updateState = 'error';
    updateError = err.message;
    return { success: false, error: err.message };
  }
});

function registerDataIpcHandlers() {
  // ─── License ───
  ipcMain.handle(channels.VALIDATE_LICENSE, async (_, licenseKey) => {
    const result = await validateAndLoad(licenseKey);

    // After successful license activation, notify all windows and start collection
    if (result.valid) {
      // Notify main window that license is now active
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send('license-activated');
      }

      const { startScheduler } = require('./scheduler/scheduler');
      startScheduler(win);
    }

    return result;
  });

  // ─── Dashboard data ───
  ipcMain.handle(channels.GET_DASHBOARD_DATA, async () => {
    try {
      const db = require('./data/db');
      const { getWeekRangeISO, getMonthRangeISO, getLastWeekRangeISO } = require('./data/dateRanges');
      const instructors = db.getAllInstructors();
      const { start: weekStart, end: weekEnd } = getWeekRangeISO();
      const { start: monthStart, end: monthEnd } = getMonthRangeISO();
      const { start: lastWeekStart, end: lastWeekEnd } = getLastWeekRangeISO();
      const lastCollection = db.getSetting('last_collection');

      return instructors.map((inst) => {
        const blogWeek = db.getBlogCount(inst.id, weekStart, weekEnd);
        const blogLastWeek = db.getBlogCount(inst.id, lastWeekStart, lastWeekEnd);
        const blogMonth = db.getBlogCountMonth(inst.id, monthStart, monthEnd);
        const reviewWeek = db.getReviewCount(inst.id, weekStart, weekEnd);
        const reviewLastWeek = db.getReviewCount(inst.id, lastWeekStart, lastWeekEnd);
        const reviewMonth = db.getReviewCountMonth(inst.id, monthStart, monthEnd);
        const seoResults = db.getSeoResults(inst.id, 3);
        const lastWeek = db.getLastWeekStatus(inst.id);

        return {
          id: inst.id,
          name: inst.name,
          displayColor: inst.display_color,
          blogWeek,
          blogLastWeek,
          blogMonth,
          reviewWeek,
          reviewLastWeek,
          reviewMonth,
          seoResults: seoResults || [],
          status: lastWeek?.status || 'ok',
          lastCollection,
        };
      });
    } catch {
      return [];
    }
  });

  // ─── SEO results ───
  ipcMain.handle(channels.GET_SEO_RESULTS, async (_, instructorId) => {
    try {
      const db = require('./data/db');
      return db.getSeoResults(instructorId, 10);
    } catch {
      return [];
    }
  });

  // ─── Manual refresh: full collection ───
  ipcMain.handle(channels.TRIGGER_RSS_REFRESH, async () => {
    try {
      const { runFullCollection } = require('./scheduler/scheduler');
      await runFullCollection();
      return { success: true };
    } catch {
      return { success: false };
    }
  });

  // ─── SEO analyze ───
  ipcMain.handle(channels.TRIGGER_SEO_ANALYZE, async (_, instructorId) => {
    try {
      const { analyzeUnanalyzedPosts } = require('./scheduler/scheduler');
      const results = await analyzeUnanalyzedPosts(instructorId);
      return results;
    } catch (err) {
      console.error('[SEO] Analysis failed:', err.message);
      return [];
    }
  });

  // ─── Weekly check ───
  ipcMain.handle(channels.TRIGGER_WEEKLY_CHECK, async () => {
    try {
      const { runWeeklyCheck } = require('./scheduler/scheduler');
      await runWeeklyCheck();
      return { success: true };
    } catch {
      return { success: false };
    }
  });

  // ─── Collection status ───
  ipcMain.handle('get-collection-status', () => {
    try {
      const db = require('./data/db');
      const { isCollecting } = require('./scheduler/scheduler');
      return {
        collecting: isCollecting(),
        lastCollection: db.getSetting('last_collection') || null,
      };
    } catch {
      return { collecting: false, lastCollection: null };
    }
  });

  // ─── UI settings ───
  ipcMain.handle(channels.GET_UI_SETTINGS, () => {
    try {
      const db = require('./data/db');
      const rawOpacity = db.getSetting('opacity');
      let opacity = 1.0;
      if (rawOpacity) {
        const parsed = parseFloat(rawOpacity);
        opacity = parsed > 1 ? parsed / 100 : parsed;
      }
      opacity = Math.max(0.2, Math.min(1.0, opacity));

      return {
        opacity,
        snapPreset: db.getSetting('snap_preset') || 'top',
        autoStart: db.getSetting('auto_start') === 'true',
        licenseKey: db.getSetting('license_key') || '',
        plan: db.getSetting('plan') || '',
      };
    } catch {
      return { opacity: 1.0, snapPreset: 'top', autoStart: false, licenseKey: '', plan: '' };
    }
  });

  // ─── Re-registration tracker ───
  ipcMain.handle(channels.SELECT_REREG_FILE, async () => {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Excel', extensions: ['xlsx', 'xls', 'csv'] }],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle(channels.GET_REREG_SHEET_NAMES, async (_, filePath) => {
    try {
      const rereg = require('./data/reregistration');
      return { sheets: rereg.getSheetNames(filePath) };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle(channels.GET_REREG_PREVIEW, async (_, config) => {
    try {
      const rereg = require('./data/reregistration');
      if (config.sourceType === 'googleSheet') {
        const rows = await rereg.fetchGoogleSheet(config.sheetUrl);
        return { rows: rows.slice(0, 15) };
      } else {
        const rows = rereg.getPreviewRows(config.filePath, config.sheetName, 15);
        return { rows };
      }
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle(channels.PARSE_REREG_DATA, async (_, config) => {
    try {
      const rereg = require('./data/reregistration');
      let records;
      if (config.sourceType === 'googleSheet') {
        const rawRows = await rereg.fetchGoogleSheet(config.sheetUrl);
        const dataRows = rawRows.slice(config.startRow || 1);
        records = rereg.mapRowsToRecords(dataRows, config.columns);
      } else {
        records = rereg.parseExcelWithMapping(config.filePath, config.sheetName, config.columns, config.startRow);
      }
      records = rereg.verifyCohortReRegistrations(records);
      return { data: records };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle(channels.GET_REREG_CONFIG, () => {
    try {
      const db = require('./data/db');
      const raw = db.getSetting('rereg_config');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  ipcMain.handle(channels.SET_REREG_CONFIG, (_, config) => {
    try {
      const db = require('./data/db');
      db.setSetting('rereg_config', JSON.stringify(config));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(channels.FETCH_GOOGLE_SHEET, async (_, url) => {
    try {
      const rereg = require('./data/reregistration');
      const rows = await rereg.fetchGoogleSheet(url);
      return { rows: rows.slice(0, 15) };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle(channels.SET_UI_SETTINGS, (_, settings) => {
    try {
      const db = require('./data/db');
      const win = getMainWindow();
      if (settings.opacity !== undefined) {
        const val = Math.max(0.2, Math.min(1.0, settings.opacity));
        db.setSetting('opacity', String(val));
        if (win) win.setOpacity(val);
      }
      if (settings.snapPreset !== undefined) db.setSetting('snap_preset', settings.snapPreset);
      if (settings.autoStart !== undefined) {
        db.setSetting('auto_start', String(settings.autoStart));
        app.setLoginItemSettings({ openAtLogin: settings.autoStart });
      }
      return { success: true };
    } catch {
      return { success: false };
    }
  });
}

// ─── Date helpers ───

// ─── App lifecycle ───

app.whenReady().then(async () => {
  try {
    const { initDb } = require('./data/db');
    await initDb();
    console.log('Database initialized');
  } catch (err) {
    console.error('Database init failed:', err.message);
  }

  // Check license
  try {
    await revalidateIfNeeded();
  } catch (err) {
    console.error('License revalidation failed:', err.message);
  }

  createMainWindow();
  registerWindowIpc();
  registerDataIpcHandlers();
  createTray();

  const win = getMainWindow();

  // Restore saved opacity
  try {
    const db = require('./data/db');
    const rawOpacity = db.getSetting('opacity');
    let opacity = 1.0;
    if (rawOpacity) {
      const parsed = parseFloat(rawOpacity);
      opacity = parsed > 1 ? parsed / 100 : parsed;
    }
    opacity = Math.max(0.2, Math.min(1.0, opacity));
    win.setOpacity(opacity);
  } catch {
    // default 100%
  }

  // Enable auto-start by default (if not explicitly set)
  try {
    const db = require('./data/db');
    const autoStartSetting = db.getSetting('auto_start');
    if (autoStartSetting === null || autoStartSetting === undefined) {
      db.setSetting('auto_start', 'true');
      app.setLoginItemSettings({ openAtLogin: true });
    }
  } catch {}

  // Start scheduler (will run initial collection if instructors exist)
  try {
    const db = require('./data/db');
    const hasLicense = db.getSetting('license_key');
    if (hasLicense) {
      const { startScheduler } = require('./scheduler/scheduler');
      startScheduler(win);
    }
  } catch {
    // scheduler will start after license activation
  }

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
    // Check for updates 5 seconds after launch (production only)
    setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 5000);
  }

  // Open Coupang Partners link in default browser on app start
  const { shell } = require('electron');
  setTimeout(() => {
    shell.openExternal('https://link.coupang.com/a/ecE8Wh');
  }, 3000);

  // Show update notes if version changed since last shown
  win.webContents.once('did-finish-load', () => {
    try {
      const db = require('./data/db');
      const { version } = require('../../package.json');
      const lastShown = db.getSetting('last_shown_version');
      if (lastShown !== version) {
        const updateNotes = require('./updateNotes');
        const notes = updateNotes[version];
        if (notes && notes.length > 0) {
          win.webContents.send('show-update-notes', { version, notes });
        }
        db.setSetting('last_shown_version', version);
      }
    } catch (err) {
      console.warn('Update notes check failed:', err.message);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
