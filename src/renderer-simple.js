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
        console.log('🚀 BACDS P2P Content Network initializing...');
        console.log('🔒 Wallet operations secured via IPC');
        console.log('🔌 electronAPI check:', !!window.electronAPI);
        
        // Search listeners (NEW)
        document.getElementById('searchButton').addEventListener('click', () => this.searchNetwork());
        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchNetwork();
        });
        
        // Earnings listeners (NEW)
        document.getElementById('updatePricing').addEventListener('click', () => this.updateDefaultPricing());
        
        // Wallet listeners (RESTORED)
        document.getElementById('generateWallet').addEventListener('click', () => this.generateWallet());
        document.getElementById('loadWallet').addEventListener('click', () => this.loadWallet());
        document.getElementById('showImport').addEventListener('click', () => this.showImportSection());
        document.getElementById('deleteWallet').addEventListener('click', () => this.deleteWallet());
        document.getElementById('backupWallet').addEventListener('click', () => this.createBackup());
        document.getElementById('restoreWallet').addEventListener('click', () => this.restoreWallet());
        
        // Project listeners (RESTORED)
        document.getElementById('createProject').addEventListener('click', () => this.createProject());
        document.getElementById('loadProject').addEventListener('click', () => this.loadProject());
        document.getElementById('convertFolder').addEventListener('click', () => this.convertFolder());
        document.getElementById('upgradeProject').addEventListener('click', () => this.upgradeProject());
        
        // Address listeners (RESTORED)
        document.getElementById('newAddress').addEventListener('click', () => this.generateNewAddress());
        document.getElementById('showAddresses').addEventListener('click', () => this.showAllAddresses());
        
        // File listeners (RESTORED)
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileSelection(e));
        const dropZone = document.getElementById('fileDropZone');
        if (dropZone) {
            dropZone.addEventListener('click', () => document.getElementById('fileInput').click());
            dropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
            dropZone.addEventListener('drop', (e) => this.handleFileDrop(e));
        }
        
        this.loadWalletStatus();
        
        // Initialize empty states for all sections (RESTORED)
        this.updateAddressList();
        this.updateFileList();
        this.updateMappingList();
        this.updateEarningsDisplay();
        this.updateLibraryStats();

        // Library tab listeners (NEW)
        this.initializeLibraryTabs();
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
        
        if (!projectName) {
            this.showMessage('❌ Please enter a project name', 'error');
            return;
        }

        try {
            // Let user choose where to create this specific project
            this.showMessage('📁 Choose location for project...', 'info');
            const dirResult = await window.electronAPI.chooseDirectory();
            
            if (!dirResult.success) {
                this.showMessage('❌ No directory selected', 'info');
                return;
            }

            this.showMessage('🎨 Creating project...', 'info');
            const result = await window.electronAPI.createProject(dirResult.path, projectName);
            
            if (result.success) {
                this.currentProject = {
                    name: result.projectName,
                    path: result.projectPath,
                    workingDir: dirResult.path
                };
                this.updateProjectStatus();
                document.getElementById('fileUploadSection').style.display = 'block';
                this.showMessage(`✅ Project "${projectName}" created at ${result.projectPath}!`, 'success');
                document.getElementById('projectName').value = '';
            } else {
                this.showMessage(`❌ Project creation failed: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error creating project:', error);
            this.showMessage('❌ Error creating project', 'error');
        }
    }

    async loadProject() {
        try {
            this.showMessage('📁 Browse for existing project...', 'info');
            const result = await window.electronAPI.loadProject();
            
            if (result.success) {
                this.currentProject = {
                    name: result.projectName,
                    path: result.projectPath,
                    workingDir: result.workingDir,
                    format: result.format,
                    canUpgrade: result.canUpgrade
                };
                
                // Load existing files from the project
                this.files = result.files || [];
                this.updateFileList();
                this.updateProjectStatus();
                document.getElementById('fileUploadSection').style.display = 'block';
                
                // Show upgrade button for legacy projects
                const upgradeBtn = document.getElementById('upgradeProject');
                if (result.format === 'legacy' && result.canUpgrade) {
                    upgradeBtn.style.display = 'inline-flex';
                    this.showMessage(`✅ Legacy project "${result.projectName}" loaded! ${result.files.length} files found. Consider upgrading to new format.`, 'success');
                } else {
                    upgradeBtn.style.display = 'none';
                    this.showMessage(`✅ Project "${result.projectName}" loaded successfully!`, 'success');
                }
                
                console.log('📂 Project loaded:', result);
            } else if (result.error === 'NO_SELECTION') {
                this.showMessage('❌ No project selected', 'info');
            } else {
                this.showMessage(`❌ Failed to load project: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error loading project:', error);
            this.showMessage('❌ Error loading project', 'error');
        }
    }

    async upgradeProject() {
        if (!this.currentProject || this.currentProject.format !== 'legacy') {
            this.showMessage('❌ No legacy project loaded to upgrade', 'error');
            return;
        }

        const confirmed = confirm(
            '🔄 Upgrade Project to New Format\n\n' +
            'This will create a manifest.json file and organize files:\n' +
            '• Files will keep their original extensions (.jpg, .png, etc.)\n' +
            '• Files will be named as [address].extension\n' +
            '• Original filenames will be preserved in manifest.json\n' +
            '• address-mapping.json will be backed up\n\n' +
            'This action cannot be undone. Continue?'
        );

        if (!confirmed) {
            this.showMessage('🔒 Project upgrade cancelled', 'info');
            return;
        }

        try {
            this.showMessage('🔄 Upgrading project to new format...', 'info');
            const result = await window.electronAPI.upgradeProject(this.currentProject.path);
            
            if (result.success) {
                // Update current project info
                this.currentProject.format = 'new';
                this.currentProject.canUpgrade = false;
                
                // Hide upgrade button
                document.getElementById('upgradeProject').style.display = 'none';
                
                // Update project status
                this.updateProjectStatus();
                
                this.showMessage(`✅ Project upgraded successfully! ${result.filesRenamed} files renamed, manifest.json created.`, 'success');
                console.log('🔄 Project upgraded:', result);
            } else {
                this.showMessage(`❌ Upgrade failed: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error upgrading project:', error);
            this.showMessage('❌ Error during upgrade', 'error');
        }
    }

    // Custom input dialog 
    showCustomInput(message, title = 'Input Required', defaultValue = '') {
        return new Promise((resolve) => {
            // Create modal overlay
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                font-family: 'Inter', sans-serif;
            `;

            // Create dialog
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: white;
                border-radius: 8px;
                padding: 24px;
                max-width: 400px;
                margin: 20px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
                text-align: center;
            `;

            // Create title
            const titleEl = document.createElement('h3');
            titleEl.textContent = title;
            titleEl.style.cssText = `
                margin: 0 0 16px 0;
                color: #0f172a;
                font-size: 1.25rem;
                font-weight: 600;
            `;

            // Create message
            const messageEl = document.createElement('p');
            messageEl.textContent = message;
            messageEl.style.cssText = `
                margin: 0 0 16px 0;
                color: #475569;
                line-height: 1.6;
                text-align: left;
            `;

            // Create input
            const input = document.createElement('input');
            input.type = 'text';
            input.value = defaultValue;
            input.style.cssText = `
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #e2e8f0;
                border-radius: 6px;
                font-size: 14px;
                margin-bottom: 20px;
                box-sizing: border-box;
                font-family: 'Inter', sans-serif;
            `;

            // Create button container
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `
                display: flex;
                gap: 12px;
                justify-content: center;
            `;

            // Create Cancel button
            const cancelButton = document.createElement('button');
            cancelButton.textContent = 'Cancel';
            cancelButton.style.cssText = `
                padding: 8px 24px;
                border: 1px solid #e2e8f0;
                border-radius: 6px;
                background: white;
                color: #64748b;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
            `;
            cancelButton.onmouseover = () => {
                cancelButton.style.background = '#f8fafc';
                cancelButton.style.borderColor = '#64748b';
            };
            cancelButton.onmouseout = () => {
                cancelButton.style.background = 'white';
                cancelButton.style.borderColor = '#e2e8f0';
            };

            // Create OK button
            const okButton = document.createElement('button');
            okButton.textContent = 'OK';
            okButton.style.cssText = `
                padding: 8px 24px;
                border: 1px solid #2563eb;
                border-radius: 6px;
                background: #2563eb;
                color: white;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
            `;
            okButton.onmouseover = () => {
                okButton.style.background = '#1d4ed8';
                okButton.style.borderColor = '#1d4ed8';
            };
            okButton.onmouseout = () => {
                okButton.style.background = '#2563eb';
                okButton.style.borderColor = '#2563eb';
            };

            // Add event listeners
            const cleanup = () => {
                document.body.removeChild(overlay);
            };

            const submit = () => {
                const value = input.value.trim();
                if (value) {
                    cleanup();
                    resolve(value);
                } else {
                    input.focus();
                    input.style.borderColor = '#ef4444';
                    setTimeout(() => {
                        input.style.borderColor = '#e2e8f0';
                    }, 2000);
                }
            };

            cancelButton.onclick = () => {
                cleanup();
                resolve(null);
            };

            okButton.onclick = submit;

            // Submit on Enter key
            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    submit();
                }
            };

            // Close on overlay click
            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    cleanup();
                    resolve(null);
                }
            };

            // Close on Escape key
            const handleKeydown = (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    document.removeEventListener('keydown', handleKeydown);
                    resolve(null);
                }
            };
            document.addEventListener('keydown', handleKeydown);

            // Assemble dialog
            buttonContainer.appendChild(cancelButton);
            buttonContainer.appendChild(okButton);
            dialog.appendChild(titleEl);
            dialog.appendChild(messageEl);
            dialog.appendChild(input);
            dialog.appendChild(buttonContainer);
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            // Focus the input
            input.focus();
            input.select();
        });
    }

    // Custom confirmation dialog with Yes/No buttons
    showCustomConfirm(message, title = 'Confirm') {
        return new Promise((resolve) => {
            // Create modal overlay
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                font-family: 'Inter', sans-serif;
            `;

            // Create dialog
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: white;
                border-radius: 8px;
                padding: 24px;
                max-width: 500px;
                margin: 20px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
                text-align: center;
            `;

            // Create title
            const titleEl = document.createElement('h3');
            titleEl.textContent = title;
            titleEl.style.cssText = `
                margin: 0 0 16px 0;
                color: #0f172a;
                font-size: 1.25rem;
                font-weight: 600;
            `;

            // Create message
            const messageEl = document.createElement('p');
            messageEl.textContent = message;
            messageEl.style.cssText = `
                margin: 0 0 24px 0;
                color: #475569;
                line-height: 1.6;
                white-space: pre-line;
            `;

            // Create button container
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `
                display: flex;
                gap: 12px;
                justify-content: center;
            `;

            // Create No button
            const noButton = document.createElement('button');
            noButton.textContent = 'No';
            noButton.style.cssText = `
                padding: 8px 24px;
                border: 1px solid #e2e8f0;
                border-radius: 6px;
                background: white;
                color: #64748b;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
            `;
            noButton.onmouseover = () => {
                noButton.style.background = '#f8fafc';
                noButton.style.borderColor = '#64748b';
            };
            noButton.onmouseout = () => {
                noButton.style.background = 'white';
                noButton.style.borderColor = '#e2e8f0';
            };

            // Create Yes button
            const yesButton = document.createElement('button');
            yesButton.textContent = 'Yes';
            yesButton.style.cssText = `
                padding: 8px 24px;
                border: 1px solid #ef4444;
                border-radius: 6px;
                background: #ef4444;
                color: white;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
            `;
            yesButton.onmouseover = () => {
                yesButton.style.background = '#dc2626';
                yesButton.style.borderColor = '#dc2626';
            };
            yesButton.onmouseout = () => {
                yesButton.style.background = '#ef4444';
                yesButton.style.borderColor = '#ef4444';
            };

            // Add event listeners
            const cleanup = () => {
                document.body.removeChild(overlay);
            };

            noButton.onclick = () => {
                cleanup();
                resolve(false);
            };

            yesButton.onclick = () => {
                cleanup();
                resolve(true);
            };

            // Close on overlay click
            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    cleanup();
                    resolve(false);
                }
            };

            // Close on Escape key
            const handleKeydown = (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    document.removeEventListener('keydown', handleKeydown);
                    resolve(false);
                }
            };
            document.addEventListener('keydown', handleKeydown);

            // Assemble dialog
            buttonContainer.appendChild(noButton);
            buttonContainer.appendChild(yesButton);
            dialog.appendChild(titleEl);
            dialog.appendChild(messageEl);
            dialog.appendChild(buttonContainer);
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            // Focus the No button by default (safer option)
            noButton.focus();
        });
    }

    async convertFolder() {
        try {
            // Step 1: Choose source folder to convert
            this.showMessage('📁 Select folder to convert to BACDS format...', 'info');
            
            const sourceResult = await window.electronAPI.chooseDirectory();
            if (!sourceResult.success) {
                this.showMessage('❌ No source folder selected', 'info');
                return;
            }

            console.log('📂 Source folder selected:', sourceResult.path);

            // Step 2: Get project name with custom input dialog
            const sourceFolderName = sourceResult.path.split('/').pop();
            const projectName = await this.showCustomInput(
                `What would you like to name this BACDS project?`,
                'Project Name',
                sourceFolderName
            );
            
            if (!projectName) {
                this.showMessage('❌ Project name required', 'error');
                return;
            }

            console.log('🏷️ Project name:', projectName);

            // Step 3: Choose destination folder
            this.showMessage('📁 Choose where to create the BACDS project...', 'info');
            const destResult = await window.electronAPI.chooseDirectory();
            if (!destResult.success) {
                this.showMessage('❌ No destination folder selected', 'info');
                return;
            }

            console.log('📁 Destination folder selected:', destResult.path);

            // Step 4: Convert the folder
            this.showMessage('🔄 Converting folder to BACDS format...', 'info');
            console.log('🔄 Starting conversion process...');
            
            const convertResult = await window.electronAPI.convertFolderToBACDS(
                sourceResult.path,
                destResult.path, 
                projectName
            );
            
            console.log('🔄 Conversion result:', convertResult);
            
            if (convertResult.success) {
                // Step 5: Ask about source folder with custom Yes/No dialog
                const deleteSource = await this.showCustomConfirm(
                    `✅ Conversion completed!\n\n` +
                    `📂 Converted: ${convertResult.filesConverted} files\n` +
                    `📸 Thumbnails: ${convertResult.thumbnailsGenerated}\n` +
                    `📁 Project: ${convertResult.projectPath}\n\n` +
                    `Do you want to DELETE the original source folder?\n` +
                    `⚠️ This cannot be undone!`,
                    'Delete Original Folder?'
                );

                if (deleteSource) {
                    this.showMessage('🗑️ Deleting source folder...', 'info');
                    const deleteResult = await window.electronAPI.deleteFolder(sourceResult.path);
                    
                    if (deleteResult.success) {
                        this.showMessage('✅ Source folder deleted successfully', 'success');
                    } else {
                        this.showMessage(`⚠️ Could not delete source folder: ${deleteResult.error}`, 'warning');
                    }
                }

                // Load the converted project
                this.currentProject = {
                    name: convertResult.projectName,
                    path: convertResult.projectPath,
                    workingDir: destResult.path,
                    format: 'new'
                };
                
                this.files = convertResult.files || [];
                this.updateFileList();
                this.updateProjectStatus();
                document.getElementById('fileUploadSection').style.display = 'block';
                
                this.showMessage(`✅ Folder converted to BACDS format! ${convertResult.filesConverted} files processed.`, 'success');
            } else {
                console.error('❌ Conversion failed:', convertResult.error);
                this.showMessage(`❌ Conversion failed: ${convertResult.error}`, 'error');
            }
        } catch (error) {
            console.error('❌ Error during conversion:', error);
            console.error('❌ Error stack:', error.stack);
            this.showMessage(`❌ Error during conversion: ${error.message}`, 'error');
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
        } else {
            statusEl.innerHTML = `
                <div class="empty-state">Enter a project name and click "Create Project" to choose location</div>
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
            this.showMessage('❌ Please create or load a project first', 'error');
            return;
        }

        if (!this.walletStatus?.hasMasterSeed) {
            this.showMessage('❌ Please generate wallet first', 'error');
            return;
        }

        for (let file of files) {
            await this.processFile(file);
        }
        
        // Update displays after adding files
        this.updateFileList();
        this.updateMappingList();
        this.updateLibraryStats();
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
                addressResult  // Pass full addressResult instead of just address
            );

            if (storeResult.success) {
                // Add to local file list
                this.files.push({
                    name: file.name,
                    address: address,
                    chunkFile: storeResult.chunkFileName,
                    size: file.size,
                    stored: new Date().toISOString(),
                    thumbnailPath: storeResult.thumbnailPath,
                    isImage: storeResult.isImage
                });

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

        fileListEl.innerHTML = this.files.map(file => {
            // Create thumbnail element
            let thumbnailHtml = '';
            if (file.isImage && file.thumbnailPath) {
                thumbnailHtml = `<div class="file-thumbnail"><img src="file://${file.thumbnailPath}" alt="${file.name}"></div>`;
            } else if (file.isImage) {
                thumbnailHtml = `<div class="file-thumbnail">🖼️</div>`;
            } else {
                thumbnailHtml = `<div class="file-thumbnail">📄</div>`;
            }
            
            return `
                <div class="file-item">
                    ${thumbnailHtml}
                    <div class="file-info">
                        <div class="file-name">${file.name}</div>
                        <div class="file-address">${file.address}</div>
                        <div class="file-chunk">→ ${file.chunkFile}</div>
                        <div class="file-meta">${this.formatBytes(file.size)} • ${new Date(file.stored).toLocaleString()}</div>
                    </div>
                </div>
            `;
        }).join('');
        
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

    // Auto-create wallet for seamless UX
    async ensureWalletExists() {
        try {
            if (!this.walletStatus?.hasMasterSeed) {
                console.log('🔐 Auto-creating wallet for seamless experience...');
                await this.generateWallet();
            }
        } catch (error) {
            console.error('Error ensuring wallet exists:', error);
        }
    }

    // Search Network
    async searchNetwork() {
        const searchInput = document.getElementById('searchInput');
        const searchResults = document.getElementById('searchResults');
        const contentType = document.getElementById('contentType').value;
        const sortBy = document.getElementById('sortBy').value;
        
        const query = searchInput.value.trim();
        if (!query) {
            this.showMessage('❌ Please enter search terms', 'error');
            return;
        }

        try {
            this.showMessage('🔍 Searching network...', 'info');
            searchResults.innerHTML = '<div class="loading">Searching network for content...</div>';
            
            // TODO: Implement actual P2P network search
            // For now, show placeholder results
            setTimeout(() => {
                searchResults.innerHTML = `
                    <div class="search-result-item">
                        <div class="search-result-thumbnail">🎬</div>
                        <div class="search-result-info">
                            <div class="search-result-title">Sample Movie.mp4</div>
                            <div class="search-result-meta">Video • 2.1 GB • Free • 542 seeders</div>
                            <button class="btn small primary">Download</button>
                        </div>
                    </div>
                    <div class="search-result-item">
                        <div class="search-result-thumbnail">🎵</div>
                        <div class="search-result-info">
                            <div class="search-result-title">Album Collection.zip</div>
                            <div class="search-result-meta">Audio • 450 MB • $2.99 • 89 seeders</div>
                            <button class="btn small primary">Download</button>
                        </div>
                    </div>
                    <div class="empty-state">Network search functionality coming soon...</div>
                `;
                this.showMessage(`✅ Found results for "${query}"`, 'success');
            }, 1500);
            
        } catch (error) {
            console.error('Search error:', error);
            searchResults.innerHTML = '<div class="empty-state">Search failed. Please try again.</div>';
            this.showMessage('❌ Search failed', 'error');
        }
    }

    // Library Management
    initializeLibrary() {
        this.updateLibraryStats();
        this.loadLibraryContent();
    }

    async addContent() {
        // Show file drop zone
        const dropZone = document.getElementById('fileDropZone');
        dropZone.style.display = 'block';
        dropZone.scrollIntoView({ behavior: 'smooth' });
        this.showMessage('📁 Click the area above or drag files to add to your library', 'info');
    }

    async importFolder() {
        try {
            this.showMessage('📁 Select folder to import...', 'info');
            const result = await window.electronAPI.chooseDirectory();
            
            if (result.success) {
                // Use the existing convertFolder functionality
                await this.convertFolder();
            }
        } catch (error) {
            console.error('Import folder error:', error);
            this.showMessage('❌ Failed to import folder', 'error');
        }
    }

    async createCollection() {
        const collectionName = await this.showCustomInput(
            'Enter a name for your new collection:',
            'Create Collection',
            'My Collection'
        );
        
        if (collectionName) {
            // TODO: Implement collection creation
            this.showMessage(`✅ Collection "${collectionName}" created`, 'success');
        }
    }

    updateLibraryStats() {
        // Update stats based on current files
        const totalFiles = this.files.length;
        const totalSize = this.files.reduce((sum, file) => sum + (file.size || 0), 0);
        const publicFiles = this.files.filter(file => file.public).length;
        
        document.getElementById('totalFiles').textContent = totalFiles;
        document.getElementById('totalSize').textContent = this.formatBytes(totalSize);
        document.getElementById('publicFiles').textContent = publicFiles;
    }

    loadLibraryContent() {
        const libraryContent = document.getElementById('libraryContent');
        
        if (this.files.length === 0) {
            libraryContent.innerHTML = '<div class="empty-state">Your library is empty. Add some content to get started!</div>';
            return;
        }

        // Display files in a user-friendly way
        libraryContent.innerHTML = this.files.map(file => {
            let thumbnailHtml = '';
            if (file.isImage && file.thumbnailPath) {
                thumbnailHtml = `<img src="file://${file.thumbnailPath}" alt="${file.name}" class="library-thumbnail">`;
            } else if (file.isImage) {
                thumbnailHtml = `<div class="library-thumbnail">🖼️</div>`;
            } else {
                thumbnailHtml = `<div class="library-thumbnail">📄</div>`;
            }
            
            return `
                <div class="library-item">
                    ${thumbnailHtml}
                    <div class="library-item-info">
                        <div class="library-item-name">${file.name}</div>
                        <div class="library-item-meta">${this.formatBytes(file.size)} • ${new Date(file.stored).toLocaleDateString()}</div>
                        <div class="library-item-actions">
                            <button class="btn small secondary">Share</button>
                            <button class="btn small secondary">Set Price</button>
                            <button class="btn small danger">Remove</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Earnings Management
    updateEarningsDisplay() {
        // TODO: Implement actual earnings calculation from blockchain
        document.getElementById('totalEarnings').textContent = '$0.00';
        document.getElementById('monthlyEarnings').textContent = '$0.00';
        document.getElementById('activeListings').textContent = '0';
    }

    async updateDefaultPricing() {
        const priceInput = document.getElementById('defaultPrice');
        const price = parseFloat(priceInput.value);
        
        if (isNaN(price) || price < 0) {
            this.showMessage('❌ Please enter a valid price', 'error');
            return;
        }

        // TODO: Save default pricing setting
        this.showMessage(`✅ Default price set to $${price.toFixed(2)}`, 'success');
    }

    // Storage Management
    async chooseStorageLocation() {
        try {
            this.showMessage('📁 Choose storage location...', 'info');
            const result = await window.electronAPI.chooseDirectory();
            
            if (result.success) {
                document.getElementById('storageLocation').innerHTML = `
                    <div class="storage-path">${result.path}</div>
                    <button id="chooseStorage" class="btn secondary">Change Location</button>
                `;
                
                // Re-attach event listener
                document.getElementById('chooseStorage').addEventListener('click', () => this.chooseStorageLocation());
                
                this.showMessage(`✅ Storage location set to ${result.path}`, 'success');
            }
        } catch (error) {
            console.error('Storage location error:', error);
            this.showMessage('❌ Failed to set storage location', 'error');
        }
    }

    // Library tab functionality
    initializeLibraryTabs() {
        const tabs = document.querySelectorAll('.library-tab');
        const tabContents = document.querySelectorAll('.library-tab-content');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.getAttribute('data-tab');
                
                // Remove active class from all tabs and contents
                tabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                // Add active class to clicked tab and corresponding content
                tab.classList.add('active');
                document.getElementById(targetTab).classList.add('active');
                
                // Update the content for the selected tab
                this.updateLibraryTab(targetTab);
                
                console.log(`📚 Switched to library tab: ${targetTab}`);
            });
        });
        
        // Initialize with "My Content" tab
        this.updateLibraryTab('my-content');
    }

    updateLibraryTab(tabName) {
        const tabContent = document.getElementById(tabName);
        const gridElement = tabContent.querySelector('.library-grid');
        
        switch (tabName) {
            case 'my-content':
                this.updateMyContentGrid(gridElement);
                break;
            case 'others-content':
                this.updateOthersContentGrid(gridElement);
                break;
            case 'commercial-content':
                this.updateCommercialContentGrid(gridElement);
                break;
        }
    }

    updateMyContentGrid(gridElement) {
        if (this.files.length === 0) {
            gridElement.innerHTML = '<div class="empty-state">Your content library is empty. Add some files to get started!</div>';
            return;
        }

        gridElement.innerHTML = this.files.map(file => {
            let thumbnailHtml = '';
            if (file.isImage && file.thumbnailPath) {
                thumbnailHtml = `<img src="file://${file.thumbnailPath}" alt="${file.name}" class="library-thumbnail">`;
            } else if (file.isImage) {
                thumbnailHtml = `<div class="library-thumbnail">🖼️</div>`;
            } else {
                thumbnailHtml = `<div class="library-thumbnail">📄</div>`;
            }
            
            return `
                <div class="library-item">
                    ${thumbnailHtml}
                    <div class="library-item-info">
                        <div class="library-item-name">${file.name}</div>
                        <div class="library-item-meta">${this.formatBytes(file.size)} • ${new Date(file.stored).toLocaleDateString()}</div>
                        <div class="library-item-actions">
                            <button class="btn small secondary">Preview</button>
                            <button class="btn small primary">Share</button>
                            <button class="btn small danger">Remove</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateOthersContentGrid(gridElement) {
        // Mock data for demonstration
        gridElement.innerHTML = `
            <div class="library-item">
                <div class="library-thumbnail">🎬</div>
                <div class="library-item-info">
                    <div class="library-item-name">Sample Movie.mp4</div>
                    <div class="library-item-meta">2.1 GB • Free</div>
                    <div class="library-item-actions">
                        <button class="btn small primary">Download</button>
                        <button class="btn small secondary">Preview</button>
                    </div>
                </div>
            </div>
            <div class="library-item">
                <div class="library-thumbnail">🎵</div>
                <div class="library-item-info">
                    <div class="library-item-name">Album Collection.zip</div>
                    <div class="library-item-meta">450 MB • Free</div>
                    <div class="library-item-actions">
                        <button class="btn small primary">Download</button>
                        <button class="btn small secondary">Preview</button>
                    </div>
                </div>
            </div>
            <div class="empty-state">Network discovery functionality coming soon...</div>
        `;
    }

    updateCommercialContentGrid(gridElement) {
        // Mock data for demonstration
        gridElement.innerHTML = `
            <div class="library-item">
                <div class="library-thumbnail">📚</div>
                <div class="library-item-info">
                    <div class="library-item-name">Premium Course.zip</div>
                    <div class="library-item-meta">1.2 GB • $29.99</div>
                    <div class="library-item-actions">
                        <button class="btn small primary">Purchase</button>
                        <button class="btn small secondary">Preview</button>
                    </div>
                </div>
            </div>
            <div class="library-item">
                <div class="library-thumbnail">🎨</div>
                <div class="library-item-info">
                    <div class="library-item-name">Design Assets.zip</div>
                    <div class="library-item-meta">800 MB • $19.99</div>
                    <div class="library-item-actions">
                        <button class="btn small primary">Purchase</button>
                        <button class="btn small secondary">Preview</button>
                    </div>
                </div>
            </div>
            <div class="empty-state">Marketplace functionality coming soon...</div>
        `;
    }

    updateFileDisplay() {
        console.log('📋 Updating file display...', this.files);
        const fileList = document.getElementById('fileList');
        
        if (this.files.length === 0) {
            fileList.innerHTML = '<div class="empty-state">No files added yet. Drop files above to add them to your project.</div>';
            return;
        }

        fileList.innerHTML = this.files.map((file, index) => {
            console.log(`📁 File ${index}:`, file);
            const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'].includes(file.extension?.toLowerCase());
            const thumbnailPath = file.thumbnailPath ? `file://${file.thumbnailPath}` : null;
            
            // Create thumbnail element
            let thumbnailHtml = '';
            if (file.isImage && file.thumbnailPath) {
                thumbnailHtml = `<div class="file-thumbnail"><img src="file://${file.thumbnailPath}" alt="${file.name}"></div>`;
            } else if (file.isImage) {
                thumbnailHtml = `<div class="file-thumbnail">🖼️</div>`;
            } else {
                thumbnailHtml = `<div class="file-thumbnail">📄</div>`;
            }
            
            return `
                <div class="file-item">
                    ${thumbnailHtml}
                    <div class="file-info">
                        <div class="file-name">${file.name}</div>
                        <div class="file-address">${file.address}</div>
                        <div class="file-chunk">→ ${file.chunkFile}</div>
                        <div class="file-meta">${this.formatBytes(file.size)} • ${new Date(file.stored).toLocaleString()}</div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Update mapping list and library when files change
        this.updateMappingList();
        this.updateLibraryStats();
        this.updateLibraryTab('my-content'); // Refresh the active library tab
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

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🎨 BACDS UI loaded - initializing components');
    
    // Initialize collapsible sections
    initializeCollapsibleSections();
    
    const app = new BACDSClient();
    app.init();
});

// Collapsible sections functionality
function initializeCollapsibleSections() {
    console.log('📁 Initializing collapsible sections');
    
    // Add click listeners to all section headers
    document.querySelectorAll('.section-header').forEach(header => {
        header.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const content = document.getElementById(targetId);
            const toggle = this.querySelector('.collapse-toggle');
            
            if (this.classList.contains('expanded')) {
                // Collapse section
                content.classList.add('collapsed');
                this.classList.remove('expanded');
                toggle.textContent = '▶';
                console.log(`📁 Collapsed section: ${targetId}`);
            } else {
                // Expand section
                content.classList.remove('collapsed');
                this.classList.add('expanded');
                toggle.textContent = '▼';
                console.log(`📂 Expanded section: ${targetId}`);
            }
        });
    });
    
    // Initialize sections based on their HTML state
    document.querySelectorAll('.section-header').forEach(header => {
        const targetId = header.getAttribute('data-target');
        const content = document.getElementById(targetId);
        const toggle = header.querySelector('.collapse-toggle');
        
        if (header.classList.contains('expanded')) {
            // Section should be expanded
            content.classList.remove('collapsed');
            toggle.textContent = '▼';
            console.log(`📂 Section ${targetId} initialized as expanded`);
        } else {
            // Section should be collapsed
            content.classList.add('collapsed');
            toggle.textContent = '▶';
            console.log(`📁 Section ${targetId} initialized as collapsed`);
        }
    });
    
    console.log('✅ All sections initialized with proper states');
} 