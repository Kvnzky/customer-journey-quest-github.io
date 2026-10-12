const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  platform: process.platform,
  isElectron: true,
  appVersion: '2.0.0',
  getSharedSettings: () => ipcRenderer.invoke('get-shared-settings'),
  saveSharedSettings: (settings) => ipcRenderer.invoke('save-shared-settings', settings),
  getSharedQuestions: () => ipcRenderer.invoke('get-shared-questions'),
  saveSharedQuestions: (questions) => ipcRenderer.invoke('save-shared-questions', questions)
});
