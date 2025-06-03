const API_BASE = 'http://127.0.0.1:3001/api';

// BitStream Data
let contentLibrary = [];
let currentUser = {
    name: '',
    settings: {
        defaultPrice: 0.001,
        autoGenerate: true
    },
    stats: {
        content: 0,
        earnings: 0,
        views: 0,
        streams: 0
    }
};

// Initialize BitStream
document.addEventListener('DOMContentLoaded', function() {
    initializeBitStream();
    checkBACDSConnection();
    loadUserSettings();
    updateStats();
    setInterval(checkBACDSConnection, 30000); // Check API every 30 seconds
});

async function initializeBitStream() {
    console.log('🚀 BitStream MVP Initializing...');
    
    // Load any existing content from localStorage
    const savedContent = localStorage.getItem('bitstream-content');
    if (savedContent) {
        contentLibrary = JSON.parse(savedContent);
        renderContentGallery();
        updateStats();
    }
    
    // Setup drag and drop
    setupDragAndDrop();
}

async function checkBACDSConnection() {
    try {
        const response = await fetch(`${API_BASE}/status`);
        const data = await response.json();
        
        document.getElementById('api-status').textContent = 'Online';
        document.getElementById('api-status').style.color = '#10b981';
        
        // Update address count
        document.getElementById('address-count').textContent = data.addressIndex || 0;
        
        // Update wallet status
        const walletStatus = data.hasMasterKey ? 'Connected' : 'No Master Key';
        document.getElementById('wallet-status').textContent = walletStatus;
        document.getElementById('wallet-status').style.color = data.hasMasterKey ? '#10b981' : '#f59e0b';
        
    } catch (error) {
        document.getElementById('api-status').textContent = 'Offline';
        document.getElementById('api-status').style.color = '#dc2626';
        document.getElementById('wallet-status').textContent = 'API Disconnected';
        document.getElementById('wallet-status').style.color = '#dc2626';
    }
}

function setupDragAndDrop() {
    const uploadZone = document.querySelector('.upload-zone');
    
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
    });
    
    uploadZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
    });
    
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        
        const files = Array.from(e.dataTransfer.files);
        handleFileSelect({ target: { files } });
    });
}

function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(`${tabName}-tab`).classList.add('active');
    event.target.classList.add('active');
}

async function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    
    if (files.length === 0) return;
    
    console.log(`📁 Selected ${files.length} file(s) for upload`);
    
    // Show upload form
    document.getElementById('upload-form').style.display = 'block';
    
    // Store files for later upload
    window.selectedFiles = files;
    
    // Preview first file
    const firstFile = files[0];
    if (firstFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.createElement('div');
            preview.innerHTML = `
                <div style="margin-top: 15px; text-align: center;">
                    <img src="${e.target.result}" style="max-width: 200px; max-height: 200px; border-radius: 8px;">
                    <p style="margin-top: 10px; color: #9ca3af;">${firstFile.name}</p>
                </div>
            `;
            document.getElementById('upload-form').prepend(preview);
        };
        reader.readAsDataURL(firstFile);
    }
    
    // Auto-fill title from filename
    document.getElementById('content-title').value = firstFile.name.split('.')[0];
}

async function publishContent() {
    const files = window.selectedFiles;
    if (!files || files.length === 0) {
        alert('Please select files to upload');
        return;
    }
    
    const title = document.getElementById('content-title').value;
    const description = document.getElementById('content-description').value;
    const price = parseFloat(document.getElementById('content-price').value);
    const accessType = document.getElementById('access-type').value;
    
    if (!title) {
        alert('Please enter a content title');
        return;
    }
    
    try {
        // Generate Bitcoin address for this content
        const addressResponse = await fetch(`${API_BASE}/addresses/batch/0/1`);
        const addressData = await addressResponse.json();
        
        if (!addressData.success) {
            throw new Error('Failed to generate Bitcoin address');
        }
        
        const bitcoinAddress = addressData.addresses[0].address;
        const addressIndex = addressData.addresses[0].index;
        
        // Simulate file upload and processing
        console.log('🔄 Publishing content...');
        
        // Create content object
        const contentItem = {
            id: Date.now(),
            title,
            description,
            price,
            accessType,
            bitcoinAddress,
            addressIndex,
            files: files.map(f => ({
                name: f.name,
                size: f.size,
                type: f.type
            })),
            created: new Date().toISOString(),
            views: 0,
            earnings: 0,
            status: 'published'
        };
        
        // Add to content library
        contentLibrary.push(contentItem);
        
        // Save to localStorage
        localStorage.setItem('bitstream-content', JSON.stringify(contentLibrary));
        
        // Update UI
        renderContentGallery();
        updateStats();
        
        // Reset form
        document.getElementById('upload-form').style.display = 'none';
        document.getElementById('content-title').value = '';
        document.getElementById('content-description').value = '';
        document.getElementById('content-price').value = '0.001';
        document.getElementById('fileInput').value = '';
        
        // Switch to gallery tab
        switchTab('gallery');
        
        console.log('✅ Content published successfully!');
        alert(`🚀 Content "${title}" published successfully!\nBitcoin Address: ${bitcoinAddress}`);
        
    } catch (error) {
        console.error('❌ Error publishing content:', error);
        alert(`Error publishing content: ${error.message}`);
    }
}

function renderContentGallery() {
    const gallery = document.getElementById('content-gallery');
    
    if (contentLibrary.length === 0) {
        gallery.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎬</div>
                <h3>No Content Yet</h3>
                <p>Upload your first image or video to start earning with BitStream</p>
                <button class="btn" onclick="switchTab('upload')">Upload Content</button>
            </div>
        `;
        return;
    }
    
    const gridHTML = contentLibrary.map(item => `
        <div class="content-card">
            <div class="content-image">
                ${item.files[0].type.startsWith('image/') ? '🖼️' : '🎥'}
            </div>
            <div class="content-info">
                <div class="content-title">${item.title}</div>
                <div class="content-address">${item.bitcoinAddress}</div>
                <div class="content-meta">
                    <span>${item.views} views</span>
                    <span class="price-tag">₿ ${item.price}</span>
                </div>
                <div style="margin-top: 10px;">
                    <button class="btn btn-secondary" onclick="viewContent('${item.id}')" style="font-size: 0.8rem; padding: 6px 12px;">View</button>
                    <button class="btn btn-secondary" onclick="shareContent('${item.id}')" style="font-size: 0.8rem; padding: 6px 12px;">Share</button>
                </div>
            </div>
        </div>
    `).join('');
    
    gallery.innerHTML = `<div class="content-grid">${gridHTML}</div>`;
}

function updateStats() {
    const stats = {
        content: contentLibrary.length,
        earnings: contentLibrary.reduce((sum, item) => sum + item.earnings, 0),
        views: contentLibrary.reduce((sum, item) => sum + item.views, 0),
        streams: contentLibrary.filter(item => item.status === 'streaming').length
    };
    
    document.getElementById('content-count').textContent = stats.content;
    document.getElementById('earnings-total').textContent = `₿ ${stats.earnings.toFixed(6)}`;
    document.getElementById('views-total').textContent = stats.views;
    document.getElementById('active-streams').textContent = stats.streams;
}

async function generateNewAddress() {
    try {
        const response = await fetch(`${API_BASE}/addresses/batch/0/1`);
        const data = await response.json();
        
        if (data.success) {
            const address = data.addresses[0];
            alert(`New Bitcoin Address Generated:\n\n${address.address}\n\nDerivation Index: ${address.index}`);
            checkBACDSConnection(); // Refresh status
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (error) {
        alert(`Error generating address: ${error.message}`);
    }
}

async function syncWithBACDS() {
    console.log('🔄 Syncing with BACDS...');
    try {
        await checkBACDSConnection();
        alert('✅ Successfully synced with BACDS API');
    } catch (error) {
        alert(`❌ Sync failed: ${error.message}`);
    }
}

function exportAddresses() {
    const addresses = contentLibrary.map(item => ({
        title: item.title,
        address: item.bitcoinAddress,
        index: item.addressIndex,
        price: item.price,
        created: item.created
    }));
    
    const dataStr = JSON.stringify(addresses, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = 'bitstream-addresses.json';
    link.click();
    
    console.log('📋 Address list exported');
}

function viewPayments() {
    const paymentsHTML = contentLibrary.map(item => `
        <div style="padding: 10px; border-bottom: 1px solid #333;">
            <strong>${item.title}</strong><br>
            <span style="font-family: monospace; color: #10b981;">${item.bitcoinAddress}</span><br>
            <span style="color: #9ca3af;">Expected: ₿ ${item.price} | Received: ₿ ${item.earnings}</span>
        </div>
    `).join('');
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center;
        z-index: 1000;
    `;
    
    modal.innerHTML = `
        <div style="background: #1f2937; padding: 30px; border-radius: 12px; max-width: 600px; width: 90%; max-height: 80%; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="color: #3b82f6;">💰 Payment Tracking</h3>
                <button onclick="document.body.removeChild(this.closest('div').parentElement)" style="background: #dc2626; color: #fff; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">✕</button>
            </div>
            <div style="margin-bottom: 15px; color: #9ca3af;">
                Monitor Bitcoin payments to your content addresses
            </div>
            ${paymentsHTML || '<div style="text-align: center; color: #6b7280; padding: 40px;">No content published yet</div>'}
        </div>
    `;
    
    document.body.appendChild(modal);
}

function viewContent(contentId) {
    const content = contentLibrary.find(item => item.id == contentId);
    if (!content) return;
    
    // Simulate viewing (increment views)
    content.views++;
    localStorage.setItem('bitstream-content', JSON.stringify(contentLibrary));
    renderContentGallery();
    updateStats();
    
    alert(`🎬 Viewing: ${content.title}\n\nThis would open the content viewer with Bitcoin payment verification.`);
}

function shareContent(contentId) {
    const content = contentLibrary.find(item => item.id == contentId);
    if (!content) return;
    
    const shareURL = `bitcoin:${content.bitcoinAddress}?amount=${content.price}&label=${encodeURIComponent(content.title)}`;
    
    navigator.clipboard.writeText(shareURL).then(() => {
        alert(`🔗 Share URL copied to clipboard!\n\n${shareURL}\n\nSend this to viewers to access your content.`);
    }).catch(() => {
        prompt('📋 Copy this share URL:', shareURL);
    });
}

function saveSettings() {
    currentUser.settings.defaultPrice = parseFloat(document.getElementById('default-price').value);
    currentUser.name = document.getElementById('creator-name').value;
    currentUser.settings.autoGenerate = document.getElementById('auto-generate').value === 'true';
    
    localStorage.setItem('bitstream-user', JSON.stringify(currentUser));
    
    alert('💾 Settings saved successfully!');
}

function loadUserSettings() {
    const savedUser = localStorage.getItem('bitstream-user');
    if (savedUser) {
        currentUser = { ...currentUser, ...JSON.parse(savedUser) };
        
        document.getElementById('default-price').value = currentUser.settings.defaultPrice;
        document.getElementById('creator-name').value = currentUser.name || '';
        document.getElementById('auto-generate').value = currentUser.settings.autoGenerate.toString();
    }
}

function showUploadModal() {
    switchTab('upload');
}

// Simulate some activity for demo
function simulateActivity() {
    if (contentLibrary.length > 0) {
        // Randomly add views or earnings
        const randomContent = contentLibrary[Math.floor(Math.random() * contentLibrary.length)];
        if (Math.random() > 0.7) {
            randomContent.views += Math.floor(Math.random() * 3) + 1;
        }
        if (Math.random() > 0.9) {
            randomContent.earnings += randomContent.price * 0.1;
        }
        
        localStorage.setItem('bitstream-content', JSON.stringify(contentLibrary));
        updateStats();
    }
}

// Simulate activity every 30 seconds for demo
setInterval(simulateActivity, 30000);

console.log('🎬 BitStream MVP loaded successfully!'); 