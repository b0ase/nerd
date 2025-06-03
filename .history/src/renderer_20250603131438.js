let selectedFiles = [];

const elements = {
    selectFiles: document.getElementById('selectFiles'),
    fileList: document.getElementById('fileList'),
    renameSection: document.getElementById('renameSection'),
    renameFiles: document.getElementById('renameFiles'),
    results: document.getElementById('results')
};

// Event listeners
elements.selectFiles.addEventListener('click', selectFiles);
elements.renameFiles.addEventListener('click', renameFiles);

async function selectFiles() {
    try {
        const filePaths = await window.electronAPI.selectFiles();
        if (filePaths && filePaths.length > 0) {
            selectedFiles = filePaths;
            displayFileList();
            elements.renameSection.style.display = 'block';
            clearResults();
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
        const fileName = filePath.split('/').pop();
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

    elements.fileList.innerHTML = fileItems;
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
            const newFileName = result.newPath.split('/').pop();
            return `
                <div class="result-item result-success">
                    <div class="result-info">
                        <div class="result-title">✅ Successfully renamed</div>
                        <div class="result-details">
                            <strong>Original:</strong> ${result.originalPath.split('/').pop()}<br>
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
                            <strong>File:</strong> ${result.originalPath.split('/').pop()}<br>
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

function clearResults() {
    elements.results.innerHTML = '';
}

// Make removeFile function globally accessible
window.removeFile = removeFile; 