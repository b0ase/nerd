# 🏗️ BACDS Repository Structure

## 📁 **Current Mono-repo Organization**

```
BACDS/
├── 📋 Project Root
│   ├── package.json              # Main project dependencies
│   ├── README.md                 # Project overview
│   ├── STRATEGIC_PLAN.md         # Complete development roadmap
│   ├── API_DOCUMENTATION.md      # BACDS API reference
│   └── .gitignore               # Comprehensive ignore rules
│
├── 🖥️ Desktop Application
│   └── src/
│       ├── main.js              # Electron main process
│       ├── preload.js           # Security bridge
│       ├── renderer.js          # Desktop UI logic
│       ├── index.html           # Desktop interface
│       ├── styles.css           # Desktop styling
│       └── api-server.js        # BACDS API server (embedded)
│
├── 🌐 Web Interfaces
│   └── src/web/
│       ├── index.html           # BACDS API web interface
│       ├── app.js               # Main web functionality
│       ├── bitstream.html       # BitStream MVP interface
│       └── bitstream.js         # BitStream functionality
│
├── 🔧 BitNet Infrastructure
│   ├── chunks/                  # Local chunk storage (runtime)
│   ├── manifests/              # File reconstruction manifests (runtime)
│   └── uploads/                # Temporary file uploads (runtime)
│
└── 📚 Documentation
    ├── STRATEGIC_PLAN.md        # Complete development log
    ├── API_DOCUMENTATION.md     # API endpoint reference
    └── REPOSITORY_STRUCTURE.md  # This file
```

## 🎯 **Why Mono-repo (Current Phase)**

### **Benefits:**
- **Rapid Development** - All components evolving together in Phase 2
- **Shared Bitcoin Addressing** - Common HD wallet implementation
- **Integrated Testing** - Desktop ↔ API ↔ Web ↔ BitStream work together
- **Atomic Commits** - File chunking affects multiple components
- **Simple Deployment** - Single `npm run dev` starts everything

### **Components:**
1. **Desktop App** - Electron-based file management
2. **BACDS API** - Express.js server with Bitcoin wallet
3. **Web Interface** - Browser-based API interaction
4. **BitStream MVP** - Content delivery platform
5. **BitNet Infrastructure** - File chunking and P2P foundation

## 🔮 **Future Microservices Architecture**

As the project scales, we may split into focused repositories:

### **Option A: Service-Based Split**
```
├── bacds-core/                  # Bitcoin addressing & HD wallet
├── bacds-api/                   # Express.js API server
├── bacds-desktop/               # Electron desktop app
├── bitstream-platform/         # Content delivery web app
├── bitnet-infrastructure/      # P2P networking & chunking
└── bacds-documentation/        # Shared docs & specifications
```

### **Option B: Layer-Based Split**
```
├── bacds-foundation/           # Core Bitcoin addressing library
├── bacds-applications/         # Desktop + Web frontends
├── bitnet-network/            # P2P networking layer
└── ecosystem-products/        # BitStream + future products
```

## 🚀 **Migration Strategy**

### **When to Split:**
- **Team Growth** - Multiple developers working independently
- **Component Maturity** - Stable APIs between services
- **Deployment Complexity** - Need independent scaling
- **Open Source Strategy** - Release parts publicly

### **Migration Steps:**
1. **Extract Common Libraries** - Bitcoin addressing, crypto utilities
2. **Define Service Boundaries** - Clear API contracts
3. **Split Gradually** - One service at a time
4. **Maintain Integration Tests** - Cross-service compatibility

## 📋 **Current Development Workflow**

### **Getting Started:**
```bash
# Clone the repo
git clone https://github.com/b0ase/BACDS.git
cd BACDS

# Install dependencies
npm install

# Start full platform
npm run dev
```

### **Accessing Components:**
- **Desktop App** - Electron window opens automatically
- **BACDS API** - http://127.0.0.1:3001/api/status
- **Web Interface** - http://127.0.0.1:3001/web
- **BitStream MVP** - http://127.0.0.1:3001/web/bitstream.html

## 🔧 **Development Structure**

### **Phase 2 Focus Areas:**
- **Week 5** ✅ - File chunking system (COMPLETE)
- **Week 6** 🔧 - P2P protocol development
- **Week 7** 🔧 - Payment integration
- **Week 8** 🔧 - Parallel download system

### **Code Organization:**
- **`src/`** - Main application code
- **`src/web/`** - Web interfaces
- **Runtime directories** - Created automatically (chunks/, manifests/)
- **Docs** - Project root for easy access

## 🔒 **Security Considerations**

### **Never Commit:**
- Master keys (`master-key.json`)
- Private wallet data
- Production Bitcoin addresses
- User uploaded content

### **Development Safety:**
- Test with small files only
- Use testnet addresses for real Bitcoin integration
- Regular backup of development master keys
- Secure development environment

---

**Status:** Mono-repo structure optimal for Phase 2 development. Will reassess for microservices during Phase 3 cloud deployment. 