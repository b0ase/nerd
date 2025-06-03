# 🚀 BACDS API Documentation
## Bitcoin-Addressed Content Delivery System

**Version:** 1.0.0  
**Base URL:** `http://127.0.0.1:3001/api`  
**Web Interface:** `http://127.0.0.1:3001/web`

---

## 🎯 Overview

The BACDS API provides a RESTful interface for building Bitcoin-addressed content delivery applications. This API serves as the foundation for **BitStream** (content delivery) and **FogPrismX** (fog computing) products.

### Key Features
- ✅ **HD Bitcoin Wallet Management** - Generate and manage master keys
- ✅ **Bitcoin Address Generation** - Deterministic address creation  
- ✅ **File Analysis** - Content hashing and validation
- ✅ **Public Address Mapping** - Shareable address databases
- 🔧 **Fog Computing Endpoints** - Future P2P networking (placeholders)

---

## 🔧 Getting Started

### Start the API Server
The API server automatically starts when you run the BACDS desktop application:

```bash
npm run dev
```

The API will be available at `http://127.0.0.1:3001/api`

### Check API Status
```bash
curl http://127.0.0.1:3001/api/status
```

---

## 📡 API Endpoints

### System Information

#### `GET /api/status`
Returns current API status and system information.

**Response:**
```json
{
  "status": "online",
  "service": "BACDS API", 
  "version": "1.0.0",
  "description": "Bitcoin-Addressed Content Delivery System API",
  "hasMasterKey": true,
  "addressIndex": 42,
  "timestamp": "2025-06-03T17:00:00.000Z"
}
```

---

### Master Key Management

#### `POST /api/master-key/generate`
Generates a new HD master key (overwrites existing).

**Response:**
```json
{
  "success": true,
  "masterKey": "c516f1cdb8ab0135c8ce8376eefb0561a7fda4dd64281bf9b92d415edd64ffe0",
  "message": "New master key generated successfully"
}
```

#### `GET /api/master-key`
Retrieves the current master key.

**Response:**
```json
{
  "success": true,
  "masterKey": "c516f1cdb8ab0135c8ce8376eefb0561a7fda4dd64281bf9b92d415edd64ffe0",
  "addressIndex": 42
}
```

#### `POST /api/master-key/import`
Imports an existing master key.

**Request Body:**
```json
{
  "masterKey": "c516f1cdb8ab0135c8ce8376eefb0561a7fda4dd64281bf9b92d415edd64ffe0"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Master key imported successfully"
}
```

---

### Bitcoin Address Generation

#### `GET /api/address/:index`
Generates a Bitcoin address at the specified derivation index.

**Parameters:**
- `index` (integer): Derivation index (0-9999)

**Example:**
```bash
curl http://127.0.0.1:3001/api/address/0
```

**Response:**
```json
{
  "success": true,
  "address": "18wVTBEGiR6zcAGj68JTcYusjpruPmpLsq",
  "index": 0,
  "derivationPath": "m/0/0"
}
```

#### `GET /api/addresses/batch/:start/:count`
Generates multiple Bitcoin addresses in batch.

**Parameters:**
- `start` (integer): Starting derivation index
- `count` (integer): Number of addresses to generate (1-100)

**Example:**
```bash
curl http://127.0.0.1:3001/api/addresses/batch/0/5
```

**Response:**
```json
{
  "success": true,
  "addresses": [
    {
      "index": 0,
      "address": "18wVTBEGiR6zcAGj68JTcYusjpruPmpLsq",
      "derivationPath": "m/0/0"
    },
    {
      "index": 1,
      "address": "1N4GYoNDCAeAxD1SgKY3SjReNGqTv4oyw8",
      "derivationPath": "m/0/1"
    }
  ],
  "start": 0,
  "count": 5,
  "total": 5
}
```

---

### File Management

#### `POST /api/files/analyze`
Analyzes uploaded files for content hashing and JPEG validation.

**Content-Type:** `multipart/form-data`

**Parameters:**
- `files` (array): Files to analyze

**Response:**
```json
{
  "success": true,
  "files": [
    {
      "filename": "image.jpg",
      "size": 156234,
      "isJPEG": true,
      "hash": "abc123...",
      "tempPath": "/tmp/upload_xyz"
    }
  ],
  "jpegCount": 1
}
```

---

### Public Address Mapping

#### `GET /api/public-addresses?outputFolder=path`
Retrieves public address mapping from specified folder.

**Query Parameters:**
- `outputFolder` (string): Path to folder containing public-addresses.json

**Response:**
```json
{
  "success": true,
  "mapping": {
    "addresses": {
      "18wVTBEGiR6zcAGj68JTcYusjpruPmpLsq": {
        "index": 0,
        "filename": "image1.jpg",
        "hash": "abc123...",
        "created": "2025-06-03T17:00:00.000Z"
      }
    },
    "metadata": {
      "totalAddresses": 1,
      "lastUpdated": "2025-06-03T17:00:00.000Z"
    }
  }
}
```

---

### Fog Computing (Future)

#### `GET /api/fog/peers`
Discovers peers on the fog computing network.

**Response:**
```json
{
  "success": true,
  "peers": [],
  "message": "Fog computing peer discovery not yet implemented",
  "roadmap": "Phase 2 feature"
}
```

#### `POST /api/fog/announce`
Announces this node to the fog computing network.

**Response:**
```json
{
  "success": true,
  "message": "Fog computing peer announcement not yet implemented", 
  "roadmap": "Phase 2 feature"
}
```

---

## 🛠️ Development Examples

### Building BitStream Features

```javascript
// Generate addresses for content library
const response = await fetch('http://127.0.0.1:3001/api/addresses/batch/0/10');
const { addresses } = await response.json();

// Use addresses for content delivery URLs
addresses.forEach(addr => {
  console.log(`Content URL: bitcoin:${addr.address}?amount=0.001`);
});
```

### Building FogPrismX Features

```javascript
// Check current fog network status
const peers = await fetch('http://127.0.0.1:3001/api/fog/peers');
const network = await peers.json();

console.log(`Found ${network.peers.length} fog peers`);
```

### File Processing Pipeline

```javascript
// Analyze files before processing
const formData = new FormData();
formData.append('files', fileInput.files[0]);

const analysis = await fetch('http://127.0.0.1:3001/api/files/analyze', {
  method: 'POST',
  body: formData
});

const result = await analysis.json();
console.log(`Analyzed ${result.jpegCount} JPEG files`);
```

---

## 🔒 Security Notes

- **Master Key Security**: Master keys are stored locally and never transmitted over network
- **Local API Only**: API server only binds to localhost (127.0.0.1)
- **CORS Protection**: Limited to local development origins
- **File Cleanup**: Temporary uploaded files are automatically cleaned up

---

## 🌐 Web Interface

Access the interactive web interface at:
**http://127.0.0.1:3001/web**

Features:
- Master key management
- Address generation tools
- API endpoint testing
- BitStream/FogPrismX feature previews

---

## 📋 Error Handling

All endpoints return consistent error format:

```json
{
  "success": false,
  "error": "Error description",
  "message": "Additional context (optional)"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `404` - Not Found (resource doesn't exist) 
- `500` - Internal Server Error

---

## 🚀 Next Steps for Developers

### BitStream Development
1. Use `/api/addresses/batch` for content URL generation
2. Implement content upload via `/api/files/analyze`
3. Build streaming interface with Bitcoin payment integration

### FogPrismX Development  
1. Monitor `/api/fog/peers` for future peer discovery
2. Implement IPv6 address mapping protocols
3. Build P2P content transfer mechanisms

### Integration Examples
- **Payment Gateways**: Use generated addresses for Bitcoin payments
- **Content CDNs**: Map Bitcoin addresses to content delivery endpoints
- **P2P Networks**: Use addresses as node identifiers

---

**Documentation Version:** 1.0.0  
**Last Updated:** June 3, 2025 17:00 GMT  
**Next Update:** Phase 2 Fog Computing Implementation 