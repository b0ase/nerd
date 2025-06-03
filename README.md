# 🚀 BACDS - Bitcoin-Addressed Content Delivery System

A Bitcoin-Addressed Content Delivery System that serves as the foundation for decentralized content delivery. This application demonstrates how Bitcoin addresses can serve as both payment endpoints AND network endpoints for peer-to-peer content delivery.

**Live Website**: [bacds.website](https://bacds.website) ✅  
**Desktop Platform**: Full-featured content management system  
**HandCash Integration**: Ready for real BSV payments  

## 🌐 BACDS Ecosystem

**BACDS** (Bitcoin-Addressed Content Delivery System) consists of:

- **Marketing Website** - Professional landing page with HandCash integration ✅ 
- **Desktop Application** - Content management and file chunking system ✅
- **BACDS API Server** - Backend infrastructure for content delivery ✅
- **Future Integrations** - P2P networking and expanded creator tools

### What Makes BACDS Different

Traditional CDN: `User → DNS → CDN Server → Origin → Content`  
**BACDS Network**: `User → Bitcoin Address → Direct Peer → Content + Payment`

## Features

- 🔒 **HD Bitcoin Wallet**: Deterministic Bitcoin address generation with master seed
- 📁 **Universal File Chunking**: Split any file type (videos, documents, images) into Bitcoin-addressed chunks
- 🎨 **Modern UI**: Clean, professional interface with real-time feedback
- 🌐 **BACDS API Server**: Express.js API with comprehensive endpoints
- 💻 **Web Interface**: Content delivery platform with professional design
- 📊 **Payment Tracking**: Monitor Bitcoin payments to content addresses
- 🖥️ **Cross-Platform**: Works on macOS, Windows, and Linux
- 🎬 **Drag & Drop Support**: Simply drag videos, documents, or any files for instant chunking
- 🚀 **HandCash Integration**: Ready for real BSV payments via @handles

## How It Works

The system creates a decentralized content delivery network by:

1. Creating or loading a master seed (HD wallet)
2. Splitting files into 1MB chunks with unique Bitcoin addresses
3. Generating payment URLs for each chunk
4. Enabling payment-gated content access via HandCash
5. Providing foundation for peer-to-peer delivery

Each chunk gets a unique Bitcoin address that serves as both a payment endpoint and future network endpoint for direct peer-to-peer delivery.

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
- Web interface at `http://127.0.0.1:3001/web`

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
   - Access web interface at `http://127.0.0.1:3001/web`

2. **Generate Master Key**
   - First launch creates a new HD wallet master seed
   - Or import existing master key from backup

3. **Upload Content**
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
   - Prepare for network delivery

## BACDS Platform Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    BACDS ECOSYSTEM                          │
├─────────────────────────────────────────────────────────────┤
│  Web Layer                                                  │
│  ├── Marketing Website (bacds.website) ✅                   │
│  ├── HandCash Integration ✅                                │
│  └── Content Marketplace Demo ✅                            │
├─────────────────────────────────────────────────────────────┤
│  Application Layer                                          │
│  ├── Desktop App (Cross-platform) ✅                       │
│  ├── Content Management ✅                                  │
│  └── Payment Integration ✅                                 │
├─────────────────────────────────────────────────────────────┤
│  BACDS API Layer ✅                                        │
│  ├── Master Key Management                                 │
│  ├── Bitcoin Address Generation                            │
│  ├── File Analysis & Content Hashing                      │
│  └── Payment URL Generation                                │
├─────────────────────────────────────────────────────────────┤
│  Core Foundation ✅                                        │
│  ├── HD Wallet Integration                                 │
│  ├── Bitcoin Address Chunking                              │
│  └── Local File Management                                 │
└─────────────────────────────────────────────────────────────┘
```

## Example

**Original file:** `movie_trailer.mp4` (50MB)  
**Chunked into:** 50 chunks with Bitcoin addresses  
**Example chunk:** `1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa_chunk_0.dat`  
**Payment URL:** `bitcoin:1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa?amount=0.00001&label=movie_chunk_0`

**Supported File Types:**
- 🎬 **Videos**: MP4, AVI, MOV, MKV, WebM
- 📷 **Images**: JPEG, PNG, GIF, WebP
- 📄 **Documents**: PDF, DOCX, TXT, MD
- 🎵 **Audio**: MP3, WAV, FLAC
- 💾 **Any file type** for chunking and network delivery

## BACDS API Endpoints

The built-in API server provides:

- `GET /api/status` - System status and capabilities
- `POST /api/master-key/generate` - Create new HD wallet
- `GET /api/master-key/export` - Backup master seed
- `GET /api/addresses/single/:index` - Generate single address
- `GET /api/addresses/batch/:start/:count` - Generate address batch
- `POST /api/files/analyze` - Upload and analyze files
- `GET /web` - Web interface

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

## BACDS Vision

**Phase 1** ✅: Desktop foundation with BACDS API and professional website  
**Phase 2**: HandCash payment integration and content marketplace  
**Phase 3**: P2P networking for direct peer-to-peer delivery  
**Phase 4**: Full decentralized infrastructure with token economy  

The ultimate goal: **Bitcoin addresses as network endpoints**, enabling direct machine-to-machine content delivery with built-in payment verification via HandCash.

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
│       └── content.js       # Content management
├── vercel-app/
│   ├── index.html           # Marketing website
│   ├── app.js               # HandCash integration
│   └── vercel.json          # Deployment config
├── package.json             # Dependencies and scripts
├── STRATEGIC_PLAN.md        # Complete development roadmap
└── README.md               # This file
```

## Contributing

Contributions welcome! This project is building the foundation for decentralized content delivery. Areas of focus:

- HandCash payment integration improvements
- P2P networking development
- UI/UX enhancements
- Mobile app development
- Documentation and tutorials

## 📞 Contact & Support

- **HandCash**: Send BSV payments or messages to [$BOASE](https://handcash.io/$BOASE)
- **GitHub**: [b0ase/BACDS](https://github.com/b0ase/BACDS)
- **Website**: Contact form at [bacds.website](https://bacds.website)
- **In-App**: Direct messaging via BACDS desktop client

For technical support or collaboration inquiries, reach out via HandCash $BOASE or submit issues on GitHub.

## License

MIT License - Open source foundation for the BACDS ecosystem.

---

**🚀 BACDS Platform**: Where Bitcoin addresses become network endpoints and content delivery meets cryptocurrency payments.

**Status**: Core platform complete ✅, Marketing website live ✅, HandCash integration ready ✅, P2P networking in development. 