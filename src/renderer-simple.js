// BACDS Frontend - Content Network with HD Wallet

class BACDSClient {
    constructor() {
        this.walletStatus = null;
        this.addresses = [];
        this.files = [];
        this.currentProject = null;  // { path, name, workingDir }
        this.collections = [];
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
        
        // Library listeners (NEW)
        document.getElementById('addContent').addEventListener('click', () => this.addContent());
        document.getElementById('importFolder').addEventListener('click', () => this.importFolder());
        document.getElementById('createCollection').addEventListener('click', () => this.createCollection());
        
        // Token Library listeners (NEW)
        document.getElementById('stakeTokens').addEventListener('click', () => this.stakeTokens());
        document.getElementById('unstakeTokens').addEventListener('click', () => this.unstakeTokens());
        document.getElementById('buyTokens').addEventListener('click', () => this.buyTokens());
        document.getElementById('sellTokens').addEventListener('click', () => this.sellTokens());
        document.getElementById('viewProposals').addEventListener('click', () => this.viewGovernanceProposals());
        document.getElementById('submitProposal').addEventListener('click', () => this.submitGovernanceProposal());
        
        // Token Management listeners (NEW)
        document.getElementById('issueTokens').addEventListener('click', () => this.issueContentTokens());
        document.getElementById('updateRevenue').addEventListener('click', () => this.updateRevenueSharing());
        document.getElementById('updateSeederRewards').addEventListener('click', () => this.updateSeederRewards());
        
        // Revenue sharing sliders
        const creatorSlider = document.getElementById('creatorSlider');
        const seederSlider = document.getElementById('seederSlider');
        if (creatorSlider && seederSlider) {
            creatorSlider.addEventListener('input', () => this.updateRevenueSliders());
            seederSlider.addEventListener('input', () => this.updateRevenueSliders());
        }
        
        // Additional library button listeners
        const refreshOthersBtn = document.getElementById('refreshOthers');
        if (refreshOthersBtn) {
            refreshOthersBtn.addEventListener('click', () => this.refreshOthersContent());
        }
        
        const downloadSelectedBtn = document.getElementById('downloadSelected');
        if (downloadSelectedBtn) {
            downloadSelectedBtn.addEventListener('click', () => this.downloadSelectedContent());
        }
        
        const browseMarketplaceBtn = document.getElementById('browseMarketplace');
        if (browseMarketplaceBtn) {
            browseMarketplaceBtn.addEventListener('click', () => this.browseMarketplace());
        }
        
        const myPurchasesBtn = document.getElementById('myPurchases');
        if (myPurchasesBtn) {
            myPurchasesBtn.addEventListener('click', () => this.showMyPurchases());
        }
        
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
        
        // Add listeners for the NERD daemon buttons
        const startNerdButton = document.getElementById('startNerdButton');
        const stopNerdButton = document.getElementById('stopNerdButton');
        if (startNerdButton) {
            startNerdButton.addEventListener('click', () => this.startNerdProcess());
        }
        if (stopNerdButton) {
            stopNerdButton.addEventListener('click', () => this.stopNerdProcess());
        }
        
        this.loadWalletStatus();
        
        // Initialize daemon status monitoring immediately
        this.startDaemonStatusMonitoring();
        
        // Get daemon status right away
        this.checkDaemonStatusNow();
        
        // Initialize empty states for all sections (RESTORED)
        this.updateAddressList();
        this.updateFileList();
        this.updateMappingList();
        this.updateEarningsDisplay();
        this.updateLibraryStats();

        // Library tab listeners (NEW)
        this.initializeLibraryTabs();
        
        // Load existing collections from localStorage
        this.loadCollections();
        
        // Initialize token data
        this.initializeTokenData();
        
        // Initialize social network features
        this.initializeSocialFeatures();
        
        // Initialize market features
        this.initializeMarketFeatures();
        
        // Initialize mint features
        this.initializeMintFeatures();
    }

    async loadWalletStatus() {
        const statusDiv = document.getElementById('walletStatus');
        
        console.log('🚀 loadWalletStatus called');
        console.log('🔍 electronAPI available:', !!window.electronAPI);
        console.log('🔍 getWalletStatus function:', typeof window.electronAPI?.getWalletStatus);
        
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
        
        if (!window.electronAPI.getWalletStatus) {
            console.error('❌ getWalletStatus function not available');
            statusDiv.innerHTML = `
                <div class="error">
                    ❌ Wallet service not available<br>
                    <small>IPC function missing</small>
                </div>
            `;
            return;
        }
        
        try {
            console.log('🔄 Getting wallet status...');
            
            // Get status immediately 
            this.walletStatus = await window.electronAPI.getWalletStatus();
            console.log('📊 Wallet status received:', this.walletStatus);
            
            if (this.walletStatus) {
                this.updateWalletDisplay();
                console.log('✅ Wallet status loaded successfully');
                
                // If wallet is still loading, periodically refresh
                if (this.walletStatus.isLoading) {
                    console.log('💤 Wallet still loading, will refresh in 3 seconds...');
                    setTimeout(() => this.loadWalletStatus(), 3000);
                }
            } else {
                console.error('❌ No wallet status returned');
                statusDiv.innerHTML = `
                    <div class="wallet-info">
                        <div class="status-item status-offline">
                            <span class="icon">❌</span>
                            <span>Wallet service unavailable</span>
                        </div>
                        <div class="wallet-actions" style="margin-top: 15px;">
                            <button class="btn primary" onclick="bacdsClient.loadWalletStatus()">Retry</button>
                        </div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('❌ Failed to load wallet status:', error);
            statusDiv.innerHTML = `
                <div class="wallet-info">
                    <div class="status-item status-offline">
                        <span class="icon">💤</span>
                        <span>Ready for HD wallet creation</span>
                    </div>
                    <div class="status-item">
                        <span class="icon">ℹ️</span>
                        <span>Create a new BIP44 HD wallet to get started</span>
                    </div>
                    <div class="wallet-actions" style="margin-top: 15px;">
                        <button class="btn primary" onclick="bacdsClient.generateWallet()">Create HD Wallet</button>
                        <button class="btn secondary" onclick="bacdsClient.loadWalletStatus()">Check Again</button>
                    </div>
                </div>
            `;
        }
    }

    updateWalletDisplay() {
        const statusDiv = document.getElementById('walletStatus');
        
        console.log('🔄 updateWalletDisplay called with status:', this.walletStatus);
        
        // Handle loading states for lazy-loaded HD wallet
        if (this.walletStatus?.isLoading) {
            statusDiv.innerHTML = `
                <div class="wallet-loading">
                    <div class="status-item">
                        <span class="icon">🔄</span>
                        <span>Loading HD wallet in background...</span>
                    </div>
                    <div class="status-item">
                        <span class="icon">ℹ️</span>
                        <span>You can use other features while loading</span>
                    </div>
                </div>
            `;
            return;
        }

        if (this.walletStatus?.hasWallet && this.walletStatus?.isLoaded) {
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
                        <span>Addresses: ${this.walletStatus.totalAddressesGenerated || 0} generated</span>
                    </div>
                    <div class="status-item">
                        <span class="icon">🌳</span>
                        <span>Type: ${this.walletStatus.walletType || 'HD Wallet'}</span>
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
        } else if (this.walletStatus?.needsLoading) {
            // Wallet file exists but not loaded yet
            statusDiv.innerHTML = `
                <div class="wallet-info">
                    <div class="status-item status-warning">
                        <span class="icon">📂</span>
                        <span>Wallet file found but not loaded</span>
                    </div>
                    <div class="status-item">
                        <span class="icon">💡</span>
                        <span>Click "Load Wallet" to initialize your existing wallet</span>
                    </div>
                    <div class="wallet-actions" style="margin-top: 15px;">
                        <button class="btn primary" onclick="bacdsClient.loadWallet()">Load Existing Wallet</button>
                        <button class="btn secondary" onclick="bacdsClient.generateWallet()">Create New Wallet</button>
                    </div>
                </div>
            `;
        } else {
            // No wallet exists - check if we need to handle file exists case
            console.log('📂 No wallet loaded, checking file system...');
            const hasFile = this.walletStatus?.walletFile && this.walletStatus?.dataDir;
            
            statusDiv.innerHTML = `
                <div class="wallet-info">
                    <div class="status-item status-offline">
                        <span class="icon">💤</span>
                        <span>Ready for HD wallet creation</span>
                    </div>
                    <div class="status-item">
                        <span class="icon">ℹ️</span>
                        <span>Create a new BIP44 HD wallet to get started</span>
                    </div>
                    <div class="status-item status-online">
                        <span class="icon">🔒</span>
                        <span>Private keys stored securely with mnemonic</span>
                    </div>
                    <div class="wallet-actions" style="margin-top: 15px;">
                        <button class="btn primary" onclick="bacdsClient.generateWallet()">Create HD Wallet</button>
                        ${hasFile ? '<button class="btn secondary" onclick="bacdsClient.loadWallet()">Load Existing</button>' : ''}
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
            this.showMessage('🔓 Initializing wallet...', 'info');
            
            // First initialize the wallet async
            const initResult = await window.electronAPI.initializeWalletAsync();
            console.log('🔄 Wallet initialization result:', initResult);
            
            // Then refresh the status display
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
            return true;
        } catch (error) {
            console.error('Error ensuring wallet exists:', error);
            return false;
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
        // First, expand the Content Management section if collapsed
        const contentSection = document.querySelector('[data-target="file-content"]');
        const contentSectionContent = document.getElementById('file-content');
        
        if (contentSection && contentSectionContent.classList.contains('collapsed')) {
            contentSection.click(); // Trigger the expand
        }
        
        // Show the file upload section if hidden
        const fileUploadSection = document.getElementById('fileUploadSection');
        if (fileUploadSection) {
            fileUploadSection.style.display = 'block';
        }
        
        // Show file drop zone
        const dropZone = document.getElementById('fileDropZone');
        if (dropZone) {
            dropZone.style.display = 'block';
            dropZone.scrollIntoView({ behavior: 'smooth' });
        }
        
        this.showMessage('📁 Content Management opened - drag files to upload or create a project first', 'info');
    }

    async importFolder() {
        try {
            // Check if we have a wallet first
            if (!await this.ensureWalletExists()) {
                return;
            }
            
            this.showMessage('📁 Select folder to import...', 'info');
            
            // Use the chooseDirectory API
            const result = await window.electronAPI.chooseDirectory();
            
            if (result.success && result.path) {
                this.showMessage('🔄 Importing folder contents...', 'info');
                
                // First, expand the Content Management section if collapsed
                const contentSection = document.querySelector('[data-target="file-content"]');
                const contentSectionContent = document.getElementById('file-content');
                
                if (contentSection && contentSectionContent.classList.contains('collapsed')) {
                    contentSection.click(); // Trigger the expand
                }
                
                // Use the existing convertFolder functionality
                await this.convertFolder();
                
                this.showMessage(`✅ Successfully imported folder: ${result.path}`, 'success');
                
                // Update library statistics
                this.updateLibraryStats();
                this.updateLibraryTab('my-content');
                
            } else if (result.path) {
                this.showMessage('❌ Failed to import folder', 'error');
            }
            // If result.path is undefined, user cancelled - don't show error
            
        } catch (error) {
            console.error('Import folder error:', error);
            this.showMessage('❌ Failed to import folder', 'error');
        }
    }

    async createCollection() {
        try {
            // Check if we have a wallet first
            if (!await this.ensureWalletExists()) {
                return;
            }
            
            const collectionName = await this.showCustomInput(
                'Enter a name for your new collection:',
                'Create Collection',
                'My Collection'
            );
            
            if (collectionName && collectionName.trim()) {
                const cleanName = collectionName.trim();
                
                // Create collection metadata
                const collection = {
                    id: Date.now().toString(),
                    name: cleanName,
                    created: new Date().toISOString(),
                    description: '',
                    files: [],
                    public: false,
                    tags: []
                };
                
                // Initialize collections array if it doesn't exist
                if (!this.collections) {
                    this.collections = [];
                }
                
                // Add to collections
                this.collections.push(collection);
                
                // Save to localStorage for persistence
                try {
                    localStorage.setItem('bacds_collections', JSON.stringify(this.collections));
                } catch (error) {
                    console.warn('Failed to save collections to localStorage:', error);
                }
                
                this.showMessage(`✅ Collection "${cleanName}" created successfully`, 'success');
                
                // Update library display
                this.updateLibraryTab('my-content');
                
                console.log('📚 Collection created:', collection);
                
            } else if (collectionName !== null) {
                this.showMessage('❌ Collection name cannot be empty', 'error');
            }
            // If collectionName is null, user cancelled - don't show error
            
        } catch (error) {
            console.error('Create collection error:', error);
            this.showMessage('❌ Failed to create collection', 'error');
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
        const hasFiles = this.files.length > 0;
        const hasCollections = this.collections && this.collections.length > 0;
        
        if (!hasFiles && !hasCollections) {
            gridElement.innerHTML = '<div class="empty-state">Your content library is empty. Add some files or create collections to get started!</div>';
            return;
        }

        let html = '';
        
        // Display collections first
        if (hasCollections) {
            html += this.collections.map(collection => {
                const fileCount = collection.files ? collection.files.length : 0;
                const createdDate = new Date(collection.created).toLocaleDateString();
                
                return `
                    <div class="library-item collection-item">
                        <div class="library-item-thumbnail">📁</div>
                        <div class="library-item-info">
                            <div class="library-item-title">${collection.name}</div>
                            <div class="library-item-meta">${fileCount} files • Created ${createdDate}</div>
                            <div class="library-item-actions">
                                <button class="btn small primary" onclick="window.bacdsClient.openCollection('${collection.id}')">Open</button>
                                <button class="btn small secondary" onclick="window.bacdsClient.editCollection('${collection.id}')">Edit</button>
                                <button class="btn small danger" onclick="window.bacdsClient.deleteCollection('${collection.id}')">Delete</button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        // Display files
        if (hasFiles) {
            html += this.files.map(file => {
                let thumbnailHtml = '';
                if (file.isImage && file.thumbnailPath) {
                    thumbnailHtml = `<img src="file://${file.thumbnailPath}" alt="${file.name}" class="library-item-thumbnail">`;
                } else if (file.isImage) {
                    thumbnailHtml = `<div class="library-item-thumbnail">🖼️</div>`;
                } else {
                    thumbnailHtml = `<div class="library-item-thumbnail">📄</div>`;
                }
                
                return `
                    <div class="library-item">
                        ${thumbnailHtml}
                        <div class="library-item-info">
                            <div class="library-item-title">${file.name}</div>
                            <div class="library-item-meta">${this.formatBytes(file.size)} • ${new Date(file.stored).toLocaleDateString()}</div>
                            <div class="library-item-actions">
                                <button class="btn small secondary" onclick="window.bacdsClient.previewFile('${file.address}')">Preview</button>
                                <button class="btn small primary" onclick="window.bacdsClient.shareFile('${file.address}')">Share</button>
                                <button class="btn small danger" onclick="window.bacdsClient.removeFile('${file.address}')">Remove</button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        gridElement.innerHTML = html;
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

    loadCollections() {
        try {
            const saved = localStorage.getItem('bacds_collections');
            if (saved) {
                this.collections = JSON.parse(saved);
                console.log('📚 Loaded collections:', this.collections.length);
            } else {
                this.collections = [];
            }
        } catch (error) {
            console.warn('Failed to load collections from localStorage:', error);
            this.collections = [];
        }
    }

    // Collection Management Functions
    async openCollection(collectionId) {
        const collection = this.collections.find(c => c.id === collectionId);
        if (collection) {
            this.showMessage(`📁 Opening collection: ${collection.name}`, 'info');
            // TODO: Implement collection view
            console.log('Opening collection:', collection);
        }
    }
    
    async editCollection(collectionId) {
        const collection = this.collections.find(c => c.id === collectionId);
        if (collection) {
            const newName = await this.showCustomInput(
                'Edit collection name:',
                'Edit Collection',
                collection.name
            );
            
            if (newName && newName.trim() && newName.trim() !== collection.name) {
                collection.name = newName.trim();
                collection.modified = new Date().toISOString();
                
                // Save changes
                try {
                    localStorage.setItem('bacds_collections', JSON.stringify(this.collections));
                    this.showMessage(`✅ Collection renamed to "${collection.name}"`, 'success');
                    this.updateLibraryTab('my-content');
                } catch (error) {
                    this.showMessage('❌ Failed to save collection changes', 'error');
                }
            }
        }
    }
    
    async deleteCollection(collectionId) {
        const collection = this.collections.find(c => c.id === collectionId);
        if (collection) {
            const confirmed = await this.showCustomConfirm(
                `Are you sure you want to delete the collection "${collection.name}"? This action cannot be undone.`,
                'Delete Collection'
            );
            
            if (confirmed) {
                this.collections = this.collections.filter(c => c.id !== collectionId);
                
                // Save changes
                try {
                    localStorage.setItem('bacds_collections', JSON.stringify(this.collections));
                    this.showMessage(`✅ Collection "${collection.name}" deleted`, 'success');
                    this.updateLibraryTab('my-content');
                } catch (error) {
                    this.showMessage('❌ Failed to delete collection', 'error');
                }
            }
        }
    }
    
    // File Action Functions
    async previewFile(fileAddress) {
        const file = this.files.find(f => f.address === fileAddress);
        if (file) {
            if (file.isImage && file.thumbnailPath) {
                // For images, show a preview
                this.showMessage(`🖼️ Previewing: ${file.name}`, 'info');
                // TODO: Implement image preview modal
            } else {
                this.showMessage(`👁️ Preview functionality coming soon for: ${file.name}`, 'info');
            }
        }
    }
    
    async shareFile(fileAddress) {
        const file = this.files.find(f => f.address === fileAddress);
        if (file) {
            this.showMessage(`🔗 Sharing: ${file.name}`, 'info');
            // TODO: Implement file sharing functionality
        }
    }
    
    async removeFile(fileAddress) {
        const file = this.files.find(f => f.address === fileAddress);
        if (file) {
            const confirmed = await this.showCustomConfirm(
                `Are you sure you want to remove "${file.name}" from your library? This action cannot be undone.`,
                'Remove File'
            );
            
            if (confirmed) {
                // Remove from files array
                this.files = this.files.filter(f => f.address !== fileAddress);
                
                this.showMessage(`✅ File "${file.name}" removed from library`, 'success');
                
                // Update displays
                this.updateFileList();
                this.updateLibraryTab('my-content');
                this.updateLibraryStats();
                this.updateMappingList();
            }
        }
    }

    // Additional Library Functions
    async refreshOthersContent() {
        this.showMessage('🔄 Refreshing network content...', 'info');
        // TODO: Implement network content refresh
        this.updateLibraryTab('others-content');
    }
    
    async downloadSelectedContent() {
        this.showMessage('📥 Download functionality coming soon...', 'info');
        // TODO: Implement download selected content
    }
    
    async browseMarketplace() {
        this.showMessage('🛒 Opening marketplace...', 'info');
        // TODO: Implement marketplace browsing
        this.updateLibraryTab('commercial-content');
    }
    
    async showMyPurchases() {
        this.showMessage('💳 Loading your purchases...', 'info');
        // TODO: Implement purchases view
    }

    // Token-related initialization
    initializeTokenData() {
        this.tokenData = {
            nerdBalance: 0,
            bsvBalance: 0.00000000,
            stakedAmount: 0,
            stakingRewards: 0.00,
            stakingApy: 5.5,
            votingPower: 0,
            revenueSharing: {
                creator: 70,
                seeder: 25,
                network: 5
            },
            seederRewards: {
                baseReward: 0.01,
                qualityMultiplier: 1.0
            },
            tokenHistory: [],
            distributionHistory: []
        };
        
        // Load from localStorage if exists
        const savedTokenData = localStorage.getItem('bacds_token_data');
        if (savedTokenData) {
            try {
                const parsed = JSON.parse(savedTokenData);
                this.tokenData = { ...this.tokenData, ...parsed };
            } catch (error) {
                console.warn('Failed to load token data:', error);
            }
        }
        
        this.updateTokenUI();
    }
    
    // Save token data to localStorage
    saveTokenData() {
        try {
            localStorage.setItem('bacds_token_data', JSON.stringify(this.tokenData));
        } catch (error) {
            console.warn('Failed to save token data:', error);
        }
    }
    
    // Update token UI elements
    updateTokenUI() {
        // Update balances
        document.getElementById('nerdBalance').textContent = this.tokenData.nerdBalance.toLocaleString();
        document.getElementById('bsvBalance').textContent = this.tokenData.bsvBalance.toFixed(8);
        document.getElementById('nerdUsdValue').textContent = `$${(this.tokenData.nerdBalance * 0.001).toFixed(2)}`;
        document.getElementById('bsvUsdValue').textContent = `$${(this.tokenData.bsvBalance * 50).toFixed(2)}`;
        
        // Update staking info
        document.getElementById('stakedAmount').textContent = this.tokenData.stakedAmount.toLocaleString();
        document.getElementById('stakingRewards').textContent = this.tokenData.stakingRewards.toFixed(2);
        document.getElementById('stakingApy').textContent = `${this.tokenData.stakingApy.toFixed(1)}%`;
        
        // Update governance
        document.getElementById('votingPower').textContent = this.tokenData.votingPower.toLocaleString();
        
        // Update revenue sharing sliders
        document.getElementById('creatorSlider').value = this.tokenData.revenueSharing.creator;
        document.getElementById('seederSlider').value = this.tokenData.revenueSharing.seeder;
        this.updateRevenueSliders();
        
        // Update seeder rewards
        document.getElementById('baseReward').value = this.tokenData.seederRewards.baseReward;
        document.getElementById('qualityMultiplier').value = this.tokenData.seederRewards.qualityMultiplier;
    }
    
    // Token Library Functions
    async stakeTokens() {
        const amount = await this.showCustomInput(
            'Enter amount of $NERD tokens to stake:',
            'Stake Tokens',
            '100'
        );
        
        if (amount && !isNaN(amount) && parseFloat(amount) > 0) {
            const stakeAmount = parseFloat(amount);
            
            if (stakeAmount <= this.tokenData.nerdBalance) {
                this.tokenData.nerdBalance -= stakeAmount;
                this.tokenData.stakedAmount += stakeAmount;
                this.tokenData.votingPower = this.tokenData.stakedAmount;
                
                this.addTokenHistory('stake', stakeAmount, 'Staked tokens for rewards');
                this.updateTokenUI();
                this.saveTokenData();
                
                this.showMessage(`✅ Successfully staked ${stakeAmount} $NERD tokens!`, 'success');
            } else {
                this.showMessage('❌ Insufficient $NERD balance for staking', 'error');
            }
        }
    }
    
    async unstakeTokens() {
        const amount = await this.showCustomInput(
            'Enter amount of $NERD tokens to unstake:',
            'Unstake Tokens',
            this.tokenData.stakedAmount.toString()
        );
        
        if (amount && !isNaN(amount) && parseFloat(amount) > 0) {
            const unstakeAmount = parseFloat(amount);
            
            if (unstakeAmount <= this.tokenData.stakedAmount) {
                this.tokenData.stakedAmount -= unstakeAmount;
                this.tokenData.nerdBalance += unstakeAmount;
                this.tokenData.votingPower = this.tokenData.stakedAmount;
                
                this.addTokenHistory('unstake', unstakeAmount, 'Unstaked tokens');
                this.updateTokenUI();
                this.saveTokenData();
                
                this.showMessage(`✅ Successfully unstaked ${unstakeAmount} $NERD tokens!`, 'success');
            } else {
                this.showMessage('❌ Insufficient staked balance', 'error');
            }
        }
    }
    
    async buyTokens() {
        this.showMessage('🔄 Opening token marketplace...', 'info');
        // TODO: Implement actual token purchase via 1Sat Ordinals
        
        // Simulate token purchase for demo
        const purchaseAmount = 1000;
        this.tokenData.nerdBalance += purchaseAmount;
        this.addTokenHistory('buy', purchaseAmount, 'Purchased from marketplace');
        this.updateTokenUI();
        this.saveTokenData();
        
        this.showMessage(`✅ Demo: Added ${purchaseAmount} $NERD tokens to your balance!`, 'success');
    }
    
    async sellTokens() {
        const amount = await this.showCustomInput(
            'Enter amount of $NERD tokens to sell:',
            'Sell Tokens',
            '100'
        );
        
        if (amount && !isNaN(amount) && parseFloat(amount) > 0) {
            const sellAmount = parseFloat(amount);
            
            if (sellAmount <= this.tokenData.nerdBalance) {
                this.tokenData.nerdBalance -= sellAmount;
                this.tokenData.bsvBalance += sellAmount * 0.00002; // Demo exchange rate
                
                this.addTokenHistory('sell', sellAmount, 'Sold for BSV');
                this.updateTokenUI();
                this.saveTokenData();
                
                this.showMessage(`✅ Successfully sold ${sellAmount} $NERD tokens!`, 'success');
            } else {
                this.showMessage('❌ Insufficient $NERD balance', 'error');
            }
        }
    }
    
    async viewGovernanceProposals() {
        this.showMessage('🗳️ Loading governance proposals...', 'info');
        // TODO: Implement governance proposal viewing
    }
    
    async submitGovernanceProposal() {
        if (this.tokenData.votingPower < 1000) {
            this.showMessage('❌ Need at least 1,000 voting power to submit proposals', 'error');
            return;
        }
        
        const proposal = await this.showCustomInput(
            'Enter your governance proposal:',
            'Submit Proposal',
            'Increase seeder rewards by 10%'
        );
        
        if (proposal && proposal.trim()) {
            this.showMessage(`✅ Proposal submitted: "${proposal.trim()}"`, 'success');
            // TODO: Implement actual proposal submission
        }
    }
    
    // Token Management Functions
    async issueContentTokens() {
        const title = document.getElementById('contentTitle').value;
        const amount = document.getElementById('tokenAmount').value;
        const price = document.getElementById('chunkPrice').value;
        
        if (!title || !amount || !price) {
            this.showMessage('❌ Please fill in all fields for token issuance', 'error');
            return;
        }
        
        const tokenAmount = parseInt(amount);
        const chunkPrice = parseFloat(price);
        
        if (tokenAmount <= 0 || chunkPrice < 0) {
            this.showMessage('❌ Invalid token amount or price', 'error');
            return;
        }
        
        // Create token issuance record
        const issuance = {
            id: Date.now().toString(),
            title: title.trim(),
            tokenAmount: tokenAmount,
            chunkPrice: chunkPrice,
            issued: new Date().toISOString(),
            status: 'active'
        };
        
        // Add to distribution history
        this.tokenData.distributionHistory.unshift(issuance);
        
        // Clear form
        document.getElementById('contentTitle').value = '';
        document.getElementById('tokenAmount').value = '';
        document.getElementById('chunkPrice').value = '';
        
        this.saveTokenData();
        this.updateTokenManagementStats();
        
        this.showMessage(`✅ Issued ${tokenAmount} tokens for "${title}"`, 'success');
    }
    
    updateRevenueSliders() {
        const creatorPercent = parseInt(document.getElementById('creatorSlider').value);
        const seederPercent = parseInt(document.getElementById('seederSlider').value);
        const networkPercent = 100 - creatorPercent - seederPercent;
        
        document.getElementById('creatorPercent').textContent = creatorPercent;
        document.getElementById('seederPercent').textContent = seederPercent;
        document.getElementById('networkPercent').textContent = networkPercent;
        
        // Ensure percentages add up to 100
        if (networkPercent < 0) {
            const adjustment = Math.abs(networkPercent);
            if (creatorPercent > seederPercent) {
                document.getElementById('creatorSlider').value = creatorPercent - adjustment;
            } else {
                document.getElementById('seederSlider').value = seederPercent - adjustment;
            }
            this.updateRevenueSliders(); // Recursive call to fix
        }
    }
    
    async updateRevenueSharing() {
        const creatorPercent = parseInt(document.getElementById('creatorSlider').value);
        const seederPercent = parseInt(document.getElementById('seederSlider').value);
        const networkPercent = 100 - creatorPercent - seederPercent;
        
        if (networkPercent < 0) {
            this.showMessage('❌ Revenue shares must total 100% or less', 'error');
            return;
        }
        
        this.tokenData.revenueSharing = {
            creator: creatorPercent,
            seeder: seederPercent,
            network: networkPercent
        };
        
        this.saveTokenData();
        this.showMessage(`✅ Revenue sharing updated: Creator ${creatorPercent}%, Seeders ${seederPercent}%, Network ${networkPercent}%`, 'success');
    }
    
    async updateSeederRewards() {
        const baseReward = parseFloat(document.getElementById('baseReward').value);
        const qualityMultiplier = parseFloat(document.getElementById('qualityMultiplier').value);
        
        if (isNaN(baseReward) || baseReward < 0) {
            this.showMessage('❌ Invalid base reward amount', 'error');
            return;
        }
        
        this.tokenData.seederRewards = {
            baseReward: baseReward,
            qualityMultiplier: qualityMultiplier
        };
        
        this.saveTokenData();
        this.showMessage(`✅ Seeder rewards updated: ${baseReward} $NERD per MB (${qualityMultiplier}x multiplier)`, 'success');
    }
    
    updateTokenManagementStats() {
        const totalTokensIssued = this.tokenData.distributionHistory.reduce((sum, item) => sum + item.tokenAmount, 0);
        const activeStreams = this.tokenData.distributionHistory.filter(item => item.status === 'active').length;
        
        document.getElementById('totalTokensIssued').textContent = totalTokensIssued.toLocaleString();
        document.getElementById('activeRevenueStreams').textContent = activeStreams;
        document.getElementById('totalSeederRewards').textContent = '$0.00'; // TODO: Calculate actual seeder rewards
    }
    
    addTokenHistory(type, amount, description) {
        const entry = {
            id: Date.now().toString(),
            type: type,
            amount: amount,
            description: description,
            timestamp: new Date().toISOString()
        };
        
        this.tokenData.tokenHistory.unshift(entry);
        
        // Keep only last 50 entries
        if (this.tokenData.tokenHistory.length > 50) {
            this.tokenData.tokenHistory = this.tokenData.tokenHistory.slice(0, 50);
        }
        
        this.updateTokenHistoryUI();
    }
    
    updateTokenHistoryUI() {
        const historyList = document.getElementById('tokenHistoryList');
        if (!historyList) return;
        
        if (this.tokenData.tokenHistory.length === 0) {
            historyList.innerHTML = '<div class="empty-state">No token transactions yet</div>';
            return;
        }
        
        const historyHTML = this.tokenData.tokenHistory.slice(0, 10).map(entry => {
            const date = new Date(entry.timestamp).toLocaleString();
            const typeIcon = {
                'stake': '🔒',
                'unstake': '🔓', 
                'buy': '💰',
                'sell': '💸',
                'reward': '🎁'
            }[entry.type] || '📝';
            
            return `
                <div class="history-entry">
                    <span class="history-icon">${typeIcon}</span>
                    <span class="history-description">${entry.description}</span>
                    <span class="history-amount">${entry.amount} $NERD</span>
                    <span class="history-date">${date}</span>
                </div>
            `;
        }).join('');
        
        historyList.innerHTML = historyHTML;
    }

    async startNerdProcess() {
        console.log('🚀 Attempting to start NERD daemon...');
        
        try {
            // Check daemon status first
            const statusResult = await window.electronAPI.getNerdDaemonStatus();
            
            if (statusResult.running) {
                this.showMessage(`✅ NERD daemon is already running (PID: ${statusResult.pid})`, 'success');
                return;
            }
            
            this.showMessage('🔄 Starting NERD daemon...', 'info');
            
            // Start the daemon
            const result = await window.electronAPI.startNerdDaemon();
            
            if (result.success) {
                this.showMessage(`✅ ${result.message} (PID: ${result.pid})`, 'success');
                console.log('✅ NERD daemon started successfully');
                
                // Update daemon status periodically
                this.startDaemonStatusMonitoring();
            } else {
                this.showMessage(`❌ Failed to start NERD daemon: ${result.error}`, 'error');
                console.error('❌ Failed to start NERD daemon:', result.error);
                
                // If executable not found, show helpful message
                if (result.error.includes('not found')) {
                    this.showMessage('💡 Tip: Build the daemon first by running "go build" in the nerd-daemon directory', 'info');
                }
            }
            
        } catch (error) {
            this.showMessage(`❌ Error starting NERD daemon: ${error.message}`, 'error');
            console.error('❌ Error starting NERD daemon:', error);
        }
    }

    async stopNerdProcess() {
        console.log('🛑 Attempting to stop NERD daemon...');
        
        try {
            const statusResult = await window.electronAPI.getNerdDaemonStatus();
            
            if (!statusResult.running) {
                this.showMessage('⚠️ NERD daemon is not running', 'warning');
                return;
            }
            
            this.showMessage('🔄 Stopping NERD daemon...', 'info');
            
            const result = await window.electronAPI.stopNerdDaemon();
            
            if (result.success) {
                this.showMessage(`✅ ${result.message}`, 'success');
                console.log('✅ NERD daemon stopped successfully');
                this.stopDaemonStatusMonitoring();
            } else {
                this.showMessage(`❌ Failed to stop NERD daemon: ${result.error}`, 'error');
                console.error('❌ Failed to stop NERD daemon:', result.error);
            }
            
        } catch (error) {
            this.showMessage(`❌ Error stopping NERD daemon: ${error.message}`, 'error');
            console.error('❌ Error stopping NERD daemon:', error);
        }
    }

    async checkDaemonStatusNow() {
        try {
            const status = await window.electronAPI.getNerdDaemonStatus();
            this.updateDaemonStatusDisplay(status);
            console.log('📊 Initial daemon status:', status);
        } catch (error) {
            console.error('Error checking initial daemon status:', error);
        }
    }

    startDaemonStatusMonitoring() {
        if (this.daemonStatusInterval) {
            clearInterval(this.daemonStatusInterval);
        }
        
        this.daemonStatusInterval = setInterval(async () => {
            try {
                const status = await window.electronAPI.getNerdDaemonStatus();
                this.updateDaemonStatusDisplay(status);
            } catch (error) {
                console.error('Error checking daemon status:', error);
            }
        }, 5000); // Check every 5 seconds
    }

    stopDaemonStatusMonitoring() {
        if (this.daemonStatusInterval) {
            clearInterval(this.daemonStatusInterval);
            this.daemonStatusInterval = null;
        }
    }

    updateDaemonStatusDisplay(status) {
        console.log('🔄 Updating daemon status display:', status);
        
        // Update UI elements that show daemon status
        const statusElements = document.querySelectorAll('[data-daemon-status]');
        console.log('📍 Found daemon status elements:', statusElements.length);
        
        statusElements.forEach(element => {
            const statusText = status.running ? `Running (PID: ${status.pid})` : 'Stopped';
            const statusClass = status.running ? 'daemon-running' : 'daemon-stopped';
            
            console.log('🔄 Setting status element to:', statusText);
            element.textContent = statusText;
            element.className = `daemon-status ${statusClass}`;
        });
    }

    // === Social Network Functions ===
    
    initializeSocialFeatures() {
        console.log('🤝 Initializing social network features...');
        
        // Social tab switching
        this.initializeSocialTabs();
        
        // Post composer
        document.getElementById('publishPost').addEventListener('click', () => this.publishPost());
        document.getElementById('exploreCreators').addEventListener('click', () => this.switchSocialTab('social-discover'));
        
        // Discover features
        document.getElementById('searchCreators').addEventListener('click', () => this.searchCreators());
        document.getElementById('creatorSearch').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchCreators();
        });
        
        // Category filtering
        document.querySelectorAll('.category-tag').forEach(tag => {
            tag.addEventListener('click', (e) => this.filterByCategory(e.target.dataset.category));
        });
        
        // Profile management
        document.getElementById('saveProfile').addEventListener('click', () => this.saveProfile());
        document.getElementById('previewProfile').addEventListener('click', () => this.previewProfile());
        document.getElementById('uploadAvatar').addEventListener('click', () => this.uploadAvatar());
        
        // Notification management
        document.getElementById('markAllRead').addEventListener('click', () => this.markAllNotificationsRead());
        document.getElementById('notificationSettings').addEventListener('click', () => this.openNotificationSettings());
        
        // Notification filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.filterNotifications(e.target.dataset.filter));
        });
        
        // Load initial social data
        this.loadSocialData();
        
        console.log('✅ BSV Social Protocol features initialized');
    }
    
    initializeSocialTabs() {
        const tabs = document.querySelectorAll('.social-tab');
        const contents = document.querySelectorAll('.social-tab-content');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab;
                this.switchSocialTab(target);
            });
        });
    }
    
    switchSocialTab(target) {
        // Update tab active states
        document.querySelectorAll('.social-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.tab === target) {
                tab.classList.add('active');
            }
        });
        
        // Update content active states
        document.querySelectorAll('.social-tab-content').forEach(content => {
            content.classList.remove('active');
            if (content.id === target) {
                content.classList.add('active');
            }
        });
        
        // Load tab-specific data
        switch (target) {
            case 'social-feed':
                this.loadSocialFeed();
                break;
            case 'social-discover':
                this.loadCreatorDiscovery();
                break;
            case 'social-profile':
                this.loadProfileData();
                break;
            case 'social-notifications':
                this.loadNotifications();
                break;
        }
    }
    
    async loadSocialData() {
        // Load social stats
        this.updateSocialStats({
            followers: 234,
            following: 156,
            socialEarnings: 1520
        });
        
        // Load initial feed if on feed tab
        if (document.querySelector('.social-tab[data-tab="social-feed"]').classList.contains('active')) {
            this.loadSocialFeed();
        }
    }
    
    updateSocialStats(stats) {
        document.getElementById('followersCount').textContent = stats.followers || 0;
        document.getElementById('followingCount').textContent = stats.following || 0;
        document.getElementById('socialEarnings').textContent = `${stats.socialEarnings || 0} $NERD`;
    }
    
    async publishPost() {
        const content = document.getElementById('postContent').value.trim();
        if (!content) {
            this.showMessage('Please enter some content for your post', 'warning');
            return;
        }
        
        try {
            // Simulate posting (in real implementation, this would connect to BSV Social Protocol)
            console.log('📝 Publishing post to BSV Social Protocol:', content);
            
            // Add post to feed
            this.addPostToFeed({
                id: Date.now().toString(),
                author: {
                    name: 'You',
                    avatar: '👤',
                    time: 'now'
                },
                content: content,
                engagement: {
                    likes: 0,
                    comments: 0,
                    shares: 0
                }
            });
            
            // Clear composer
            document.getElementById('postContent').value = '';
            
            this.showMessage('Post published successfully! 🎉', 'success');
            
        } catch (error) {
            console.error('Failed to publish post:', error);
            this.showMessage('Failed to publish post', 'error');
        }
    }
    
    loadSocialFeed() {
        const feedContainer = document.getElementById('socialFeedContainer');
        
        // Sample posts for demonstration
        const samplePosts = [
            {
                id: '1',
                author: {
                    name: 'Alex Chen',
                    avatar: '🚀',
                    time: '2h ago'
                },
                content: 'Just published my latest article about BSV Social Protocol and how it\'s changing content monetization. The micropayment system is revolutionary!',
                engagement: {
                    likes: 34,
                    comments: 8,
                    shares: 12
                }
            },
            {
                id: '2',
                author: {
                    name: 'Sarah Miller',
                    avatar: '🎨',
                    time: '4h ago'
                },
                content: 'Loving the new creator tools in BACDS! Being able to earn $NERD tokens for social engagement is a game-changer for content creators like me.',
                engagement: {
                    likes: 67,
                    comments: 15,
                    shares: 23
                }
            },
            {
                id: '3',
                author: {
                    name: 'David Wang',
                    avatar: '💻',
                    time: '6h ago'
                },
                content: 'The BSV Social Protocol implementation in NERD is impressive. Decentralized social networking with built-in payments is the future.',
                engagement: {
                    likes: 89,
                    comments: 22,
                    shares: 31
                }
            }
        ];
        
        if (samplePosts.length === 0) {
            feedContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">👋</div>
                    <h4>Welcome to BSV Social!</h4>
                    <p>Follow creators and engage with content to see posts here</p>
                    <button class="btn secondary" id="exploreCreators">Explore Creators</button>
                </div>
            `;
            return;
        }
        
        feedContainer.innerHTML = samplePosts.map(post => this.createPostHTML(post)).join('');
        
        // Add event listeners for engagement buttons
        this.attachPostEventListeners();
    }
    
    createPostHTML(post) {
        return `
            <div class="social-post fade-in" data-post-id="${post.id}">
                <div class="post-header">
                    <div class="post-author">
                        <div class="author-avatar">${post.author.avatar}</div>
                        <div class="author-info">
                            <h5>${post.author.name}</h5>
                            <span class="post-time">${post.author.time}</span>
                        </div>
                    </div>
                    <button class="engagement-btn" onclick="bacdsClient.showPostOptions('${post.id}')">⋯</button>
                </div>
                <div class="post-content">${post.content}</div>
                <div class="post-actions">
                    <div class="post-engagement">
                        <button class="engagement-btn" onclick="bacdsClient.likePost('${post.id}')">
                            ❤️ ${post.engagement.likes}
                        </button>
                        <button class="engagement-btn" onclick="bacdsClient.commentOnPost('${post.id}')">
                            💬 ${post.engagement.comments}
                        </button>
                        <button class="engagement-btn" onclick="bacdsClient.sharePost('${post.id}')">
                            🔄 ${post.engagement.shares}
                        </button>
                    </div>
                    <button class="engagement-btn" onclick="bacdsClient.tipPost('${post.id}')">
                        💰 Tip $NERD
                    </button>
                </div>
            </div>
        `;
    }
    
    addPostToFeed(post) {
        const feedContainer = document.getElementById('socialFeedContainer');
        const postHTML = this.createPostHTML(post);
        feedContainer.insertAdjacentHTML('afterbegin', postHTML);
        this.attachPostEventListeners();
    }
    
    attachPostEventListeners() {
        // Post event listeners are handled by onclick attributes in the HTML
        // This method can be used for additional event listeners if needed
    }
    
    async likePost(postId) {
        console.log('❤️ Liking post:', postId);
        // In real implementation, this would interact with BSV Social Protocol
        this.showMessage('Post liked! +1 $NERD token earned', 'success');
    }
    
    async commentOnPost(postId) {
        console.log('💬 Commenting on post:', postId);
        const comment = await this.showCustomInput('Enter your comment:', 'Comment on Post');
        if (comment) {
            console.log('Comment:', comment);
            this.showMessage('Comment posted! +5 $NERD tokens earned', 'success');
        }
    }
    
    async sharePost(postId) {
        console.log('🔄 Sharing post:', postId);
        this.showMessage('Post shared! +15 $NERD tokens earned', 'success');
    }
    
    async tipPost(postId) {
        console.log('💰 Tipping post:', postId);
        const amount = await this.showCustomInput('Enter tip amount (NERD tokens):', 'Tip Creator', '10');
        if (amount && !isNaN(amount) && parseFloat(amount) > 0) {
            this.showMessage(`Tipped ${amount} $NERD tokens to creator!`, 'success');
        }
    }
    
    showPostOptions(postId) {
        console.log('⋯ Post options for:', postId);
        // Could show a dropdown menu with options like: Report, Block, Copy Link, etc.
    }
    
    async searchCreators() {
        const query = document.getElementById('creatorSearch').value.trim();
        console.log('🔍 Searching creators:', query);
        
        if (!query) {
            this.showMessage('Please enter a search term', 'warning');
            return;
        }
        
        // Simulate search results
        this.loadCreatorDiscovery(query);
    }
    
    filterByCategory(category) {
        console.log('🏷️ Filtering by category:', category);
        
        // Update active category
        document.querySelectorAll('.category-tag').forEach(tag => {
            tag.classList.remove('active');
            if (tag.dataset.category === category) {
                tag.classList.add('active');
            }
        });
        
        this.loadCreatorDiscovery(null, category);
    }
    
    loadCreatorDiscovery(searchQuery = null, category = 'all') {
        const container = document.getElementById('suggestedCreators');
        
        // Sample creators for demonstration
        const sampleCreators = [
            {
                id: '1',
                name: 'Alex Johnson',
                avatar: '🚀',
                bio: 'BSV developer building the future of social networks',
                followers: 1245,
                following: 235,
                category: 'developers'
            },
            {
                id: '2',
                name: 'Sarah Miller',
                avatar: '🎨',
                bio: 'Digital artist creating NFTs on BSV blockchain',
                followers: 2341,
                following: 156,
                category: 'artists'
            },
            {
                id: '3',
                name: 'Mike Chen',
                avatar: '🎵',
                bio: 'Musician distributing music through BACDS',
                followers: 892,
                following: 347,
                category: 'musicians'
            },
            {
                id: '4',
                name: 'Emma Davis',
                avatar: '✍️',
                bio: 'Writer sharing stories and articles on BSV Social',
                followers: 1567,
                following: 289,
                category: 'writers'
            }
        ];
        
        let filteredCreators = sampleCreators;
        
        // Filter by category
        if (category !== 'all') {
            filteredCreators = sampleCreators.filter(creator => creator.category === category);
        }
        
        // Filter by search query
        if (searchQuery) {
            filteredCreators = filteredCreators.filter(creator => 
                creator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                creator.bio.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        
        if (filteredCreators.length === 0) {
            container.innerHTML = '<div class="empty-state">No creators found matching your criteria</div>';
            return;
        }
        
        container.innerHTML = filteredCreators.map(creator => `
            <div class="creator-card fade-in">
                <div class="creator-info">
                    <div class="creator-avatar">${creator.avatar}</div>
                    <div class="creator-details">
                        <h5>${creator.name}</h5>
                        <p class="creator-bio">${creator.bio}</p>
                        <div class="creator-stats">
                            <span>${creator.followers} followers</span>
                            <span>${creator.following} following</span>
                        </div>
                    </div>
                </div>
                <button class="btn secondary" onclick="bacdsClient.followCreator('${creator.id}')">
                    Follow
                </button>
            </div>
        `).join('');
    }
    
    async followCreator(creatorId) {
        console.log('👥 Following creator:', creatorId);
        this.showMessage('Now following creator! +10 $NERD tokens earned', 'success');
        
        // Update stats
        const currentFollowing = parseInt(document.getElementById('followingCount').textContent) || 0;
        document.getElementById('followingCount').textContent = currentFollowing + 1;
    }
    
    loadProfileData() {
        // Load user's profile data (in real implementation, this would come from BSV Social Protocol)
        console.log('👤 Loading profile data...');
        
        // Update analytics
        document.getElementById('profileViews').textContent = '1,234';
        document.getElementById('contentInteractions').textContent = '5,678';
        document.getElementById('socialTips').textContent = '890 $NERD';
    }
    
    async saveProfile() {
        const displayName = document.getElementById('displayName').value.trim();
        const bio = document.getElementById('profileBio').value.trim();
        const website = document.getElementById('profileWebsite').value.trim();
        const category = document.getElementById('profileCategory').value;
        
        if (!displayName) {
            this.showMessage('Please enter a display name', 'warning');
            return;
        }
        
        console.log('💾 Saving profile:', { displayName, bio, website, category });
        
        // In real implementation, this would save to BSV Social Protocol
        this.showMessage('Profile saved successfully!', 'success');
    }
    
    async previewProfile() {
        console.log('👀 Previewing profile...');
        this.showMessage('Profile preview feature coming soon!', 'info');
    }
    
    async uploadAvatar() {
        console.log('📸 Uploading avatar...');
        this.showMessage('Avatar upload feature coming soon!', 'info');
    }
    
    loadNotifications() {
        const container = document.getElementById('notificationsList');
        
        // Sample notifications for demonstration
        const sampleNotifications = [
            {
                id: '1',
                type: 'like',
                user: { name: 'Alex Chen', avatar: '🚀' },
                text: 'liked your post about BSV Social Protocol',
                time: '5 minutes ago',
                unread: true
            },
            {
                id: '2',
                type: 'comment',
                user: { name: 'Sarah Miller', avatar: '🎨' },
                text: 'commented on your post',
                time: '1 hour ago',
                unread: true
            },
            {
                id: '3',
                type: 'follow',
                user: { name: 'Mike Chen', avatar: '🎵' },
                text: 'started following you',
                time: '2 hours ago',
                unread: false
            },
            {
                id: '4',
                type: 'tip',
                user: { name: 'Emma Davis', avatar: '✍️' },
                text: 'tipped you 25 $NERD tokens',
                time: '1 day ago',
                unread: false
            }
        ];
        
        if (sampleNotifications.length === 0) {
            container.innerHTML = '<div class="empty-state">No notifications yet</div>';
            return;
        }
        
        // Update notification badge
        const unreadCount = sampleNotifications.filter(n => n.unread).length;
        const badge = document.getElementById('notificationBadge');
        if (unreadCount > 0) {
            badge.textContent = unreadCount;
            badge.style.display = 'inline';
        } else {
            badge.style.display = 'none';
        }
        
        container.innerHTML = sampleNotifications.map(notification => `
            <div class="notification-item ${notification.unread ? 'unread' : ''}" data-notification-id="${notification.id}">
                <div class="notification-avatar">${notification.user.avatar}</div>
                <div class="notification-content">
                    <div class="notification-text">
                        <strong>${notification.user.name}</strong> ${notification.text}
                    </div>
                    <div class="notification-time">${notification.time}</div>
                </div>
                <div class="notification-icon ${notification.type}">
                    ${this.getNotificationIcon(notification.type)}
                </div>
            </div>
        `).join('');
    }
    
    getNotificationIcon(type) {
        const icons = {
            like: '❤️',
            comment: '💬',
            follow: '👥',
            tip: '💰'
        };
        return icons[type] || '🔔';
    }
    
    filterNotifications(filter) {
        console.log('🔍 Filtering notifications by:', filter);
        
        // Update active filter
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.filter === filter) {
                btn.classList.add('active');
            }
        });
        
        // In real implementation, this would filter the notifications
        this.loadNotifications();
    }
    
    markAllNotificationsRead() {
        console.log('✅ Marking all notifications as read');
        
        // Remove unread styles
        document.querySelectorAll('.notification-item.unread').forEach(item => {
            item.classList.remove('unread');
        });
        
        // Hide notification badge
        document.getElementById('notificationBadge').style.display = 'none';
        
        this.showMessage('All notifications marked as read', 'success');
    }
    
    openNotificationSettings() {
        console.log('⚙️ Opening notification settings');
        this.showMessage('Notification settings coming soon!', 'info');
    }

    // === Market Features ===
    
    initializeMarketFeatures() {
        console.log('💰 Initializing market features...');
        
        try {
            // Market tab functionality
            document.getElementById('refreshPrices')?.addEventListener('click', () => this.refreshMarketPrices());
            document.getElementById('exportPortfolio')?.addEventListener('click', () => this.exportPortfolio());
            document.getElementById('browseContent')?.addEventListener('click', () => this.switchSocialTab('social-discover'));
            document.getElementById('becomeDistributor')?.addEventListener('click', () => this.showDistributorInfo());
            
            // Initialize portfolio data
            this.loadPortfolioData();
            
            console.log('Market features initialized successfully');
        } catch (error) {
            console.error('Error initializing market features:', error);
        }
    }
    
    async refreshMarketPrices() {
        console.log('🔄 Refreshing market prices...');
        
        try {
            // Simulate price refresh
            const refreshBtn = document.getElementById('refreshPrices');
            const originalText = refreshBtn.textContent;
            refreshBtn.textContent = '🔄 Refreshing...';
            refreshBtn.disabled = true;
            
            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Update mock prices
            document.getElementById('nerdPrice').textContent = '$0.0042';
            document.getElementById('nerdChange').textContent = '+2.34%';
            document.getElementById('nerdChange').className = 'token-change positive';
            
            // Update portfolio value
            document.getElementById('totalPortfolioValue').textContent = '$126.84';
            document.getElementById('portfolioChange').textContent = '+$2.96 (+2.39%)';
            
            refreshBtn.textContent = originalText;
            refreshBtn.disabled = false;
            
            this.showMessage('Market prices refreshed successfully', 'success');
        } catch (error) {
            console.error('Error refreshing prices:', error);
            this.showMessage('Failed to refresh prices', 'error');
        }
    }
    
    exportPortfolio() {
        console.log('📊 Exporting portfolio data...');
        
        try {
            const portfolioData = {
                timestamp: new Date().toISOString(),
                totalValue: '$126.84',
                tokens: {
                    platform: [
                        { symbol: '$NERD', holdings: '30,000', value: '$126.84' }
                    ],
                    content: [],
                    distributor: []
                }
            };
            
            const dataStr = JSON.stringify(portfolioData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `portfolio-${Date.now()}.json`;
            link.click();
            
            URL.revokeObjectURL(url);
            this.showMessage('Portfolio data exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting portfolio:', error);
            this.showMessage('Failed to export portfolio', 'error');
        }
    }
    
    loadPortfolioData() {
        // Load initial portfolio data
        document.getElementById('nerdHoldings').textContent = '30,000 $NERD';
        document.getElementById('nerdValue').textContent = '$126.84';
        document.getElementById('totalPortfolioValue').textContent = '$126.84';
    }
    
    showDistributorInfo() {
        this.showMessage('Distributor program coming soon! Earn $NERD by running network nodes.', 'info');
    }
    
    // === Mint Features ===
    
    initializeMintFeatures() {
        console.log('🏭 Initializing mint features...');
        
        try {
            // Token type selection
            const typeOptions = document.querySelectorAll('.token-type-option');
            typeOptions.forEach(option => {
                option.addEventListener('click', () => this.selectTokenType(option));
            });
            
            // Template selection
            const templateItems = document.querySelectorAll('.template-item');
            templateItems.forEach(item => {
                item.addEventListener('click', () => this.applyTemplate(item.dataset.template));
            });
            
            // Mint actions
            document.getElementById('previewToken')?.addEventListener('click', () => this.previewToken());
            document.getElementById('mintToken')?.addEventListener('click', () => this.mintToken());
            
            // Form validation
            const inputs = ['tokenName', 'tokenSymbol', 'tokenDescription', 'tokenSupply', 'initialPrice'];
            inputs.forEach(inputId => {
                const input = document.getElementById(inputId);
                if (input) {
                    input.addEventListener('input', () => this.validateTokenForm());
                }
            });
            
            console.log('Mint features initialized successfully');
        } catch (error) {
            console.error('Error initializing mint features:', error);
        }
    }
    
    selectTokenType(option) {
        // Update active state
        document.querySelectorAll('.token-type-option').forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
        
        const tokenType = option.dataset.type;
        console.log(`Selected token type: ${tokenType}`);
        
        // Update mint cost based on type
        const mintCostInput = document.getElementById('mintCost');
        const costs = { content: 100, distributor: 500, utility: 250 };
        mintCostInput.value = costs[tokenType] || 100;
        
        this.validateTokenForm();
    }
    
    applyTemplate(templateType) {
        console.log(`Applying template: ${templateType}`);
        
        const templates = {
            artwork: {
                name: 'Digital Artwork Collection',
                symbol: 'ART',
                description: 'Unique digital artwork with provable ownership and authenticity.',
                supply: 1000,
                price: 0.001
            },
            music: {
                name: 'Music Album Token',
                symbol: 'MUSIC',
                description: 'Exclusive access to music content with fan benefits.',
                supply: 5000,
                price: 0.0005
            },
            video: {
                name: 'Video Content Series',
                symbol: 'VIDEO',
                description: 'Premium video content with subscriber benefits.',
                supply: 2500,
                price: 0.002
            },
            service: {
                name: 'Service Access Token',
                symbol: 'SVC',
                description: 'Access token for premium services and features.',
                supply: 10000,
                price: 0.0001
            }
        };
        
        const template = templates[templateType];
        if (template) {
            document.getElementById('tokenName').value = template.name;
            document.getElementById('tokenSymbol').value = template.symbol;
            document.getElementById('tokenDescription').value = template.description;
            document.getElementById('tokenSupply').value = template.supply;
            document.getElementById('initialPrice').value = template.price;
            
            this.validateTokenForm();
        }
    }
    
    validateTokenForm() {
        const name = document.getElementById('tokenName').value.trim();
        const symbol = document.getElementById('tokenSymbol').value.trim();
        const description = document.getElementById('tokenDescription').value.trim();
        const supply = parseInt(document.getElementById('tokenSupply').value);
        const price = parseFloat(document.getElementById('initialPrice').value);
        
        const isValid = name && symbol && description && supply > 0 && price > 0;
        
        const mintButton = document.getElementById('mintToken');
        const previewButton = document.getElementById('previewToken');
        
        mintButton.disabled = !isValid;
        previewButton.disabled = !isValid;
        
        return isValid;
    }
    
    previewToken() {
        if (!this.validateTokenForm()) return;
        
        const tokenData = this.getTokenFormData();
        
        const preview = `
Token Preview:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📛 Name: ${tokenData.name}
🏷️  Symbol: ${tokenData.symbol}
📄 Description: ${tokenData.description}
🔢 Total Supply: ${tokenData.supply.toLocaleString()}
💰 Initial Price: ${tokenData.price} BSV
💸 Mint Cost: ${tokenData.mintCost} $NERD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `;
        
        alert(preview);
    }
    
    async mintToken() {
        if (!this.validateTokenForm()) return;
        
        const tokenData = this.getTokenFormData();
        console.log('🏭 Minting token:', tokenData);
        
        try {
            const mintButton = document.getElementById('mintToken');
            const originalText = mintButton.textContent;
            mintButton.textContent = '🏭 Minting...';
            mintButton.disabled = true;
            
            // Simulate minting process
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Add to mint history
            this.addToMintHistory(tokenData);
            
            // Clear form
            this.clearTokenForm();
            
            mintButton.textContent = originalText;
            mintButton.disabled = false;
            
            this.showMessage(`Token "${tokenData.symbol}" minted successfully!`, 'success');
        } catch (error) {
            console.error('Error minting token:', error);
            this.showMessage('Failed to mint token', 'error');
        }
    }
    
    getTokenFormData() {
        return {
            name: document.getElementById('tokenName').value.trim(),
            symbol: document.getElementById('tokenSymbol').value.trim(),
            description: document.getElementById('tokenDescription').value.trim(),
            supply: parseInt(document.getElementById('tokenSupply').value),
            price: parseFloat(document.getElementById('initialPrice').value),
            mintCost: parseInt(document.getElementById('mintCost').value),
            type: document.querySelector('.token-type-option.active').dataset.type,
            timestamp: new Date().toISOString()
        };
    }
    
    clearTokenForm() {
        document.getElementById('tokenName').value = '';
        document.getElementById('tokenSymbol').value = '';
        document.getElementById('tokenDescription').value = '';
        document.getElementById('tokenSupply').value = '';
        document.getElementById('initialPrice').value = '';
        this.validateTokenForm();
    }
    
    addToMintHistory(tokenData) {
        const historyContainer = document.getElementById('mintHistory');
        
        // Remove empty state if it exists
        const emptyState = historyContainer.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }
        
        const historyItem = document.createElement('div');
        historyItem.className = 'mint-history-item';
        historyItem.innerHTML = `
            <div class="history-item-header">
                <strong>${tokenData.symbol}</strong>
                <span class="history-date">${new Date(tokenData.timestamp).toLocaleDateString()}</span>
            </div>
            <div class="history-item-details">
                <div>${tokenData.name}</div>
                <div>Supply: ${tokenData.supply.toLocaleString()}</div>
            </div>
        `;
        
        historyContainer.insertBefore(historyItem, historyContainer.firstChild);
    }

    startDaemonStatusMonitoring() {
        if (this.daemonStatusInterval) {
            clearInterval(this.daemonStatusInterval);
        }
        
        this.daemonStatusInterval = setInterval(async () => {
            try {
                const status = await window.electronAPI.getNerdDaemonStatus();
                this.updateDaemonStatusDisplay(status);
            } catch (error) {
                console.error('Error checking daemon status:', error);
            }
        }, 5000); // Check every 5 seconds
    }
}

// Debug functions for testing IPC
window.testWalletStatus = async function() {
    const output = document.getElementById('debugOutput');
    output.innerHTML = '🔄 Testing wallet status...<br>';
    
    try {
        output.innerHTML += `electronAPI available: ${!!window.electronAPI}<br>`;
        output.innerHTML += `getWalletStatus function: ${typeof window.electronAPI?.getWalletStatus}<br>`;
        
        if (window.electronAPI && window.electronAPI.getWalletStatus) {
            output.innerHTML += '📞 Calling getWalletStatus...<br>';
            const result = await window.electronAPI.getWalletStatus();
            output.innerHTML += `✅ Result: <pre>${JSON.stringify(result, null, 2)}</pre><br>`;
            
            // Also update the actual wallet display with this working data
            output.innerHTML += '🔧 Forcing wallet display update...<br>';
            if (window.bacdsClient) {
                window.bacdsClient.walletStatus = result;
                window.bacdsClient.updateWalletDisplay();
                output.innerHTML += '✅ Wallet display updated!<br>';
            } else {
                output.innerHTML += '❌ bacdsClient not available yet<br>';
                // Try to update the display directly
                output.innerHTML += '🔧 Attempting direct DOM update...<br>';
                const statusDiv = document.getElementById('walletStatus');
                if (statusDiv) {
                    statusDiv.innerHTML = `
                        <div class="wallet-info">
                            <div class="status-item">
                                <span class="label">Status:</span>
                                <span class="value success">✅ Wallet Loaded</span>
                            </div>
                            <div class="status-item">
                                <span class="label">Addresses:</span>
                                <span class="value">${result.addressIndex} generated</span>
                            </div>
                            <div class="status-item">
                                <span class="label">Data Directory:</span>
                                <span class="value">${result.dataDir}</span>
                            </div>
                            <div class="status-item">
                                <span class="label">Created:</span>
                                <span class="value">${new Date(result.created).toLocaleDateString()}</span>
                            </div>
                        </div>
                    `;
                    output.innerHTML += '✅ Direct DOM update completed!<br>';
                } else {
                    output.innerHTML += '❌ Could not find walletStatus element<br>';
                }
            }
        } else {
            output.innerHTML += '❌ electronAPI or getWalletStatus not available<br>';
        }
    } catch (error) {
        output.innerHTML += `❌ Error: ${error.message}<br>`;
    }
};

window.testDaemonStatus = async function() {
    const output = document.getElementById('debugOutput');
    output.innerHTML = '🔄 Testing daemon status...<br>';
    
    try {
        if (window.electronAPI && window.electronAPI.getNerdDaemonStatus) {
            output.innerHTML += '📞 Calling getNerdDaemonStatus...<br>';
            const result = await window.electronAPI.getNerdDaemonStatus();
            output.innerHTML += `✅ Result: <pre>${JSON.stringify(result, null, 2)}</pre><br>`;
        } else {
            output.innerHTML += '❌ electronAPI or getNerdDaemonStatus not available<br>';
        }
    } catch (error) {
        output.innerHTML += `❌ Error: ${error.message}<br>`;
    }
};

window.testStartDaemon = async function() {
    const output = document.getElementById('debugOutput');
    output.innerHTML = '🔄 Starting daemon...<br>';
    
    try {
        if (window.electronAPI && window.electronAPI.startNerdDaemon) {
            output.innerHTML += '📞 Calling startNerdDaemon...<br>';
            const result = await window.electronAPI.startNerdDaemon();
            output.innerHTML += `✅ Result: <pre>${JSON.stringify(result, null, 2)}</pre><br>`;
            
            // Update daemon status display
            if (result.success) {
                output.innerHTML += '🔄 Checking daemon status after start...<br>';
                setTimeout(async () => {
                    const status = await window.electronAPI.getNerdDaemonStatus();
                    output.innerHTML += `📊 New status: <pre>${JSON.stringify(status, null, 2)}</pre><br>`;
                }, 3000);
            }
        } else {
            output.innerHTML += '❌ electronAPI or startNerdDaemon not available<br>';
        }
    } catch (error) {
        output.innerHTML += `❌ Error: ${error.message}<br>`;
    }
};

window.testStopDaemon = async function() {
    const output = document.getElementById('debugOutput');
    output.innerHTML = '🔄 Stopping daemon...<br>';
    
    try {
        if (window.electronAPI && window.electronAPI.stopNerdDaemon) {
            output.innerHTML += '📞 Calling stopNerdDaemon...<br>';
            const result = await window.electronAPI.stopNerdDaemon();
            output.innerHTML += `✅ Result: <pre>${JSON.stringify(result, null, 2)}</pre><br>`;
        } else {
            output.innerHTML += '❌ electronAPI or stopNerdDaemon not available<br>';
        }
    } catch (error) {
        output.innerHTML += `❌ Error: ${error.message}<br>`;
    }
};

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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌟 DOM loaded, initializing BACDS...');
    
    // Create global instance for onclick handlers
    window.bacdsClient = new BACDSClient();
    
    // Initialize collapsible sections
    initializeCollapsibleSections();
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