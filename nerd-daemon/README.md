# NERD Daemon

**Network Endpoint Redistribution Daemon** - A BitTorrent-inspired P2P content delivery system with BitcoinSV payments and $NERD token economics.

## Overview

The NERD daemon is the core networking component of the BACDS (Bitcoin Addressed Content Delivery System). It implements a hybrid BitTorrent + BitcoinSV protocol for decentralized content distribution with integrated cryptocurrency payments.

## Features

- **Complete P2P Networking**: TCP-based peer-to-peer connections on port 6881
- **BitTorrent Wire Protocol**: Full implementation with handshake and message handling
- **Protocol Buffers**: Efficient message serialization for peer communication
- **Connection Management**: Thread-safe connection pooling with proper lifecycle management
- **Message Types**: Standard BitTorrent + NERD-specific payment and token messages
- **Extensible Architecture**: Ready for DHT, tracker, and payment integration

## Current Status

✅ **Completed:**
- Go project structure with proper module organization
- TCP networking foundation with connection handling
- Protocol Buffer message definitions and code generation
- **Complete BitTorrent wire protocol implementation**
- **Full handshake protocol with traditional BitTorrent compatibility**
- **15+ message types including standard BitTorrent (0-9) and NERD extensions (100+)**
- Connection pool management with mutex synchronization
- Error handling and graceful connection cleanup
- **Message serialization/deserialization with Protocol Buffers**
- **P2P communication foundation ready for production**

🚧 **In Progress:**
- Distributed Hash Table (DHT) implementation for peer discovery
- BitTorrent tracker server integration
- Peer Exchange (PEX) protocol implementation

📋 **Planned:**
- BSV micropayment channels for chunk-based payments
- $NERD token integration and rewards distribution
- Torrent file parsing and piece management
- Content addressing and routing
- Seeder rewards system

## Build Instructions

### Prerequisites
- Go 1.21 or later
- Protocol Buffers compiler (`protoc`)
- `protoc-gen-go` plugin

### Install Protocol Buffer Tools
```bash
# Install protoc-gen-go plugin
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest

# Make sure Go bin directory is in your PATH
export PATH=$PATH:$(go env GOPATH)/bin
```

### Build the Daemon
```bash
# Clone and navigate to the project
cd nerd-daemon

# Download dependencies
go mod tidy

# Generate Protocol Buffer code (if needed)
cd messages
protoc --go_out=. --go_opt=paths=source_relative messages.proto
cd ..

# Build the daemon
go build -o nerd-daemon

# Run the daemon
./nerd-daemon
```

## Project Structure

```
nerd-daemon/
├── main.go              # Main daemon entry point and connection handling
├── protocol.go          # BitTorrent wire protocol implementation
├── go.mod               # Go module definition with Protocol Buffer dependencies
├── messages/            # Protocol Buffer message definitions
│   ├── messages.proto   # Message schema definitions
│   └── messages.pb.go   # Generated Go code (auto-generated)
├── test_p2p.sh         # P2P communication test script
└── README.md           # This file
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
- **PaymentRequestMsg**: Request BSV payment for content delivery
- **PaymentProofMsg**: Proof of BitcoinSV payment transaction
- **TokenBalanceMsg**: $NERD token balance and quality score information
- **QualityMetricsMsg**: Peer performance data (uptime, speed, reliability)
- **GeographicHintMsg**: Geographic routing optimization data

## Configuration

The daemon currently uses hardcoded configuration:
- **Port**: 6881 (standard BitTorrent port)
- **Test Peer**: localhost:6882

Future versions will support configuration files and environment variables.

## Development

### Current Architecture
```
NERD Daemon v1.0
├── TCP Networking ✅
├── Protocol Buffers ✅  
├── BitTorrent Wire Protocol ✅
├── Connection Management ✅
├── Message Handling ✅
├── Payment Messages (structure) ✅
└── Ready for: DHT, Tracker, Payments 🚀
```

### Adding New Message Types
1. Define the message in `messages/messages.proto`
2. Regenerate Go code: `protoc --go_out=. --go_opt=paths=source_relative messages.proto`
3. Implement message handling in `main.go`

### Testing
```bash
# Run the P2P test script
./test_p2p.sh

# Or run manually
./nerd-daemon
```

The daemon demonstrates complete P2P networking capabilities and is ready for the next phase of development focusing on DHT implementation and payment integration.

## License

Part of the BACDS project - see main project for licensing information. 