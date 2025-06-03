const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');

let mainWindow;
let masterSeed = null;
let addressIndex = 0;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
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

// HD Wallet functions
function generateMasterSeed() {
  return crypto.randomBytes(32);
}

function derivePrivateKey(masterSeed, index) {
  // Simple HD derivation (BIP32-inspired but simplified)
  const indexBuffer = Buffer.alloc(4);
  indexBuffer.writeUInt32BE(index, 0);
  const combined = Buffer.concat([masterSeed, indexBuffer]);
  return crypto.createHash('sha256').update(combined).digest();
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

function generateHDBitcoinAddress(index) {
  if (!masterSeed) {
    masterSeed = generateMasterSeed();
  }
  
  // Derive private key for this index
  const privateKey = derivePrivateKey(masterSeed, index);
  
  // Generate public key (simplified - using private key as seed for demo)
  const publicKeyHash = ripemd160(sha256(privateKey));
  
  // Add version byte (0x00 for mainnet)
  const versionedHash = Buffer.concat([Buffer.from([0x00]), publicKeyHash]);
  
  // Calculate checksum
  const checksum = sha256(sha256(versionedHash)).slice(0, 4);
  
  // Combine and encode
  const fullAddress = Buffer.concat([versionedHash, checksum]);
  return base58Encode(fullAddress);
}

// Function to validate if a Bitcoin address belongs to our master key
function validateAddressAgainstMasterKey(address) {
  if (!masterSeed || !address) {
    console.warn('validateAddressAgainstMasterKey: Missing masterSeed or address');
    return { isValid: false, index: -1 };
  }
  
  // Check if it's a valid Bitcoin address format
  const bitcoinAddressPattern = /^1[A-HJ-NP-Z0-9]{25,34}$/;
  if (!bitcoinAddressPattern.test(address)) {
    console.warn(`validateAddressAgainstMasterKey: Invalid address format: ${address}`);
    return { isValid: false, index: -1 };
  }
  
  // Check against first 10000 possible addresses from our master key (increased from 1000)
  for (let i = 0; i < 10000; i++) {
    const testAddress = generateHDBitcoinAddress(i);
    if (testAddress === address) {
      console.log(`validateAddressAgainstMasterKey: Found match for ${address} at index ${i}`);
      return { isValid: true, index: i };
    }
  }
  
  console.warn(`validateAddressAgainstMasterKey: No match found for ${address} in first 10000 indexes`);
  return { isValid: false, index: -1 };
}

// Function to extract Bitcoin address from filename (clean format)
function extractBitcoinAddressFromFilename(filename) {
  const nameWithoutExt = path.parse(filename).name;
  
  // Clean format: just the Bitcoin address
  const bitcoinAddressPattern = /^(1[A-HJ-NP-Z0-9]{25,34})$/;
  const match = nameWithoutExt.match(bitcoinAddressPattern);
  return match ? match[1] : null;
}

// Function to save master key to output folder
async function saveMasterKeyToOutputFolder(outputFolder) {
  if (!masterSeed || !outputFolder) return;
  
  const keyFilePath = path.join(outputFolder, 'master-key.json');
  let existingData = {};
  
  // Load existing data if file exists (to preserve address mappings)
  try {
    if (await fs.pathExists(keyFilePath)) {
      const existingContent = await fs.readFile(keyFilePath, 'utf8');
      existingData = JSON.parse(existingContent);
    }
  } catch (error) {
    console.warn('Could not read existing master key file:', error.message);
  }
  
  const masterKeyData = {
    masterKey: masterSeed.toString('hex'),
    created: existingData.created || new Date().toISOString(),
    version: "1.0",
    description: "HD Master Key for JPEG Renamer - Keep this file safe!",
    addresses: existingData.addresses || {},
    metadata: {
      totalAddresses: existingData.addresses ? Object.keys(existingData.addresses).length : 0,
      lastUpdated: new Date().toISOString(),
      ...existingData.metadata
    }
  };
  
  try {
    await fs.writeFile(keyFilePath, JSON.stringify(masterKeyData, null, 2));
    console.log('Master key saved to:', keyFilePath);
    return keyFilePath;
  } catch (error) {
    console.warn('Failed to save master key:', error.message);
  }
}

// Function to save/update address-to-index mapping (now combined with master key)
async function saveAddressMapping(outputFolder, address, index, filename) {
  const keyFilePath = path.join(outputFolder, 'master-key.json');
  
  try {
    let masterKeyData = {};
    
    // Load existing master key file
    if (await fs.pathExists(keyFilePath)) {
      const existingData = await fs.readFile(keyFilePath, 'utf8');
      masterKeyData = JSON.parse(existingData);
    } else {
      // Initialize if file doesn't exist
      masterKeyData = {
        masterKey: masterSeed ? masterSeed.toString('hex') : '',
        created: new Date().toISOString(),
        version: "1.0",
        description: "HD Master Key for JPEG Renamer - Keep this file safe!",
        addresses: {},
        metadata: {
          totalAddresses: 0,
          lastUpdated: new Date().toISOString()
        }
      };
    }
    
    // Initialize addresses structure if needed
    if (!masterKeyData.addresses) {
      masterKeyData.addresses = {};
    }
    if (!masterKeyData.metadata) {
      masterKeyData.metadata = {
        totalAddresses: 0,
        lastUpdated: new Date().toISOString()
      };
    }
    
    // Add/update the address mapping
    masterKeyData.addresses[address] = {
      derivationIndex: index,
      filename: filename,
      created: new Date().toISOString()
    };
    
    masterKeyData.metadata.lastUpdated = new Date().toISOString();
    masterKeyData.metadata.totalAddresses = Object.keys(masterKeyData.addresses).length;
    
    await fs.writeFile(keyFilePath, JSON.stringify(masterKeyData, null, 2));
    console.log(`✅ Address mapping saved successfully: ${address} -> index ${index} (file: ${filename})`);
    return { success: true, keyFilePath };
  } catch (error) {
    console.error(`❌ Failed to save address mapping for ${address}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Function to load address mapping (now from combined master key file)
async function loadAddressMapping(outputFolder) {
  const keyFilePath = path.join(outputFolder, 'master-key.json');
  
  try {
    if (await fs.pathExists(keyFilePath)) {
      const masterKeyData = await fs.readFile(keyFilePath, 'utf8');
      const parsed = JSON.parse(masterKeyData);
      return {
        addresses: parsed.addresses || {},
        metadata: parsed.metadata || {}
      };
    }
  } catch (error) {
    console.warn('Could not load address mapping from master key file:', error.message);
  }
  
  return { addresses: {}, metadata: {} };
}

// Function to load master key from output folder
async function loadMasterKeyFromOutputFolder(outputFolder) {
  const keyFilePath = path.join(outputFolder, 'master-key.json');
  
  try {
    if (await fs.pathExists(keyFilePath)) {
      const keyData = await fs.readFile(keyFilePath, 'utf8');
      const parsed = JSON.parse(keyData);
      
      if (parsed.masterKey && typeof parsed.masterKey === 'string') {
        const hexKey = parsed.masterKey;
        if (hexKey.length === 64) {
          masterSeed = Buffer.from(hexKey, 'hex');
          addressIndex = 0;
          console.log('Master key loaded from output folder');
          return {
            success: true,
            masterKey: hexKey,
            message: 'Master key loaded from output folder',
            created: parsed.created
          };
        }
      }
    }
  } catch (error) {
    console.warn('Could not load master key from output folder:', error.message);
  }
  
  return { success: false };
}

// Helper function to calculate file hash
async function calculateFileHash(filePath) {
  const fileBuffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

// Recursive function to find all JPEG files
async function findJPEGFiles(dirPath, allFiles = []) {
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      
      if (item.isDirectory()) {
        // Recursively scan subdirectories
        await findJPEGFiles(fullPath, allFiles);
      } else if (item.isFile()) {
        // Check if it's a JPEG file
        const extension = path.extname(item.name).toLowerCase();
        if (['.jpg', '.jpeg'].includes(extension)) {
          allFiles.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.warn(`Could not read directory ${dirPath}:`, error.message);
  }
  
  return allFiles;
}

// IPC handlers
ipcMain.handle('generate-new-master-key', async () => {
  masterSeed = generateMasterSeed();
  addressIndex = 0;
  return {
    masterKey: masterSeed.toString('hex'),
    message: 'New master key generated. Save this key safely!'
  };
});

ipcMain.handle('import-master-key', async (event, hexKey) => {
  try {
    masterSeed = Buffer.from(hexKey, 'hex');
    if (masterSeed.length !== 32) {
      throw new Error('Master key must be exactly 32 bytes (64 hex characters)');
    }
    addressIndex = 0;
    return { success: true, message: 'Master key imported successfully!' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-master-key', async () => {
  if (!masterSeed) {
    masterSeed = generateMasterSeed();
  }
  return masterSeed.toString('hex');
});

ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'JPEG Images', extensions: ['jpg', 'jpeg', 'JPG', 'JPEG'] }
    ]
  });
  
  return result.filePaths;
});

ipcMain.handle('select-folders', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'multiSelections'],
    title: 'Select Folders to Process'
  });
  
  if (result.canceled) return [];
  
  // Find all JPEG files in selected folders
  const allFiles = [];
  for (const folderPath of result.filePaths) {
    const filesInFolder = await findJPEGFiles(folderPath);
    allFiles.push(...filesInFolder);
  }
  
  return {
    folders: result.filePaths,
    files: allFiles
  };
});

ipcMain.handle('select-output-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Output Folder for Renamed Files'
  });
  
  if (result.canceled) return null;
  
  const selectedFolder = result.filePaths[0];
  
  // Check if output folder has an existing master key
  const keyLoadResult = await loadMasterKeyFromOutputFolder(selectedFolder);
  
  return {
    folder: selectedFolder,
    masterKeyFound: keyLoadResult.success,
    masterKeyInfo: keyLoadResult.success ? {
      masterKey: keyLoadResult.masterKey,
      message: keyLoadResult.message,
      created: keyLoadResult.created
    } : null
  };
});

ipcMain.handle('process-files', async (event, filePaths, outputFolder, shouldDeleteSourceFolders = false, sourceFolders = []) => {
  const results = [];
  const processedHashes = new Set();
  
  // Ensure output folder exists
  try {
    await fs.ensureDir(outputFolder);
  } catch (error) {
    return [{
      success: false,
      error: `Failed to create output folder: ${error.message}`
    }];
  }
  
  // Save master key to output folder
  await saveMasterKeyToOutputFolder(outputFolder);
  
  // Load existing address mapping to avoid re-checking known addresses
  const existingMapping = await loadAddressMapping(outputFolder);
  
  // Check existing files in output folder to detect duplicates
  try {
    const existingFiles = await fs.readdir(outputFolder);
    // Clean format: just Bitcoin address + extension
    const bitcoinAddressPattern = /^1[A-HJ-NP-Z0-9]{25,34}\.(jpg|jpeg)$/i;
    
    for (const fileName of existingFiles) {
      if (bitcoinAddressPattern.test(fileName)) {
        const existingFilePath = path.join(outputFolder, fileName);
        try {
          const existingHash = await calculateFileHash(existingFilePath);
          processedHashes.add(existingHash);
          
          // If this file doesn't have a mapping entry, add it
          const address = extractBitcoinAddressFromFilename(fileName);
          if (address && !existingMapping.addresses[address]) {
            const validation = validateAddressAgainstMasterKey(address);
            if (validation.isValid) {
              await saveAddressMapping(outputFolder, address, validation.index, fileName);
              console.log(`Added missing mapping for existing file: ${fileName} -> index ${validation.index}`);
            }
          }
        } catch (error) {
          console.warn(`Could not read existing file ${fileName}:`, error.message);
        }
      }
    }
  } catch (error) {
    console.warn('Could not scan existing files:', error.message);
  }
  
  // Process each file
  for (const filePath of filePaths) {
    try {
      // Calculate hash of the input file
      const fileHash = await calculateFileHash(filePath);
      
      // Check if we've already processed this exact file content
      if (processedHashes.has(fileHash)) {
        results.push({
          success: false,
          originalPath: filePath,
          error: 'Duplicate file - this image has already been processed',
          isDuplicate: true
        });
        continue;
      }
      
      const originalFileName = path.basename(filePath);
      const extension = path.extname(filePath);
      
      // Check if filename already has a Bitcoin address
      const existingAddress = extractBitcoinAddressFromFilename(originalFileName);
      let needsRename = true;
      let renameReason = 'No Bitcoin address in filename';
      
      if (existingAddress) {
        console.log(`Found existing address in filename: ${existingAddress}`);
        const validation = validateAddressAgainstMasterKey(existingAddress);
        if (validation.isValid) {
          // Address is valid for our master key, just copy it
          const newFilePath = path.join(outputFolder, originalFileName);
          
          // Check if destination already exists
          if (await fs.pathExists(newFilePath)) {
            renameReason = 'File with same address already exists in output folder';
            needsRename = true;
            console.log(`File with address ${existingAddress} already exists in output folder, will rename`);
          } else {
            await fs.copy(filePath, newFilePath);
            processedHashes.add(fileHash);
            
            // Always save address mapping for valid addresses
            console.log(`Saving address mapping for valid existing address: ${existingAddress} -> index ${validation.index}`);
            const mappingResult = await saveAddressMapping(outputFolder, existingAddress, validation.index, originalFileName);
            
            results.push({
              success: true,
              originalPath: filePath,
              newPath: newFilePath,
              bitcoinAddress: existingAddress,
              derivationIndex: validation.index,
              outputFolder: outputFolder,
              action: 'copied_existing_address',
              message: `File already had valid address (index ${validation.index}) - mapping saved`
            });
            continue;
          }
        } else {
          renameReason = 'Bitcoin address does not match current master key';
          console.log(`Existing address ${existingAddress} does not match current master key, will rename`);
        }
      }
      
      // Generate new Bitcoin address if needed
      if (needsRename) {
        const bitcoinAddress = generateHDBitcoinAddress(addressIndex);
        const newFileName = `${bitcoinAddress}${extension}`;
        const newFilePath = path.join(outputFolder, newFileName);
        
        // Check if file with new name already exists (very unlikely with HD addresses)
        if (await fs.pathExists(newFilePath)) {
          let attempts = 0;
          let uniqueAddress = bitcoinAddress;
          let uniqueIndex = addressIndex;
          let uniqueNewFilePath = newFilePath;
          
          while (await fs.pathExists(uniqueNewFilePath) && attempts < 10) {
            addressIndex++;
            uniqueIndex = addressIndex;
            uniqueAddress = generateHDBitcoinAddress(addressIndex);
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
          newFileName = `${uniqueAddress}${extension}`;
        }
        
        // Copy the file to the new location with Bitcoin address name
        await fs.copy(filePath, newFilePath);
        processedHashes.add(fileHash);
        
        // Save address mapping
        await saveAddressMapping(outputFolder, bitcoinAddress, addressIndex, newFileName);
        
        results.push({
          success: true,
          originalPath: filePath,
          newPath: newFilePath,
          bitcoinAddress: bitcoinAddress,
          derivationIndex: addressIndex,
          outputFolder: outputFolder,
          action: existingAddress ? 'renamed_invalid_address' : 'renamed_no_address',
          message: renameReason,
          previousAddress: existingAddress || 'None'
        });
        
        // Increment address index for next file
        addressIndex++;
      }
      
    } catch (error) {
      results.push({
        success: false,
        originalPath: filePath,
        error: error.message
      });
    }
  }
  
  // Delete source folders if requested and processing was successful
  if (shouldDeleteSourceFolders && sourceFolders.length > 0) {
    const successfulFiles = results.filter(r => r.success).length;
    if (successfulFiles > 0) {
      const folderDeletionResults = [];
      
      for (const folderPath of sourceFolders) {
        try {
          await fs.remove(folderPath);
          folderDeletionResults.push({
            success: true,
            folderPath: folderPath,
            message: 'Folder deleted successfully'
          });
        } catch (error) {
          folderDeletionResults.push({
            success: false,
            folderPath: folderPath,
            error: error.message
          });
        }
      }
      
      results.push({
        folderDeletion: true,
        folderResults: folderDeletionResults
      });
    }
  }
  
  return results;
});

ipcMain.handle('rebuild-address-mapping', async (event, outputFolder) => {
  if (!outputFolder) {
    return { success: false, error: 'No output folder specified' };
  }
  
  try {
    // Load existing master key from folder
    const keyLoadResult = await loadMasterKeyFromOutputFolder(outputFolder);
    if (!keyLoadResult.success) {
      return { success: false, error: 'No master key found in output folder' };
    }
    
    // Clear existing address mappings in the master key file
    const keyFilePath = path.join(outputFolder, 'master-key.json');
    let masterKeyData = {};
    
    if (await fs.pathExists(keyFilePath)) {
      const existingData = await fs.readFile(keyFilePath, 'utf8');
      masterKeyData = JSON.parse(existingData);
    }
    
    // Clear addresses but keep master key data
    masterKeyData.addresses = {};
    masterKeyData.metadata = {
      ...masterKeyData.metadata,
      totalAddresses: 0,
      lastUpdated: new Date().toISOString()
    };
    
    // Scan all Bitcoin address files
    const existingFiles = await fs.readdir(outputFolder);
    const bitcoinAddressPattern = /^1[A-HJ-NP-Z0-9]{25,34}\.(jpg|jpeg)$/i;
    let rebuiltCount = 0;
    let errorCount = 0;
    
    for (const fileName of existingFiles) {
      if (bitcoinAddressPattern.test(fileName)) {
        const address = extractBitcoinAddressFromFilename(fileName);
        if (address) {
          const validation = validateAddressAgainstMasterKey(address);
          if (validation.isValid) {
            await saveAddressMapping(outputFolder, address, validation.index, fileName);
            rebuiltCount++;
            console.log(`Rebuilt mapping: ${fileName} -> index ${validation.index}`);
          } else {
            errorCount++;
            console.warn(`File ${fileName} has address that doesn't match master key`);
          }
        }
      }
    }
    
    return {
      success: true,
      rebuiltCount: rebuiltCount,
      errorCount: errorCount,
      message: `Rebuilt mappings for ${rebuiltCount} files${errorCount > 0 ? `, ${errorCount} files had invalid addresses` : ''}`
    };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Function to generate public address mapping (shareable, no private key)
async function generatePublicAddressMapping(outputFolder) {
  const keyFilePath = path.join(outputFolder, 'master-key.json');
  const publicMappingPath = path.join(outputFolder, 'public-addresses.json');
  
  try {
    if (await fs.pathExists(keyFilePath)) {
      const masterKeyData = await fs.readFile(keyFilePath, 'utf8');
      const parsed = JSON.parse(masterKeyData);
      
      const publicMapping = {
        version: "1.0",
        description: "Public Bitcoin address mapping - safe to share",
        collection: {
          name: "JPEG Collection", // Could be customizable
          created: parsed.created,
          totalAddresses: parsed.metadata?.totalAddresses || 0,
          lastUpdated: new Date().toISOString()
        },
        addresses: {}
      };
      
      // Copy address mappings without exposing master key
      if (parsed.addresses) {
        for (const [address, data] of Object.entries(parsed.addresses)) {
          publicMapping.addresses[address] = {
            filename: data.filename,
            derivationIndex: data.derivationIndex,
            created: data.created,
            // Future: could add metadata like file size, hash, price, license, etc.
            fileHash: null, // Placeholder for future content verification
            contentType: "image/jpeg",
            // Fog computing endpoints (placeholder for future IPv6 integration)
            endpoints: []
          };
        }
      }
      
      await fs.writeFile(publicMappingPath, JSON.stringify(publicMapping, null, 2));
      console.log(`✅ Public address mapping generated: ${publicMappingPath}`);
      return { success: true, publicMappingPath, totalAddresses: Object.keys(publicMapping.addresses).length };
    }
  } catch (error) {
    console.error('❌ Failed to generate public address mapping:', error.message);
    return { success: false, error: error.message };
  }
  
  return { success: false, error: 'Master key file not found' };
} 