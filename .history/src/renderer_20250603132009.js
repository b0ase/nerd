let selectedFiles = [];
const MAX_FILES = 100;

const elements = {
    selectFiles: document.getElementById('selectFiles'),
    dropZone: document.getElementById('dropZone'),
    fileList: document.getElementById('fileList'),
    renameSection: document.getElementById('renameSection'),
    renameFiles: document.getElementById('renameFiles'),
    results: document.getElementById('results')
};

// Event listeners
elements.selectFiles.addEventListener('click', selectFiles);
elements.renameFiles.addEventListener('click', renameFiles);

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
    
    if (jpegFiles.length > MAX_FILES) {
        showError(`Too many files selected. Maximum is ${MAX_FILES} files, but you selected ${jpegFiles.length}.`);
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
    
    // Ensure we don't exceed the limit
    if (selectedFiles.length > MAX_FILES) {
        selectedFiles = selectedFiles.slice(0, MAX_FILES);
        showWarning(`File list trimmed to maximum of ${MAX_FILES} files.`);
    }
    
    displayFileList();
    elements.renameSection.style.display = 'block';
    clearResults();
    
    // Show success message
    showSuccess(`Added ${newFiles.length} JPEG file(s) to the list.`);
}

async function selectFiles() {
    try {
        const filePaths = await window.electronAPI.selectFiles();
        if (filePaths && filePaths.length > 0) {
            if (filePaths.length > MAX_FILES) {
                showError(`Too many files selected. Maximum is ${MAX_FILES} files, but you selected ${filePaths.length}.`);
                return;
            }
            
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
            
            // Ensure we don't exceed the limit
            if (selectedFiles.length > MAX_FILES) {
                selectedFiles = selectedFiles.slice(0, MAX_FILES);
                showWarning(`File list trimmed to maximum of ${MAX_FILES} files.`);
            }
            
            displayFileList();
            elements.renameSection.style.display = 'block';
            clearResults();
            
            showSuccess(`Added ${newFiles.length} JPEG file(s) to the list.`);
        }
    } catch (error) {
        console.error('Error selecting files:', error);
        showError('Failed to select files. Please try again.');
    }
}

function displayFileList() {
    if (selectedFiles.length === 0) {
        elements.fileList.innerHTML = '<div class="empty-state">No files selected</div>';
        elements.renameSection.style.display = 'none';
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

    const counterClass = selectedFiles.length >= MAX_FILES ? 'error' : 
                        selectedFiles.length > MAX_FILES * 0.8 ? 'warning' : '';
    
    const fileCounter = `
        <div class="file-counter ${counterClass}">
            📊 ${selectedFiles.length}/${MAX_FILES} files selected
        </div>
    `;

    elements.fileList.innerHTML = fileItems + fileCounter;
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    displayFileList();
    if (selectedFiles.length === 0) {
        elements.renameSection.style.display = 'none';
    }
}

async function renameFiles() {
    if (selectedFiles.length === 0) {
        showError('No files selected for renaming.');
        return;
    }

    // Show loading state
    elements.renameFiles.disabled = true;
    elements.renameFiles.innerHTML = '🔄 Renaming Files...';
    elements.results.innerHTML = '<div class="loading">Processing files, please wait...</div>';

    try {
        const results = await window.electronAPI.renameFiles(selectedFiles);
        displayResults(results);
        
        // Update the selected files list (remove successfully renamed files)
        const successfulRenames = results.filter(r => r.success).map(r => r.originalPath);
        selectedFiles = selectedFiles.filter(filePath => !successfulRenames.includes(filePath));
        displayFileList();
        
    } catch (error) {
        console.error('Error renaming files:', error);
        showError('Failed to rename files. Please try again.');
    } finally {
        elements.renameFiles.disabled = false;
        elements.renameFiles.innerHTML = '🔄 Rename Files';
    }
}

function displayResults(results) {
    if (results.length === 0) {
        elements.results.innerHTML = '<div class="empty-state">No results to display</div>';
        return;
    }

    const resultItems = results.map(result => {
        if (result.success) {
            const newFileName = result.newPath.split('/').pop() || result.newPath.split('\\').pop();
            return `
                <div class="result-item result-success">
                    <div class="result-info">
                        <div class="result-title">✅ Successfully renamed</div>
                        <div class="result-details">
                            <strong>Original:</strong> ${result.originalPath.split('/').pop() || result.originalPath.split('\\').pop()}<br>
                            <strong>New name:</strong> ${newFileName}
                        </div>
                        <div class="bitcoin-address">
                            Bitcoin Address: ${result.bitcoinAddress}
                        </div>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="result-item result-error">
                    <div class="result-info">
                        <div class="result-title">❌ Failed to rename</div>
                        <div class="result-details">
                            <strong>File:</strong> ${result.originalPath.split('/').pop() || result.originalPath.split('\\').pop()}<br>
                            <strong>Error:</strong> ${result.error}
                        </div>
                    </div>
                </div>
            `;
        }
    }).join('');

    elements.results.innerHTML = resultItems;
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