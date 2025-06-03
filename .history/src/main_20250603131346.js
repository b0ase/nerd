const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    visualEffectState: 'active'
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Bitcoin address generation functions
function generateRandomPrivateKey() {
  return crypto.randomBytes(32);
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest();
}

function ripemd160(buffer) {
  return crypto.createHash('ripemd160').update(buffer).digest();
}

function base58Encode(buffer) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let result = '';
  let num = BigInt('0x' + buffer.toString('hex'));
  
  while (num > 0) {
    result = alphabet[num % 58n] + result;
    num = num / 58n;
  }
  
  // Handle leading zeros
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
    result = '1' + result;
  }
  
  return result;
}

function generateBitcoinAddress() {
  // Generate random private key
  const privateKey = generateRandomPrivateKey();
  
  // Create public key (simplified - using the private key as seed for deterministic generation)
  const publicKeyHash = ripemd160(sha256(privateKey));
  
  // Add version byte (0x00 for mainnet)
  const versionedPayload = Buffer.concat([Buffer.from([0x00]), publicKeyHash]);
  
  // Double SHA256 for checksum
  const checksum = sha256(sha256(versionedPayload)).slice(0, 4);
  
  // Combine payload and checksum
  const fullPayload = Buffer.concat([versionedPayload, checksum]);
  
  // Base58 encode
  return base58Encode(fullPayload);
}

// IPC handlers
ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'JPEG Images', extensions: ['jpg', 'jpeg', 'JPG', 'JPEG'] }
    ]
  });
  
  return result.filePaths;
});

ipcMain.handle('rename-files', async (event, filePaths) => {
  const results = [];
  
  for (const filePath of filePaths) {
    try {
      const directory = path.dirname(filePath);
      const extension = path.extname(filePath);
      const bitcoinAddress = generateBitcoinAddress();
      const newFileName = `${bitcoinAddress}${extension}`;
      const newFilePath = path.join(directory, newFileName);
      
      // Check if file with new name already exists
      if (await fs.pathExists(newFilePath)) {
        results.push({
          success: false,
          originalPath: filePath,
          error: 'File with generated address already exists'
        });
        continue;
      }
      
      await fs.rename(filePath, newFilePath);
      
      results.push({
        success: true,
        originalPath: filePath,
        newPath: newFilePath,
        bitcoinAddress: bitcoinAddress
      });
      
    } catch (error) {
      results.push({
        success: false,
        originalPath: filePath,
        error: error.message
      });
    }
  }
  
  return results;
}); 