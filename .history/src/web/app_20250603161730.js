const API_BASE = 'http://127.0.0.1:3001/api';

// Check API status on load
document.addEventListener('DOMContentLoaded', function() {
    checkAPIStatus();
    setInterval(checkAPIStatus, 30000); // Check every 30 seconds
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