const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFiles: () => ipcRenderer.invoke('select-files'),
  selectFolders: () => ipcRenderer.invoke('select-folders'),
  selectOutputFolder: () => ipcRenderer.invoke('select-output-folder'),
  processFiles: (filePaths, outputFolder, shouldDeleteSourceFolders, sourceFolders) => 
    ipcRenderer.invoke('process-files', filePaths, outputFolder, shouldDeleteSourceFolders, sourceFolders),
  generateNewMasterKey: () => ipcRenderer.invoke('generate-new-master-key'),
  importMasterKey: (hexKey) => ipcRenderer.invoke('import-master-key', hexKey),
  getMasterKey: () => ipcRenderer.invoke('get-master-key')
}); 