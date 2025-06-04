package main

import (
	"fmt"
	"io"
	"log"
	"net"
	"sync"

	"github.com/nerd-daemon/messages" // Import the generated Protocol Buffer messages
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

// --- Networking Functions ---

// Note: Message structures are now imported from "github.com/nerd-daemon/messages" package
// Available types: messages.HandshakeMsg, messages.InterestedMsg, messages.HaveMsg

// TODO: Define other message types (KeepAlive, Choke, Unchoke, Request, Piece, Cancel)
// TODO: Define NERD-specific message types (PaymentRequest, PaymentProof, TokenBalance, etc.)

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

	// Create wire protocol handler
	wireProtocol := NewWireProtocol(conn)

	// Try to receive handshake (for incoming connections)
	handshake, err := wireProtocol.ReceiveHandshake()
	if err != nil {
		log.Printf("Failed to receive handshake from %s: %v", conn.RemoteAddr(), err)
		return
	}

	log.Printf("Received handshake from %s: protocol=%s, peer_id=%x",
		conn.RemoteAddr(), string(handshake.ProtocolString), handshake.PeerId)

	// Send our handshake response
	var infoHash [20]byte                     // Placeholder - in real implementation this would be content-specific
	copy(infoHash[:], "NERD_DAEMON_HASH____") // 20 byte placeholder

	err = wireProtocol.SendHandshake(infoHash)
	if err != nil {
		log.Printf("Failed to send handshake to %s: %v", conn.RemoteAddr(), err)
		return
	}

	// Send interested message to indicate we want to participate
	err = wireProtocol.SendInterested()
	if err != nil {
		log.Printf("Failed to send interested message to %s: %v", conn.RemoteAddr(), err)
		return
	}

	log.Printf("Handshake completed with %s", conn.RemoteAddr())

	// Message handling loop
	for {
		msg, err := wireProtocol.ReceiveMessage()
		if err != nil {
			if err != io.EOF {
				log.Printf("Error receiving message from %s: %v", conn.RemoteAddr(), err)
			}
			return
		}

		// Parse the message payload
		payload, err := ParseMessagePayload(msg.MessageId, msg.Payload)
		if err != nil {
			log.Printf("Failed to parse message payload from %s (type %d): %v",
				conn.RemoteAddr(), msg.MessageId, err)
			continue
		}

		// Handle different message types
		switch msg.MessageId {
		case 999: // Keep-alive (defined in protocol.go)
			log.Printf("Received keep-alive from %s", conn.RemoteAddr())
		case 2: // MsgTypeInterested
			log.Printf("Peer %s is interested", conn.RemoteAddr())
			// Send unchoke message
			unchoke := &messages.UnchokeMsg{}
			wireProtocol.SendMessage(1, unchoke) // MsgTypeUnchoke = 1
		case 4: // MsgTypeHave
			haveMsg := payload.(*messages.HaveMsg)
			log.Printf("Peer %s has piece %d", conn.RemoteAddr(), haveMsg.PieceIndex)
		case 100: // MsgTypePaymentRequest
			paymentReq := payload.(*messages.PaymentRequestMsg)
			log.Printf("Payment request from %s: %d satoshis for piece %d",
				conn.RemoteAddr(), paymentReq.AmountSatoshis, paymentReq.PieceIndex)
		case 102: // MsgTypeTokenBalance
			tokenBalance := payload.(*messages.TokenBalanceMsg)
			log.Printf("Token balance from %s: %d $NERD tokens, quality score: %d",
				conn.RemoteAddr(), tokenBalance.NerdBalance, tokenBalance.QualityScore)
		default:
			log.Printf("Received message type %d from %s", msg.MessageId, conn.RemoteAddr())
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

	// Create wire protocol handler for outgoing connection
	wireProtocol := NewWireProtocol(conn)

	// Send handshake first (for outgoing connections)
	var infoHash [20]byte
	copy(infoHash[:], "NERD_DAEMON_HASH____") // 20 byte placeholder

	err = wireProtocol.SendHandshake(infoHash)
	if err != nil {
		log.Printf("Failed to send handshake to %s: %v", addr, err)
		conn.Close()
		return
	}

	log.Printf("Sent handshake to %s", addr)

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
