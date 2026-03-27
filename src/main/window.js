const { BrowserWindow, screen, ipcMain, shell } = require('electron');
const path = require('path');
const channels = require('../../shared/ipc-channels');

let mainWindow = null;
let seoWindow = null;
let settingsWindow = null;
let currentSnapPosition = null;

const isDev = !require('electron').app.isPackaged;

// ═══ Main Window ═══

function createMainWindow() {
  mainWindow = new BrowserWindow({
    icon: path.join(__dirname, '../../assets/icon.png'),
    transparent: false,
    frame: false,
    alwaysOnTop: false,
    skipTaskbar: false,
    width: 960,
    height: 340,
    minWidth: 400,
    minHeight: 180,
    resizable: true,
    backgroundColor: '#111827',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.setOpacity(1.0);

  // ─── Edge magnet snap while dragging ───
  let _isSnapping = false;
  mainWindow.on('move', () => {
    if (_isSnapping) return;
    const SNAP_THRESHOLD = 20;
    const bounds = mainWindow.getBounds();
    const area = screen.getPrimaryDisplay().workArea;

    let snapped = false;
    // Left edge
    if (Math.abs(bounds.x - area.x) < SNAP_THRESHOLD && bounds.x !== area.x) {
      bounds.x = area.x; snapped = true;
    }
    // Top edge
    if (Math.abs(bounds.y - area.y) < SNAP_THRESHOLD && bounds.y !== area.y) {
      bounds.y = area.y; snapped = true;
    }
    // Right edge
    const rightGap = (area.x + area.width) - (bounds.x + bounds.width);
    if (Math.abs(rightGap) < SNAP_THRESHOLD && rightGap !== 0) {
      bounds.x = area.x + area.width - bounds.width; snapped = true;
    }
    // Bottom edge
    const bottomGap = (area.y + area.height) - (bounds.y + bounds.height);
    if (Math.abs(bottomGap) < SNAP_THRESHOLD && bottomGap !== 0) {
      bounds.y = area.y + area.height - bounds.height; snapped = true;
    }

    if (snapped) {
      _isSnapping = true;
      mainWindow.setBounds(bounds);
      setTimeout(() => { _isSnapping = false; }, 50);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    closeSeoWindow();
    closeSettingsWindow();
  });

  return mainWindow;
}

function getMainWindow() {
  return mainWindow;
}

// ═══ Auto-resize to fit instructor cards ═══

function resizeToFitInstructors(count) {
  if (!mainWindow || count <= 0) return;

  const display = screen.getPrimaryDisplay();
  const { width: screenW } = display.workAreaSize;

  // Card: 220px wide, gap: 12px, padding: 12px each side
  const CARD_W = 220;
  const GAP = 12;
  const PAD = 12;
  const targetWidth = PAD + (CARD_W * count) + (GAP * (count - 1)) + PAD;

  const width = Math.max(400, Math.min(targetWidth, screenW));
  const height = 340;

  const bounds = mainWindow.getBounds();
  mainWindow.setBounds({ x: bounds.x, y: bounds.y, width, height }, true);
}

// ═══ Snap ═══

function createSnapBounds(position) {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  const { x: ox, y: oy } = display.workArea;

  const presets = {
    top:    { x: ox, y: oy, width, height: 260 },
    right:  { x: ox + width - 400, y: oy, width: 400, height },
    bottom: { x: ox, y: oy + height - 180, width, height: 180 },
  };

  return presets[position] || null;
}

function getLayoutMode(position) {
  const modes = { top: 'horizontal', right: 'vertical', bottom: 'compact' };
  return modes[position] || 'horizontal';
}

function snapWindow(position) {
  if (!mainWindow) return;
  currentSnapPosition = position;
  const bounds = createSnapBounds(position);
  if (bounds) mainWindow.setBounds(bounds, true);
  mainWindow.webContents.send('layout-change', getLayoutMode(position));
  closeSeoWindow();
}

// ═══ SEO Floating Window ═══

function openSeoWindow({ x, y, width, instructorId, seoResultId }) {
  closeSeoWindow();

  seoWindow = new BrowserWindow({
    parent: mainWindow,
    x: Math.round(x),
    y: Math.round(y),
    width: width || 240,
    height: 420,
    transparent: true,
    frame: false,
    alwaysOnTop: false,
    resizable: false,
    skipTaskbar: true,
    hasShadow: true,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const hash = seoResultId ? `/seo/${instructorId}/${seoResultId}` : `/seo/${instructorId}`;
  if (isDev) {
    seoWindow.loadURL(`http://localhost:5173/#${hash}`);
  } else {
    seoWindow.loadFile(
      path.join(__dirname, '../../dist/renderer/index.html'),
      { hash }
    );
  }

  seoWindow.on('closed', () => {
    seoWindow = null;
  });
}

function closeSeoWindow() {
  if (seoWindow && !seoWindow.isDestroyed()) {
    seoWindow.close();
  }
  seoWindow = null;
}

// ═══ Settings Window ═══

function openSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  const mainBounds = mainWindow ? mainWindow.getBounds() : { x: 200, y: 200, width: 960, height: 260 };
  const sw = 420;
  const sh = 520;
  const sx = Math.round(mainBounds.x + (mainBounds.width - sw) / 2);
  const sy = Math.round(mainBounds.y + (mainBounds.height - sh) / 2);

  settingsWindow = new BrowserWindow({
    width: sw,
    height: sh,
    x: Math.max(0, sx),
    y: Math.max(0, sy),
    resizable: false,
    minimizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    parent: mainWindow || undefined,
    modal: false,
    backgroundColor: '#1f2937',
    title: '',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    settingsWindow.loadURL('http://localhost:5173/#/settings');
  } else {
    settingsWindow.loadFile(
      path.join(__dirname, '../../dist/renderer/index.html'),
      { hash: '/settings' }
    );
  }

  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function closeSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close();
  }
  settingsWindow = null;
}

// ═══ Register all window-related IPC handlers ═══

function registerWindowIpc() {
  // Window controls (traffic light buttons)
  ipcMain.handle('close-window', () => {
    if (mainWindow) mainWindow.close();
  });

  ipcMain.handle('minimize-window', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.handle('maximize-window', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  // Opacity
  ipcMain.handle(channels.SET_OPACITY, (_, val) => {
    if (!mainWindow) return;
    const clamped = Math.max(0.2, Math.min(1.0, val));
    mainWindow.setOpacity(clamped);
    try {
      const db = require('./data/db');
      db.setSetting('opacity', String(clamped));
    } catch { /* ignore */ }
  });

  // Snap
  ipcMain.handle(channels.SNAP_WINDOW, (_, pos) => {
    snapWindow(pos);
  });

  // SEO floating window
  ipcMain.handle(channels.OPEN_SEO_WINDOW, (_, { cardBounds, instructorId, seoResultId }) => {
    if (!mainWindow) return;
    const contentBounds = mainWindow.getContentBounds();
    const screenX = contentBounds.x + cardBounds.x;
    const screenY = contentBounds.y + cardBounds.y + cardBounds.height + 4;
    openSeoWindow({
      x: screenX,
      y: screenY,
      width: Math.max(cardBounds.width, 220),
      instructorId,
      seoResultId,
    });
  });

  ipcMain.handle(channels.CLOSE_SEO_WINDOW, () => {
    closeSeoWindow();
  });

  // Settings window
  ipcMain.handle('open-settings-window', () => {
    openSettingsWindow();
  });

  ipcMain.handle('close-settings-window', () => {
    closeSettingsWindow();
  });

  // Open external URL
  ipcMain.handle('open-external', (_, url) => {
    shell.openExternal(url);
  });

  // Auto-resize to fit instructor cards
  ipcMain.handle(channels.RESIZE_TO_FIT, (_, count) => {
    resizeToFitInstructors(count);
  });
}

module.exports = {
  createMainWindow,
  getMainWindow,
  resizeToFitInstructors,
  createSnapBounds,
  snapWindow,
  openSeoWindow,
  closeSeoWindow,
  openSettingsWindow,
  closeSettingsWindow,
  registerWindowIpc,
};
