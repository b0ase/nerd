const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFiles: () => ipcRenderer.invoke('select-files'),
  selectOutputFolder: () => ipcRenderer.invoke('select-output-folder'),
  processFiles: (filePaths, outputFolder) => ipcRenderer.invoke('process-files', filePaths, outputFolder)
}); 