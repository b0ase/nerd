package main

import (
	"context"
	"crypto/rand"
	"fmt"
	"log"
	"net"
	"sync"
	"time"

	"github.com/anacrolix/dht/v2"
	"github.com/anacrolix/dht/v2/krpc"
	"github.com/anacrolix/torrent/metainfo"
	"github.com/nerd-daemon/messages"
	"google.golang.org/protobuf/proto"
)

// DHTConfig holds configuration for DHT operations
type DHTConfig struct {
	Port           int
	BootstrapNodes []string
	NodeID         [20]byte
	SecretSalt     uint16
}

// DHTServer wraps the DHT functionality with NERD-specific features
type DHTServer struct {
	server       *dht.Server
	config       *DHTConfig
	peerStore    *PeerStore
	qualityCache *QualityMetricsCache
	mu           sync.RWMutex
	isRunning    bool
}

// PeerStore manages discovered peers with quality metrics
type PeerStore struct {
	peers map[string]*PeerInfo
	mu    sync.RWMutex
}

// PeerInfo represents a peer with quality metrics
type PeerInfo struct {
	Address      string
	Port         int
	QualityScore float64
	LastSeen     time.Time
	Uptime       time.Duration
	Location     *messages.GeographicHintMsg
	TokenBalance uint64
}

// QualityMetricsCache manages peer quality data
type QualityMetricsCache struct {
	metrics map[string]*QualityMetrics
	mu      sync.RWMutex
}

// QualityMetrics represents detailed peer performance data
type QualityMetrics struct {
	ResponseTime     time.Duration
	Reliability      float64
	BandwidthScore   float64
	UptimePercentage float64
	LastUpdated      time.Time
}

// NewDHTServer creates a new DHT server instance
func NewDHTServer(config *DHTConfig) (*DHTServer, error) {
	// Create UDP connection for DHT
	addr, err := net.ResolveUDPAddr("udp", fmt.Sprintf(":%d", config.Port))
	if err != nil {
		return nil, fmt.Errorf("failed to resolve DHT address: %v", err)
	}

	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		return nil, fmt.Errorf("failed to listen on DHT port: %v", err)
	}

	// Create DHT server configuration
	serverConfig := dht.NewDefaultServerConfig()
	serverConfig.Conn = conn
	serverConfig.NodeId = krpc.ID(config.NodeID)

	// Set bootstrap nodes
	if len(config.BootstrapNodes) > 0 {
		serverConfig.StartingNodes = func() ([]dht.Addr, error) {
			return dht.ResolveHostPorts(config.BootstrapNodes)
		}
	}

	// Configure DHT callbacks for NERD integration
	serverConfig.OnAnnouncePeer = func(infoHash metainfo.Hash, ip net.IP, port int, portOk bool) {
		log.Printf("[DHT] Peer announced: %s:%d for infohash %x", ip, port, infoHash)
	}

	// Create DHT server
	server, err := dht.NewServer(serverConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create DHT server: %v", err)
	}

	dhtServer := &DHTServer{
		server:       server,
		config:       config,
		peerStore:    NewPeerStore(),
		qualityCache: NewQualityMetricsCache(),
		isRunning:    false,
	}

	return dhtServer, nil
}

// NewPeerStore creates a new peer store
func NewPeerStore() *PeerStore {
	return &PeerStore{
		peers: make(map[string]*PeerInfo),
	}
}

// NewQualityMetricsCache creates a new quality metrics cache
func NewQualityMetricsCache() *QualityMetricsCache {
	return &QualityMetricsCache{
		metrics: make(map[string]*QualityMetrics),
	}
}

// GenerateRandomNodeID creates a random 20-byte node ID
func GenerateRandomNodeID() ([20]byte, error) {
	var nodeID [20]byte
	_, err := rand.Read(nodeID[:])
	if err != nil {
		return nodeID, fmt.Errorf("failed to generate random node ID: %v", err)
	}
	return nodeID, nil
}

// Start begins DHT operations
func (ds *DHTServer) Start() error {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	if ds.isRunning {
		return fmt.Errorf("DHT server is already running")
	}

	log.Printf("[DHT] Starting DHT server on port %d", ds.config.Port)
	log.Printf("[DHT] Node ID: %x", ds.config.NodeID)

	// Start table maintainer (keeps routing table healthy)
	go ds.server.TableMaintainer()

	// Bootstrap the DHT
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	stats, err := ds.server.BootstrapContext(ctx)
	if err != nil {
		log.Printf("[DHT] Bootstrap warning: %v", err)
	} else {
		log.Printf("[DHT] Bootstrap completed: %d nodes contacted", stats.NumAddrsTried)
	}

	ds.isRunning = true

	// Start periodic maintenance
	go ds.maintenanceLoop()

	log.Printf("[DHT] DHT server started successfully with %d nodes in routing table", ds.server.NumNodes())
	return nil
}

// Stop shuts down the DHT server
func (ds *DHTServer) Stop() {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	if !ds.isRunning {
		return
	}

	log.Printf("[DHT] Stopping DHT server...")
	ds.server.Close()
	ds.isRunning = false
	log.Printf("[DHT] DHT server stopped")
}

// AnnouncePeer announces this node as a peer for a given infohash
func (ds *DHTServer) AnnouncePeer(infohash [20]byte, port int) error {
	if !ds.isRunning {
		return fmt.Errorf("DHT server is not running")
	}

	log.Printf("[DHT] Announcing peer for infohash %x on port %d", infohash, port)

	// Use the new AnnounceTraversal method
	announce, err := ds.server.AnnounceTraversal(infohash, dht.AnnouncePeer(dht.AnnouncePeerOpts{
		Port:        port,
		ImpliedPort: false,
	}))
	if err != nil {
		return fmt.Errorf("failed to start announce traversal: %v", err)
	}

	// Monitor the announcement in a goroutine
	go func() {
		defer announce.Close()

		finished := announce.Finished()
		for {
			select {
			case peers, ok := <-announce.Peers:
				if !ok {
					log.Printf("[DHT] Announce completed for infohash %x", infohash)
					return
				}

				// Process discovered peers
				for _, peer := range peers.Peers {
					ds.addDiscoveredPeer(peer.IP.String(), peer.Port, &peers.NodeInfo)
				}

			case <-finished:
				log.Printf("[DHT] Announce traversal finished for infohash %x", infohash)
				return
			}
		}
	}()

	return nil
}

// FindPeers searches for peers sharing a specific infohash
func (ds *DHTServer) FindPeers(infohash [20]byte) ([]*PeerInfo, error) {
	if !ds.isRunning {
		return nil, fmt.Errorf("DHT server is not running")
	}

	log.Printf("[DHT] Searching for peers with infohash %x", infohash)

	announce, err := ds.server.AnnounceTraversal(infohash, dht.Scrape())
	if err != nil {
		return nil, fmt.Errorf("failed to start peer search: %v", err)
	}

	var discoveredPeers []*PeerInfo
	timeout := time.After(30 * time.Second)

	go func() {
		defer announce.Close()

		finished := announce.Finished()
		for {
			select {
			case peers, ok := <-announce.Peers:
				if !ok {
					return
				}

				// Add discovered peers to our store
				for _, peer := range peers.Peers {
					peerInfo := ds.addDiscoveredPeer(peer.IP.String(), peer.Port, &peers.NodeInfo)
					discoveredPeers = append(discoveredPeers, peerInfo)
				}

			case <-finished:
				return
			case <-timeout:
				return
			}
		}
	}()

	// Wait a bit for initial results
	time.Sleep(5 * time.Second)

	return discoveredPeers, nil
}

// addDiscoveredPeer adds a newly discovered peer to our store
func (ds *DHTServer) addDiscoveredPeer(address string, port int, nodeInfo *krpc.NodeInfo) *PeerInfo {
	peerKey := fmt.Sprintf("%s:%d", address, port)

	ds.peerStore.mu.Lock()
	defer ds.peerStore.mu.Unlock()

	if existingPeer, exists := ds.peerStore.peers[peerKey]; exists {
		existingPeer.LastSeen = time.Now()
		return existingPeer
	}

	peerInfo := &PeerInfo{
		Address:      address,
		Port:         port,
		QualityScore: 0.5, // Default quality score
		LastSeen:     time.Now(),
		Uptime:       0,
		Location:     nil,
		TokenBalance: 0,
	}

	ds.peerStore.peers[peerKey] = peerInfo

	log.Printf("[DHT] Discovered new peer: %s:%d", address, port)
	return peerInfo
}

// GetPeers returns all known peers, optionally filtered by quality
func (ds *DHTServer) GetPeers(minQuality float64) []*PeerInfo {
	ds.peerStore.mu.RLock()
	defer ds.peerStore.mu.RUnlock()

	var peers []*PeerInfo
	for _, peer := range ds.peerStore.peers {
		if peer.QualityScore >= minQuality {
			peers = append(peers, peer)
		}
	}

	return peers
}

// UpdatePeerQuality updates quality metrics for a peer
func (ds *DHTServer) UpdatePeerQuality(address string, port int, metrics *QualityMetrics) {
	peerKey := fmt.Sprintf("%s:%d", address, port)

	ds.qualityCache.mu.Lock()
	ds.qualityCache.metrics[peerKey] = metrics
	ds.qualityCache.mu.Unlock()

	// Update peer info with new quality score
	ds.peerStore.mu.Lock()
	if peer, exists := ds.peerStore.peers[peerKey]; exists {
		peer.QualityScore = ds.calculateQualityScore(metrics)
		peer.LastSeen = time.Now()
	}
	ds.peerStore.mu.Unlock()
}

// calculateQualityScore computes an overall quality score from metrics
func (ds *DHTServer) calculateQualityScore(metrics *QualityMetrics) float64 {
	// Weight different factors
	responseWeight := 0.3
	reliabilityWeight := 0.4
	bandwidthWeight := 0.2
	uptimeWeight := 0.1

	// Normalize response time (lower is better, scale to 0-1)
	responseScore := 1.0
	if metrics.ResponseTime > 0 {
		maxResponseTime := 5 * time.Second
		responseScore = 1.0 - float64(metrics.ResponseTime)/float64(maxResponseTime)
		if responseScore < 0 {
			responseScore = 0
		}
	}

	qualityScore := (responseScore * responseWeight) +
		(metrics.Reliability * reliabilityWeight) +
		(metrics.BandwidthScore * bandwidthWeight) +
		(metrics.UptimePercentage * uptimeWeight)

	// Ensure score is between 0 and 1
	if qualityScore > 1.0 {
		qualityScore = 1.0
	}
	if qualityScore < 0.0 {
		qualityScore = 0.0
	}

	return qualityScore
}

// StoreNERDData stores NERD-specific data in the DHT
func (ds *DHTServer) StoreNERDData(key [20]byte, data []byte) error {
	if !ds.isRunning {
		return fmt.Errorf("DHT server is not running")
	}

	// In a real implementation, you would use BEP44 mutable/immutable storage
	// For now, we'll log the storage request
	log.Printf("[DHT] Storing NERD data: key=%x, size=%d bytes", key, len(data))

	// TODO: Implement actual DHT storage using BEP44
	// This would involve using ds.server.Put() with appropriate parameters

	return nil
}

// RetrieveNERDData retrieves NERD-specific data from the DHT
func (ds *DHTServer) RetrieveNERDData(key [20]byte) ([]byte, error) {
	if !ds.isRunning {
		return nil, fmt.Errorf("DHT server is not running")
	}

	log.Printf("[DHT] Retrieving NERD data: key=%x", key)

	// TODO: Implement actual DHT retrieval using BEP44
	// This would involve using ds.server.Get() with appropriate parameters

	return nil, fmt.Errorf("DHT storage not yet implemented")
}

// GetStats returns DHT statistics
func (ds *DHTServer) GetStats() map[string]interface{} {
	stats := make(map[string]interface{})

	if ds.isRunning {
		serverStats := ds.server.Stats()
		stats["good_nodes"] = serverStats.GoodNodes
		stats["total_nodes"] = serverStats.Nodes
		stats["outstanding_transactions"] = serverStats.OutstandingTransactions
		stats["successful_announces"] = serverStats.SuccessfulOutboundAnnouncePeerQueries
	}

	ds.peerStore.mu.RLock()
	stats["known_peers"] = len(ds.peerStore.peers)
	ds.peerStore.mu.RUnlock()

	ds.qualityCache.mu.RLock()
	stats["quality_metrics_cached"] = len(ds.qualityCache.metrics)
	ds.qualityCache.mu.RUnlock()

	return stats
}

// maintenanceLoop performs periodic DHT maintenance
func (ds *DHTServer) maintenanceLoop() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if !ds.isRunning {
				return
			}

			// Clean up old peers
			ds.cleanupOldPeers()

			// Log stats
			stats := ds.GetStats()
			log.Printf("[DHT] Maintenance - Nodes: %v, Peers: %v, Transactions: %v",
				stats["total_nodes"], stats["known_peers"], stats["outstanding_transactions"])
		}
	}
}

// cleanupOldPeers removes peers that haven't been seen recently
func (ds *DHTServer) cleanupOldPeers() {
	ds.peerStore.mu.Lock()
	defer ds.peerStore.mu.Unlock()

	threshold := time.Now().Add(-30 * time.Minute)
	var removed int

	for key, peer := range ds.peerStore.peers {
		if peer.LastSeen.Before(threshold) {
			delete(ds.peerStore.peers, key)
			removed++
		}
	}

	if removed > 0 {
		log.Printf("[DHT] Cleaned up %d old peers", removed)
	}
}

// ProcessNERDMessage handles NERD-specific DHT messages
func (ds *DHTServer) ProcessNERDMessage(msgType string, data []byte) error {
	switch msgType {
	case "quality_metrics":
		var qualityMsg messages.QualityMetricsMsg
		if err := proto.Unmarshal(data, &qualityMsg); err != nil {
			return fmt.Errorf("failed to unmarshal quality metrics: %v", err)
		}

		log.Printf("[DHT] Received quality metrics - Uptime: %d seconds", qualityMsg.UptimeSeconds)
		return ds.processQualityMetrics(&qualityMsg)

	case "geographic_hint":
		var geoMsg messages.GeographicHintMsg
		if err := proto.Unmarshal(data, &geoMsg); err != nil {
			return fmt.Errorf("failed to unmarshal geographic hint: %v", err)
		}

		log.Printf("[DHT] Received geographic hint: %s, %s", geoMsg.CountryCode, geoMsg.City)
		return ds.processGeographicHint(&geoMsg)

	default:
		log.Printf("[DHT] Unknown NERD message type: %s", msgType)
	}

	return nil
}

// processQualityMetrics processes received quality metrics
func (ds *DHTServer) processQualityMetrics(msg *messages.QualityMetricsMsg) error {
	// Calculate response time from uptime (simplified approach)
	responseTime := time.Duration(100) * time.Millisecond // Default response time

	metrics := &QualityMetrics{
		ResponseTime:     responseTime,
		Reliability:      float64(msg.ReliabilityScore),
		BandwidthScore:   float64(msg.UploadSpeedMbps) / 100.0,     // Normalize to 0-1
		UptimePercentage: float64(msg.UptimeSeconds) / (24 * 3600), // Rough uptime percentage
		LastUpdated:      time.Now(),
	}

	// Create a simple peer identifier based on bytes uploaded
	peerID := fmt.Sprintf("peer_%d", msg.BytesUploaded%10000)
	if peer := ds.findPeerByID(peerID); peer != nil {
		ds.UpdatePeerQuality(peer.Address, peer.Port, metrics)
	}

	return nil
}

// processGeographicHint processes received geographic information
func (ds *DHTServer) processGeographicHint(msg *messages.GeographicHintMsg) error {
	// Update peer location information
	ds.peerStore.mu.Lock()
	defer ds.peerStore.mu.Unlock()

	for _, peer := range ds.peerStore.peers {
		// Simple matching - in production you'd need better peer identification
		if peer.Address != "" {
			peer.Location = msg
			break
		}
	}

	return nil
}

// findPeerByID finds a peer by their ID (simplified implementation)
func (ds *DHTServer) findPeerByID(peerID string) *PeerInfo {
	ds.peerStore.mu.RLock()
	defer ds.peerStore.mu.RUnlock()

	// In a real implementation, you'd have proper peer ID mapping
	for _, peer := range ds.peerStore.peers {
		if fmt.Sprintf("%s:%d", peer.Address, peer.Port) == peerID {
			return peer
		}
	}

	return nil
}
