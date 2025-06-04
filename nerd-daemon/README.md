# NERD Daemon

**Network Endpoint Redistribution Daemon** - A BitTorrent-inspired P2P content delivery system with BitcoinSV payments and $NERD token economics.

## Overview

The NERD daemon is the core networking component of the BACDS (Bitcoin Addressed Content Delivery System). It implements a hybrid BitTorrent + BitcoinSV protocol for decentralized content distribution with integrated cryptocurrency payments.

## Features

- **Complete P2P Networking**: TCP-based peer-to-peer connections.
- **BitTorrent Wire Protocol**: Full implementation with handshake and message handling.
- **Protocol Buffers**: Efficient message serialization for core peer communication.
- **Connection Management**: Thread-safe connection pooling with proper lifecycle management.
- **Distributed Hash Table (DHT)**: Kademlia-based DHT for decentralized peer discovery using `anacrolix/dht/v2`.
- **BitTorrent Tracker**: Integrated HTTP/UDP tracker for announcing and discovering peers.
- **BSV Micropayments (Foundational)**: System for creating, signing, and broadcasting BSV transactions for payments, using `bsv-blockchain/go-sdk`. Placeholder for UTXO fetching and payment channel management.
- **Extensible Architecture**: Designed for further feature integration.

## Current Status (Phase 3 Completion)

✅ **Completed:**
- Go project structure with proper module organization.
- TCP networking foundation with connection handling.
- Protocol Buffer message definitions (`messages/messages.pb.go`).
- **Complete BitTorrent wire protocol implementation**.
- **Full handshake protocol with traditional BitTorrent compatibility**.
- Standard BitTorrent message types (0-9) and NERD extensions (100+).
- Connection pool management with mutex synchronization.
- Error handling and graceful connection cleanup.
- **Message serialization/deserialization with Protocol Buffers**.
- **P2P communication foundation**.
- **Distributed Hash Table (DHT)**: Implemented in `dht.go` for peer discovery and announcement. Integrated into the main daemon flow.
- **BitTorrent Tracker**: Implemented in `tracker.go` with HTTP and UDP interfaces. Integrated into the main daemon flow.
- **BSV Micropayment System (Foundational)**: Implemented in `bsv_payments.go`. Includes private key management, address generation, transaction creation (inputs, outputs, fees, change), signing, and placeholder broadcasting. Uses `bsv-blockchain/go-sdk`.

📋 **Next Steps / Planned Refinements & Features:**
1.  **BSV Payment System - Finalization & Integration**:
    *   Implement real UTXO fetching (e.g., via Whatsonchain API).
    *   Implement real transaction broadcasting (currently placeholder in `bsv_payments.go` but points to Whatsonchain).
    *   Develop robust wallet balance tracking.
    *   Finalize and integrate payment channel logic (`OpenPaymentChannel`, `ClosePaymentChannel`, state updates).
2.  **Content Discovery and Search**:
    *   Advanced mechanisms for discovering and searching content (extend DHT or new indexing protocol).
3.  **Security Enhancements**:
    *   Peer authentication and encryption (e.g., TLS).
    *   Message signing and verification.
    *   Sybil attack resistance and peer reputation.
4.  **Advanced Data Handling & NERD Tokens**:
    *   Implement NERD-specific data storage/retrieval on DHT (`StoreNERDData`, `RetrieveNERDData`).
    *   Flesh out NERD token functionalities and economics.
5.  **Peer Exchange (PEX)**: Implement PEX protocol for more peer discovery.
6.  **Torrent File Parsing & Piece Management**: Full support for `.torrent` files.
7.  **Testing and Refinement**: Add comprehensive unit, integration, and end-to-end tests.

## Build Instructions

### Prerequisites
- Go 1.21 or later (ensure your `go.mod` reflects this or higher if SDKs require it).

### Build the Daemon
```bash
# Navigate to the project directory
cd nerd-daemon

# Download dependencies
go mod tidy

# Build the daemon (latest version with Phase 3 features)
go build -o nerd-daemon-phase3-final .

# To run the daemon (ensure it has execute permissions: chmod +x nerd-daemon-phase3-final)
./nerd-daemon-phase3-final
```

## Project Structure

```
nerd-daemon/
├── main.go                # Main daemon entry point, config, P2P, DHT, Tracker, BSV Payments integration
├── protocol.go            # BitTorrent wire protocol implementation
├── dht.go                 # Kademlia DHT implementation for peer discovery
├── tracker.go             # BitTorrent tracker server implementation
├── bsv_payments.go        # BSV micropayment system implementation
├── go.mod                 # Go module definition
├── go.sum                 # Go module checksums
├── messages/              # Protocol Buffer message definitions
│   └── messages.pb.go     # Generated Go code (auto-generated, checked-in)
├── CHANGELOG.md           # Project changelog
├── README.md              # This file
└── test_p2p.sh            # P2P communication test script (may need updates)
```

## Message Types

### Standard BitTorrent Messages (0-9)
- **HandshakeMsg**: Initial peer handshake with protocol string, info hash, and peer ID
- **KeepAliveMsg**: Connection heartbeat message
- **ChokeMsg/UnchokeMsg**: Bandwidth control messages
- **InterestedMsg/NotInterestedMsg**: Interest signaling messages
- **HaveMsg**: Announces possession of a complete piece
- **BitfieldMsg**: Bitfield representing owned pieces
- **RequestMsg**: Requests a specific block from a piece
- **PieceMsg**: Delivers a block of data from a piece
- **CancelMsg**: Cancels a previous request
- **PortMsg**: Announces the port for DHT node communication

### NERD-Specific Messages (100+)
(Defined in `messages/messages.pb.go`)
- **PaymentRequestMsg**: Request BSV payment for content delivery.
- **PaymentProofMsg**: Proof of BitcoinSV payment transaction.
- **TokenBalanceMsg**: $NERD token balance and quality score information.
- **QualityMetricsMsg**: Peer performance data (uptime, speed, reliability).
- **GeographicHintMsg**: Geographic routing optimization data.

## Configuration (`config.json` loaded by `main.go`)

The daemon loads configuration from `config.json`. Key settings include:
- **ListenPort**: TCP port for P2P connections (e.g., 6881).
- **EnableDHT**: Boolean to enable/disable the DHT server.
- **DHTPort**: UDP port for the DHT server.
- **BootstrapNodes**: List of initial DHT bootstrap nodes.
- **EnableTracker**: Boolean to enable/disable the integrated tracker.
- **TrackerHTTPPort**: HTTP port for the tracker.
- **TrackerUDPPort**: UDP port for the tracker.
- **BSVPayment**: Configuration block for BSV payments:
    - **PrivateKeyWIF**: Wallet Import Format for BSV private key.
    - **NetworkType**: "mainnet" or "testnet".
    - **BroadcastURL**: API URL for broadcasting transactions.
    - **UTXOFetchURLFormat**: API URL format for fetching UTXOs.
    - **FeeRate**: Satoshis per byte for transaction fees.

Default values are provided if `config.json` is missing or incomplete.

## Development

### Current Architecture (Post-Phase 3)
```
NERD Daemon (Phase 3)
├── TCP Networking ✅
├── Protocol Buffers ✅
├── BitTorrent Wire Protocol ✅
├── Connection Management ✅
├── Message Handling ✅
├── Kademlia DHT (anacrolix/dht/v2) ✅
├── BitTorrent Tracker (HTTP/UDP) ✅
├── BSV Payments (bsv-blockchain/go-sdk) - Foundational ✅
│   ├── Address Generation ✅
│   ├── Transaction Creation (Inputs, Outputs, Fee, Change) ✅
│   ├── Transaction Signing ✅
│   ├── Placeholder UTXO Fetching (to be replaced with API) ✅
│   └── Placeholder Broadcasting (to be replaced with API) ✅
└── Ready for: BSV API integration, Payment Channels, Content Search, Security 🚀
```

### Testing
The `test_p2p.sh` script may require updates to align with current functionalities.
Manual testing by running multiple daemon instances is recommended.

## License

Part of the BACDS project - see main project for licensing information. 