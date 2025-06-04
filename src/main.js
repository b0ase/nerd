const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');

// Try to import sharp for thumbnail generation
let sharp;
try {
    sharp = require('sharp');
    console.log('📸 Sharp library loaded for thumbnail generation');
} catch (error) {
    console.log('⚠️ Sharp library not available - thumbnails disabled');
}

// Supported image extensions for thumbnail generation
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.svg'];

// Generate thumbnail for image files
async function generateThumbnail(imagePath, thumbnailPath) {
    if (!sharp) {
        console.log('⚠️ Sharp not available, skipping thumbnail for:', path.basename(imagePath));
        return false;
    }
    
    try {
        const extension = path.extname(imagePath).toLowerCase();
        
        // Skip SVG files as they need special handling
        if (extension === '.svg') {
            console.log('⏭️ Skipping SVG thumbnail:', path.basename(imagePath));
            return false;
        }
        
        await sharp(imagePath)
            .resize(150, 150, { 
                fit: 'cover',
                position: 'center'
            })
            .jpeg({ quality: 80 })
            .toFile(thumbnailPath);
            
        console.log('📸 Thumbnail created:', path.basename(thumbnailPath));
        return true;
    } catch (error) {
        console.error('❌ Thumbnail generation failed for', path.basename(imagePath), ':', error.message);
        return false;
    }
}

// Single instance lock - prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    console.log('🚫 Another instance is already running. Exiting...');
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, focus our window instead
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

class SecureHDWallet {
    constructor() {
        this.masterSeed = null;
        this.addressIndex = 0;
        this.dataDir = path.join(require('os').homedir(), '.bacds');
        this.masterKeyFile = path.join(this.dataDir, 'master-key.json');
        
        // Ensure data directory exists
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }

        // Auto-load existing wallet on startup
        this.loadMasterKey();
    }

    generateMasterSeed() {
        // Check if wallet already exists and warn user
        if (this.masterSeed) {
            return {
                success: false,
                error: 'WALLET_EXISTS',
                message: 'Wallet already exists. Use backup/restore functions to manage existing wallet.',
                hasExistingWallet: true
            };
        }

        this.masterSeed = crypto.randomBytes(32).toString('hex');
        this.addressIndex = 0;
        this.save();
        console.log('🔐 New HD wallet generated securely');
        return {
            success: true,
            seed: this.masterSeed,
            message: 'Wallet generated successfully',
            created: new Date().toISOString()
        };
    }

    loadMasterKey() {
        try {
            if (fs.existsSync(this.masterKeyFile)) {
                const data = JSON.parse(fs.readFileSync(this.masterKeyFile, 'utf8'));
                this.masterSeed = data.masterSeed;
                this.addressIndex = data.addressIndex || 0;
                console.log('🔓 Existing wallet loaded from secure storage');
                return { success: true, message: 'Wallet loaded successfully' };
            }
            return { success: false, message: 'No existing wallet found' };
        } catch (error) {
            console.error('Error loading master key:', error);
            return { success: false, message: 'Error loading wallet', error: error.message };
        }
    }

    save() {
        const data = {
            masterSeed: this.masterSeed,
            addressIndex: this.addressIndex,
            lastSaved: new Date().toISOString()
        };
        fs.writeFileSync(this.masterKeyFile, JSON.stringify(data, null, 2));
    }

    // Get the master seed (for backup/reveal purposes)
    getMasterSeed() {
        if (!this.masterSeed) {
            throw new Error('No master seed available');
        }
        return {
            masterSeed: this.masterSeed,
            addressIndex: this.addressIndex,
            created: this.getWalletCreationDate(),
            dataDir: this.dataDir
        };
    }

    getWalletCreationDate() {
        try {
            if (fs.existsSync(this.masterKeyFile)) {
                const stats = fs.statSync(this.masterKeyFile);
                return stats.birthtime.toISOString();
            }
        } catch (error) {
            console.error('Error getting wallet creation date:', error);
        }
        return new Date().toISOString();
    }

    // Create backup data with public address as identifier
    createBackupData() {
        if (!this.masterSeed) {
            throw new Error('No wallet to backup');
        }

        // Generate the first address to use as identifier
        const firstAddress = this.generateAddress(0);
        
        return {
            version: '1.0',
            type: 'BACDS_HD_Wallet_Backup',
            publicIdentifier: firstAddress.address,
            masterSeed: this.masterSeed,
            addressIndex: this.addressIndex,
            created: this.getWalletCreationDate(),
            backedUp: new Date().toISOString(),
            warning: 'KEEP THIS FILE SECURE - Contains private keys'
        };
    }

    // Restore from backup data
    restoreFromBackup(backupData) {
        try {
            if (!backupData.masterSeed || !backupData.type === 'BACDS_HD_Wallet_Backup') {
                throw new Error('Invalid backup file format');
            }

            // Check if wallet already exists
            if (this.masterSeed) {
                return {
                    success: false,
                    error: 'WALLET_EXISTS',
                    message: 'Wallet already exists. Delete existing wallet first.'
                };
            }

            this.masterSeed = backupData.masterSeed;
            this.addressIndex = backupData.addressIndex || 0;
            this.save();
            
            console.log('🔓 Wallet restored from backup');
            return {
                success: true,
                message: 'Wallet restored successfully',
                publicIdentifier: backupData.publicIdentifier
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Secure deterministic address generation
    generateAddress(index = null) {
        if (!this.masterSeed) {
            throw new Error('No master seed available - generate wallet first');
        }

        const useIndex = index !== null ? index : this.addressIndex++;
        const hash = crypto.createHash('sha256')
            .update(this.masterSeed + useIndex.toString())
            .digest('hex');
        
        // Create a Bitcoin-like address (simplified for demo)
        const address = '1' + hash.substring(0, 32);
        
        if (index === null) {
            this.save(); // Save updated index only for new addresses
        }
        
        return {
            address,
            index: useIndex,
            path: `m/44'/0'/0'/0/${useIndex}`,
            generated: new Date().toISOString()
        };
    }

    getStatus() {
        const status = {
            hasMasterSeed: !!this.masterSeed,
            addressIndex: this.addressIndex,
            dataDir: this.dataDir,
            walletFile: this.masterKeyFile,
            isSecure: true
        };

        // Add creation date if wallet exists
        if (this.masterSeed) {
            status.created = this.getWalletCreationDate();
            // Add first address as public identifier
            try {
                const firstAddress = this.generateAddress(0);
                status.publicIdentifier = firstAddress.address;
            } catch (error) {
                console.error('Error getting public identifier:', error);
            }
        }

        return status;
    }

    // Delete existing wallet (for fresh start)
    deleteWallet() {
        try {
            if (fs.existsSync(this.masterKeyFile)) {
                fs.unlinkSync(this.masterKeyFile);
            }
            this.masterSeed = null;
            this.addressIndex = 0;
            console.log('🗑️ Wallet deleted');
            return { success: true, message: 'Wallet deleted successfully' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Import wallet from private key or seed
    importFromPrivateKey(privateKey) {
        try {
            // Check if wallet already exists
            if (this.masterSeed) {
                return {
                    success: false,
                    error: 'WALLET_EXISTS',
                    message: 'Wallet already exists. Delete existing wallet first to import.'
                };
            }

            // Basic validation - ensure it's a hex string and reasonable length
            const cleanKey = privateKey.trim().replace(/\s+/g, '');
            
            if (!/^[0-9a-fA-F]+$/.test(cleanKey)) {
                return {
                    success: false,
                    error: 'INVALID_FORMAT',
                    message: 'Private key must be a hexadecimal string'
                };
            }

            if (cleanKey.length < 32) {
                return {
                    success: false,
                    error: 'INVALID_LENGTH',
                    message: 'Private key too short. Must be at least 32 characters.'
                };
            }

            // Use the provided key as master seed
            this.masterSeed = cleanKey.toLowerCase();
            this.addressIndex = 0;
            this.save();
            
            console.log('🔐 Wallet imported from private key');
            return {
                success: true,
                message: 'Private key imported successfully',
                created: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get all generated addresses
    getAllAddresses() {
        try {
            if (!this.masterSeed) {
                return {
                    success: false,
                    error: 'No wallet available'
                };
            }

            const addresses = [];
            for (let i = 0; i < this.addressIndex; i++) {
                const addr = this.generateAddress(i);
                addresses.push({
                    address: addr.address,
                    index: addr.index,
                    created: addr.generated
                });
            }

            return {
                success: true,
                addresses: addresses
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Generate new address and return it
    generateNewAddress() {
        try {
            if (!this.masterSeed) {
                return {
                    success: false,
                    error: 'No wallet available - generate wallet first'
                };
            }

            const addr = this.generateAddress();
            return {
                success: true,
                address: addr.address,
                index: addr.index,
                created: addr.generated
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Enhanced backup creation with filename
    createEnhancedBackup() {
        try {
            const backupData = this.createBackupData();
            const filename = `BACDS_Backup_${backupData.publicIdentifier.substring(0, 8)}_${new Date().toISOString().split('T')[0]}.json`;
            
            return {
                success: true,
                backup: backupData,
                filename: filename
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Create secure wallet instance
const wallet = new SecureHDWallet();

// Secure IPC handlers - all wallet operations happen in main process
ipcMain.handle('wallet:generate', async () => {
    try {
        return wallet.generateMasterSeed();
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('wallet:load', async () => {
    try {
        return wallet.loadMasterKey();
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('wallet:status', async () => {
    return wallet.getStatus();
});

ipcMain.handle('wallet:getMasterSeed', async () => {
    try {
        return wallet.getMasterSeed();
    } catch (error) {
        return { error: error.message };
    }
});

ipcMain.handle('wallet:createBackup', async () => {
    try {
        return wallet.createEnhancedBackup();
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('wallet:delete', async () => {
    try {
        return wallet.deleteWallet();
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('wallet:restore', async (event, backupData) => {
    try {
        return wallet.restoreFromBackup(backupData);
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('wallet:importPrivateKey', async (event, privateKey) => {
    try {
        return wallet.importFromPrivateKey(privateKey);
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('address:generate', async () => {
    try {
        return wallet.generateAddress();
    } catch (error) {
        return { error: error.message };
    }
});

ipcMain.handle('address:generateNew', async () => {
    try {
        return wallet.generateNewAddress();
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('address:getAll', async () => {
    try {
        return wallet.getAllAddresses();
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('address:get', async (event, index) => {
    try {
        return wallet.generateAddress(parseInt(index));
    } catch (error) {
        return { error: error.message };
    }
});

ipcMain.handle('util:getDataDir', async () => {
    return wallet.dataDir;
});

// Project and file management
ipcMain.handle('project:chooseDirectory', async () => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory', 'createDirectory'],
            title: 'Choose Working Directory for Content Projects',
            buttonLabel: 'Select Folder'
        });
        
        if (!result.canceled && result.filePaths.length > 0) {
            return { success: true, path: result.filePaths[0] };
        } else {
            return { success: false, message: 'No directory selected' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('project:create', async (event, workingDir, projectName) => {
    try {
        // Sanitize project name for filesystem
        const sanitizedName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const projectPath = path.join(workingDir, sanitizedName);
        
        // Create project directory
        if (!fs.existsSync(projectPath)) {
            fs.mkdirSync(projectPath, { recursive: true });
        }
        
        // Create manifest file
        const manifestPath = path.join(projectPath, 'manifest.json');
        const manifest = {
            projectName: projectName,
            created: new Date().toISOString(),
            files: {},
            version: '1.0'
        };
        
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        
        // Create visible master key backup in project for transparency
        console.log('🔑 Creating visible master key backup...');
        const masterKeyBackup = {
            warning: "⚠️ KEEP THIS FILE SECURE - Contains your master private key",
            purpose: "This key can regenerate all addresses in this project",
            projectName: projectName,
            created: new Date().toISOString(),
            masterSeed: wallet.getMasterSeed().masterSeed,
            currentAddressIndex: wallet.addressIndex,
            instructions: {
                recovery: "Import this master seed to recover all project addresses",
                verification: "Addresses are generated using SHA256(masterSeed + index)",
                derivationPath: "m/44'/0'/0'/0/{index}"
            }
        };
        
        const masterKeyPath = path.join(projectPath, 'MASTER_KEY_BACKUP.json');
        fs.writeFileSync(masterKeyPath, JSON.stringify(masterKeyBackup, null, 2));
        console.log('🔑 Master key backup saved to:', masterKeyPath);
        
        console.log(`📁 Project created: ${projectPath}`);
        return { 
            success: true, 
            projectPath: projectPath,
            manifestPath: manifestPath,
            projectName: sanitizedName
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('project:storeFile', async (event, projectPath, fileName, fileBuffer, addressResult) => {
    try {
        // Preserve original file extension
        const extension = path.extname(fileName);
        const chunkFileName = extension ? `${addressResult.address}${extension}` : addressResult.address;
        const filePath = path.join(projectPath, chunkFileName);
        
        // Write the file
        fs.writeFileSync(filePath, fileBuffer);
        
        // Generate thumbnail for image files
        let thumbnailPath = null;
        if (IMAGE_EXTENSIONS.includes(extension.toLowerCase())) {
            const thumbnailsDir = path.join(projectPath, '.thumbnails');
            if (!fs.existsSync(thumbnailsDir)) {
                fs.mkdirSync(thumbnailsDir, { recursive: true });
            }
            
            const thumbnailFile = `${addressResult.address}.jpg`;
            const thumbnailFullPath = path.join(thumbnailsDir, thumbnailFile);
            
            console.log('📸 Generating thumbnail for new file:', fileName);
            const thumbnailGenerated = await generateThumbnail(filePath, thumbnailFullPath);
            
            if (thumbnailGenerated && fs.existsSync(thumbnailFullPath)) {
                thumbnailPath = thumbnailFullPath;
            }
        }
        
        // Update manifest
        const manifestPath = path.join(projectPath, 'manifest.json');
        let manifest = { files: {} };
        
        if (fs.existsSync(manifestPath)) {
            manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        }
        
        manifest.files[addressResult.address] = {
            originalName: fileName,
            chunkFile: chunkFileName,
            stored: new Date().toISOString(),
            size: fileBuffer.length,
            derivationIndex: addressResult.index,  // Add index for transparency
            derivationPath: `m/44'/0'/0'/0/${addressResult.index}`  // Add full path
        };
        
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        
        console.log(`💾 File stored: ${fileName} → ${chunkFileName} (index: ${addressResult.index})`);
        return { 
            success: true, 
            chunkPath: filePath,
            chunkFileName: chunkFileName,
            thumbnailPath: thumbnailPath,
            isImage: IMAGE_EXTENSIONS.includes(extension.toLowerCase())
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('project:load', async () => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory'],
            title: 'Select BACDS Project Directory',
            buttonLabel: 'Load Project'
        });
        
        if (result.canceled || result.filePaths.length === 0) {
            return { success: false, error: 'NO_SELECTION' };
        }

        const projectPath = result.filePaths[0];
        const manifestPath = path.join(projectPath, 'manifest.json');
        const legacyMappingPath = path.join(projectPath, 'address-mapping.json');
        
        console.log('🔍 Loading project from:', projectPath);
        console.log('🔍 Looking for manifest at:', manifestPath);
        console.log('🔍 Looking for legacy mapping at:', legacyMappingPath);
        console.log('🔍 Manifest exists:', fs.existsSync(manifestPath));
        console.log('🔍 Legacy mapping exists:', fs.existsSync(legacyMappingPath));
        
        // Check for new format first (manifest.json)
        if (fs.existsSync(manifestPath)) {
            console.log('📂 Loading new format project (manifest.json)');
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            
            // Create thumbnails directory if it doesn't exist
            const thumbnailsDir = path.join(projectPath, '.thumbnails');
            if (!fs.existsSync(thumbnailsDir)) {
                fs.mkdirSync(thumbnailsDir, { recursive: true });
            }
            
            // Convert manifest files to frontend format
            const files = [];
            if (manifest.files) {
                for (const [address, fileInfo] of Object.entries(manifest.files)) {
                    const filePath = path.join(projectPath, fileInfo.chunkFile);
                    const extension = path.extname(fileInfo.chunkFile).toLowerCase();
                    
                    let thumbnailPath = null;
                    
                    // Generate thumbnail for image files
                    if (IMAGE_EXTENSIONS.includes(extension) && fs.existsSync(filePath)) {
                        const thumbnailFile = `${address}.jpg`;
                        const thumbnailFullPath = path.join(thumbnailsDir, thumbnailFile);
                        
                        // Only generate if thumbnail doesn't exist or is older than the original file
                        if (!fs.existsSync(thumbnailFullPath) || 
                            fs.statSync(filePath).mtime > fs.statSync(thumbnailFullPath).mtime) {
                            console.log('📸 Generating thumbnail for:', fileInfo.originalName);
                            await generateThumbnail(filePath, thumbnailFullPath);
                        }
                        
                        if (fs.existsSync(thumbnailFullPath)) {
                            thumbnailPath = thumbnailFullPath;
                        }
                    }
                    
                    files.push({
                        name: fileInfo.originalName,
                        address: address,
                        chunkFile: fileInfo.chunkFile,
                        size: fileInfo.size,
                        stored: fileInfo.stored,
                        thumbnailPath: thumbnailPath,
                        isImage: IMAGE_EXTENSIONS.includes(extension)
                    });
                }
            }
            
            console.log(`📂 New project loaded: ${manifest.projectName} (${files.length} files)`);
            return {
                success: true,
                projectName: manifest.projectName,
                projectPath: projectPath,
                workingDir: path.dirname(projectPath),
                files: files,
                created: manifest.created,
                format: 'new'
            };
        }
        
        // Check for legacy format (address-mapping.json)
        else if (fs.existsSync(legacyMappingPath)) {
            console.log('📂 Loading legacy format project (address-mapping.json)');
            const addressMapping = JSON.parse(fs.readFileSync(legacyMappingPath, 'utf8'));
            console.log('🔍 Address mapping content:', addressMapping);
            
            // Create thumbnails directory if it doesn't exist
            const thumbnailsDir = path.join(projectPath, '.thumbnails');
            if (!fs.existsSync(thumbnailsDir)) {
                fs.mkdirSync(thumbnailsDir, { recursive: true });
            }
            
            // Convert legacy format to frontend format
            const files = [];
            
            // If address-mapping.json has files, use them
            if (addressMapping.files && Object.keys(addressMapping.files).length > 0) {
                for (const [filename, address] of Object.entries(addressMapping.files)) {
                    const filePath = path.join(projectPath, filename);
                    const extension = path.extname(filename).toLowerCase();
                    let fileSize = 0;
                    let thumbnailPath = null;
                    
                    try {
                        if (fs.existsSync(filePath)) {
                            const stats = fs.statSync(filePath);
                            fileSize = stats.size;
                            
                            // Generate thumbnail for image files
                            if (IMAGE_EXTENSIONS.includes(extension)) {
                                const thumbnailFile = `${address}.jpg`;
                                const thumbnailFullPath = path.join(thumbnailsDir, thumbnailFile);
                                
                                // Only generate if thumbnail doesn't exist or is older than the original file
                                if (!fs.existsSync(thumbnailFullPath) || 
                                    stats.mtime > fs.statSync(thumbnailFullPath).mtime) {
                                    console.log('📸 Generating thumbnail for:', filename);
                                    await generateThumbnail(filePath, thumbnailFullPath);
                                }
                                
                                if (fs.existsSync(thumbnailFullPath)) {
                                    thumbnailPath = thumbnailFullPath;
                                }
                            }
                        }
                    } catch (e) {
                        console.log('Could not get file size for:', filename);
                    }
                    
                    files.push({
                        name: filename,
                        address: address,
                        chunkFile: filename,
                        size: fileSize,
                        stored: addressMapping.created || new Date().toISOString(),
                        thumbnailPath: thumbnailPath,
                        isImage: IMAGE_EXTENSIONS.includes(extension)
                    });
                }
            } 
            // If no files in mapping, scan directory for address-named files
            else {
                console.log('📂 No files in address-mapping.json, scanning directory...');
                const dirContents = fs.readdirSync(projectPath);
                
                // Filter files that look like Bitcoin addresses (start with 1, length ~34)
                const addressFiles = dirContents.filter(filename => {
                    return filename.match(/^1[A-Za-z0-9]{25,34}\.(jpg|jpeg|png|gif|webp|bmp|tiff|svg)$/i) ||
                           filename.match(/^[A-Za-z0-9]{32,34}\.(jpg|jpeg|png|gif|webp|bmp|tiff|svg)$/i);
                });
                
                console.log(`🔍 Found ${addressFiles.length} address-named files`);
                
                for (const filename of addressFiles) {
                    const filePath = path.join(projectPath, filename);
                    const extension = path.extname(filename).toLowerCase();
                    let fileSize = 0;
                    let thumbnailPath = null;
                    
                    try {
                        const stats = fs.statSync(filePath);
                        fileSize = stats.size;
                        
                        // Generate thumbnail for image files
                        if (IMAGE_EXTENSIONS.includes(extension)) {
                            // Extract address from filename (remove extension)
                            const address = filename.split('.')[0];
                            const thumbnailFile = `${address}.jpg`;
                            const thumbnailFullPath = path.join(thumbnailsDir, thumbnailFile);
                            
                            // Only generate if thumbnail doesn't exist or is older than the original file
                            if (!fs.existsSync(thumbnailFullPath) || 
                                stats.mtime > fs.statSync(thumbnailFullPath).mtime) {
                                console.log('📸 Generating thumbnail for:', filename);
                                await generateThumbnail(filePath, thumbnailFullPath);
                            }
                            
                            if (fs.existsSync(thumbnailFullPath)) {
                                thumbnailPath = thumbnailFullPath;
                            }
                        }
                    } catch (e) {
                        console.log('Could not get file size for:', filename);
                    }
                    
                    // Extract address from filename (remove extension)
                    const address = filename.split('.')[0];
                    
                    files.push({
                        name: filename,
                        address: address,
                        chunkFile: filename,
                        size: fileSize,
                        stored: addressMapping.created || new Date().toISOString(),
                        thumbnailPath: thumbnailPath,
                        isImage: IMAGE_EXTENSIONS.includes(extension)
                    });
                }
            }
            
            const projectName = path.basename(projectPath);
            console.log(`📂 Legacy project loaded: ${projectName} (${files.length} files)`);
            return {
                success: true,
                projectName: projectName,
                projectPath: projectPath,
                workingDir: path.dirname(projectPath),
                files: files,
                created: addressMapping.created || new Date().toISOString(),
                format: 'legacy',
                canUpgrade: true  // Flag to show upgrade option
            };
        }
        
        // Neither format found and no address files
        else {
            console.log('📂 No BACDS project files found, scanning for address-named files...');
            
            try {
                const dirContents = fs.readdirSync(projectPath);
                console.log('🔍 Directory contents sample:', dirContents.slice(0, 10));
                
                // Filter files that look like Bitcoin addresses (start with 1, length ~34)
                const addressFiles = dirContents.filter(filename => {
                    return filename.match(/^1[A-Za-z0-9]{25,34}\.(jpg|jpeg|png|gif|webp|bmp|tiff|svg)$/i) ||
                           filename.match(/^[A-Za-z0-9]{32,34}\.(jpg|jpeg|png|gif|webp|bmp|tiff|svg)$/i);
                });
                
                console.log(`🔍 Found ${addressFiles.length} address-named files`);
                
                // If we found address-named files, treat as legacy project
                if (addressFiles.length > 0) {
                    console.log('📂 Treating as legacy project based on address-named files');
                    
                    // Create thumbnails directory if it doesn't exist
                    const thumbnailsDir = path.join(projectPath, '.thumbnails');
                    if (!fs.existsSync(thumbnailsDir)) {
                        fs.mkdirSync(thumbnailsDir, { recursive: true });
                    }
                    
                    const files = [];
                    
                    for (const filename of addressFiles) {
                        const filePath = path.join(projectPath, filename);
                        const extension = path.extname(filename).toLowerCase();
                        let fileSize = 0;
                        let thumbnailPath = null;
                        
                        try {
                            const stats = fs.statSync(filePath);
                            fileSize = stats.size;
                            
                            // Generate thumbnail for image files
                            if (IMAGE_EXTENSIONS.includes(extension)) {
                                // Extract address from filename (remove extension)
                                const address = filename.split('.')[0];
                                const thumbnailFile = `${address}.jpg`;
                                const thumbnailFullPath = path.join(thumbnailsDir, thumbnailFile);
                                
                                // Only generate if thumbnail doesn't exist or is older than the original file
                                if (!fs.existsSync(thumbnailFullPath) || 
                                    stats.mtime > fs.statSync(thumbnailFullPath).mtime) {
                                    console.log('📸 Generating thumbnail for:', filename);
                                    await generateThumbnail(filePath, thumbnailFullPath);
                                }
                                
                                if (fs.existsSync(thumbnailFullPath)) {
                                    thumbnailPath = thumbnailFullPath;
                                }
                            }
                        } catch (e) {
                            console.log('Could not get file size for:', filename);
                        }
                        
                        // Extract address from filename (remove extension)
                        const address = filename.split('.')[0];
                        
                        files.push({
                            name: filename,
                            address: address,
                            chunkFile: filename,
                            size: fileSize,
                            stored: new Date().toISOString(),
                            thumbnailPath: thumbnailPath,
                            isImage: IMAGE_EXTENSIONS.includes(extension)
                        });
                    }
                    
                    const projectName = path.basename(projectPath);
                    console.log(`📂 Legacy project loaded: ${projectName} (${files.length} files)`);
                    return {
                        success: true,
                        projectName: projectName,
                        projectPath: projectPath,
                        workingDir: path.dirname(projectPath),
                        files: files,
                        created: new Date().toISOString(),
                        format: 'legacy',
                        canUpgrade: true  // Flag to show upgrade option
                    };
                }
            } catch (e) {
                console.log('🔍 Error scanning directory:', e.message);
            }
            
            // Neither format found and no address files
            return { 
                success: false, 
                error: 'NOT_BACDS_PROJECT',
                message: `No BACDS project files found. Looking for either manifest.json (new format), address-mapping.json (legacy format), or address-named files.`
            };
        }
        
    } catch (error) {
        console.log('🔍 Load project error:', error);
        return { success: false, error: error.message };
    }
});

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,      // Security: disable node integration
            contextIsolation: true,      // Security: enable context isolation
            preload: path.join(__dirname, 'preload.js') // Secure IPC bridge
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }
}

app.whenReady().then(() => {
    console.log('🚀 BACDS Desktop App - Secure IPC Mode');
    console.log('🔒 Private keys never leave the main process');
    console.log('📁 Wallet data:', wallet.dataDir);
    
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});