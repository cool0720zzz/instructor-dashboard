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

autoUpdater.on('update-available', () => {
  const win = getMainWindow();
  if (win && !win.isDestroyed()) win.webContents.send('update-available');
});

autoUpdater.on('update-downloaded', () => {
  const win = getMainWindow();
  if (win && !win.isDestroyed()) win.webContents.send('update-downloaded');
});

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall();
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
      const { getWeekRangeISO, getMonthRangeISO } = require('./data/dateRanges');
      const instructors = db.getAllInstructors();
      const { start: weekStart, end: weekEnd } = getWeekRangeISO();
      const { start: monthStart, end: monthEnd } = getMonthRangeISO();
      const lastCollection = db.getSetting('last_collection');

      return instructors.map((inst) => {
        const blogWeek = db.getBlogCount(inst.id, weekStart, weekEnd);
        const blogMonth = db.getBlogCountMonth(inst.id, monthStart, monthEnd);
        const reviewWeek = db.getReviewCount(inst.id, weekStart, weekEnd);
        const reviewMonth = db.getReviewCountMonth(inst.id, monthStart, monthEnd);
        const seoResults = db.getSeoResults(inst.id, 3);
        const lastWeek = db.getLastWeekStatus(inst.id);

        return {
          id: inst.id,
          name: inst.name,
          displayColor: inst.display_color,
          blogWeek,
          blogMonth,
          reviewWeek,
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
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
