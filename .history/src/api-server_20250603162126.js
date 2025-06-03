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

    // BitNet Infrastructure - File Chunking System
    this.app.post('/api/bitnet/chunk-file', this.upload.single('file'), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            error: 'No file uploaded'
          });
        }

        if (!this.masterSeed) {
          return res.status(400).json({
            success: false,
            error: 'No master key available for chunk addressing'
          });
        }

        const result = await this.chunkFile(req.file);
        
        res.json({
          success: true,
          message: 'File chunked successfully',
          ...result
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.get('/api/bitnet/chunk/:chunkHash', (req, res) => {
      try {
        const chunkHash = req.params.chunkHash;
        const chunk = this.getChunk(chunkHash);
        
        if (!chunk) {
          return res.status(404).json({
            success: false,
            error: 'Chunk not found'
          });
        }

        // In a real P2P system, this would check payment first
        res.json({
          success: true,
          chunk
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.get('/api/bitnet/manifest/:fileHash', (req, res) => {
      try {
        const fileHash = req.params.fileHash;
        const manifest = this.getFileManifest(fileHash);
        
        if (!manifest) {
          return res.status(404).json({
            success: false,
            error: 'File manifest not found'
          });
        }

        res.json({
          success: true,
          manifest
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.get('/api/bitnet/chunks/list', (req, res) => {
      try {
        const chunks = this.listLocalChunks();
        
        res.json({
          success: true,
          chunks,
          total: chunks.length
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // BitNet Network endpoints (Phase 2 Week 6+)
    this.app.get('/api/network/peers', (req, res) => {
      res.json({
        success: true,
        message: 'BitNet peer discovery system',
        roadmap: 'Week 6 development',
        peers: [] // Placeholder for future peer discovery
      });
    });

    this.app.post('/api/network/announce', (req, res) => {
      res.json({
        success: true,
        message: 'BitNet peer announcement not yet implemented',
        roadmap: 'Week 6 feature'
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
          'GET /api/public-addresses',
          'POST /api/bitnet/chunk-file',
          'GET /api/bitnet/chunk/:chunkHash',
          'GET /api/bitnet/manifest/:fileHash',
          'GET /api/bitnet/chunks/list',
          'GET /api/network/peers',
          'POST /api/network/announce'
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

  // BitNet Infrastructure - File Chunking Implementation
  async chunkFile(file) {
    const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
    const fileData = await fs.readFile(file.path);
    const fileHash = crypto.createHash('sha256').update(fileData).digest('hex');
    
    // Create chunks directory if it doesn't exist
    const chunksDir = path.join(__dirname, '..', 'chunks');
    await fs.ensureDir(chunksDir);
    
    // Create manifests directory
    const manifestsDir = path.join(__dirname, '..', 'manifests');
    await fs.ensureDir(manifestsDir);
    
    const chunks = [];
    const totalChunks = Math.ceil(fileData.length / CHUNK_SIZE);
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, fileData.length);
      const chunkData = fileData.slice(start, end);
      
      // Generate hash for this chunk
      const chunkHash = crypto.createHash('sha256').update(chunkData).digest('hex');
      
      // Generate Bitcoin address for this chunk
      const chunkAddressIndex = this.addressIndex++;
      const chunkAddress = this.generateHDBitcoinAddress(chunkAddressIndex);
      
      // Save chunk to disk
      const chunkPath = path.join(chunksDir, `${chunkHash}.chunk`);
      await fs.writeFile(chunkPath, chunkData);
      
      const chunk = {
        index: i,
        hash: chunkHash,
        address: chunkAddress,
        addressIndex: chunkAddressIndex,
        size: chunkData.length,
        path: chunkPath,
        paymentUrl: `bitcoin:${chunkAddress}?amount=0.00001&label=chunk_${i}`
      };
      
      chunks.push(chunk);
    }
    
    // Create file manifest
    const manifest = {
      fileHash,
      fileName: file.originalname,
      fileSize: fileData.length,
      mimeType: file.mimetype,
      totalChunks: chunks.length,
      chunkSize: CHUNK_SIZE,
      chunks: chunks.map(c => ({
        index: c.index,
        hash: c.hash,
        address: c.address,
        size: c.size,
        paymentUrl: c.paymentUrl
      })),
      created: new Date().toISOString(),
      version: '1.0'
    };
    
    // Save manifest
    const manifestPath = path.join(manifestsDir, `${fileHash}.json`);
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    
    // Clean up uploaded file
    await fs.remove(file.path);
    
    return {
      fileHash,
      fileName: file.originalname,
      fileSize: fileData.length,
      totalChunks: chunks.length,
      chunks: chunks.length,
      manifest,
      manifestPath
    };
  }
  
  getChunk(chunkHash) {
    try {
      const chunkPath = path.join(__dirname, '..', 'chunks', `${chunkHash}.chunk`);
      
      if (!fs.existsSync(chunkPath)) {
        return null;
      }
      
      const chunkData = fs.readFileSync(chunkPath);
      
      return {
        hash: chunkHash,
        size: chunkData.length,
        data: chunkData.toString('base64'), // Base64 encode for JSON transport
        path: chunkPath
      };
    } catch (error) {
      console.error('Error getting chunk:', error);
      return null;
    }
  }
  
  getFileManifest(fileHash) {
    try {
      const manifestPath = path.join(__dirname, '..', 'manifests', `${fileHash}.json`);
      
      if (!fs.existsSync(manifestPath)) {
        return null;
      }
      
      const manifestData = fs.readFileSync(manifestPath, 'utf8');
      return JSON.parse(manifestData);
    } catch (error) {
      console.error('Error getting manifest:', error);
      return null;
    }
  }
  
  listLocalChunks() {
    try {
      const chunksDir = path.join(__dirname, '..', 'chunks');
      
      if (!fs.existsSync(chunksDir)) {
        return [];
      }
      
      const chunkFiles = fs.readdirSync(chunksDir).filter(f => f.endsWith('.chunk'));
      
      return chunkFiles.map(filename => {
        const chunkHash = filename.replace('.chunk', '');
        const chunkPath = path.join(chunksDir, filename);
        const stats = fs.statSync(chunkPath);
        
        return {
          hash: chunkHash,
          filename,
          size: stats.size,
          created: stats.birthtime,
          path: chunkPath
        };
      });
    } catch (error) {
      console.error('Error listing chunks:', error);
      return [];
    }
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