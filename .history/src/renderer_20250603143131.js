let selectedFiles = [];
let outputFolder = null;
let sourceFolders = [];

const elements = {
    // HD Wallet controls
    generateMasterKey: document.getElementById('generateMasterKey'),
    showMasterKey: document.getElementById('showMasterKey'),
    importMasterKey: document.getElementById('importMasterKey'),
    masterKeyInput: document.getElementById('masterKeyInput'),
    masterKeyDisplay: document.getElementById('masterKeyDisplay'),
    
    // File/Folder selection
    selectFiles: document.getElementById('selectFiles'),
    selectFolders: document.getElementById('selectFolders'),
    dropZone: document.getElementById('dropZone'),
    fileList: document.getElementById('fileList'),
    
    // Output and processing
    outputSection: document.getElementById('outputSection'),
    selectOutputFolder: document.getElementById('selectOutputFolder'),
    selectedFolder: document.getElementById('selectedFolder'),
    dangerZone: document.getElementById('dangerZone'),
    deleteSourceFolders: document.getElementById('deleteSourceFolders'),
    foldersToDelete: document.getElementById('foldersToDelete'),
    processSection: document.getElementById('processSection'),
    processFiles: document.getElementById('processFiles'),
    results: document.getElementById('results')
};

// Event listeners
elements.generateMasterKey.addEventListener('click', generateNewMasterKey);
elements.showMasterKey.addEventListener('click', showCurrentMasterKey);
elements.importMasterKey.addEventListener('click', importMasterKey);
elements.selectFiles.addEventListener('click', selectFiles);
elements.selectFolders.addEventListener('click', selectFolders);
elements.selectOutputFolder.addEventListener('click', selectOutputFolder);
elements.processFiles.addEventListener('click', processFiles);
elements.deleteSourceFolders.addEventListener('change', updateDangerZone);

// Drag and drop event listeners
elements.dropZone.addEventListener('click', selectFiles);
elements.dropZone.addEventListener('dragover', handleDragOver);
elements.dropZone.addEventListener('dragleave', handleDragLeave);
elements.dropZone.addEventListener('drop', handleDrop);

// Prevent default drag behaviors on document
document.addEventListener('dragover', preventDefault);
document.addEventListener('drop', preventDefault);

function preventDefault(e) {
    e.preventDefault();
    e.stopPropagation();
}

// HD Wallet functions
async function generateNewMasterKey() {
    try {
        const result = await window.electronAPI.generateNewMasterKey();
        showMasterKeyMessage(result.masterKey, result.message, 'success');
    } catch (error) {
        showMasterKeyMessage('', `Error: ${error.message}`, 'error');
    }
}

async function showCurrentMasterKey() {
    try {
        const masterKey = await window.electronAPI.getMasterKey();
        showMasterKeyMessage(masterKey, 'Current master key (save this safely!):', 'warning');
    } catch (error) {
        showMasterKeyMessage('', `Error: ${error.message}`, 'error');
    }
}

async function importMasterKey() {
    const hexKey = elements.masterKeyInput.value.trim();
    if (!hexKey) {
        showMasterKeyMessage('', 'Please enter a master key', 'error');
        return;
    }
    
    try {
        const result = await window.electronAPI.importMasterKey(hexKey);
        if (result.success) {
            showMasterKeyMessage(hexKey, result.message, 'success');
            elements.masterKeyInput.value = '';
        } else {
            showMasterKeyMessage('', result.error, 'error');
        }
    } catch (error) {
        showMasterKeyMessage('', `Error: ${error.message}`, 'error');
    }
}

function showMasterKeyMessage(key, message, type) {
    elements.masterKeyDisplay.className = `master-key-display ${type}`;
    elements.masterKeyDisplay.innerHTML = `
        <div style="margin-bottom: 10px; font-weight: 600;">${message}</div>
        ${key ? `<div style="background: rgba(0,0,0,0.1); padding: 10px; border-radius: 4px; margin-top: 10px;">Master Key: ${key}</div>` : ''}
    `;
}

// Drag and drop handlers
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.dropZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (!elements.dropZone.contains(e.relatedTarget)) {
        elements.dropZone.classList.remove('drag-over');
    }
}

async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.dropZone.classList.remove('drag-over');
    
    const items = Array.from(e.dataTransfer.items);
    const files = Array.from(e.dataTransfer.files);
    let hasDirectories = false;
    const droppedFiles = [];
    
    // Check if any directories were dropped
    for (const item of items) {
        if (item.kind === 'file') {
            const entry = item.webkitGetAsEntry();
            if (entry && entry.isDirectory) {
                hasDirectories = true;
                break;
            }
        }
    }
    
    // Also check by file type (directories typically have empty type)
    const directoryFiles = files.filter(file => file.type === '' && file.size === 0);
    if (directoryFiles.length > 0) {
        hasDirectories = true;
    }
    
    // If folders were dropped, automatically open folder selection dialog
    if (hasDirectories) {
        showLoading('📁 Folders detected! Opening folder selection dialog...');
        setTimeout(async () => {
            try {
                const result = await window.electronAPI.selectFolders();
                
                if (result.folders && result.folders.length > 0) {
                    sourceFolders = [...new Set([...sourceFolders, ...result.folders])];
                    
                    if (result.files && result.files.length > 0) {
                        await addFilesToList(result.files);
                        showSuccess(`Found ${result.files.length} JPEG files in ${result.folders.length} folder(s) with nested subdirectories.`);
                    } else {
                        showError('No JPEG files found in the selected folders.');
                    }
                } else {
                    clearResults();
                }
            } catch (error) {
                showError('Error processing folders. Please try again.');
            }
        }, 500);
        return;
    }
    
    // Process individual files
    for (const file of files) {
        const extension = file.name.toLowerCase().split('.').pop();
        if (['jpg', 'jpeg'].includes(extension)) {
            droppedFiles.push(file.path || file.name);
        }
    }
    
    if (droppedFiles.length > 0) {
        await addFilesToList(droppedFiles);
    } else {
        showError('No JPEG files found in the dropped items.');
    }
}

// File/Folder selection functions
async function selectFiles() {
    try {
        const filePaths = await window.electronAPI.selectFiles();
        if (filePaths && filePaths.length > 0) {
            await addFilesToList(filePaths);
        }
    } catch (error) {
        console.error('Error selecting files:', error);
        showError('Failed to select files. Please try again.');
    }
}

async function selectFolders() {
    try {
        showLoading('Scanning folders for JPEG files...');
        const result = await window.electronAPI.selectFolders();
        
        if (result.folders && result.folders.length > 0) {
            sourceFolders = [...new Set([...sourceFolders, ...result.folders])]; // Remove duplicates
            
            if (result.files && result.files.length > 0) {
                await addFilesToList(result.files);
                showSuccess(`Found ${result.files.length} JPEG files in ${result.folders.length} folder(s).`);
            } else {
                showError('No JPEG files found in the selected folders.');
            }
        }
    } catch (error) {
        console.error('Error selecting folders:', error);
        showError('Failed to select folders. Please try again.');
    }
}

async function addFilesToList(newFilePaths) {
    // Check for duplicates
    const uniqueFiles = newFilePaths.filter(filePath => 
        !selectedFiles.includes(filePath)
    );
    
    if (uniqueFiles.length === 0) {
        showError('All selected files are already in the list.');
        return;
    }
    
    // Add to existing selection
    selectedFiles = [...selectedFiles, ...uniqueFiles];
    
    displayFileList();
    updateWorkflowSteps();
    clearResults();
    
    showSuccess(`Added ${uniqueFiles.length} JPEG file(s) to the list.`);
}

async function selectOutputFolder() {
    try {
        const result = await window.electronAPI.selectOutputFolder();
        if (result && (result.folder || result)) {
            // Handle both old and new response formats
            const folder = result.folder || result;
            outputFolder = folder;
            
            let displayHtml = `
                <div class="folder-selection">
                    <strong>✅ Output Folder Selected:</strong><br>
                    <span class="folder-path">${folder}</span><br>
                    <small>📋 Renamed files will be copied here (originals preserved unless deletion enabled below)</small>
                </div>
            `;
            
            // Check if master key was found and loaded
            if (result.masterKeyFound && result.masterKeyInfo) {
                const keyInfo = result.masterKeyInfo;
                const createdDate = keyInfo.created ? new Date(keyInfo.created).toLocaleString() : 'Unknown';
                
                displayHtml += `
                    <div class="master-key-found">
                        <strong>🔑 Master Key Found & Loaded:</strong><br>
                        <small>Created: ${createdDate}</small><br>
                        <small>All files will use this master key for address generation</small>
                    </div>
                `;
                
                // Show success message for master key loading
                showMasterKeyMessage(keyInfo.masterKey, 'Master key automatically loaded from output folder!', 'success');
                setTimeout(() => {
                    showSuccess('Output folder selected and master key loaded! Your files will use consistent addressing.');
                }, 100);
            } else {
                showSuccess('Output folder selected successfully! A new master key file will be created.');
            }
            
            elements.selectedFolder.innerHTML = displayHtml;
            updateWorkflowSteps();
            clearResults();
        }
    } catch (error) {
        console.error('Error selecting output folder:', error);
        showError('Failed to select output folder. Please try again.');
    }
}

function updateWorkflowSteps() {
    // Show output section if files are selected
    if (selectedFiles.length > 0) {
        elements.outputSection.style.display = 'block';
        
        // Show danger zone if we have source folders
        if (sourceFolders.length > 0) {
            elements.dangerZone.style.display = 'block';
            updateDangerZone();
        }
    } else {
        elements.outputSection.style.display = 'none';
        elements.processSection.style.display = 'none';
        return;
    }
    
    // Show process section if both files and folder are selected
    if (selectedFiles.length > 0 && outputFolder) {
        elements.processSection.style.display = 'block';
        elements.processFiles.disabled = false;
    } else {
        elements.processSection.style.display = 'none';
    }
}

function updateDangerZone() {
    if (elements.deleteSourceFolders.checked && sourceFolders.length > 0) {
        elements.foldersToDelete.className = 'folders-to-delete show';
        elements.foldersToDelete.innerHTML = `
            <div class="danger-warning">
                <strong>⚠️ SOURCE FOLDERS that will be PERMANENTLY DELETED after successful copying:</strong><br>
                <small>(These are the original folders where your files came from - NOT the output folder)</small>
            </div>
            <div class="folder-list">
                ${sourceFolders.map(folder => `📁 ${folder}`).join('<br>')}
            </div>
        `;
    } else {
        elements.foldersToDelete.className = 'folders-to-delete';
    }
}

function displayFileList() {
    if (selectedFiles.length === 0) {
        elements.fileList.innerHTML = '<div class="empty-state">No files selected</div>';
        return;
    }

    const fileItems = selectedFiles.map((filePath, index) => {
        const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || filePath;
        return `
            <div class="file-item">
                <div class="file-info">
                    <div class="file-name">📷 ${fileName}</div>
                    <div class="file-path">${filePath}</div>
                </div>
                <button class="danger-btn remove-btn" onclick="removeFile(${index})">
                    ❌ Remove
                </button>
            </div>
        `;
    }).join('');

    const fileCounter = `
        <div class="file-counter">
            📊 ${selectedFiles.length} file${selectedFiles.length === 1 ? '' : 's'} selected
            ${sourceFolders.length > 0 ? `<br>📂 From ${sourceFolders.length} folder${sourceFolders.length === 1 ? '' : 's'}` : ''}
        </div>
    `;

    elements.fileList.innerHTML = fileItems + fileCounter;
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    displayFileList();
    updateWorkflowSteps();
}

async function processFiles() {
    if (selectedFiles.length === 0) {
        showError('No files selected for processing.');
        return;
    }
    
    if (!outputFolder) {
        showError('Please select an output folder first.');
        return;
    }

    const shouldDeleteFolders = elements.deleteSourceFolders.checked;
    
    if (shouldDeleteFolders && sourceFolders.length > 0) {
        const confirmed = confirm(
            `🔄 PROCESSING SUMMARY:\n` +
            `✅ Files will be COPIED and RENAMED to: ${outputFolder}\n\n` +
            `⚠️ AFTER successful copying, these SOURCE folders will be PERMANENTLY DELETED:\n\n${sourceFolders.join('\n')}\n\n` +
            `❗ IMPORTANT: Your output folder (${outputFolder}) will NOT be deleted.\n` +
            `Only the original source folders listed above will be removed.\n\n` +
            `Are you sure you want to proceed?`
        );
        if (!confirmed) {
            return;
        }
    }

    // Show loading state
    elements.processFiles.disabled = true;
    elements.processFiles.innerHTML = '🔄 Processing Files...';
    elements.results.innerHTML = '<div class="loading">Copying and renaming files with HD addresses, please wait...</div>';

    try {
        const results = await window.electronAPI.processFiles(
            selectedFiles, 
            outputFolder, 
            shouldDeleteFolders, 
            sourceFolders
        );
        
        displayResults(results);
        
        // Update the selected files list (remove successfully processed files)
        const successfulProcesses = results.filter(r => r.success).map(r => r.originalPath);
        selectedFiles = selectedFiles.filter(filePath => !successfulProcesses.includes(filePath));
        
        // If folders were deleted, clear the source folders list
        if (shouldDeleteFolders) {
            sourceFolders = [];
            elements.deleteSourceFolders.checked = false;
        }
        
        displayFileList();
        updateWorkflowSteps();
        
    } catch (error) {
        console.error('Error processing files:', error);
        showError('Failed to process files. Please try again.');
    } finally {
        elements.processFiles.disabled = false;
        elements.processFiles.innerHTML = '🔄 Copy & Rename with HD Addresses';
    }
}

function displayResults(results) {
    if (results.length === 0) {
        elements.results.innerHTML = '<div class="empty-state">No results to display</div>';
        return;
    }

    // Check if folder deletion results exist
    const folderDeletionResult = results.find(r => r.folderDeletion);
    const fileResults = results.filter(r => !r.folderDeletion);
    
    const successCount = fileResults.filter(r => r.success).length;
    const failCount = fileResults.filter(r => !r.success).length;
    const duplicateCount = fileResults.filter(r => r.isDuplicate).length;
    
    let summaryHtml = '';
    if (successCount > 0 || failCount > 0) {
        summaryHtml = `
            <div class="result-item" style="background: #e8f4f8; border-left: 4px solid #17a2b8;">
                <div class="result-info">
                    <div class="result-title">📊 Processing Summary</div>
                    <div class="result-details">
                        <strong>Successfully processed:</strong> ${successCount} file${successCount === 1 ? '' : 's'}<br>
                        <strong>Duplicates skipped:</strong> ${duplicateCount} file${duplicateCount === 1 ? '' : 's'}<br>
                        <strong>Other failures:</strong> ${failCount - duplicateCount} file${(failCount - duplicateCount) === 1 ? '' : 's'}
                        ${fileResults[0]?.outputFolder ? `<br><strong>Output folder:</strong> ${fileResults[0].outputFolder}` : ''}
                        ${successCount > 0 ? `<br><strong>📁 Files created:</strong> master-key.json, address-mapping.json` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    // Add folder deletion summary
    if (folderDeletionResult) {
        const folderSuccessCount = folderDeletionResult.folderResults.filter(r => r.success).length;
        const folderFailCount = folderDeletionResult.folderResults.filter(r => !r.success).length;
        
        summaryHtml += `
            <div class="result-item" style="background: ${folderFailCount > 0 ? '#fff3e0' : '#e8f5e8'}; border-left: 4px solid ${folderFailCount > 0 ? '#f57c00' : '#4caf50'};">
                <div class="result-info">
                    <div class="result-title">${folderFailCount > 0 ? '⚠️' : '✅'} Folder Deletion Summary</div>
                    <div class="result-details">
                        <strong>Successfully deleted:</strong> ${folderSuccessCount} folder${folderSuccessCount === 1 ? '' : 's'}<br>
                        <strong>Failed to delete:</strong> ${folderFailCount} folder${folderFailCount === 1 ? '' : 's'}
                    </div>
                </div>
            </div>
        `;
    }

    const resultItems = fileResults.map(result => {
        if (result.success) {
            const newFileName = result.newPath.split('/').pop() || result.newPath.split('\\').pop();
            const originalFileName = result.originalPath.split('/').pop() || result.originalPath.split('\\').pop();
            
            let actionIcon = '✅';
            let actionDescription = 'Successfully copied & renamed';
            let actionDetails = '';
            
            if (result.action === 'copied_existing_address') {
                actionIcon = '✅';
                actionDescription = 'Copied with existing valid address';
                actionDetails = `<br><strong>Action:</strong> ${result.message}`;
            } else if (result.action === 'upgraded_format') {
                actionIcon = '🔄';
                actionDescription = 'Upgraded filename format';
                actionDetails = `<br><strong>Action:</strong> ${result.message}`;
            } else if (result.action === 'renamed_invalid_address') {
                actionIcon = '🔄';
                actionDescription = 'Fixed invalid address';
                actionDetails = `<br><strong>Previous address:</strong> ${result.previousAddress}<br><strong>Reason:</strong> ${result.message}`;
            } else if (result.action === 'renamed_no_address') {
                actionIcon = '🏷️';
                actionDescription = 'Added Bitcoin address';
                actionDetails = `<br><strong>Reason:</strong> ${result.message}`;
            }
            
            return `
                <div class="result-item result-success">
                    <div class="result-info">
                        <div class="result-title">${actionIcon} ${actionDescription}</div>
                        <div class="result-details">
                            <strong>Original:</strong> ${originalFileName}<br>
                            <strong>New name:</strong> ${newFileName}${actionDetails}
                        </div>
                        <div class="bitcoin-address">
                            Bitcoin Address: ${result.bitcoinAddress}
                        </div>
                        <div class="derivation-info">
                            HD Derivation Index: ${result.derivationIndex}
                        </div>
                    </div>
                </div>
            `;
        } else {
            const originalFileName = result.originalPath?.split('/').pop() || result.originalPath?.split('\\').pop() || 'Unknown file';
            const isWarning = result.isDuplicate;
            const bgColor = isWarning ? '#fff3e0' : '#f8d7da';
            const borderColor = isWarning ? '#f57c00' : '#dc3545';
            const icon = isWarning ? '⚠️' : '❌';
            const title = isWarning ? 'Duplicate skipped' : 'Failed to process';
            
            return `
                <div class="result-item" style="background: ${bgColor}; border-left: 4px solid ${borderColor};">
                    <div class="result-info">
                        <div class="result-title">${icon} ${title}</div>
                        <div class="result-details">
                            <strong>File:</strong> ${originalFileName}<br>
                            <strong>${isWarning ? 'Reason' : 'Error'}:</strong> ${result.error}
                        </div>
                    </div>
                </div>
            `;
        }
    }).join('');

    // Add folder deletion details
    let folderResultsHtml = '';
    if (folderDeletionResult) {
        folderResultsHtml = folderDeletionResult.folderResults.map(result => {
            const folderName = result.folderPath.split('/').pop() || result.folderPath.split('\\').pop() || result.folderPath;
            const bgColor = result.success ? '#e8f5e8' : '#f8d7da';
            const borderColor = result.success ? '#4caf50' : '#dc3545';
            const icon = result.success ? '✅' : '❌';
            const title = result.success ? 'Folder deleted' : 'Failed to delete folder';
            
            return `
                <div class="result-item" style="background: ${bgColor}; border-left: 4px solid ${borderColor};">
                    <div class="result-info">
                        <div class="result-title">${icon} ${title}</div>
                        <div class="result-details">
                            <strong>Folder:</strong> ${folderName}<br>
                            <strong>${result.success ? 'Status' : 'Error'}:</strong> ${result.success ? result.message : result.error}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    elements.results.innerHTML = summaryHtml + resultItems + folderResultsHtml;
}

function showLoading(message) {
    elements.results.innerHTML = `<div class="loading">${message}</div>`;
}

function showError(message) {
    elements.results.innerHTML = `
        <div class="result-item result-error">
            <div class="result-info">
                <div class="result-title">❌ Error</div>
                <div class="result-details">${message}</div>
            </div>
        </div>
    `;
}

function showWarning(message) {
    elements.results.innerHTML = `
        <div class="result-item" style="background: #fff3e0; border-left: 4px solid #f57c00;">
            <div class="result-info">
                <div class="result-title">⚠️ Warning</div>
                <div class="result-details">${message}</div>
            </div>
        </div>
    `;
}

function showSuccess(message) {
    elements.results.innerHTML = `
        <div class="result-item result-success">
            <div class="result-info">
                <div class="result-title">✅ Success</div>
                <div class="result-details">${message}</div>
            </div>
        </div>
    `;
}

function clearResults() {
    elements.results.innerHTML = '';
}

// Make removeFile function globally accessible
window.removeFile = removeFile; 