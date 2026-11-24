const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('EstimatorDesktop', {
  platform: process.platform,
  isDesktop: true,
  notify: function (payload) {
    ipcRenderer.send('show-notification', payload || {});
  },
  openExternal: function (url) {
    if (url && typeof url === 'string') {
      ipcRenderer.send('open-external', url);
    }
  },
  setUnreadCount: function (count) {
    ipcRenderer.send('set-unread-count', Number(count) || 0);
  },
  syncConfig: function (config) {
    ipcRenderer.send('sync-config', config || {});
  },
  checkLiveUpdate: function () {
    return ipcRenderer.invoke('check-live-update');
  },
  checkAndRefresh: function () {
    return ipcRenderer.invoke('check-and-refresh');
  },
  getLiveUpdateStatus: function () {
    return ipcRenderer.invoke('get-live-update-status');
  },
  onMainAction: function (callback) {
    if (typeof callback !== 'function') return;
    ipcRenderer.on('main-action', function (_event, action, data) {
      callback(action, data);
    });
  }
});
