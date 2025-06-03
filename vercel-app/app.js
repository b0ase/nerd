// BitNet Web App - HandCash Integration & Content Marketplace
// ================================================================

let handCashConnect;
let currentUser = null;

// Initialize HandCash Connect
const HANDCASH_APP_ID = 'YOUR_HANDCASH_APP_ID'; // You'll need to register at handcash.io
const HANDCASH_APP_SECRET = 'YOUR_HANDCASH_APP_SECRET';

// Mock data for demo purposes
const mockContent = [
    {
        id: 'bitcoin-future',
        title: '🎬 "Bitcoin\'s Future" Documentary',
        creator: '$filmmaker',
        size: '2.1 GB',
        accessPrice: 0.10,
        currentReturns: 15,
        investmentTiers: [5, 10, 25, 50],
        description: 'A comprehensive documentary exploring Bitcoin\'s role in the future of finance.'
    },
    {
        id: 'decentralized-beats',
        title: '🎵 Electronic Album - "Decentralized Beats"',
        creator: '$musicproducer',
        size: '156 MB',
        accessPrice: 0.05,
        currentReturns: 8,
        investmentTiers: [2, 5, 10, 20],
        description: 'Electronic music album inspired by decentralized technologies.'
    },
    {
        id: 'p2p-course',
        title: '📚 "P2P Networks Explained" Course',
        creator: '$educator',
        size: '4.5 GB',
        accessPrice: 0.25,
        currentReturns: 22,
        investmentTiers: [10, 25, 50, 100],
        description: 'Complete course on peer-to-peer networking fundamentals.'
    }
];

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 BitNet Web App Initializing...');
    
    // Initialize HandCash Connect
    initializeHandCash();
    
    // Set up event listeners
    setupEventListeners();
    
    // Load content marketplace
    loadContentMarketplace();
    
    // Check for existing session
    checkExistingSession();
    
    console.log('✅ BitNet Web App Ready');
});

// HandCash Integration
// =====================

function initializeHandCash() {
    try {
        // For demo purposes, we'll use a mock HandCash implementation
        // In production, you'd use the actual HandCash Connect SDK
        console.log('🔗 Initializing HandCash Connect...');
        
        // Mock HandCash Connect for demo
        handCashConnect = {
            getRedirectionUrl: () => 'https://handcash.io/connect/demo',
            getAccountFromAuthToken: (token) => ({
                handle: '$BOASE',
                displayName: 'BOASE',
                avatarUrl: '',
                balance: { bsv: 15.25, usd: 1525.50 }
            }),
            pay: (payments) => Promise.resolve({ transactionId: 'mock_tx_' + Date.now() })
        };
        
        console.log('✅ HandCash Connect Ready (Demo Mode)');
    } catch (error) {
        console.error('❌ HandCash initialization failed:', error);
        showToast('HandCash initialization failed. Running in demo mode.', 'warning');
    }
}

function setupEventListeners() {
    // HandCash login button
    const loginBtn = document.getElementById('handcash-login');
    if (loginBtn) {
        loginBtn.addEventListener('click', handleHandCashLogin);
    }
    
    // Smooth scrolling for navigation
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

async function handleHandCashLogin() {
    const loginBtn = document.getElementById('handcash-login');
    
    try {
        loginBtn.innerHTML = '<div class="spinner"></div> Connecting...';
        loginBtn.disabled = true;
        
        // Demo authentication (in production, use real HandCash flow)
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay
        
        // Mock user data
        currentUser = {
            handle: '$BOASE',
            displayName: 'BOASE',
            avatarUrl: '',
            balance: { bsv: 15.25, usd: 1525.50 },
            investments: [
                { contentId: 'bitcoin-future', amount: 10, returns: 1.5 },
                { contentId: 'p2p-course', amount: 25, returns: 5.5 }
            ],
            totalEarnings: 7.0
        };
        
        // Update UI
        updateUserInterface();
        showToast('🎉 Welcome back, ' + currentUser.handle + '!', 'success');
        
    } catch (error) {
        console.error('❌ HandCash login failed:', error);
        showToast('Login failed. Please try again.', 'error');
        loginBtn.innerHTML = '🚀 Login with HandCash';
        loginBtn.disabled = false;
    }
}

function updateUserInterface() {
    const loginBtn = document.getElementById('handcash-login');
    const userProfile = document.getElementById('user-profile');
    
    if (currentUser) {
        // Update login button
        loginBtn.innerHTML = `👋 ${currentUser.handle}`;
        loginBtn.onclick = () => showUserMenu();
        
        // Show user profile
        document.getElementById('user-handle').textContent = currentUser.handle;
        document.getElementById('user-balance').textContent = 
            `Balance: $${currentUser.balance.usd.toFixed(2)} (${currentUser.balance.bsv.toFixed(4)} BSV)`;
        document.getElementById('user-avatar').textContent = 
            currentUser.handle.charAt(1).toUpperCase();
        document.getElementById('user-investments').textContent = currentUser.investments.length;
        document.getElementById('user-earnings').textContent = `$${currentUser.totalEarnings.toFixed(2)}`;
        
        userProfile.style.display = 'block';
        
        // Update investment buttons
        updateInvestmentButtons();
    }
}

function updateInvestmentButtons() {
    const investButtons = document.querySelectorAll('.invest-btn');
    investButtons.forEach(btn => {
        const contentId = btn.onclick.toString().match(/'([^']+)'/)?.[1];
        const userInvestment = currentUser.investments.find(inv => inv.contentId === contentId);
        
        if (userInvestment) {
            btn.innerHTML = `✅ Invested $${userInvestment.amount} (+$${userInvestment.returns.toFixed(2)})`;
            btn.style.background = 'linear-gradient(135deg, #059669, #047857)';
        }
    });
}

function showUserMenu() {
    // Simple implementation - could be expanded with a proper dropdown
    const actions = [
        'View Portfolio',
        'Transaction History', 
        'Settings',
        'Logout'
    ];
    
    const action = prompt('Choose an action:\n' + actions.map((a, i) => `${i + 1}. ${a}`).join('\n'));
    
    if (action === '4' || action?.toLowerCase() === 'logout') {
        logout();
    }
}

function logout() {
    currentUser = null;
    document.getElementById('handcash-login').innerHTML = '🚀 Login with HandCash';
    document.getElementById('handcash-login').onclick = handleHandCashLogin;
    document.getElementById('user-profile').style.display = 'none';
    showToast('👋 Logged out successfully', 'info');
    
    // Reset investment buttons
    document.querySelectorAll('.invest-btn').forEach(btn => {
        const contentId = btn.onclick.toString().match(/'([^']+)'/)?.[1];
        const content = mockContent.find(c => c.id === contentId);
        if (content) {
            btn.innerHTML = `💎 Invest $${content.investmentTiers[0]} BSV`;
            btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        }
    });
}

function checkExistingSession() {
    // Check localStorage for existing session (demo)
    const savedUser = localStorage.getItem('bitnet_user');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            updateUserInterface();
            showToast('Welcome back!', 'info');
        } catch (error) {
            localStorage.removeItem('bitnet_user');
        }
    }
}

// Content Marketplace
// ===================

function loadContentMarketplace() {
    const contentGrid = document.getElementById('content-grid');
    if (!contentGrid) return;
    
    // Clear existing content except demo cards
    const demoCards = contentGrid.children.length;
    
    // Add dynamic content indicators
    updateContentStats();
}

function updateContentStats() {
    // Update stats with live numbers
    const stats = document.querySelectorAll('.stat-number');
    if (stats.length >= 4) {
        // Simulate dynamic stats
        animateNumber(stats[0], '0.001¢');
        animateText(stats[1], 'Instant');
        animateText(stats[2], 'P2P');
        animateText(stats[3], '100%');
    }
}

async function investInContent(contentId) {
    if (!currentUser) {
        showToast('Please login with HandCash to invest', 'warning');
        document.getElementById('handcash-login').click();
        return;
    }
    
    const content = mockContent.find(c => c.id === contentId);
    if (!content) {
        showToast('Content not found', 'error');
        return;
    }
    
    const existingInvestment = currentUser.investments.find(inv => inv.contentId === contentId);
    if (existingInvestment) {
        showToast('You have already invested in this content!', 'info');
        return;
    }
    
    const investmentAmount = content.investmentTiers[0];
    
    if (currentUser.balance.bsv < investmentAmount) {
        showToast('Insufficient BSV balance', 'error');
        return;
    }
    
    try {
        showToast('Processing investment...', 'info');
        
        // Simulate payment processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Mock payment to creator
        const payment = await handCashConnect.pay([{
            to: content.creator,
            amount: investmentAmount,
            currency: 'BSV',
            description: `Investment in "${content.title}"`
        }]);
        
        // Update user state
        currentUser.balance.bsv -= investmentAmount;
        currentUser.balance.usd -= investmentAmount * 100; // Mock BSV/USD rate
        currentUser.investments.push({
            contentId: contentId,
            amount: investmentAmount,
            returns: 0,
            timestamp: Date.now()
        });
        
        // Save to localStorage (demo)
        localStorage.setItem('bitnet_user', JSON.stringify(currentUser));
        
        // Update UI
        updateUserInterface();
        showToast(`🎉 Successfully invested $${investmentAmount} BSV in "${content.title}"!`, 'success');
        
        // Track analytics
        trackInvestment(contentId, investmentAmount);
        
    } catch (error) {
        console.error('❌ Investment failed:', error);
        showToast('Investment failed. Please try again.', 'error');
    }
}

function trackInvestment(contentId, amount) {
    // Analytics tracking (would integrate with real analytics service)
    console.log('📊 Investment tracked:', { contentId, amount, timestamp: Date.now() });
}

// Download Functionality
// ======================

function downloadApp(platform) {
    const downloadUrls = {
        mac: '#', // Will point to actual DMG file
        windows: '#', // Will point to actual EXE file
        linux: '#' // Will point to actual AppImage file
    };
    
    const platformNames = {
        mac: 'macOS',
        windows: 'Windows',
        linux: 'Linux'
    };
    
    showToast(`Preparing ${platformNames[platform]} download...`, 'info');
    
    // Simulate download preparation
    setTimeout(() => {
        if (downloadUrls[platform] !== '#') {
            window.open(downloadUrls[platform], '_blank');
        } else {
            showToast(`${platformNames[platform]} download will be available soon!`, 'warning');
        }
        
        // Track download
        console.log('📥 Download initiated:', { platform, timestamp: Date.now() });
    }, 1500);
}

// Utility Functions
// =================

function showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 10px;
        font-weight: 600;
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        max-width: 350px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.3);
    `;
    toast.textContent = message;
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(toast);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 4000);
}

function animateNumber(element, targetValue) {
    element.textContent = targetValue;
}

function animateText(element, targetText) {
    element.textContent = targetText;
}

// Export for global access
window.BitNet = {
    investInContent,
    downloadApp,
    showToast,
    currentUser: () => currentUser
};

console.log('🌐 BitNet Web App Loaded Successfully'); 