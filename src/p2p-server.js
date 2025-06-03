const WebSocket = require('ws');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const dgram = require('dgram');
const os = require('os');

class BitNetP2PServer {
    constructor(port = 6001, apiServerPort = 3001) {
        this.port = port;
        this.apiServerPort = apiServerPort;
        this.nodeId = this.generateNodeId();
        this.peers = new Map(); // nodeId -> {ws, address, lastSeen, chunks}
        this.localChunks = new Map(); // chunkHash -> chunkInfo
        this.dht = new Map(); // chunkHash -> Set of nodeIds that have it
        this.discoverySocket = null;
        this.wss = null;
        
        // Discovery settings
        this.discoveryPort = 6002;
        this.discoveryInterval = 30000; // 30 seconds
        this.maxPeers = 50;
        
        console.log(`🔗 BitNet P2P Node ID: ${this.nodeId}`);
    }
    
    generateNodeId() {
        return crypto.randomBytes(16).toString('hex');
    }
    
    async start() {
        try {
            // Start WebSocket server for P2P connections
            await this.startWebSocketServer();
            
            // Start UDP discovery service
            await this.startDiscoveryService();
            
            // Load local chunks from API server
            await this.loadLocalChunks();
            
            // Start periodic discovery broadcasts
            this.startPeriodicDiscovery();
            
            console.log(`🚀 BitNet P2P Server started on port ${this.port}`);
            console.log(`📡 Discovery service running on port ${this.discoveryPort}`);
            
        } catch (error) {
            console.error('❌ Failed to start P2P server:', error);
            throw error;
        }
    }
    
    async startWebSocketServer() {
        this.wss = new WebSocket.Server({ 
            port: this.port,
            perMessageDeflate: false 
        });
        
        this.wss.on('connection', (ws, request) => {
            const clientAddress = request.socket.remoteAddress;
            console.log(`🔗 New P2P connection from ${clientAddress}`);
            
            ws.on('message', async (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    await this.handleMessage(ws, message);
                } catch (error) {
                    console.error('❌ Error handling message:', error);
                    this.sendError(ws, 'Invalid message format');
                }
            });
            
            ws.on('close', () => {
                this.removePeer(ws);
                console.log(`🔌 P2P connection closed from ${clientAddress}`);
            });
            
            ws.on('error', (error) => {
                console.error('❌ WebSocket error:', error);
                this.removePeer(ws);
            });
            
            // Send handshake
            this.sendMessage(ws, {
                type: 'handshake',
                nodeId: this.nodeId,
                chunks: Array.from(this.localChunks.keys()),
                timestamp: Date.now()
            });
        });
    }
    
    async startDiscoveryService() {
        this.discoverySocket = dgram.createSocket('udp4');
        
        this.discoverySocket.on('message', async (msg, rinfo) => {
            try {
                const discovery = JSON.parse(msg.toString());
                if (discovery.type === 'peer_discovery' && discovery.nodeId !== this.nodeId) {
                    await this.handlePeerDiscovery(discovery, rinfo);
                }
            } catch (error) {
                // Ignore malformed discovery messages
            }
        });
        
        this.discoverySocket.on('error', (error) => {
            console.error('❌ Discovery socket error:', error);
        });
        
        this.discoverySocket.bind(this.discoveryPort);
    }
    
    async handleMessage(ws, message) {
        switch (message.type) {
            case 'handshake':
                await this.handleHandshake(ws, message);
                break;
                
            case 'chunk_request':
                await this.handleChunkRequest(ws, message);
                break;
                
            case 'chunk_response':
                await this.handleChunkResponse(ws, message);
                break;
                
            case 'chunk_availability':
                await this.handleChunkAvailability(ws, message);
                break;
                
            case 'peer_list_request':
                await this.handlePeerListRequest(ws, message);
                break;
                
            default:
                console.log(`⚠️ Unknown message type: ${message.type}`);
        }
    }
    
    async handleHandshake(ws, message) {
        const { nodeId, chunks } = message;
        
        // Register peer
        this.peers.set(nodeId, {
            ws,
            nodeId,
            lastSeen: Date.now(),
            chunks: new Set(chunks)
        });
        
        // Update DHT with peer's chunks
        for (const chunkHash of chunks) {
            if (!this.dht.has(chunkHash)) {
                this.dht.set(chunkHash, new Set());
            }
            this.dht.get(chunkHash).add(nodeId);
        }
        
        console.log(`🤝 Handshake completed with node ${nodeId} (${chunks.length} chunks)`);
        
        // Send our chunk list
        this.sendMessage(ws, {
            type: 'chunk_availability',
            chunks: Array.from(this.localChunks.keys()),
            timestamp: Date.now()
        });
    }
    
    async handleChunkRequest(ws, message) {
        const { chunkHash, requestId } = message;
        
        if (this.localChunks.has(chunkHash)) {
            try {
                // Get chunk data from local API server
                const response = await fetch(`http://127.0.0.1:${this.apiServerPort}/api/bitnet/chunk/${chunkHash}`);
                
                if (response.ok) {
                    const chunkData = await response.arrayBuffer();
                    
                    this.sendMessage(ws, {
                        type: 'chunk_response',
                        requestId,
                        chunkHash,
                        data: Buffer.from(chunkData).toString('base64'),
                        success: true
                    });
                    
                    console.log(`📤 Served chunk ${chunkHash} to peer`);
                } else {
                    this.sendMessage(ws, {
                        type: 'chunk_response',
                        requestId,
                        chunkHash,
                        success: false,
                        error: 'Chunk not found locally'
                    });
                }
            } catch (error) {
                console.error(`❌ Error serving chunk ${chunkHash}:`, error);
                this.sendMessage(ws, {
                    type: 'chunk_response',
                    requestId,
                    chunkHash,
                    success: false,
                    error: 'Internal server error'
                });
            }
        } else {
            this.sendMessage(ws, {
                type: 'chunk_response',
                requestId,
                chunkHash,
                success: false,
                error: 'Chunk not available'
            });
        }
    }
    
    async handleChunkResponse(ws, message) {
        const { requestId, chunkHash, data, success, error } = message;
        
        if (success && data) {
            // Store received chunk (this would integrate with the API server)
            console.log(`📥 Received chunk ${chunkHash} from peer`);
            
            // Emit event for any pending download requests
            this.emit('chunk_received', { chunkHash, data: Buffer.from(data, 'base64') });
        } else {
            console.log(`❌ Failed to receive chunk ${chunkHash}: ${error}`);
            this.emit('chunk_failed', { chunkHash, error });
        }
    }
    
    async handleChunkAvailability(ws, message) {
        const { chunks } = message;
        const peer = this.findPeerByWebSocket(ws);
        
        if (peer) {
            // Update peer's chunk list
            peer.chunks = new Set(chunks);
            
            // Update DHT
            for (const chunkHash of chunks) {
                if (!this.dht.has(chunkHash)) {
                    this.dht.set(chunkHash, new Set());
                }
                this.dht.get(chunkHash).add(peer.nodeId);
            }
            
            console.log(`📊 Updated chunk availability for node ${peer.nodeId}`);
        }
    }
    
    async handlePeerListRequest(ws, message) {
        const peerList = Array.from(this.peers.values()).map(peer => ({
            nodeId: peer.nodeId,
            chunkCount: peer.chunks.size,
            lastSeen: peer.lastSeen
        }));
        
        this.sendMessage(ws, {
            type: 'peer_list_response',
            peers: peerList,
            timestamp: Date.now()
        });
    }
    
    async handlePeerDiscovery(discovery, rinfo) {
        const { nodeId, port, chunks } = discovery;
        
        // Don't connect to ourselves or existing peers
        if (nodeId === this.nodeId || this.peers.has(nodeId)) {
            return;
        }
        
        // Limit number of peers
        if (this.peers.size >= this.maxPeers) {
            return;
        }
        
        // Attempt to connect to discovered peer
        try {
            const ws = new WebSocket(`ws://${rinfo.address}:${port}`);
            
            ws.on('open', () => {
                console.log(`🔗 Connected to discovered peer ${nodeId} at ${rinfo.address}:${port}`);
            });
            
            ws.on('message', async (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    await this.handleMessage(ws, message);
                } catch (error) {
                    console.error('❌ Error handling discovered peer message:', error);
                }
            });
            
            ws.on('close', () => {
                this.removePeer(ws);
            });
            
            ws.on('error', (error) => {
                console.error(`❌ Connection error to peer ${nodeId}:`, error);
            });
            
        } catch (error) {
            console.error(`❌ Failed to connect to discovered peer ${nodeId}:`, error);
        }
    }
    
    startPeriodicDiscovery() {
        setInterval(() => {
            this.broadcastDiscovery();
        }, this.discoveryInterval);
        
        // Initial broadcast
        setTimeout(() => this.broadcastDiscovery(), 1000);
    }
    
    broadcastDiscovery() {
        const discovery = {
            type: 'peer_discovery',
            nodeId: this.nodeId,
            port: this.port,
            chunks: Array.from(this.localChunks.keys()),
            timestamp: Date.now()
        };
        
        const message = Buffer.from(JSON.stringify(discovery));
        
        // Broadcast to local network
        this.discoverySocket.send(message, this.discoveryPort, '255.255.255.255', (error) => {
            if (error) {
                console.error('❌ Discovery broadcast error:', error);
            }
        });
        
        // Also broadcast to local subnet
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    const broadcast = this.calculateBroadcastAddress(iface.address, iface.netmask);
                    this.discoverySocket.send(message, this.discoveryPort, broadcast, () => {});
                }
            }
        }
    }
    
    calculateBroadcastAddress(ip, netmask) {
        const ipParts = ip.split('.').map(Number);
        const maskParts = netmask.split('.').map(Number);
        
        const broadcast = ipParts.map((part, index) => {
            return part | (255 - maskParts[index]);
        });
        
        return broadcast.join('.');
    }
    
    async loadLocalChunks() {
        try {
            const response = await fetch(`http://127.0.0.1:${this.apiServerPort}/api/bitnet/chunks/list`);
            if (response.ok) {
                const chunks = await response.json();
                
                for (const chunk of chunks) {
                    this.localChunks.set(chunk.hash, chunk);
                    
                    // Add to DHT
                    if (!this.dht.has(chunk.hash)) {
                        this.dht.set(chunk.hash, new Set());
                    }
                    this.dht.get(chunk.hash).add(this.nodeId);
                }
                
                console.log(`📦 Loaded ${chunks.length} local chunks`);
            }
        } catch (error) {
            console.error('❌ Failed to load local chunks:', error);
        }
    }
    
    // Public API methods
    
    async requestChunk(chunkHash) {
        const peers = this.dht.get(chunkHash);
        if (!peers || peers.size === 0) {
            throw new Error(`No peers have chunk ${chunkHash}`);
        }
        
        // Try multiple peers in parallel
        const requestPromises = Array.from(peers).slice(0, 3).map(nodeId => {
            const peer = this.peers.get(nodeId);
            if (peer && peer.ws.readyState === WebSocket.OPEN) {
                return this.requestChunkFromPeer(peer.ws, chunkHash);
            }
            return Promise.reject(new Error('Peer not available'));
        });
        
        return Promise.race(requestPromises);
    }
    
    async requestChunkFromPeer(ws, chunkHash) {
        return new Promise((resolve, reject) => {
            const requestId = crypto.randomBytes(8).toString('hex');
            const timeout = setTimeout(() => {
                reject(new Error('Request timeout'));
            }, 30000);
            
            const handleResponse = (message) => {
                if (message.requestId === requestId) {
                    clearTimeout(timeout);
                    ws.removeListener('message', handleResponse);
                    
                    if (message.success) {
                        resolve(Buffer.from(message.data, 'base64'));
                    } else {
                        reject(new Error(message.error));
                    }
                }
            };
            
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    if (message.type === 'chunk_response') {
                        handleResponse(message);
                    }
                } catch (error) {
                    // Ignore malformed messages
                }
            });
            
            this.sendMessage(ws, {
                type: 'chunk_request',
                chunkHash,
                requestId,
                timestamp: Date.now()
            });
        });
    }
    
    findChunkPeers(chunkHash) {
        const peers = this.dht.get(chunkHash);
        return peers ? Array.from(peers) : [];
    }
    
    getNetworkStats() {
        return {
            nodeId: this.nodeId,
            connectedPeers: this.peers.size,
            localChunks: this.localChunks.size,
            dhtEntries: this.dht.size,
            uptime: process.uptime()
        };
    }
    
    // Helper methods
    
    sendMessage(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }
    
    sendError(ws, error) {
        this.sendMessage(ws, { type: 'error', error, timestamp: Date.now() });
    }
    
    findPeerByWebSocket(ws) {
        for (const peer of this.peers.values()) {
            if (peer.ws === ws) {
                return peer;
            }
        }
        return null;
    }
    
    removePeer(ws) {
        const peer = this.findPeerByWebSocket(ws);
        if (peer) {
            this.peers.delete(peer.nodeId);
            
            // Remove from DHT
            for (const [chunkHash, nodeSet] of this.dht.entries()) {
                nodeSet.delete(peer.nodeId);
                if (nodeSet.size === 0) {
                    this.dht.delete(chunkHash);
                }
            }
            
            console.log(`🔌 Removed peer ${peer.nodeId}`);
        }
    }
    
    async stop() {
        if (this.discoverySocket) {
            this.discoverySocket.close();
        }
        
        if (this.wss) {
            this.wss.close();
        }
        
        console.log('🛑 BitNet P2P Server stopped');
    }
}

// EventEmitter functionality for chunk download events
const EventEmitter = require('events');
Object.setPrototypeOf(BitNetP2PServer.prototype, EventEmitter.prototype);

module.exports = BitNetP2PServer; 