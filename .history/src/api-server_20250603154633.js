const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');
const multer = require('multer');

class BACDSAPIServer {
  constructor() {
    this.app = express();
    this.port = 3001; // Default port for BACDS API
    this.masterSeed = null;
    this.addressIndex = 0;
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // Enable CORS for web interface
    this.app.use(cors({
      origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true
    }));
    
    // Parse JSON and form data
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // Setup multer for file uploads
    this.upload = multer({ dest: 'uploads/' });
    
    // Serve static files (web UI)
    this.app.use('/web', express.static(path.join(__dirname, 'web')));
  }

  setupRoutes() {
    // API status and info
    this.app.get('/api/status', (req, res) => {
      res.json({
        status: 'online',
        service: 'BACDS API',
        version: '1.0.0',
        description: 'Bitcoin-Addressed Content Delivery System API',
        hasMasterKey: !!this.masterSeed,
        addressIndex: this.addressIndex,
        timestamp: new Date().toISOString()
      });
    });

    // Master Key Management
    this.app.post('/api/master-key/generate', (req, res) => {
      try {
        this.masterSeed = this.generateMasterSeed();
        this.addressIndex = 0;
        
        res.json({
          success: true,
          masterKey: this.masterSeed.toString('hex'),
          message: 'New master key generated successfully'
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.get('/api/master-key', (req, res) => {
      if (!this.masterSeed) {
        return res.status(404).json({
          success: false,
          error: 'No master key available'
        });
      }
      
      res.json({
        success: true,
        masterKey: this.masterSeed.toString('hex'),
        addressIndex: this.addressIndex
      });
    });

    this.app.post('/api/master-key/import', (req, res) => {
      try {
        const { masterKey } = req.body;
        
        if (!masterKey || typeof masterKey !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'Master key is required'
          });
        }

        // Validate hex format
        if (!/^[0-9a-fA-F]{64}$/.test(masterKey)) {
          return res.status(400).json({
            success: false,
            error: 'Master key must be 64-character hex string'
          });
        }

        this.masterSeed = Buffer.from(masterKey, 'hex');
        this.addressIndex = 0;

        res.json({
          success: true,
          message: 'Master key imported successfully'
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Bitcoin Address Generation
    this.app.get('/api/address/:index', (req, res) => {
      try {
        const index = parseInt(req.params.index);
        
        if (isNaN(index) || index < 0) {
          return res.status(400).json({
            success: false,
            error: 'Invalid index. Must be a non-negative integer.'
          });
        }

        if (!this.masterSeed) {
          return res.status(400).json({
            success: false,
            error: 'No master key available. Generate or import one first.'
          });
        }

        const address = this.generateHDBitcoinAddress(index);
        
        res.json({
          success: true,
          address,
          index,
          derivationPath: `m/0/${index}`
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.get('/api/addresses/batch/:start/:count', (req, res) => {
      try {
        const start = parseInt(req.params.start);
        const count = parseInt(req.params.count);
        
        if (isNaN(start) || isNaN(count) || start < 0 || count <= 0 || count > 100) {
          return res.status(400).json({
            success: false,
            error: 'Invalid parameters. Start must be ≥0, count must be 1-100.'
          });
        }

        if (!this.masterSeed) {
          return res.status(400).json({
            success: false,
            error: 'No master key available.'
          });
        }

        const addresses = [];
        for (let i = start; i < start + count; i++) {
          addresses.push({
            index: i,
            address: this.generateHDBitcoinAddress(i),
            derivationPath: `m/0/${i}`
          });
        }

        res.json({
          success: true,
          addresses,
          start,
          count,
          total: addresses.length
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // File Management
    this.app.post('/api/files/analyze', this.upload.array('files'), async (req, res) => {
      try {
        const files = req.files;
        
        if (!files || files.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'No files provided'
          });
        }

        const analysis = [];
        
        for (const file of files) {
          // Check if it's a JPEG
          const isJPEG = /\.(jpe?g)$/i.test(file.originalname);
          let hash = null;
          
          if (isJPEG) {
            hash = await this.calculateFileHash(file.path);
          }
          
          analysis.push({
            filename: file.originalname,
            size: file.size,
            isJPEG,
            hash,
            tempPath: file.path
          });
          
          // Clean up temp file if not JPEG
          if (!isJPEG) {
            await fs.remove(file.path);
          }
        }

        res.json({
          success: true,
          files: analysis,
          jpegCount: analysis.filter(f => f.isJPEG).length
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Public Address Mapping
    this.app.get('/api/public-addresses', async (req, res) => {
      try {
        const { outputFolder } = req.query;
        
        if (!outputFolder) {
          return res.status(400).json({
            success: false,
            error: 'Output folder path required'
          });
        }

        const publicAddressFile = path.join(outputFolder, 'public-addresses.json');
        
        if (!(await fs.pathExists(publicAddressFile))) {
          return res.status(404).json({
            success: false,
            error: 'Public address mapping not found'
          });
        }

        const data = await fs.readFile(publicAddressFile, 'utf8');
        const mapping = JSON.parse(data);

        res.json({
          success: true,
          mapping
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Future Fog Computing Endpoints (placeholders)
    this.app.get('/api/fog/peers', (req, res) => {
      res.json({
        success: true,
        peers: [],
        message: 'Fog computing peer discovery not yet implemented',
        roadmap: 'Phase 2 feature'
      });
    });

    this.app.post('/api/fog/announce', (req, res) => {
      res.json({
        success: true,
        message: 'Fog computing peer announcement not yet implemented',
        roadmap: 'Phase 2 feature'
      });
    });

    // Error handling
    this.app.use((error, req, res, next) => {
      console.error('API Error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        availableEndpoints: [
          'GET /api/status',
          'POST /api/master-key/generate',
          'GET /api/master-key',
          'POST /api/master-key/import',
          'GET /api/address/:index',
          'GET /api/addresses/batch/:start/:count',
          'POST /api/files/analyze',
          'GET /api/public-addresses'
        ]
      });
    });
  }

  // HD Wallet functions (copied from main.js)
  generateMasterSeed() {
    return crypto.randomBytes(32);
  }

  derivePrivateKey(masterSeed, index) {
    const indexBuffer = Buffer.alloc(4);
    indexBuffer.writeUInt32BE(index, 0);
    const combined = Buffer.concat([masterSeed, indexBuffer]);
    return crypto.createHash('sha256').update(combined).digest();
  }

  sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest();
  }

  ripemd160(buffer) {
    return crypto.createHash('ripemd160').update(buffer).digest();
  }

  base58Encode(buffer) {
    const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let result = '';
    let num = BigInt('0x' + buffer.toString('hex'));
    
    while (num > 0) {
      result = alphabet[num % 58n] + result;
      num = num / 58n;
    }
    
    for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
      result = '1' + result;
    }
    
    return result;
  }

  generateHDBitcoinAddress(index) {
    if (!this.masterSeed) {
      this.masterSeed = this.generateMasterSeed();
    }
    
    const privateKey = this.derivePrivateKey(this.masterSeed, index);
    const publicKeyHash = this.ripemd160(this.sha256(privateKey));
    const versionedHash = Buffer.concat([Buffer.from([0x00]), publicKeyHash]);
    const checksum = this.sha256(this.sha256(versionedHash)).slice(0, 4);
    const fullAddress = Buffer.concat([versionedHash, checksum]);
    return this.base58Encode(fullAddress);
  }

  async calculateFileHash(filePath) {
    const data = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, '127.0.0.1', (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`🚀 BACDS API Server running on http://127.0.0.1:${this.port}`);
          console.log(`📊 API Status: http://127.0.0.1:${this.port}/api/status`);
          console.log(`🌐 Web UI: http://127.0.0.1:${this.port}/web`);
          resolve();
        }
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('BACDS API Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = BACDSAPIServer; 