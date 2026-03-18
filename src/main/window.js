const { BrowserWindow, BrowserView, screen, ipcMain, shell, session } = require('electron');
const path = require('path');
const channels = require('../../shared/ipc-channels');

let mainWindow = null;
let bannerView = null;
let seoWindow = null;
let settingsWindow = null;
let currentSnapPosition = null;

const isDev = !require('electron').app.isPackaged;

const BANNER_HEIGHT = 70;
const COUPANG_URL = 'https://ads-partners.coupang.com/widgets.html?id=972878&template=carousel&trackingCode=AF1751405&subId=FCwidget&width=680&height=70';

// ═══ Main Window ═══

function createMainWindow() {
  // Strip CSP headers so Coupang scripts/images can load in the BrowserView
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    delete headers['content-security-policy'];
    delete headers['Content-Security-Policy'];
    callback({ responseHeaders: headers });
  });

  mainWindow = new BrowserWindow({
    icon: path.join(__dirname, '../../assets/icon.png'),
    transparent: false,
    frame: false,
    alwaysOnTop: false,
    skipTaskbar: false,
    width: 960,
    height: 260 + BANNER_HEIGHT,
    minWidth: 400,
    minHeight: 180 + BANNER_HEIGHT,
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

  // Update banner bounds when window resizes
  mainWindow.on('resize', () => {
    _syncBannerBounds();
  });

  mainWindow.on('closed', () => {
    bannerView = null;
    mainWindow = null;
    closeSeoWindow();
    closeSettingsWindow();
  });

  // Attach banner view
  _createBannerView();

  return mainWindow;
}

function getMainWindow() {
  return mainWindow;
}

// ═══ Banner BrowserView ═══

function _createBannerView() {
  if (!mainWindow) return;

  bannerView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
    },
  });

  mainWindow.addBrowserView(bannerView);
  _syncBannerBounds();

  bannerView.webContents.loadURL(COUPANG_URL);

  // Open all links in default system browser, not inside Electron
  bannerView.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  bannerView.webContents.on('will-navigate', (event, url) => {
    // Allow the initial coupang widget URL to load
    if (url.includes('ads-partners.coupang.com/widgets')) return;
    event.preventDefault();
    shell.openExternal(url);
  });

  // Set dark background while loading
  bannerView.setBackgroundColor('#0d1b2a');
}

function _syncBannerBounds() {
  if (!mainWindow || !bannerView) return;
  const { width, height } = mainWindow.getContentBounds();
  bannerView.setBounds({
    x: 0,
    y: height - BANNER_HEIGHT,
    width,
    height: BANNER_HEIGHT,
  });
}

// ═══ Snap ═══

function createSnapBounds(position) {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  const { x: ox, y: oy } = display.workArea;

  const presets = {
    top:    { x: ox, y: oy, width, height: 260 + BANNER_HEIGHT },
    right:  { x: ox + width - 400, y: oy, width: 400, height },
    bottom: { x: ox, y: oy + height - 180 - BANNER_HEIGHT, width, height: 180 + BANNER_HEIGHT },
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

function openSeoWindow({ x, y, width, instructorId }) {
  closeSeoWindow();

  seoWindow = new BrowserWindow({
    x: Math.round(x),
    y: Math.round(y),
    width: width || 240,
    height: 420,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
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

  const hash = `/seo/${instructorId}`;
  if (isDev) {
    seoWindow.loadURL(`http://localhost:5173/#${hash}`);
  } else {
    seoWindow.loadFile(
      path.join(__dirname, '../../dist/renderer/index.html'),
      { hash }
    );
  }

  seoWindow.on('blur', () => {
    closeSeoWindow();
  });

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
  ipcMain.handle(channels.OPEN_SEO_WINDOW, (_, { cardBounds, instructorId }) => {
    if (!mainWindow) return;
    const contentBounds = mainWindow.getContentBounds();
    const screenX = contentBounds.x + cardBounds.x;
    const screenY = contentBounds.y + cardBounds.y + cardBounds.height + 4;
    openSeoWindow({
      x: screenX,
      y: screenY,
      width: Math.max(cardBounds.width, 220),
      instructorId,
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
}

module.exports = {
  createMainWindow,
  getMainWindow,
  createSnapBounds,
  snapWindow,
  openSeoWindow,
  closeSeoWindow,
  openSettingsWindow,
  closeSettingsWindow,
  registerWindowIpc,
};
