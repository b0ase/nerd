const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Wallet operations
    generateWallet: () => ipcRenderer.invoke('wallet:generate'),
    loadWallet: () => ipcRenderer.invoke('wallet:load'),
    getWalletStatus: () => ipcRenderer.invoke('wallet:status'),
    getMasterSeed: () => ipcRenderer.invoke('wallet:getMasterSeed'),
    createBackup: () => ipcRenderer.invoke('wallet:createBackup'),
    deleteWallet: () => ipcRenderer.invoke('wallet:delete'),
    restoreWallet: (backupData) => ipcRenderer.invoke('wallet:restore', backupData),
    importPrivateKey: (privateKey) => ipcRenderer.invoke('wallet:importPrivateKey', privateKey),
    
    // Address operations
    generateAddress: (index) => ipcRenderer.invoke('address:generate', index),
    generateNewAddress: () => ipcRenderer.invoke('address:generateNew'),
    getAllAddresses: () => ipcRenderer.invoke('address:getAll'),
    getAddress: (index) => ipcRenderer.invoke('address:get', index),
    
    // Project and file operations
    chooseDirectory: () => ipcRenderer.invoke('project:chooseDirectory'),
    createProject: (workingDir, projectName) => ipcRenderer.invoke('project:create', workingDir, projectName),
    loadProject: () => ipcRenderer.invoke('project:load'),
    upgradeProject: (projectPath) => ipcRenderer.invoke('project:upgrade', projectPath),
    convertFolderToBACDS: (sourceFolder, destFolder, projectName) => ipcRenderer.invoke('project:convertFolderToBACDS', sourceFolder, destFolder, projectName),
    deleteFolder: (folderPath) => ipcRenderer.invoke('project:deleteFolder', folderPath),
    storeFile: (projectPath, fileName, fileBuffer, address) => ipcRenderer.invoke('project:storeFile', projectPath, fileName, fileBuffer, address),
    
    // Utility operations
    getDataDir: () => ipcRenderer.invoke('util:getDataDir')
}); 