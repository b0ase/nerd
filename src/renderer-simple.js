// BACDS Frontend - Content Network with HD Wallet

class BACDSClient {
    constructor() {
        this.walletStatus = null;
        this.addresses = [];
        this.files = [];
        this.currentProject = null;  // { path, name, workingDir }
        this.init();
    }

    init() {
        console.log('🚀 BACDS Content Network initializing...');
        console.log('🔒 Wallet operations secured via IPC');
        console.log('🔌 electronAPI check:', !!window.electronAPI);
        
        // Wallet listeners
        document.getElementById('generateWallet').addEventListener('click', () => this.generateWallet());
        document.getElementById('loadWallet').addEventListener('click', () => this.loadWallet());
        document.getElementById('showImport').addEventListener('click', () => this.showImportSection());
        document.getElementById('deleteWallet').addEventListener('click', () => this.deleteWallet());
        document.getElementById('backupWallet').addEventListener('click', () => this.createBackup());
        document.getElementById('restoreWallet').addEventListener('click', () => this.restoreWallet());
        
        // Project listeners
        document.getElementById('chooseWorkingDir').addEventListener('click', () => this.chooseWorkingDirectory());
        document.getElementById('createProject').addEventListener('click', () => this.createProject());
        
        // File listeners
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileSelection(e));
        const dropZone = document.getElementById('fileDropZone');
        dropZone.addEventListener('click', () => document.getElementById('fileInput').click());
        dropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
        dropZone.addEventListener('drop', (e) => this.handleFileDrop(e));
        
        // Address listeners
        document.getElementById('newAddress').addEventListener('click', () => this.generateNewAddress());
        document.getElementById('showAddresses').addEventListener('click', () => this.showAllAddresses());
        
        this.loadWalletStatus();
        
        // Initialize empty states for all sections
        this.updateAddressList();
        this.updateFileList();
        this.updateMappingList();
    }

    async loadWalletStatus() {
        const statusDiv = document.getElementById('walletStatus');
        
        // Check if electronAPI is available
        if (!window.electronAPI) {
            console.error('❌ electronAPI not available - preload script issue');
            statusDiv.innerHTML = `
                <div class="error">
                    ❌ IPC Bridge not loaded<br>
                    <small>Preload script failed to initialize</small>
                </div>
            `;
            return;
        }
        
        try {
            console.log('🔄 Starting wallet status load...');
            
            // Add timeout to prevent infinite hanging
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout after 5 seconds')), 5000)
            );
            
            const statusPromise = window.electronAPI.getWalletStatus();
            
            this.walletStatus = await Promise.race([statusPromise, timeoutPromise]);
            console.log('📊 Wallet status received:', this.walletStatus);
            
            this.updateWalletDisplay();
            console.log('✅ Wallet status loaded successfully');
        } catch (error) {
            console.error('❌ Failed to load wallet status:', error);
            statusDiv.innerHTML = `
                <div class="error">
                    ❌ Unable to connect to wallet service<br>
                    <small>Error: ${error.message}</small>
                </div>
            `;
        }
    }

    updateWalletDisplay() {
        const statusDiv = document.getElementById('walletStatus');
        if (this.walletStatus.hasMasterSeed) {
            const createdDate = this.walletStatus.created ? 
                new Date(this.walletStatus.created).toLocaleString() : 'Unknown';
            
            statusDiv.innerHTML = `
                <div class="wallet-info">
                    <div class="status-item status-online">
                        <span class="icon">✅</span>
                        <span>Wallet ready</span>
                    </div>
                    <div class="status-item">
                        <span class="icon">🆔</span>
                        <span>ID: ${this.walletStatus.publicIdentifier || 'Generating...'}</span>
                    </div>
                    <div class="status-item">
                        <span class="icon">📅</span>
                        <span>Created: ${createdDate}</span>
                    </div>
                    <div class="status-item">
                        <span class="icon">📍</span>
                        <span>Address Index: ${this.walletStatus.addressIndex}</span>
                    </div>
                    <div class="status-item">
                        <span class="icon">🔒</span>
                        <span>Security: ${this.walletStatus.isSecure ? 'Enabled' : 'Disabled'}</span>
                    </div>
                    <div class="status-item">
                        <span class="icon">📁</span>
                        <span>Data: ${this.walletStatus.dataDir}</span>
                    </div>
                    
                    <div class="master-seed-section">
                        <div class="master-seed-header">
                            <span>🔑 Recovery Key</span>
                            <button id="revealSeed" class="btn small secondary">Show</button>
                        </div>
                        <div class="master-seed-display" id="masterSeedDisplay">
                            <span class="seed-hidden">••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••</span>
                        </div>
                    </div>
                </div>
            `;

            // Add event listener for reveal button
            document.getElementById('revealSeed').addEventListener('click', () => {
                this.toggleSeedVisibility();
            });
        } else {
            statusDiv.innerHTML = `
                <div class="wallet-info">
                    <div class="status-item status-offline">
                        <span class="icon">❌</span>
                        <span>No wallet found</span>
                    </div>
                    <div class="status-item">
                        <span class="icon">ℹ️</span>
                        <span>Create a new wallet to get started</span>
                    </div>
                    <div class="status-item status-online">
                        <span class="icon">🔒</span>
                        <span>Private keys stored securely</span>
                    </div>
                </div>
            `;
        }
    }

    async toggleSeedVisibility() {
        const button = document.getElementById('revealSeed');
        const display = document.getElementById('masterSeedDisplay');
        
        if (button.textContent === 'Show') {
            try {
                const result = await window.electronAPI.getMasterSeed();
                if (result.error) {
                    this.showMessage(`❌ ${result.error}`, 'error');
                    return;
                }
                
                display.innerHTML = `
                    <div class="seed-revealed">
                        <div class="seed-value">${result.masterSeed}</div>
                        <button class="btn small success" onclick="copyToClipboard('${result.masterSeed}')">Copy</button>
                    </div>
                `;
                button.textContent = 'Hide';
                button.classList.remove('secondary');
                button.classList.add('danger');
                this.showMessage('⚠️ Recovery key is visible - keep it safe!', 'info');
            } catch (error) {
                this.showMessage('❌ Unable to access recovery key', 'error');
            }
        } else {
            display.innerHTML = '<span class="seed-hidden">••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••</span>';
            button.textContent = 'Show';
            button.classList.remove('danger');
            button.classList.add('secondary');
        }
    }

    showImportSection() {
        const importSection = document.getElementById('importSection');
        importSection.style.display = 'block';
        document.getElementById('privateKeyInput').focus();
        
        // Add event listeners for import buttons
        document.getElementById('importFromKey').addEventListener('click', () => this.importFromPrivateKey());
        document.getElementById('cancelImport').addEventListener('click', () => this.hideImportSection());
        
        this.showMessage('💡 Import mode activated', 'info');
    }

    hideImportSection() {
        const importSection = document.getElementById('importSection');
        importSection.style.display = 'none';
        document.getElementById('privateKeyInput').value = '';
        this.showMessage('🔒 Import mode closed', 'info');
    }

    async importFromPrivateKey() {
        const privateKeyInput = document.getElementById('privateKeyInput');
        const privateKey = privateKeyInput.value.trim();

        if (!privateKey) {
            this.showMessage('❌ Please enter a private key', 'error');
            return;
        }

        // Validate private key format (basic validation)
        if (privateKey.length < 32) {
            this.showMessage('❌ Private key appears to be too short', 'error');
            return;
        }

        try {
            this.showMessage('🔐 Importing private key...', 'info');
            
            const result = await window.electronAPI.importPrivateKey(privateKey);
            
            if (result.success) {
                this.showMessage('✅ Private key imported successfully', 'success');
                this.hideImportSection();
                await this.loadWalletStatus();
            } else {
                this.showMessage(`❌ Import failed: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error importing private key:', error);
            this.showMessage('❌ Error during import', 'error');
        }
    }

    async generateWallet() {
        try {
            this.showMessage('🔐 Creating new wallet...', 'info');
            const result = await window.electronAPI.generateWallet();
            
            if (result.success) {
                this.showMessage('✅ Wallet created successfully!', 'success');
                console.log('🔒 Private keys secured locally');
                await this.loadWalletStatus();
            } else if (result.error === 'WALLET_EXISTS') {
                this.showMessage('⚠️ Wallet already exists! Use backup/restore to manage existing wallets.', 'error');
            } else {
                this.showMessage(`❌ Wallet creation failed: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error generating wallet:', error);
            this.showMessage('❌ Error creating wallet', 'error');
        }
    }

    async loadWallet() {
        try {
            this.showMessage('🔓 Loading wallet...', 'info');
            await this.loadWalletStatus();
            this.showMessage('✅ Wallet loaded successfully!', 'success');
        } catch (error) {
            console.error('Error loading wallet:', error);
            this.showMessage('❌ Error loading wallet', 'error');
        }
    }

    async deleteWallet() {
        const confirmed = confirm(
            '⚠️ Delete Wallet\n\n' +
            'This will permanently delete your wallet and all data.\n' +
            'This action cannot be undone!\n\n' +
            'Are you sure you want to proceed?'
        );
        
        if (!confirmed) {
            this.showMessage('🔒 Wallet deletion cancelled', 'info');
            return;
        }

        try {
            this.showMessage('💥 Deleting wallet...', 'info');
            const result = await window.electronAPI.deleteWallet();
            
            if (result.success) {
                this.showMessage('✅ Wallet deleted successfully', 'success');
                console.log('🔒 Wallet deleted securely');
                await this.loadWalletStatus();
            } else {
                this.showMessage(`❌ Deletion failed: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error deleting wallet:', error);
            this.showMessage('❌ Error during deletion', 'error');
        }
    }

    async createBackup() {
        try {
            this.showMessage('📦 Creating backup...', 'info');
            const result = await window.electronAPI.createBackup();
            
            if (result.success) {
                this.downloadJSON(result.backup, result.filename);
                this.showMessage(`✅ Backup saved: ${result.filename}`, 'success');
                console.log('🔒 Backup created securely');
            } else {
                this.showMessage(`❌ ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error creating backup:', error);
            this.showMessage('❌ Error creating backup', 'error');
        }
    }

    async restoreWallet() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                this.restoreWallet(file);
            }
        };
        input.click();
    }

    async restoreWallet(file) {
        try {
            this.showMessage('📂 Restoring from backup...', 'info');
            
            const text = await file.text();
            const backupData = JSON.parse(text);
            
            const result = await window.electronAPI.restoreWallet(backupData);
            
            if (result.success) {
                this.showMessage('✅ Wallet restored successfully!', 'success');
                console.log('🔒 Wallet restored securely');
                await this.loadWalletStatus();
            } else {
                this.showMessage(`❌ Restoration failed: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error restoring wallet:', error);
            if (error instanceof SyntaxError) {
                this.showMessage('❌ Invalid backup file format', 'error');
            } else {
                this.showMessage('❌ Error during restoration', 'error');
            }
        }
    }

    async generateNewAddress() {
        try {
            this.showMessage('⚡ Generating new address...', 'info');
            const result = await window.electronAPI.generateNewAddress();
            
            if (result.success) {
                this.showMessage(`✅ New address: ${result.address}`, 'success');
                console.log('🔒 New address generated securely');
                
                this.addresses.push({
                    address: result.address,
                    index: result.index,
                    created: new Date().toISOString()
                });
                this.updateAddressList();
            } else {
                this.showMessage(`❌ Address generation failed: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error generating address:', error);
            this.showMessage('❌ Error generating address', 'error');
        }
    }

    async showAllAddresses() {
        try {
            this.showMessage('📋 Loading addresses...', 'info');
            const result = await window.electronAPI.getAllAddresses();
            
            if (result.success) {
                this.addresses = result.addresses || [];
                this.updateAddressList();
                this.showMessage(`✅ ${this.addresses.length} addresses loaded`, 'success');
            } else {
                this.showMessage(`❌ Failed to load addresses: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error loading addresses:', error);
            this.showMessage('❌ Error loading addresses', 'error');
        }
    }

    updateAddressList() {
        const addressList = document.getElementById('addressList');
        
        if (this.addresses.length === 0) {
            addressList.innerHTML = '<div class="empty-state">No addresses generated yet</div>';
            return;
        }

        addressList.innerHTML = this.addresses.map(addr => `
            <div class="address-item">
                <div class="address">${addr.address}</div>
                <div class="address-meta">Index: ${addr.index} • Created: ${new Date(addr.created).toLocaleString()}</div>
            </div>
        `).join('');
    }

    // Project Management
    async chooseWorkingDirectory() {
        try {
            this.showMessage('📁 Opening directory selector...', 'info');
            const result = await window.electronAPI.chooseDirectory();
            
            if (result.success) {
                this.currentProject = { workingDir: result.path, name: null, path: null };
                this.updateProjectStatus();
                this.showMessage(`📂 Directory selected: ${result.path}`, 'success');
            } else {
                this.showMessage('❌ No directory selected', 'info');
            }
        } catch (error) {
            console.error('Error choosing directory:', error);
            this.showMessage('❌ Error selecting directory', 'error');
        }
    }

    async createProject() {
        const projectName = document.getElementById('projectName').value.trim();
        
        if (!this.currentProject?.workingDir) {
            this.showMessage('❌ Please choose a working directory first', 'error');
            return;
        }
        
        if (!projectName) {
            this.showMessage('❌ Please enter a project name', 'error');
            return;
        }

        try {
            this.showMessage('🎨 Creating project...', 'info');
            const result = await window.electronAPI.createProject(this.currentProject.workingDir, projectName);
            
            if (result.success) {
                this.currentProject.name = result.projectName;
                this.currentProject.path = result.projectPath;
                this.updateProjectStatus();
                document.getElementById('fileUploadSection').style.display = 'block';
                this.showMessage(`✅ Project "${projectName}" created!`, 'success');
                document.getElementById('projectName').value = '';
            } else {
                this.showMessage(`❌ Project creation failed: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error creating project:', error);
            this.showMessage('❌ Error creating project', 'error');
        }
    }

    updateProjectStatus() {
        const statusEl = document.getElementById('projectStatus');
        
        if (this.currentProject?.path) {
            statusEl.innerHTML = `
                <div class="project-active">
                    ✅ Active Project: ${this.currentProject.name}
                    <div class="project-path">${this.currentProject.path}</div>
                </div>
            `;
            statusEl.className = 'project-status project-active';
        } else if (this.currentProject?.workingDir) {
            statusEl.innerHTML = `
                <div>📂 Working Directory: ${this.currentProject.workingDir}
                <br>Enter project name and click "Create Project"</div>
            `;
            statusEl.className = 'project-status';
        } else {
            statusEl.innerHTML = `
                <div class="empty-state">No project selected - choose a directory and name your content project</div>
            `;
            statusEl.className = 'project-status';
        }
    }

    // File Handling
    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('dragover');
    }

    handleFileDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        this.handleFiles(e.dataTransfer.files);
    }

    handleFileSelection(e) {
        this.handleFiles(e.target.files);
    }

    async handleFiles(files) {
        if (!this.currentProject?.path) {
            this.showMessage('❌ Please create a project first', 'error');
            return;
        }

        if (!this.walletStatus?.wallet || this.walletStatus.addresses.length === 0) {
            this.showMessage('❌ Please generate wallet and addresses first', 'error');
            return;
        }

        for (let file of files) {
            await this.processFile(file);
        }
    }

    async processFile(file) {
        try {
            // Generate new address for this file
            const addressResult = await window.electronAPI.generateNewAddress();
            if (!addressResult.success) {
                this.showMessage(`❌ Failed to generate address for ${file.name}`, 'error');
                return;
            }

            const address = addressResult.address;
            this.showMessage(`📄 Processing: ${file.name} → ${address}`, 'info');

            // Read file as buffer
            const arrayBuffer = await file.arrayBuffer();
            const buffer = new Uint8Array(arrayBuffer);

            // Store file with nested structure
            const storeResult = await window.electronAPI.storeFile(
                this.currentProject.path,
                file.name,
                buffer,
                address
            );

            if (storeResult.success) {
                // Add to local file list
                this.files.push({
                    name: file.name,
                    address: address,
                    chunkFile: storeResult.chunkFileName,
                    size: file.size,
                    stored: new Date().toISOString()
                });

                this.updateFileList();
                this.showMessage(`✅ Stored: ${file.name} → ${storeResult.chunkFileName}`, 'success');
            } else {
                this.showMessage(`❌ Failed to store ${file.name}: ${storeResult.error}`, 'error');
            }
        } catch (error) {
            console.error('Error processing file:', error);
            this.showMessage(`❌ Error processing ${file.name}`, 'error');
        }
    }

    updateFileList() {
        const fileListEl = document.getElementById('fileList');
        
        if (this.files.length === 0) {
            fileListEl.innerHTML = '<div class="empty-state">No files stored yet</div>';
            return;
        }

        fileListEl.innerHTML = this.files.map(file => `
            <div class="file-item">
                <div class="file-name">📄 ${file.name}</div>
                <div class="file-address">${file.address}</div>
                <div class="file-chunk">→ ${file.chunkFile}</div>
                <div class="file-meta">${this.formatBytes(file.size)} • ${new Date(file.stored).toLocaleString()}</div>
            </div>
        `).join('');
        
        // Update mapping list as well
        this.updateMappingList();
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    updateMappingList() {
        const mappingListEl = document.getElementById('mappingList');
        
        if (!mappingListEl) {
            return; // Element doesn't exist
        }
        
        if (this.files.length === 0) {
            mappingListEl.innerHTML = '<div class="empty-state">No content mapped yet</div>';
            return;
        }

        mappingListEl.innerHTML = this.files.map(file => `
            <div class="mapping-item">
                <div class="bitcoin-address">${file.address}</div>
                <div class="mapping-meta">File: ${file.name} • Size: ${this.formatBytes(file.size)}</div>
            </div>
        `).join('');
    }

    showMessage(message, type = 'info') {
        // Remove any existing toast
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        // Create new toast
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // Show toast
        setTimeout(() => toast.classList.add('show'), 100);

        // Hide toast after 5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }
}

// Global function for copying to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Show a temporary message
        const originalText = event.target.textContent;
        event.target.textContent = 'Copied!';
        setTimeout(() => {
            event.target.textContent = originalText;
        }, 1000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
}

// Initialize the client when the page loads
const client = new BACDSClient(); 