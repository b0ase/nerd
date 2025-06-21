const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const bip32 = require('bip32');
const bip39 = require('bip39');
const bitcoin = require('bitcoinjs-lib');

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
        this.mnemonic = null;
        this.masterNode = null;
        this.addressCaches = new Map(); // Cache derived addresses
        this.dataDir = path.join(require('os').homedir(), '.bacds');
        this.walletFile = path.join(this.dataDir, 'hd-wallet.json');
        this.isLoading = false;
        this.isLoaded = false;
        this.loadPromise = null; // Track loading promise
        
        // BIP44 derivation paths
        this.paths = {
            // m/44'/0'/0'/0/x - Main receiving addresses (Bitcoin standard)
            receiving: "m/44'/0'/0'/0",
            // m/44'/0'/0'/1/x - Change addresses
            change: "m/44'/0'/0'/1", 
            // m/44'/0'/1'/0/x - Content addresses (custom account)
            content: "m/44'/0'/1'/0",
            // m/44'/0'/2'/0/x - Social addresses (custom account)
            social: "m/44'/0'/2'/0"
        };
        
        // Track usage indices for each path
        this.indices = {
            receiving: 0,
            change: 0,
            content: 0,
            social: 0
        };
        
        // Ensure data directory exists
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }

        // DON'T start wallet loading automatically - only when needed
        console.log('💤 HD wallet ready for on-demand initialization');
    }

    // Lazy initialization - loads wallet in background
    async initializeWalletAsync() {
        if (this.isLoading || this.isLoaded) {
            return this.loadPromise;
        }

        this.isLoading = true;
        this.loadPromise = (async () => {
            try {
                const result = await this.loadWallet();
                this.isLoading = false;
                this.isLoaded = true;
                if (result.success) {
                    console.log('🚀 HD wallet lazy loading completed');
                } else {
                    console.log('💤 No existing wallet found - ready for new wallet creation');
                }
                return result;
            } catch (error) {
                this.isLoading = false;
                console.error('❌ Wallet lazy loading failed:', error);
                return { success: false, error: error.message };
            }
        })();

        return this.loadPromise;
    }

    // Ensure wallet is ready before operations
    async ensureWalletReady() {
        if (this.isLoaded) return true;
        if (this.loadPromise) {
            await this.loadPromise;
        }
        return this.isLoaded;
    }

    generateWallet() {
        // Check if wallet already exists and warn user
        if (this.mnemonic) {
            return {
                success: false,
                error: 'WALLET_EXISTS',
                message: 'HD wallet already exists. Use backup/restore functions to manage existing wallet.',
                hasExistingWallet: true
            };
        }

        try {
            // Generate a 12-word BIP39 mnemonic
            this.mnemonic = bip39.generateMnemonic(128); // 128 bits = 12 words
            
            // Generate master node from mnemonic
            const seed = bip39.mnemonicToSeedSync(this.mnemonic);
            this.masterNode = bip32.fromSeed(seed);
            
            // Reset indices
            this.indices = {
                receiving: 0,
                change: 0,
                content: 0,
                social: 0
            };
            
            // Clear address cache
            this.addressCaches.clear();
            
            this.saveWallet();
            console.log('🔐 New BIP32/BIP44 HD wallet generated with 12-word mnemonic');
            
            return {
                success: true,
                mnemonic: this.mnemonic,
                message: 'HD wallet generated successfully',
                created: new Date().toISOString(),
                publicIdentifier: this.getAddress('receiving', 0)
            };
        } catch (error) {
            console.error('Error generating HD wallet:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async loadWallet() {
        try {
            if (fs.existsSync(this.walletFile)) {
                const data = JSON.parse(fs.readFileSync(this.walletFile, 'utf8'));
                
                // Validate mnemonic and restore master node
                if (data.mnemonic && bip39.validateMnemonic(data.mnemonic)) {
                    this.mnemonic = data.mnemonic;
                    const seed = bip39.mnemonicToSeedSync(this.mnemonic);
                    this.masterNode = bip32.fromSeed(seed);
                    
                    // Load indices
                    this.indices = data.indices || {
                        receiving: 0,
                        change: 0,
                        content: 0,
                        social: 0
                    };
                    
                    // Clear address cache (will be rebuilt on demand)
                    this.addressCaches.clear();
                    
                    console.log('🔓 HD wallet loaded from secure storage');
                    return { success: true, message: 'HD wallet loaded successfully' };
                } else {
                    console.error('❌ Invalid mnemonic in wallet file');
                    return { success: false, message: 'Invalid wallet file - corrupt mnemonic' };
                }
            }
            return { success: false, message: 'No existing HD wallet found' };
        } catch (error) {
            console.error('Error loading HD wallet:', error);
            return { success: false, message: 'Error loading wallet', error: error.message };
        }
    }

    saveWallet() {
        const data = {
            version: '2.0',
            type: 'BACDS_BIP44_HD_Wallet',
            mnemonic: this.mnemonic,
            indices: this.indices,
            created: this.getWalletCreationDate(),
            lastSaved: new Date().toISOString(),
            warning: 'KEEP THIS FILE SECURE - Contains mnemonic seed phrase'
        };
        fs.writeFileSync(this.walletFile, JSON.stringify(data, null, 2));
    }

    // Get address at specific path and index (core HD derivation method)
    getAddress(pathType, index) {
        if (!this.isLoaded) {
            throw new Error('HD wallet not loaded yet - use ensureWalletReady() first');
        }

        if (!this.masterNode) {
            throw new Error('No HD wallet available - generate wallet first');
        }

        const cacheKey = `${pathType}:${index}`;
        
        // Return cached address if available
        if (this.addressCaches.has(cacheKey)) {
            return this.addressCaches.get(cacheKey);
        }

        try {
            // Get the derivation path
            const basePath = this.paths[pathType];
            if (!basePath) {
                throw new Error(`Invalid path type: ${pathType}`);
            }

            // Derive the child node at the specific index
            const fullPath = `${basePath}/${index}`;
            const child = this.masterNode.derivePath(fullPath);
            
            // Generate Bitcoin address (P2PKH format)
            const { address } = bitcoin.payments.p2pkh({ 
                pubkey: child.publicKey,
                network: bitcoin.networks.bitcoin 
            });

            const addressInfo = {
                address,
                path: fullPath,
                index,
                pathType,
                publicKey: child.publicKey.toString('hex'),
                generated: new Date().toISOString()
            };

            // Cache the address
            this.addressCaches.set(cacheKey, addressInfo);

            return addressInfo;
        } catch (error) {
            console.error(`Error deriving address for ${pathType}:${index}:`, error);
            throw error;
        }
    }

    // Generate next address for a specific path type
    async getNextAddress(pathType = 'content') {
        await this.ensureWalletReady();
        
        if (!this.masterNode) {
            throw new Error('No HD wallet available - generate wallet first');
        }

        const currentIndex = this.indices[pathType];
        const addressInfo = this.getAddress(pathType, currentIndex);
        
        // Increment the index for this path type
        this.indices[pathType]++;
        this.saveWallet();

        return addressInfo;
    }

    // Get mnemonic for backup purposes
    getMnemonic() {
        if (!this.mnemonic) {
            throw new Error('No HD wallet available');
        }
        return {
            mnemonic: this.mnemonic,
            indices: { ...this.indices },
            created: this.getWalletCreationDate(),
            dataDir: this.dataDir,
            warning: 'Keep this mnemonic phrase secure - it controls all your addresses'
        };
    }

    getWalletCreationDate() {
        try {
            if (fs.existsSync(this.walletFile)) {
                const stats = fs.statSync(this.walletFile);
                return stats.birthtime.toISOString();
            }
        } catch (error) {
            console.error('Error getting wallet creation date:', error);
        }
        return new Date().toISOString();
    }

    getStatus() {
        const walletFileExists = fs.existsSync(this.walletFile);
        
        const status = {
            hasWallet: walletFileExists && !!this.mnemonic,
            walletType: 'BIP32/BIP44 HD Wallet',
            dataDir: this.dataDir,
            walletFile: this.walletFile,
            isSecure: true,
            isLoading: this.isLoading,
            isLoaded: this.isLoaded,
            indices: { ...this.indices }
        };

        // Handle loading state
        if (this.isLoading) {
            status.loadingStatus = 'Loading HD wallet in background...';
            return status;
        }

        // Handle case where wallet file exists but not loaded yet
        if (walletFileExists && !this.isLoaded && !this.isLoading) {
            status.loadingStatus = 'Wallet file found - click to load';
            status.needsLoading = true;
            return status;
        }

        // Handle case where no wallet exists
        if (!walletFileExists) {
            status.loadingStatus = 'No wallet found - ready for creation';
            return status;
        }

        // Add detailed info if wallet exists and is loaded
        if (this.mnemonic && this.isLoaded) {
            status.created = this.getWalletCreationDate();
            status.totalAddressesGenerated = Object.values(this.indices).reduce((sum, count) => sum + count, 0);
            
            // Get the primary receiving address as public identifier (only if loaded)
            try {
                const primaryAddress = this.getAddress('receiving', 0);
                status.publicIdentifier = primaryAddress.address;
                status.primaryAddress = primaryAddress;
            } catch (error) {
                console.error('Error getting public identifier:', error);
                status.publicIdentifier = 'Error generating identifier';
            }
        }

        return status;
    }

    // Create backup data with mnemonic and public identifier
    createBackupData() {
        if (!this.mnemonic) {
            throw new Error('No HD wallet to backup');
        }

        // Get the primary address as identifier
        const primaryAddress = this.getAddress('receiving', 0);
        
        return {
            version: '2.0',
            type: 'BACDS_BIP44_HD_Wallet_Backup',
            publicIdentifier: primaryAddress.address,
            mnemonic: this.mnemonic,
            indices: { ...this.indices },
            paths: { ...this.paths },
            created: this.getWalletCreationDate(),
            backedUp: new Date().toISOString(),
            warning: 'KEEP THIS FILE SECURE - Contains BIP39 mnemonic seed phrase'
        };
    }

    // Restore from backup data
    restoreFromBackup(backupData) {
        try {
            // Support both old and new backup formats
            const isNewFormat = backupData.type === 'BACDS_BIP44_HD_Wallet_Backup' && backupData.mnemonic;
            const isOldFormat = backupData.type === 'BACDS_HD_Wallet_Backup' && backupData.masterSeed;
            
            if (!isNewFormat && !isOldFormat) {
                throw new Error('Invalid backup file format - unsupported backup type');
            }

            // Check if wallet already exists
            if (this.mnemonic) {
                return {
                    success: false,
                    error: 'WALLET_EXISTS',
                    message: 'HD wallet already exists. Delete existing wallet first.'
                };
            }

            if (isNewFormat) {
                // Restore BIP44 HD wallet
                if (!bip39.validateMnemonic(backupData.mnemonic)) {
                    throw new Error('Invalid mnemonic in backup file');
                }
                
                this.mnemonic = backupData.mnemonic;
                const seed = bip39.mnemonicToSeedSync(this.mnemonic);
                this.masterNode = bip32.fromSeed(seed);
                this.indices = backupData.indices || {
                    receiving: 0,
                    change: 0,
                    content: 0,
                    social: 0
                };
                this.addressCaches.clear();
                console.log('🔓 BIP44 HD wallet restored from backup');
            } else {
                // Convert old format to new HD wallet
                console.log('🔄 Converting old wallet format to BIP44 HD wallet...');
                
                // Generate new mnemonic and warn user
                this.mnemonic = bip39.generateMnemonic(128);
                const seed = bip39.mnemonicToSeedSync(this.mnemonic);
                this.masterNode = bip32.fromSeed(seed);
                this.indices = {
                    receiving: 0,
                    change: 0,
                    content: backupData.addressIndex || 0,
                    social: 0
                };
                this.addressCaches.clear();
                console.log('⚠️ Old format converted - new mnemonic generated');
            }
            
            this.saveWallet();
            console.log('✅ HD wallet restoration completed');
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

    // Legacy method - now redirects to proper HD derivation
    generateAddress(index = null) {
        console.log('⚠️ Using legacy generateAddress method - consider using getAddress() or getNextAddress()');
        
        if (index !== null) {
            // Get specific content address
            return this.getAddress('content', index);
        } else {
            // Generate next content address
            return this.getNextAddress('content');
        }
    }

    // Legacy method for compatibility - redirects to new getStatus
    getStatusLegacy() {
        const status = this.getStatus();
        return {
            hasMasterSeed: status.hasWallet,
            addressIndex: status.indices?.content || 0,
            dataDir: status.dataDir,
            walletFile: status.walletFile,
            isSecure: status.isSecure,
            created: status.created,
            publicIdentifier: status.publicIdentifier
        };
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
        await wallet.ensureWalletReady();
        return wallet.generateWallet();
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
    try {
        console.log('🔍 IPC wallet:status called');
        // Don't wait for wallet to load - return current status immediately
        const status = wallet.getStatus();
        console.log('📊 Wallet status:', status);
        return status;
    } catch (error) {
        console.error('❌ Error getting wallet status:', error);
        return { error: error.message, hasWallet: false, isLoading: false, isLoaded: false };
    }
});

ipcMain.handle('wallet:initializeAsync', async () => {
    try {
        console.log('🔄 IPC wallet:initializeAsync called');
        const result = await wallet.initializeWalletAsync();
        console.log('📊 Wallet initialization result:', result);
        return result;
    } catch (error) {
        console.error('❌ Error initializing wallet:', error);
        return { success: false, error: error.message };
    }
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
        await wallet.ensureWalletReady();
        return await wallet.generateNewAddress();
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

// NERD Daemon management
let nerdDaemonProcess = null;
let nerdDaemonStatus = 'stopped';

ipcMain.handle('daemon:start', async () => {
    try {
        if (nerdDaemonProcess) {
            return { success: false, error: 'Daemon is already running' };
        }

        const { spawn } = require('child_process');
        const daemonPath = path.join(__dirname, '..', 'nerd-daemon-bsv-integrated');
        
        // Check if daemon executable exists
        if (!fs.existsSync(daemonPath)) {
            return { 
                success: false, 
                error: `NERD daemon executable not found at: ${daemonPath}. Please build the daemon first.` 
            };
        }

        console.log('🚀 Starting NERD daemon from:', daemonPath);
        
        // Start the daemon process
        nerdDaemonProcess = spawn(daemonPath, [], {
            cwd: path.join(__dirname, '..'),
            stdio: ['ignore', 'pipe', 'pipe'] // ignore stdin, capture stdout/stderr
        });

        nerdDaemonStatus = 'starting';

        // Handle process output
        nerdDaemonProcess.stdout.on('data', (data) => {
            console.log('[NERD Daemon]:', data.toString().trim());
        });

        nerdDaemonProcess.stderr.on('data', (data) => {
            console.log('[NERD Daemon Error]:', data.toString().trim());
        });

        // Handle process exit
        nerdDaemonProcess.on('exit', (code) => {
            console.log(`[NERD Daemon] Process exited with code ${code}`);
            nerdDaemonProcess = null;
            nerdDaemonStatus = 'stopped';
        });

        nerdDaemonProcess.on('error', (error) => {
            console.error('[NERD Daemon] Process error:', error);
            nerdDaemonProcess = null;
            nerdDaemonStatus = 'error';
        });

        // Wait a bit to see if it starts successfully
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (nerdDaemonProcess && !nerdDaemonProcess.killed) {
            nerdDaemonStatus = 'running';
            return { 
                success: true, 
                message: 'NERD daemon started successfully',
                pid: nerdDaemonProcess.pid
            };
        } else {
            return { success: false, error: 'Daemon failed to start' };
        }

    } catch (error) {
        console.error('Failed to start NERD daemon:', error);
        nerdDaemonProcess = null;
        nerdDaemonStatus = 'error';
        return { success: false, error: error.message };
    }
});

ipcMain.handle('daemon:stop', async () => {
    try {
        if (!nerdDaemonProcess) {
            return { success: false, error: 'Daemon is not running' };
        }

        console.log('🛑 Stopping NERD daemon...');
        nerdDaemonStatus = 'stopping';
        
        // Try graceful shutdown first
        nerdDaemonProcess.kill('SIGTERM');
        
        // Wait up to 5 seconds for graceful shutdown
        await new Promise(resolve => {
            const timeout = setTimeout(() => {
                if (nerdDaemonProcess) {
                    console.log('🔨 Force killing NERD daemon...');
                    nerdDaemonProcess.kill('SIGKILL');
                }
                resolve();
            }, 5000);

            if (nerdDaemonProcess) {
                nerdDaemonProcess.on('exit', () => {
                    clearTimeout(timeout);
                    resolve();
                });
            } else {
                clearTimeout(timeout);
                resolve();
            }
        });

        nerdDaemonProcess = null;
        nerdDaemonStatus = 'stopped';
        
        return { success: true, message: 'NERD daemon stopped successfully' };

    } catch (error) {
        console.error('Failed to stop NERD daemon:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('daemon:status', async () => {
    const status = {
        status: nerdDaemonStatus,
        running: nerdDaemonProcess !== null,
        pid: nerdDaemonProcess ? nerdDaemonProcess.pid : null
    };
    console.log('🔍 IPC daemon:status called, returning:', status);
    return status;
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