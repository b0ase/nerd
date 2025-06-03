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

ipcMain.handle('select-output-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Output Folder for Renamed Files'
  });
  
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('process-files', async (event, filePaths, outputFolder) => {
  const results = [];
  
  // Ensure output folder exists
  try {
    await fs.ensureDir(outputFolder);
  } catch (error) {
    return [{
      success: false,
      error: `Failed to create output folder: ${error.message}`
    }];
  }
  
  for (const filePath of filePaths) {
    try {
      const extension = path.extname(filePath);
      const bitcoinAddress = generateBitcoinAddress();
      const newFileName = `${bitcoinAddress}${extension}`;
      const newFilePath = path.join(outputFolder, newFileName);
      
      // Check if file with new name already exists in output folder
      if (await fs.pathExists(newFilePath)) {
        // Generate a new address if there's a collision (very unlikely but possible)
        let attempts = 0;
        let uniqueAddress = bitcoinAddress;
        let uniqueNewFilePath = newFilePath;
        
        while (await fs.pathExists(uniqueNewFilePath) && attempts < 10) {
          uniqueAddress = generateBitcoinAddress();
          const uniqueFileName = `${uniqueAddress}${extension}`;
          uniqueNewFilePath = path.join(outputFolder, uniqueFileName);
          attempts++;
        }
        
        if (attempts >= 10) {
          results.push({
            success: false,
            originalPath: filePath,
            error: 'Could not generate unique Bitcoin address after 10 attempts'
          });
          continue;
        }
        
        bitcoinAddress = uniqueAddress;
        newFilePath = uniqueNewFilePath;
      }
      
      // Copy the file to the new location with Bitcoin address name
      await fs.copy(filePath, newFilePath);
      
      results.push({
        success: true,
        originalPath: filePath,
        newPath: newFilePath,
        bitcoinAddress: bitcoinAddress,
        outputFolder: outputFolder
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