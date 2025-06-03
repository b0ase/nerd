const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFiles: () => ipcRenderer.invoke('select-files'),
  renameFiles: (filePaths) => ipcRenderer.invoke('rename-files', filePaths)
}); 