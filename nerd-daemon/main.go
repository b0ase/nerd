package main

import (
	"fmt"
	"io"
	"log"
	"net"
	"sync"
)

// Global map to store active connections and a mutex for thread safety
var (
	activeConnections = make(map[string]net.Conn)
	connectionsMutex  sync.Mutex
)

// Configuration struct (placeholder)
type Config struct {
	Port         int
	ConnectPeers []string // List of peer addresses to try connecting to (for now)
}

// Load configuration (placeholder)
func loadConfig() (*Config, error) {
	// TODO: Implement actual configuration loading (e.g., from file, env vars)
	log.Println("Loading configuration...")
	// For now, return a default config with a standard BitTorrent port (6881)
	defaultConfig := &Config{
		Port: 6881,
		// Example hardcoded peer for testing - replace later
		ConnectPeers: []string{"localhost:6882"}, // Assuming another instance runs on 6882
	}
	log.Printf("Using default configuration: %+v\n", defaultConfig)
	return defaultConfig, nil
}

// --- Peer Message Structures ---

// HandshakeMsg is the initial message exchanged between peers.
// It includes the protocol string, reserved bytes, info hash, and peer ID.
type HandshakeMsg struct {
	PstrLen  uint8    // Length of the protocol string (19 for BitTorrent)
	Pstr     [19]byte // Protocol string ("BitTorrent protocol")
	Reserved [8]byte  // Reserved bytes (used for extensions)
	InfoHash [20]byte // The hash of the .torrent file's info section
	PeerID   [20]byte // The peer's unique identifier
}

// InterestedMsg indicates that a peer is interested in downloading pieces.
type InterestedMsg struct {
	// No payload, just a message ID
}

// HaveMsg indicates that a peer has a complete piece.
type HaveMsg struct {
	PieceIndex uint32 // The zero-based index of the piece the peer has
}

// TODO: Define other message types (KeepAlive, Choke, Unchoke, Request, Piece, Cancel)
// TODO: Define NERD-specific message types (PaymentRequest, PaymentProof, TokenBalance, etc.)

// --- Networking Functions ---

// Placeholder function to handle incoming connections
func handleConnection(conn net.Conn) {
	log.Printf("Accepted connection from %s", conn.RemoteAddr())

	// Add the connection to the pool
	connectionsMutex.Lock()
	activeConnections[conn.RemoteAddr().String()] = conn
	connectionsMutex.Unlock()

	// Ensure the connection is closed and removed from the pool when the function exits
	defer func() {
		conn.Close()
		connectionsMutex.Lock()
		delete(activeConnections, conn.RemoteAddr().String())
		log.Printf("Connection closed and removed from pool: %s", conn.RemoteAddr())
		connectionsMutex.Unlock()
	}()

	log.Printf("Handling connection from %s. Currently %d active connections.", conn.RemoteAddr(), len(activeConnections))

	// Placeholder: Read loop to simulate handling data and detect errors
	buffer := make([]byte, 1024) // Small buffer for reading
	for {
		// Set a read deadline (optional, but good practice for network services)
		// conn.SetReadDeadline(time.Now().Add(60 * time.Second))

		n, err := conn.Read(buffer)
		if err != nil {
			if err != io.EOF { // Ignore EOF errors on read, which indicate connection closed normally
				log.Printf("Error reading from %s: %v", conn.RemoteAddr(), err)
			}
			return // Exit the handler function, triggering the defer to close
		}

		if n > 0 {
			// TODO: Process received data (buffer[:n])
			log.Printf("Received %d bytes from %s", n, conn.RemoteAddr())
		}
	}
}

// Function to dial and establish an outgoing connection to a peer
func dialPeer(addr string) {
	log.Printf("Attempting to connect to peer %s...", addr)

	conn, err := net.Dial("tcp", addr)
	if err != nil {
		log.Printf("Failed to connect to peer %s: %v", addr, err)
		return // Exit if connection fails
	}

	log.Printf("Successfully connected to peer %s", addr)

	// Hand off the established connection to the handler
	go handleConnection(conn) // handleConnection will add to pool and manage lifecycle
}

func main() {
	log.Println("NERD daemon starting...")

	// Load configuration
	cfg, err := loadConfig()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Use the loaded configuration
	fmt.Printf("Configuration loaded: %+v\n", cfg)

	// Set up TCP listener
	listenAddr := fmt.Sprintf(":%d", cfg.Port)
	listener, err := net.Listen("tcp", listenAddr)
	if err != nil {
		log.Fatalf("Failed to start listener on %s: %v", listenAddr, err)
	}
	defer listener.Close() // Ensure the listener is closed when main exits

	log.Printf("NERD daemon listening on %s", listenAddr)

	// TODO: Implement core NERD daemon logic

	// Attempt to connect to configured peers (for testing)
	for _, peerAddr := range cfg.ConnectPeers {
		go dialPeer(peerAddr) // Attempt to dial each peer concurrently
	}

	// Accept incoming connections in a loop
	for {
		conn, err := listener.Accept()
		if err != nil {
			log.Printf("Error accepting connection: %v", err)
			continue // Continue accepting connections even if one fails
		}

		// Handle the connection concurrently
		go handleConnection(conn)
	}

	// Keep the daemon running (this will actually be reached now)
	// select {} // Block forever
}
