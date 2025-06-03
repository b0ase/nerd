# 🚀 BACDS Desktop - BitNet Platform Foundation

A revolutionary Bitcoin-Addressed Content Delivery System that evolved from a desktop JPEG renamer into the foundation for the **BitNet** decentralized content delivery network. This application demonstrates how Bitcoin addresses can serve as both payment endpoints AND network endpoints for peer-to-peer content delivery.

## 🌐 BitNet Ecosystem

**BACDS** (Bitcoin-Addressed Content Delivery System) serves as the foundation for:

- **BitStream** - Content delivery and streaming platform ✅ 
- **BitNet Infrastructure** - Peer-to-peer networking layer (Phase 2)
- **Future Products** - Built on the BACDS API foundation

### What Makes BitNet Different

Traditional CDN: `User → DNS → CDN Server → Origin → Content`  
**BitNet Network**: `User → Bitcoin Address → Direct Peer → Content + Payment`

## Features

- 🔒 **HD Bitcoin Wallet**: Deterministic Bitcoin address generation with master seed
- 📁 **Content Management**: Rename files with Bitcoin addresses for network delivery
- 🎨 **Modern UI**: Clean, professional interface with real-time feedback
- 🌐 **BACDS API Server**: Express.js API with comprehensive endpoints
- 💻 **BitStream MVP**: Full content delivery platform with web interface
- 📊 **Payment Tracking**: Monitor Bitcoin payments to content addresses
- 🖥️ **Cross-Platform**: Works on macOS, Windows, and Linux

## How It Works

The app generates deterministic Bitcoin addresses for content delivery by:

1. Creating or loading a master seed (HD wallet)
2. Deriving Bitcoin addresses using deterministic key generation
3. Mapping content to unique Bitcoin addresses
4. Enabling payment-gated content access
5. Providing foundation for peer-to-peer delivery on BitNet

Each generated address is unique, follows Bitcoin mainnet format, and serves as both a payment endpoint and future network endpoint.

## Installation

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn

### Setup

1. Clone or download this repository
2. Open a terminal in the project directory
3. Install dependencies:

```bash
npm install
```

## Usage

### Development Mode

To run the complete BACDS platform with API server:

```bash
npm run dev
```

This starts:
- Desktop Electron app
- BACDS API server on `http://127.0.0.1:3001`
- BitStream web interface at `http://127.0.0.1:3001/web`

### Production Mode

To run the app normally:

```bash
npm start
```

### API Only

To run just the BACDS API server:

```bash
npm run api
```

### Building Executables

To create distributable executables for your platform:

```bash
npm run build
```

The built applications will be in the `dist` folder.

## How to Use the App

1. **Launch the Application**
   - Run using `npm run dev` for full platform
   - Access BitStream web interface at `http://127.0.0.1:3001/web`

2. **Generate Master Key**
   - First launch creates a new HD wallet master seed
   - Or import existing master key from backup

3. **Upload Content to BitStream**
   - Use web interface to upload images/videos
   - Automatic Bitcoin address generation for each piece
   - Set pricing and access controls

4. **Manage Content**
   - View content gallery with payment addresses
   - Track payments and views
   - Export address mappings for external use

5. **Desktop File Management**
   - Select files to rename with Bitcoin addresses
   - Create address-to-content mappings
   - Prepare for BitNet network delivery

## BitNet Platform Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    BitNet ECOSYSTEM                         │
├─────────────────────────────────────────────────────────────┤
│  Product Layer                                              │
│  ├── BitStream (Content Delivery & Streaming) ✅           │
│  ├── BitNet Infrastructure (P2P Networking) [Phase 2]      │
│  └── Future Products (Built on API)                        │
├─────────────────────────────────────────────────────────────┤
│  BACDS API Layer ✅                                        │
│  ├── Master Key Management                                 │
│  ├── Bitcoin Address Generation                            │
│  ├── File Analysis & Content Hashing                      │
│  └── Payment URL Generation                                │
├─────────────────────────────────────────────────────────────┤
│  Desktop Foundation ✅                                     │
│  ├── Electron App (Cross-platform)                        │
│  ├── HD Wallet Integration                                 │
│  └── Local File Management                                 │
└─────────────────────────────────────────────────────────────┘
```

## Example

**Original filename:** `vacation_photo.jpg`  
**New filename:** `1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa.jpg`  
**Payment URL:** `bitcoin:1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa?amount=0.001&label=vacation_photo`

## BACDS API Endpoints

The built-in API server provides:

- `GET /api/status` - System status and capabilities
- `POST /api/master-key/generate` - Create new HD wallet
- `GET /api/master-key/export` - Backup master seed
- `GET /api/addresses/single/:index` - Generate single address
- `GET /api/addresses/batch/:start/:count` - Generate address batch
- `POST /api/files/analyze` - Upload and analyze files
- `GET /web` - BitStream web interface

See `API_DOCUMENTATION.md` for complete endpoint details.

## Technical Details

### Bitcoin Address Format

- **Type**: Pay-to-Public-Key-Hash (P2PKH)
- **Network**: Bitcoin Mainnet
- **Format**: Base58Check encoding
- **Length**: 26-35 characters
- **Prefix**: Always starts with "1"

### HD Wallet Implementation

- Deterministic key derivation from master seed
- Incremental address index tracking
- Air-gapped private key security (never exposed via API)
- Public address mapping for external integrations

### Security

- Master seed stored locally with AES encryption
- Private keys never transmitted over network
- Proper Bitcoin address validation with checksums
- Atomic file operations prevent data corruption

## BitNet Vision

**Phase 1** ✅: Desktop foundation with BACDS API and BitStream MVP  
**Phase 2**: IPv6 integration for direct peer-to-peer delivery  
**Phase 3**: Cloud platform and developer ecosystem  
**Phase 4**: Full BitNet infrastructure with token economy  

The ultimate goal: **Bitcoin addresses as network endpoints**, enabling direct machine-to-machine content delivery with built-in payment verification.

## Development

### Project Structure

```
bacds/
├── src/
│   ├── main.js              # Electron main process
│   ├── preload.js           # Security bridge
│   ├── renderer.js          # Desktop UI logic
│   ├── index.html           # Desktop interface
│   ├── styles.css           # Desktop styling
│   ├── api-server.js        # BACDS API server
│   └── web/
│       ├── index.html       # API web interface
│       ├── bitstream.html   # BitStream MVP
│       └── bitstream.js     # BitStream functionality
├── package.json             # Dependencies and scripts
├── STRATEGIC_PLAN.md        # Complete development roadmap
└── README.md               # This file
```

## Contributing

Contributions welcome! This project is building the foundation for a revolutionary content delivery network. Areas of focus:

- IPv6 integration for peer-to-peer networking
- Payment verification systems
- UI/UX improvements
- Mobile app development
- Documentation and tutorials

## License

MIT License - Open source foundation for the BitNet ecosystem.

---

**🚀 Join the BitNet Revolution**: Where Bitcoin addresses become network endpoints and content delivery meets cryptocurrency payments.

**Status**: BACDS foundation complete, BitStream MVP launched, ready for BitNet Infrastructure development (Phase 2). 