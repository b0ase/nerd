package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"sync"
	"time"

	"github.com/nerd-daemon/messages" // Import the generated Protocol Buffer messages
)

// Global map to store active connections and a mutex for thread safety
var (
	activeConnections = make(map[string]net.Conn)
	connectionsMutex  sync.Mutex
)

// Configuration struct with DHT, Tracker, and BSV Payment support
type Config struct {
	Port            int
	DHTPort         int
	TrackerHTTPPort int
	TrackerUDPPort  int
	ConnectPeers    []string         // List of peer addresses to try connecting to (for now)
	BootstrapNodes  []string         // DHT bootstrap nodes
	EnableDHT       bool             // Enable DHT functionality
	EnableTracker   bool             // Enable tracker functionality
	EnableBSV       bool             // Enable BSV payment functionality
	DataDir         string           // Data directory for storage
	BSVPayment      BSVPaymentConfig // BSV payment configuration
}

// JSONConfig represents the JSON structure for configuration file
type JSONConfig struct {
	Port            int      `json:"port"`
	DHTPort         int      `json:"dht_port"`
	TrackerHTTPPort int      `json:"tracker_http_port"`
	TrackerUDPPort  int      `json:"tracker_udp_port"`
	EnableDHT       bool     `json:"enable_dht"`
	EnableTracker   bool     `json:"enable_tracker"`
	EnableBSV       bool     `json:"enable_bsv"`
	BootstrapNodes  []string `json:"bootstrap_nodes"`
	ConnectPeers    []string `json:"connect_peers"`
	BSVPayment      struct {
		PrivateKeyWIF        string  `json:"private_key_wif"`
		MinPaymentSatoshis   int64   `json:"min_payment_satoshis"`
		MaxPaymentSatoshis   int64   `json:"max_payment_satoshis"`
		ChannelTimeoutBlocks int     `json:"channel_timeout_blocks"`
		FeeRate              float64 `json:"fee_rate"`
		NetworkType          string  `json:"network_type"`
		BroadcastURL         string  `json:"broadcast_url"`
		UTXOFetchURLFormat   string  `json:"utxo_fetch_url_format"`
	} `json:"bsv_payment"`
}

// Load configuration with support for JSON file loading and fallback to defaults
func loadConfig() (*Config, error) {
	log.Println("Loading configuration...")

	// Try to load from config.json first
	configFile := "config.json"
	if data, err := os.ReadFile(configFile); err == nil {
		log.Printf("Loading configuration from %s", configFile)

		var jsonConfig JSONConfig
		if err := json.Unmarshal(data, &jsonConfig); err != nil {
			log.Printf("Warning: Failed to parse %s: %v. Using default configuration.", configFile, err)
		} else {
			// Convert JSON config to internal Config struct
			config := &Config{
				Port:            jsonConfig.Port,
				DHTPort:         jsonConfig.DHTPort,
				TrackerHTTPPort: jsonConfig.TrackerHTTPPort,
				TrackerUDPPort:  jsonConfig.TrackerUDPPort,
				EnableDHT:       jsonConfig.EnableDHT,
				EnableTracker:   jsonConfig.EnableTracker,
				EnableBSV:       jsonConfig.EnableBSV,
				DataDir:         "./nerd-data", // Default data directory
				BootstrapNodes:  jsonConfig.BootstrapNodes,
				ConnectPeers:    jsonConfig.ConnectPeers,
				BSVPayment: BSVPaymentConfig{
					PrivateKeyWIF:        jsonConfig.BSVPayment.PrivateKeyWIF,
					MinPaymentSatoshis:   jsonConfig.BSVPayment.MinPaymentSatoshis,
					MaxPaymentSatoshis:   jsonConfig.BSVPayment.MaxPaymentSatoshis,
					ChannelTimeoutBlocks: jsonConfig.BSVPayment.ChannelTimeoutBlocks,
					FeeRate:              jsonConfig.BSVPayment.FeeRate,
					NetworkType:          jsonConfig.BSVPayment.NetworkType,
					BroadcastURL:         jsonConfig.BSVPayment.BroadcastURL,
					UTXOFetchURLFormat:   jsonConfig.BSVPayment.UTXOFetchURLFormat,
				},
			}
			log.Printf("Configuration loaded from file successfully")
			return config, nil
		}
	} else {
		log.Printf("No %s file found: %v. Using default configuration.", configFile, err)
	}

	// Fallback to default configuration
	// Default DHT bootstrap nodes (BitTorrent mainline DHT)
	defaultBootstrapNodes := []string{
		"router.utorrent.com:6881",
		"router.bittorrent.com:6881",
		"dht.transmissionbt.com:6881",
		"dht.aelitis.com:6881",
	}

	defaultConfig := &Config{
		Port:            6881,
		DHTPort:         6882, // DHT on different port to avoid conflicts
		TrackerHTTPPort: 8080, // Tracker HTTP port
		TrackerUDPPort:  8081, // Tracker UDP port
		EnableDHT:       true,
		EnableTracker:   true,
		EnableBSV:       true,          // Enable BSV payments by default
		DataDir:         "./nerd-data", // Default data directory
		BootstrapNodes:  defaultBootstrapNodes,
		ConnectPeers:    []string{"localhost:6883"}, // Example peer for testing
		BSVPayment: BSVPaymentConfig{
			PrivateKeyWIF:        "REPLACE_WITH_YOUR_BSV_PRIVATE_KEY_WIF_FORMAT", // Placeholder
			MinPaymentSatoshis:   1,                                              // 1 satoshi minimum
			MaxPaymentSatoshis:   10000,                                          // 10k satoshi maximum
			ChannelTimeoutBlocks: 144,                                            // 24 hours (assuming 10 min blocks)
			FeeRate:              0.5,                                            // 0.5 satoshis per byte
			NetworkType:          "testnet",
			BroadcastURL:         "https://api.whatsonchain.com/v1/bsv/test/tx/raw",
			UTXOFetchURLFormat:   "https://api.whatsonchain.com/v1/bsv/%s/address/%s/unspent",
		},
	}
	log.Printf("Using default configuration")
	return defaultConfig, nil
}

// --- Networking Functions ---

// Note: Message structures are now imported from "github.com/nerd-daemon/messages" package
// Available types: messages.HandshakeMsg, messages.InterestedMsg, messages.HaveMsg

// TODO: Define other message types (KeepAlive, Choke, Unchoke, Request, Piece, Cancel)
// TODO: Define NERD-specific message types (PaymentRequest, PaymentProof, TokenBalance, etc.)

// Placeholder function to handle incoming connections
func handleConnection(conn net.Conn, dhtServer *DHTServer) {
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

	// If DHT is enabled, add this peer to our DHT peer store
	if dhtServer != nil {
		host, portStr, err := net.SplitHostPort(conn.RemoteAddr().String())
		if err == nil {
			if port := parsePort(portStr); port > 0 {
				// Add discovered peer to DHT
				dhtServer.addDiscoveredPeer(host, port, nil)
			}
		}
	}

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
		case 103: // MsgTypeQualityMetrics
			qualityMetrics := payload.(*messages.QualityMetricsMsg)
			log.Printf("Quality metrics from %s: uptime=%d, reliability=%.2f",
				conn.RemoteAddr(), qualityMetrics.UptimeSeconds, qualityMetrics.ReliabilityScore)
			// Process quality metrics through DHT if available
			if dhtServer != nil {
				dhtServer.ProcessNERDMessage("quality_metrics", msg.Payload)
			}
		case 104: // MsgTypeGeographicHint
			geoHint := payload.(*messages.GeographicHintMsg)
			log.Printf("Geographic hint from %s: %s, %s",
				conn.RemoteAddr(), geoHint.CountryCode, geoHint.City)
			// Process geographic hint through DHT if available
			if dhtServer != nil {
				dhtServer.ProcessNERDMessage("geographic_hint", msg.Payload)
			}
		default:
			log.Printf("Received message type %d from %s", msg.MessageId, conn.RemoteAddr())
		}
	}
}

// Function to dial and establish an outgoing connection to a peer
func dialPeer(addr string, dhtServer *DHTServer) {
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
	go handleConnection(conn, dhtServer) // handleConnection will add to pool and manage lifecycle
}

// Helper function to parse port from string
func parsePort(portStr string) int {
	var port int
	fmt.Sscanf(portStr, "%d", &port)
	return port
}

// initializeDHT sets up and starts the DHT server
func initializeDHT(config *Config) (*DHTServer, error) {
	if !config.EnableDHT {
		log.Println("DHT is disabled in configuration")
		return nil, nil
	}

	log.Printf("Initializing DHT on port %d...", config.DHTPort)

	// Generate a random node ID for this daemon instance
	nodeID, err := GenerateRandomNodeID()
	if err != nil {
		return nil, fmt.Errorf("failed to generate node ID: %v", err)
	}

	// Create DHT configuration
	dhtConfig := &DHTConfig{
		Port:           config.DHTPort,
		BootstrapNodes: config.BootstrapNodes,
		NodeID:         nodeID,
		SecretSalt:     12345, // TODO: Make this configurable or random
	}

	// Create DHT server
	dhtServer, err := NewDHTServer(dhtConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create DHT server: %v", err)
	}

	// Start DHT server
	err = dhtServer.Start()
	if err != nil {
		return nil, fmt.Errorf("failed to start DHT server: %v", err)
	}

	log.Printf("DHT server initialized successfully on port %d", config.DHTPort)
	return dhtServer, nil
}

// announceDaemonToNetwork announces this daemon to the DHT network
func announceDaemonToNetwork(dhtServer *DHTServer, tcpPort int) {
	if dhtServer == nil {
		return
	}

	// Create a NERD-specific infohash for daemon discovery
	var nerdInfoHash [20]byte
	copy(nerdInfoHash[:], "NERD_DAEMON_NETWORK_")

	go func() {
		// Wait a bit for DHT to bootstrap
		time.Sleep(10 * time.Second)

		log.Printf("Announcing NERD daemon to DHT network...")
		err := dhtServer.AnnouncePeer(nerdInfoHash, tcpPort)
		if err != nil {
			log.Printf("Failed to announce daemon to DHT: %v", err)
		} else {
			log.Printf("Successfully announced daemon to DHT network")
		}

		// Periodically re-announce
		ticker := time.NewTicker(30 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			log.Printf("Re-announcing daemon to DHT network...")
			err := dhtServer.AnnouncePeer(nerdInfoHash, tcpPort)
			if err != nil {
				log.Printf("Failed to re-announce daemon to DHT: %v", err)
			}
		}
	}()
}

// discoverPeersViaDHT discovers other NERD daemons via DHT
func discoverPeersViaDHT(dhtServer *DHTServer) {
	if dhtServer == nil {
		return
	}

	go func() {
		// Wait for DHT to be ready
		time.Sleep(15 * time.Second)

		var nerdInfoHash [20]byte
		copy(nerdInfoHash[:], "NERD_DAEMON_NETWORK_")

		ticker := time.NewTicker(10 * time.Minute)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				log.Printf("Discovering NERD daemons via DHT...")
				peers, err := dhtServer.FindPeers(nerdInfoHash)
				if err != nil {
					log.Printf("DHT peer discovery failed: %v", err)
					continue
				}

				log.Printf("Discovered %d peers via DHT", len(peers))
				for _, peer := range peers {
					log.Printf("Found peer: %s:%d (quality: %.2f)",
						peer.Address, peer.Port, peer.QualityScore)

					// Attempt to connect to high-quality peers
					if peer.QualityScore > 0.7 {
						peerAddr := fmt.Sprintf("%s:%d", peer.Address, peer.Port)
						go dialPeer(peerAddr, dhtServer)
					}
				}
			}
		}
	}()
}

// logDHTStats periodically logs DHT statistics
func logDHTStats(dhtServer *DHTServer) {
	if dhtServer == nil {
		return
	}

	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			stats := dhtServer.GetStats()
			log.Printf("[DHT Stats] Nodes: %v, Peers: %v, Quality Metrics: %v",
				stats["total_nodes"], stats["known_peers"], stats["quality_metrics_cached"])
		}
	}()
}

// initializeTracker sets up and starts the tracker server
func initializeTracker(config *Config) (*TrackerServer, error) {
	if !config.EnableTracker {
		log.Println("Tracker is disabled in configuration")
		return nil, nil
	}

	log.Printf("Initializing tracker server on HTTP port %d, UDP port %d...",
		config.TrackerHTTPPort, config.TrackerUDPPort)

	// Create tracker configuration
	trackerConfig := &TrackerConfig{
		HTTPPort:    config.TrackerHTTPPort,
		UDPPort:     config.TrackerUDPPort,
		AnnounceURL: "/announce",
		MaxPeers:    200,
		PeerTimeout: 30 * time.Minute,
		EnableNERD:  true, // Enable NERD extensions
	}

	// Create tracker server
	tracker, err := NewTrackerServer(trackerConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create tracker server: %v", err)
	}

	// Start tracker server
	err = tracker.Start()
	if err != nil {
		return nil, fmt.Errorf("failed to start tracker server: %v", err)
	}

	log.Printf("Tracker server initialized successfully")
	return tracker, nil
}

// logTrackerStats periodically logs tracker statistics
func logTrackerStats(tracker *TrackerServer) {
	if tracker == nil {
		return
	}

	go func() {
		ticker := time.NewTicker(10 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			stats := tracker.GetStats()
			log.Printf("[Tracker Stats] Swarms: %d, Peers: %d (Seeders: %d, Leechers: %d), Completed: %d",
				stats.TotalSwarms, stats.TotalPeers, stats.TotalSeeders,
				stats.TotalLeechers, stats.TotalCompleted)
		}
	}()
}

// initializeBSVPayments sets up and starts the BSV payment system
func initializeBSVPayments(config *Config) (*BSVPaymentSystem, error) {
	if !config.EnableBSV {
		log.Println("BSV payments are disabled in configuration")
		return nil, nil
	}

	// Validate BSV configuration
	if config.BSVPayment.PrivateKeyWIF == "" ||
		config.BSVPayment.PrivateKeyWIF == "L1abc123def456..." ||
		config.BSVPayment.PrivateKeyWIF == "REPLACE_WITH_YOUR_BSV_PRIVATE_KEY_WIF_FORMAT" {
		log.Println("WARNING: BSV private key is not configured or is placeholder. BSV payments will not function.")
		log.Println("Please set a valid BSV private key WIF in the configuration file or generate one using BSV tools.")
		log.Println("For testnet development, you can get free testnet coins from: https://faucet.bitcoincloud.net/")
		return nil, nil
	}

	log.Printf("Initializing BSV payment system (network: %s)...", config.BSVPayment.NetworkType)

	// Create BSV payment system
	bsvSystem, err := NewBSVPaymentSystem(&config.BSVPayment)
	if err != nil {
		return nil, fmt.Errorf("failed to create BSV payment system: %v", err)
	}

	// Start BSV payment system
	err = bsvSystem.Start()
	if err != nil {
		return nil, fmt.Errorf("failed to start BSV payment system: %v", err)
	}

	log.Printf("BSV payment system initialized successfully")
	log.Printf("BSV Address: %s", bsvSystem.GetAddress())
	return bsvSystem, nil
}

// logBSVStats periodically logs BSV payment statistics
func logBSVStats(bsvSystem *BSVPaymentSystem) {
	if bsvSystem == nil {
		return
	}

	go func() {
		ticker := time.NewTicker(15 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			stats := bsvSystem.GetPaymentStats()
			log.Printf("[BSV Stats] Address: %v, Pending: %v, Channels: %v",
				stats["address"], stats["pending_payments"], stats["open_channels"])
		}
	}()
}

// logSocialStats periodically logs BSV Social Protocol statistics
func logSocialStats(socialSystem *BSVSocialSystem) {
	if socialSystem == nil {
		return
	}

	go func() {
		ticker := time.NewTicker(20 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			stats := socialSystem.GetStats()
			log.Printf("[Social Stats] Follows: %v, Likes: %v, Comments: %v, Shares: %v, Profiles: %v",
				stats["total_follows"], stats["total_likes"], stats["total_comments"],
				stats["total_shares"], stats["total_profiles"])
		}
	}()
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

	// Initialize DHT if enabled
	dhtServer, err := initializeDHT(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize DHT: %v", err)
	}
	defer func() {
		if dhtServer != nil {
			dhtServer.Stop()
		}
	}()

	// Initialize Tracker if enabled
	tracker, err := initializeTracker(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize tracker: %v", err)
	}
	defer func() {
		if tracker != nil {
			tracker.Stop()
		}
	}()

	// Initialize BSV Payment System if enabled
	bsvSystem, err := initializeBSVPayments(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize BSV payment system: %v", err)
	}
	defer func() {
		if bsvSystem != nil {
			bsvSystem.Stop()
		}
	}()

	// Initialize BSV Social Protocol if BSV is enabled
	var socialSystem *BSVSocialSystem
	if cfg.EnableBSV && bsvSystem != nil {
		socialSystem = NewBSVSocialSystem(bsvSystem, cfg.DataDir)
		err = socialSystem.Start()
		if err != nil {
			log.Fatalf("Failed to initialize BSV social protocol: %v", err)
		}
		defer func() {
			if socialSystem != nil {
				socialSystem.Stop()
			}
		}()
	}

	// Set up TCP listener for P2P connections
	listenAddr := fmt.Sprintf(":%d", cfg.Port)
	listener, err := net.Listen("tcp", listenAddr)
	if err != nil {
		log.Fatalf("Failed to start listener on %s: %v", listenAddr, err)
	}
	defer listener.Close() // Ensure the listener is closed when main exits

	log.Printf("NERD daemon listening on %s", listenAddr)

	// Start DHT-related background tasks
	if dhtServer != nil {
		announceDaemonToNetwork(dhtServer, cfg.Port)
		discoverPeersViaDHT(dhtServer)
		logDHTStats(dhtServer)
	}

	// Start tracker-related background tasks
	if tracker != nil {
		logTrackerStats(tracker)
	}

	// Start BSV-related background tasks
	if bsvSystem != nil {
		logBSVStats(bsvSystem)
	}

	// Start Social-related background tasks
	if socialSystem != nil {
		logSocialStats(socialSystem)
	}

	// Log service status
	log.Printf("=== NERD Daemon Services ===")
	log.Printf("P2P Network: listening on port %d", cfg.Port)
	if dhtServer != nil {
		log.Printf("DHT: enabled on port %d", cfg.DHTPort)
	} else {
		log.Printf("DHT: disabled")
	}
	if tracker != nil {
		log.Printf("Tracker: HTTP port %d, UDP port %d", cfg.TrackerHTTPPort, cfg.TrackerUDPPort)
	} else {
		log.Printf("Tracker: disabled")
	}
	if bsvSystem != nil {
		log.Printf("BSV Payments: enabled on %s (address: %s)", cfg.BSVPayment.NetworkType, bsvSystem.GetAddress())
	} else {
		log.Printf("BSV Payments: disabled")
	}
	if socialSystem != nil {
		log.Printf("BSV Social Protocol: enabled")
	} else {
		log.Printf("BSV Social Protocol: disabled")
	}
	log.Printf("============================")

	// Attempt to connect to configured peers (for testing)
	for _, peerAddr := range cfg.ConnectPeers {
		go dialPeer(peerAddr, dhtServer)
	}

	// Accept incoming connections
	for {
		conn, err := listener.Accept()
		if err != nil {
			log.Printf("Failed to accept connection: %v", err)
			continue
		}
		go handleConnection(conn, dhtServer)
	}
}
