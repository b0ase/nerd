let selectedFiles = [];
let outputFolder = null;

const elements = {
    selectFiles: document.getElementById('selectFiles'),
    dropZone: document.getElementById('dropZone'),
    fileList: document.getElementById('fileList'),
    outputSection: document.getElementById('outputSection'),
    selectOutputFolder: document.getElementById('selectOutputFolder'),
    selectedFolder: document.getElementById('selectedFolder'),
    processSection: document.getElementById('processSection'),
    processFiles: document.getElementById('processFiles'),
    results: document.getElementById('results')
};

// Event listeners
elements.selectFiles.addEventListener('click', selectFiles);
elements.selectOutputFolder.addEventListener('click', selectOutputFolder);
elements.processFiles.addEventListener('click', processFiles);

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

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.dropZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Only remove drag-over if we're leaving the drop zone entirely
    if (!elements.dropZone.contains(e.relatedTarget)) {
        elements.dropZone.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.dropZone.classList.remove('drag-over');
    
    const files = Array.from(e.dataTransfer.files);
    processDroppedFiles(files);
}

function processDroppedFiles(files) {
    // Filter for JPEG files
    const jpegFiles = files.filter(file => {
        const extension = file.name.toLowerCase().split('.').pop();
        return ['jpg', 'jpeg'].includes(extension);
    });
    
    if (jpegFiles.length === 0) {
        showError('No JPEG files found. Please select files with .jpg or .jpeg extensions.');
        return;
    }
    
    // Check for duplicate files already in the list
    const newFiles = jpegFiles.filter(file => 
        !selectedFiles.some(existingPath => existingPath.endsWith(file.name))
    );
    
    if (newFiles.length === 0) {
        showError('All selected files are already in the list.');
        return;
    }
    
    // Convert FileList to file paths (for drag and drop, we use file.path)
    const newFilePaths = newFiles.map(file => file.path || file.name);
    
    // Add to existing selection
    selectedFiles = [...selectedFiles, ...newFilePaths];
    
    displayFileList();
    updateWorkflowSteps();
    clearResults();
    
    // Show success message
    showSuccess(`Added ${newFiles.length} JPEG file(s) to the list.`);
}

async function selectFiles() {
    try {
        const filePaths = await window.electronAPI.selectFiles();
        if (filePaths && filePaths.length > 0) {
            // Check for duplicates
            const newFiles = filePaths.filter(filePath => 
                !selectedFiles.includes(filePath)
            );
            
            if (newFiles.length === 0) {
                showError('All selected files are already in the list.');
                return;
            }
            
            // Add to existing selection
            selectedFiles = [...selectedFiles, ...newFiles];
            
            displayFileList();
            updateWorkflowSteps();
            clearResults();
            
            showSuccess(`Added ${newFiles.length} JPEG file(s) to the list.`);
        }
    } catch (error) {
        console.error('Error selecting files:', error);
        showError('Failed to select files. Please try again.');
    }
}

async function selectOutputFolder() {
    try {
        const folder = await window.electronAPI.selectOutputFolder();
        if (folder) {
            outputFolder = folder;
            elements.selectedFolder.textContent = folder;
            updateWorkflowSteps();
            clearResults();
            showSuccess('Output folder selected successfully!');
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

    // Show loading state
    elements.processFiles.disabled = true;
    elements.processFiles.innerHTML = '🔄 Processing Files...';
    elements.results.innerHTML = '<div class="loading">Copying and renaming files, please wait...</div>';

    try {
        const results = await window.electronAPI.processFiles(selectedFiles, outputFolder);
        displayResults(results);
        
        // Update the selected files list (remove successfully processed files)
        const successfulProcesses = results.filter(r => r.success).map(r => r.originalPath);
        selectedFiles = selectedFiles.filter(filePath => !successfulProcesses.includes(filePath));
        displayFileList();
        updateWorkflowSteps();
        
    } catch (error) {
        console.error('Error processing files:', error);
        showError('Failed to process files. Please try again.');
    } finally {
        elements.processFiles.disabled = false;
        elements.processFiles.innerHTML = '🔄 Copy & Rename Files';
    }
}

function displayResults(results) {
    if (results.length === 0) {
        elements.results.innerHTML = '<div class="empty-state">No results to display</div>';
        return;
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const duplicateCount = results.filter(r => r.isDuplicate).length;
    
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
                        ${results[0]?.outputFolder ? `<br><strong>Output folder:</strong> ${results[0].outputFolder}` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    const resultItems = results.map(result => {
        if (result.success) {
            const newFileName = result.newPath.split('/').pop() || result.newPath.split('\\').pop();
            const originalFileName = result.originalPath.split('/').pop() || result.originalPath.split('\\').pop();
            return `
                <div class="result-item result-success">
                    <div class="result-info">
                        <div class="result-title">✅ Successfully copied & renamed</div>
                        <div class="result-details">
                            <strong>Original:</strong> ${originalFileName}<br>
                            <strong>New name:</strong> ${newFileName}
                        </div>
                        <div class="bitcoin-address">
                            Bitcoin Address: ${result.bitcoinAddress}
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

    elements.results.innerHTML = summaryHtml + resultItems;
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