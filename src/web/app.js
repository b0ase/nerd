const API_BASE = 'http://127.0.0.1:3001/api';

// Auto-refresh network status
setInterval(refreshNetworkStatus, 10000); // Every 10 seconds

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    checkAPIStatus();
    setInterval(checkAPIStatus, 30000); // Check every 30 seconds
    
    // Initialize P2P network status
    setTimeout(refreshNetworkStatus, 2000); // Give P2P server time to start
});

async function checkAPIStatus() {
    try {
        const response = await fetch(`${API_BASE}/status`);
        const data = await response.json();
        
        const statusInfo = document.getElementById('status-info');
        statusInfo.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <div><strong>Status:</strong> ${data.status}</div>
                <div><strong>Service:</strong> ${data.service}</div>
                <div><strong>Version:</strong> ${data.version}</div>
                <div><strong>Master Key:</strong> ${data.hasMasterKey ? '✅ Loaded' : '❌ None'}</div>
                <div><strong>Address Index:</strong> ${data.addressIndex}</div>
                <div><strong>Last Updated:</strong> ${new Date(data.timestamp).toLocaleTimeString()}</div>
            </div>
        `;
    } catch (error) {
        const statusInfo = document.getElementById('status-info');
        statusInfo.innerHTML = `
            <div class="error">
                ❌ Cannot connect to BACDS API Server
                <br><small>Make sure the desktop app is running</small>
            </div>
        `;
    }
}

async function generateMasterKey() {
    try {
        const response = await fetch(`${API_BASE}/master-key/generate`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.success) {
            displayMasterKey(data.masterKey, data.message, 'success');
            checkAPIStatus(); // Refresh status
        } else {
            displayMasterKey('', data.error, 'error');
        }
    } catch (error) {
        displayMasterKey('', `Error: ${error.message}`, 'error');
    }
}

async function getCurrentMasterKey() {
    try {
        const response = await fetch(`${API_BASE}/master-key`);
        const data = await response.json();
        
        if (data.success) {
            displayMasterKey(data.masterKey, 'Current master key (keep this safe!):', 'success');
        } else {
            displayMasterKey('', data.error, 'error');
        }
    } catch (error) {
        displayMasterKey('', `Error: ${error.message}`, 'error');
    }
}

async function importMasterKey() {
    const masterKey = document.getElementById('importKeyInput').value.trim();
    if (!masterKey) {
        displayMasterKey('', 'Please enter a master key', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/master-key/import`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ masterKey })
        });
        const data = await response.json();
        
        if (data.success) {
            displayMasterKey(masterKey, data.message, 'success');
            document.getElementById('importKeyInput').value = '';
            checkAPIStatus(); // Refresh status
        } else {
            displayMasterKey('', data.error, 'error');
        }
    } catch (error) {
        displayMasterKey('', `Error: ${error.message}`, 'error');
    }
}

function displayMasterKey(key, message, type) {
    const display = document.getElementById('masterKeyDisplay');
    const className = type === 'success' ? 'success' : 'error';
    
    display.innerHTML = `
        <div class="${className}">
            <strong>${message}</strong>
            ${key ? `
                <div class="key-display" style="margin-top: 15px;">
                    ${key}
                    <div style="margin-top: 10px;">
                        <button class="copy-btn" onclick="copyToClipboard('${key}')">📋 Copy Key</button>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

async function generateSingleAddress() {
    const index = parseInt(document.getElementById('addressIndex').value) || 0;
    
    try {
        const response = await fetch(`${API_BASE}/address/${index}`);
        const data = await response.json();
        
        if (data.success) {
            displayAddresses([data], 'Single address generated:');
        } else {
            displayAddressError(data.error);
        }
    } catch (error) {
        displayAddressError(`Error: ${error.message}`);
    }
}

async function generateBatchAddresses() {
    const start = parseInt(document.getElementById('batchStart').value) || 0;
    const count = parseInt(document.getElementById('batchCount').value) || 5;
    
    if (count > 20) {
        displayAddressError('Maximum batch size is 20 addresses');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/addresses/batch/${start}/${count}`);
        const data = await response.json();
        
        if (data.success) {
            displayAddresses(data.addresses, `Generated ${data.total} addresses:`);
        } else {
            displayAddressError(data.error);
        }
    } catch (error) {
        displayAddressError(`Error: ${error.message}`);
    }
}

function displayAddresses(addresses, title) {
    const results = document.getElementById('addressResults');
    
    let html = `<div class="success"><strong>${title}</strong></div>`;
    html += '<div class="address-list">';
    
    addresses.forEach(addr => {
        html += `
            <div class="address-item">
                <div class="address-index">#${addr.index}</div>
                <div class="address-value">${addr.address}</div>
                <button class="copy-btn" onclick="copyToClipboard('${addr.address}')">📋 Copy</button>
            </div>
        `;
    });
    
    html += '</div>';
    results.innerHTML = html;
}

function displayAddressError(error) {
    const results = document.getElementById('addressResults');
    results.innerHTML = `<div class="error">${error}</div>`;
}

async function checkNetworkPeers() {
    try {
        const response = await fetch(`${API_BASE}/network/peers`);
        const data = await response.json();
        
        alert(`🌐 BitNet Peer Discovery\n\n${data.message}\n\nRoadmap: ${data.roadmap}\n\nFound ${data.peers.length} peers.`);
    } catch (error) {
        alert(`Error checking network peers: ${error.message}`);
    }
}

// BitNet Infrastructure - File Chunking Functions
async function chunkSelectedFile() {
    const fileInput = document.getElementById('chunkFile');
    const file = fileInput.files[0];
    
    if (!file) {
        displayChunkingResult('Please select a file to chunk', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        displayChunkingResult('🔧 Chunking file... Please wait.', 'loading');
        
        const response = await fetch(`${API_BASE}/bitnet/chunk-file`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayChunkingResult(`
                <strong>✅ File chunked successfully!</strong><br>
                <div style="margin-top: 10px;">
                    <strong>File:</strong> ${data.fileName}<br>
                    <strong>Size:</strong> ${(data.fileSize / 1024 / 1024).toFixed(2)} MB<br>
                    <strong>File Hash:</strong> <code>${data.fileHash}</code><br>
                    <strong>Total Chunks:</strong> ${data.totalChunks}<br>
                    <strong>Chunks Created:</strong> ${data.chunks}
                </div>
                <div style="margin-top: 15px;">
                    <button class="btn btn-secondary" onclick="viewManifest('${data.fileHash}')">📄 View Manifest</button>
                    <button class="btn btn-secondary" onclick="listLocalChunks()">📋 List All Chunks</button>
                </div>
            `, 'success');
            
            // Clear file input
            fileInput.value = '';
        } else {
            displayChunkingResult(`❌ Error: ${data.error}`, 'error');
        }
    } catch (error) {
        displayChunkingResult(`❌ Network error: ${error.message}`, 'error');
    }
}

async function listLocalChunks() {
    try {
        const response = await fetch(`${API_BASE}/bitnet/chunks/list`);
        const data = await response.json();
        
        if (data.success) {
            if (data.chunks.length === 0) {
                displayChunkingResult('📋 No chunks found. Upload a file to create chunks.', 'info');
                return;
            }
            
            let html = `<strong>📋 Local Chunks (${data.total} total)</strong>`;
            html += '<div class="address-list" style="max-height: 200px;">';
            
            data.chunks.forEach(chunk => {
                const createdDate = new Date(chunk.created).toLocaleString();
                const sizeKB = (chunk.size / 1024).toFixed(1);
                
                html += `
                    <div class="address-item">
                        <div>
                            <strong>${chunk.hash.slice(0, 12)}...</strong><br>
                            <small style="color: #9ca3af;">${sizeKB} KB • ${createdDate}</small>
                        </div>
                        <button class="copy-btn" onclick="copyToClipboard('${chunk.hash}')">📋 Copy Hash</button>
                    </div>
                `;
            });
            
            html += '</div>';
            displayChunkingResult(html, 'success');
        } else {
            displayChunkingResult(`❌ Error: ${data.error}`, 'error');
        }
    } catch (error) {
        displayChunkingResult(`❌ Network error: ${error.message}`, 'error');
    }
}

async function showManifests() {
    // This would list all manifest files - for now, show placeholder
    displayChunkingResult(`
        <strong>📄 File Manifests</strong><br>
        <div style="margin-top: 10px; color: #9ca3af;">
            Manifest listing will be implemented in Week 5+.<br>
            Use "View Manifest" after chunking a file.
        </div>
    `, 'info');
}

async function viewManifest(fileHash) {
    try {
        const response = await fetch(`${API_BASE}/bitnet/manifest/${fileHash}`);
        const data = await response.json();
        
        if (data.success) {
            const manifest = data.manifest;
            
            let html = `
                <strong>📄 File Manifest</strong><br>
                <div style="margin-top: 10px;">
                    <strong>File:</strong> ${manifest.fileName}<br>
                    <strong>Size:</strong> ${(manifest.fileSize / 1024 / 1024).toFixed(2)} MB<br>
                    <strong>Type:</strong> ${manifest.mimeType}<br>
                    <strong>Hash:</strong> <code style="font-size: 0.8rem;">${manifest.fileHash}</code><br>
                    <strong>Chunks:</strong> ${manifest.totalChunks}<br>
                    <strong>Created:</strong> ${new Date(manifest.created).toLocaleString()}
                </div>
                <div style="margin-top: 15px;">
                    <strong>Chunk Details:</strong>
                </div>
                <div class="address-list" style="max-height: 150px; margin-top: 10px;">
            `;
            
            manifest.chunks.forEach(chunk => {
                const sizeKB = (chunk.size / 1024).toFixed(1);
                html += `
                    <div class="address-item">
                        <div class="address-index">#${chunk.index}</div>
                        <div style="flex: 1; margin: 0 10px;">
                            <div style="font-family: monospace; font-size: 0.8rem; color: #10b981;">
                                ${chunk.address}
                            </div>
                            <div style="font-size: 0.7rem; color: #9ca3af;">
                                ${chunk.hash.slice(0, 12)}... • ${sizeKB} KB
                            </div>
                        </div>
                        <button class="copy-btn" onclick="copyToClipboard('${chunk.paymentUrl}')">💰 Payment</button>
                    </div>
                `;
            });
            
            html += '</div>';
            displayChunkingResult(html, 'success');
        } else {
            displayChunkingResult(`❌ Error: ${data.error}`, 'error');
        }
    } catch (error) {
        displayChunkingResult(`❌ Network error: ${error.message}`, 'error');
    }
}

function displayChunkingResult(content, type) {
    const results = document.getElementById('chunkingResults');
    let className = 'success';
    
    if (type === 'error') className = 'error';
    else if (type === 'loading') className = 'loading';
    else if (type === 'info') className = 'success';
    
    if (type === 'loading') {
        results.innerHTML = `<div class="${className}">${content}</div>`;
    } else {
        results.innerHTML = `<div class="${className}">${content}</div>`;
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Show brief success indicator
        const originalText = event.target.textContent;
        event.target.textContent = '✅ Copied!';
        event.target.style.background = '#10b981';
        
        setTimeout(() => {
            event.target.textContent = originalText;
            event.target.style.background = '#374151';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy to clipboard:', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        event.target.textContent = '✅ Copied!';
        setTimeout(() => {
            event.target.textContent = '📋 Copy';
        }, 2000);
    });
}

// P2P Network Functions

async function refreshNetworkStatus() {
    try {
        const response = await fetch('/api/bitnet/p2p/status');
        if (response.ok) {
            const status = await response.json();
            
            document.getElementById('p2p-status').textContent = status.status;
            document.getElementById('peer-count').textContent = status.connectedPeers;
            document.getElementById('dht-count').textContent = status.dhtEntries;
            document.getElementById('node-id').textContent = status.nodeId.substring(0, 12) + '...';
            
            showSuccess(`Network status updated - ${status.connectedPeers} peers connected`);
        } else {
            const error = await response.json();
            showError(`Failed to get network status: ${error.error}`);
        }
    } catch (error) {
        showError(`Network error: ${error.message}`);
    }
}

async function showPeerList() {
    try {
        const response = await fetch('/api/bitnet/p2p/peers');
        if (response.ok) {
            const data = await response.json();
            const peers = data.peers;
            
            const resultsDiv = document.getElementById('network-results');
            const titleDiv = document.getElementById('network-results-title');
            const contentDiv = document.getElementById('network-results-content');
            
            titleDiv.textContent = `Connected Peers (${peers.length})`;
            
            if (peers.length === 0) {
                contentDiv.innerHTML = '<p style="color: #9ca3af;">No peers connected yet. Ensure other BitNet nodes are running on your network.</p>';
            } else {
                const peerHTML = peers.map(peer => `
                    <div class="peer-item" style="background: #1f2937; padding: 15px; margin: 10px 0; border-radius: 8px;">
                        <div><strong>Node ID:</strong> ${peer.nodeId}</div>
                        <div><strong>Chunks:</strong> ${peer.chunkCount}</div>
                        <div><strong>Status:</strong> ${peer.connected ? '🟢 Connected' : '🔴 Disconnected'}</div>
                        <div><strong>Last Seen:</strong> ${new Date(peer.lastSeen).toLocaleString()}</div>
                    </div>
                `).join('');
                
                contentDiv.innerHTML = peerHTML;
            }
            
            resultsDiv.style.display = 'block';
            showSuccess(`Found ${peers.length} peers`);
        } else {
            const error = await response.json();
            showError(`Failed to get peer list: ${error.error}`);
        }
    } catch (error) {
        showError(`Network error: ${error.message}`);
    }
}

async function showDHTTable() {
    try {
        const response = await fetch('/api/bitnet/p2p/dht');
        if (response.ok) {
            const data = await response.json();
            const dht = data.dht;
            
            const resultsDiv = document.getElementById('network-results');
            const titleDiv = document.getElementById('network-results-title');
            const contentDiv = document.getElementById('network-results-content');
            
            const chunkCount = Object.keys(dht).length;
            titleDiv.textContent = `DHT Table (${chunkCount} chunks)`;
            
            if (chunkCount === 0) {
                contentDiv.innerHTML = '<p style="color: #9ca3af;">No chunks registered in DHT yet.</p>';
            } else {
                const dhtHTML = Object.entries(dht).map(([chunkHash, nodeIds]) => `
                    <div class="dht-item" style="background: #1f2937; padding: 15px; margin: 10px 0; border-radius: 8px;">
                        <div><strong>Chunk:</strong> ${chunkHash.substring(0, 16)}...</div>
                        <div><strong>Available on:</strong> ${nodeIds.length} node(s)</div>
                        <div style="margin-top: 8px; font-size: 12px; color: #9ca3af;">
                            Nodes: ${nodeIds.map(id => id.substring(0, 8)).join(', ')}
                        </div>
                        <button onclick="requestSpecificChunk('${chunkHash}')" style="margin-top: 8px; padding: 4px 8px; background: #059669; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            📥 Request Chunk
                        </button>
                    </div>
                `).join('');
                
                contentDiv.innerHTML = dhtHTML;
            }
            
            resultsDiv.style.display = 'block';
            showSuccess(`DHT table loaded with ${chunkCount} chunks`);
        } else {
            const error = await response.json();
            showError(`Failed to get DHT table: ${error.error}`);
        }
    } catch (error) {
        showError(`Network error: ${error.message}`);
    }
}

async function requestChunkFromNetwork() {
    const chunkHashInput = document.getElementById('chunk-hash-input');
    const chunkHash = chunkHashInput.value.trim();
    
    if (!chunkHash) {
        showError('Please enter a chunk hash');
        return;
    }
    
    await requestSpecificChunk(chunkHash);
    chunkHashInput.value = '';
}

async function requestSpecificChunk(chunkHash) {
    const resultDiv = document.getElementById('chunk-request-result');
    
    try {
        // First, find which peers have this chunk
        const findResponse = await fetch(`/api/bitnet/p2p/find-chunk/${chunkHash}`);
        if (!findResponse.ok) {
            throw new Error('Failed to find chunk in network');
        }
        
        const findData = await findResponse.json();
        
        if (findData.peerCount === 0) {
            resultDiv.innerHTML = `
                <div style="background: #dc2626; color: white; padding: 10px; border-radius: 6px; margin-top: 10px;">
                    ❌ Chunk not found in network
                </div>
            `;
            resultDiv.style.display = 'block';
            return;
        }
        
        // Show found peers
        resultDiv.innerHTML = `
            <div style="background: #059669; color: white; padding: 10px; border-radius: 6px; margin-top: 10px;">
                ✅ Found chunk on ${findData.peerCount} peer(s). Requesting download...
            </div>
        `;
        resultDiv.style.display = 'block';
        
        // Request the chunk
        const requestResponse = await fetch('/api/bitnet/p2p/request-chunk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ chunkHash })
        });
        
        if (requestResponse.ok) {
            const requestData = await requestResponse.json();
            
            if (requestData.success) {
                resultDiv.innerHTML = `
                    <div style="background: #059669; color: white; padding: 10px; border-radius: 6px; margin-top: 10px;">
                        ✅ Chunk downloaded successfully!<br>
                        📦 Size: ${requestData.size} bytes<br>
                        💾 Stored locally: ${requestData.storedLocally ? 'Yes' : 'No'}
                    </div>
                `;
                
                // Refresh local chunks list
                setTimeout(listLocalChunks, 1000);
            } else {
                resultDiv.innerHTML = `
                    <div style="background: #dc2626; color: white; padding: 10px; border-radius: 6px; margin-top: 10px;">
                        ❌ Failed to download chunk: ${requestData.error}
                    </div>
                `;
            }
        } else {
            throw new Error('Download request failed');
        }
        
    } catch (error) {
        resultDiv.innerHTML = `
            <div style="background: #dc2626; color: white; padding: 10px; border-radius: 6px; margin-top: 10px;">
                ❌ Error: ${error.message}
            </div>
        `;
        resultDiv.style.display = 'block';
    }
}

// ... existing code ... 