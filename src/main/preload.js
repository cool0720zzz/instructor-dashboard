const { contextBridge, ipcRenderer } = require('electron');
const channels = require('../../shared/ipc-channels');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  closeWindow: () => ipcRenderer.invoke('close-window'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  snapWindow: (position) => ipcRenderer.invoke(channels.SNAP_WINDOW, position),
  setOpacity: (value) => ipcRenderer.invoke(channels.SET_OPACITY, value), // float 0.0-1.0

  // SEO floating window
  openSeoWindow: (data) => ipcRenderer.invoke(channels.OPEN_SEO_WINDOW, data),
  closeSeoWindow: () => ipcRenderer.invoke(channels.CLOSE_SEO_WINDOW),

  // License
  validateLicense: (licenseKey) => ipcRenderer.invoke(channels.VALIDATE_LICENSE, licenseKey),

  // Data
  getDashboardData: () => ipcRenderer.invoke(channels.GET_DASHBOARD_DATA),
  getSeoResults: (instructorId) => ipcRenderer.invoke(channels.GET_SEO_RESULTS, instructorId),

  // Actions
  triggerRssRefresh: () => ipcRenderer.invoke(channels.TRIGGER_RSS_REFRESH),
  triggerSeoAnalyze: (postId) => ipcRenderer.invoke(channels.TRIGGER_SEO_ANALYZE, postId),
  triggerWeeklyCheck: () => ipcRenderer.invoke(channels.TRIGGER_WEEKLY_CHECK),

  // UI Settings
  getUiSettings: () => ipcRenderer.invoke(channels.GET_UI_SETTINGS),
  setUiSettings: (settings) => ipcRenderer.invoke(channels.SET_UI_SETTINGS, settings),

  // Settings window (separate BrowserWindow)
  openSettingsWindow: () => ipcRenderer.invoke('open-settings-window'),
  closeSettingsWindow: () => ipcRenderer.invoke('close-settings-window'),

  // Open external URL
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Auto-resize window to fit instructor cards
  resizeToFit: (count) => ipcRenderer.invoke(channels.RESIZE_TO_FIT, count),

  // Layout change listener
  onLayoutChange: (callback) => {
    const handler = (_, layout) => callback(layout);
    ipcRenderer.on('layout-change', handler);
    return () => ipcRenderer.removeListener('layout-change', handler);
  },

  // Collection status
  getCollectionStatus: () => ipcRenderer.invoke('get-collection-status'),
  onCollectionStatus: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('collection-status', handler);
    return () => ipcRenderer.removeListener('collection-status', handler);
  },

  // Event listeners
  onLicenseActivated: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('license-activated', handler);
    return () => ipcRenderer.removeListener('license-activated', handler);
  },

  onWeeklyCheckDone: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on(channels.WEEKLY_CHECK_DONE, handler);
    return () => ipcRenderer.removeListener(channels.WEEKLY_CHECK_DONE, handler);
  },

  // App version
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Auto-update
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateAvailable: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('update-available', handler);
    return () => ipcRenderer.removeListener('update-available', handler);
  },
  onUpdateDownloaded: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('update-downloaded', handler);
    return () => ipcRenderer.removeListener('update-downloaded', handler);
  },
  onUpdateStatusChanged: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('update-status-changed', handler);
    return () => ipcRenderer.removeListener('update-status-changed', handler);
  },

  // Update notes
  onShowUpdateNotes: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('show-update-notes', handler);
    return () => ipcRenderer.removeListener('show-update-notes', handler);
  },
});
