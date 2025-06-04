package main

import (
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/nerd-daemon/messages"
	"google.golang.org/protobuf/proto"
)

// TrackerConfig holds configuration for the tracker server
type TrackerConfig struct {
	HTTPPort    int
	UDPPort     int
	AnnounceURL string
	MaxPeers    int
	PeerTimeout time.Duration
	EnableNERD  bool
}

// TrackerServer implements a BitTorrent tracker with NERD extensions
type TrackerServer struct {
	config     *TrackerConfig
	swarms     map[string]*Swarm // Map infohash -> swarm data
	httpServer *http.Server
	udpConn    net.PacketConn
	mu         sync.RWMutex
	isRunning  bool
}

// Swarm represents a torrent swarm
type Swarm struct {
	InfoHash       string
	Peers          map[string]*TrackerPeer
	Created        time.Time
	LastUpdate     time.Time
	SeedCount      int
	LeechCount     int
	CompletedCount int64
	NERDEnabled    bool
	mu             sync.RWMutex
}

// TrackerPeer represents a peer in the tracker
type TrackerPeer struct {
	PeerID       string
	IP           net.IP
	Port         uint16
	Uploaded     int64
	Downloaded   int64
	Left         int64
	LastSeen     time.Time
	IsSeeder     bool
	UserAgent    string
	QualityScore float64
	NERDBalance  uint64
	Location     *messages.GeographicHintMsg
}

// TrackerStats holds tracker statistics
type TrackerStats struct {
	TotalSwarms      int
	TotalPeers       int
	TotalSeeders     int
	TotalLeechers    int
	TotalCompleted   int64
	RequestsPerHour  int64
	BytesTransferred int64
}

// AnnounceRequest represents a BitTorrent announce request
type AnnounceRequest struct {
	InfoHash   string
	PeerID     string
	Port       uint16
	Uploaded   int64
	Downloaded int64
	Left       int64
	Compact    bool
	NoPeerID   bool
	Event      string
	IP         net.IP
	NumWant    int
	Key        string
	TrackerID  string
	UserAgent  string
}

// AnnounceResponse represents a BitTorrent announce response
type AnnounceResponse struct {
	Interval    int32
	MinInterval int32
	TrackerID   string
	Complete    int32
	Incomplete  int32
	Peers       []TrackerPeer
	WarningMsg  string
	FailureMsg  string
}

// NewTrackerServer creates a new tracker server instance
func NewTrackerServer(config *TrackerConfig) (*TrackerServer, error) {
	tracker := &TrackerServer{
		config: config,
		swarms: make(map[string]*Swarm),
	}

	return tracker, nil
}

// Start begins tracker operations
func (ts *TrackerServer) Start() error {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	if ts.isRunning {
		return fmt.Errorf("tracker server is already running")
	}

	log.Printf("[Tracker] Starting tracker server...")

	// Start HTTP server
	if err := ts.startHTTPServer(); err != nil {
		return fmt.Errorf("failed to start HTTP server: %v", err)
	}

	// Start UDP server
	if err := ts.startUDPServer(); err != nil {
		return fmt.Errorf("failed to start UDP server: %v", err)
	}

	// Start maintenance routines
	go ts.maintenanceLoop()
	go ts.statsLoop()

	ts.isRunning = true
	log.Printf("[Tracker] Tracker server started successfully")
	log.Printf("[Tracker] HTTP server: http://localhost:%d%s", ts.config.HTTPPort, ts.config.AnnounceURL)
	log.Printf("[Tracker] UDP server: udp://localhost:%d", ts.config.UDPPort)

	return nil
}

// Stop shuts down the tracker server
func (ts *TrackerServer) Stop() error {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	if !ts.isRunning {
		return nil
	}

	log.Printf("[Tracker] Stopping tracker server...")

	// Stop HTTP server
	if ts.httpServer != nil {
		ts.httpServer.Close()
	}

	// Stop UDP server
	if ts.udpConn != nil {
		ts.udpConn.Close()
	}

	ts.isRunning = false
	log.Printf("[Tracker] Tracker server stopped")
	return nil
}

// startHTTPServer initializes the HTTP tracker server
func (ts *TrackerServer) startHTTPServer() error {
	mux := http.NewServeMux()

	// BitTorrent announce endpoint
	mux.HandleFunc(ts.config.AnnounceURL, ts.handleHTTPAnnounce)

	// Scrape endpoint
	mux.HandleFunc("/scrape", ts.handleHTTPScrape)

	// Stats endpoint (NERD-specific)
	if ts.config.EnableNERD {
		mux.HandleFunc("/stats", ts.handleHTTPStats)
		mux.HandleFunc("/nerd/quality", ts.handleNERDQuality)
		mux.HandleFunc("/nerd/payments", ts.handleNERDPayments)
	}

	// Health check endpoint
	mux.HandleFunc("/health", ts.handleHealthCheck)

	ts.httpServer = &http.Server{
		Addr:    fmt.Sprintf(":%d", ts.config.HTTPPort),
		Handler: mux,
	}

	go func() {
		if err := ts.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("[Tracker] HTTP server error: %v", err)
		}
	}()

	return nil
}

// startUDPServer initializes the UDP tracker server
func (ts *TrackerServer) startUDPServer() error {
	addr, err := net.ResolveUDPAddr("udp", fmt.Sprintf(":%d", ts.config.UDPPort))
	if err != nil {
		return err
	}

	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		return err
	}

	ts.udpConn = conn

	go ts.handleUDPRequests()
	return nil
}

// handleHTTPAnnounce processes HTTP announce requests
func (ts *TrackerServer) handleHTTPAnnounce(w http.ResponseWriter, r *http.Request) {
	// Parse announce request
	req, err := ts.parseAnnounceRequest(r)
	if err != nil {
		ts.writeErrorResponse(w, fmt.Sprintf("Invalid request: %v", err))
		return
	}

	// Process the announce
	resp, err := ts.processAnnounce(req)
	if err != nil {
		ts.writeErrorResponse(w, err.Error())
		return
	}

	// Write response
	ts.writeAnnounceResponse(w, resp)
}

// handleHTTPScrape processes scrape requests
func (ts *TrackerServer) handleHTTPScrape(w http.ResponseWriter, r *http.Request) {
	infoHashBytes, err := hex.DecodeString(r.URL.Query().Get("info_hash"))
	if err != nil || len(infoHashBytes) != 20 {
		ts.writeErrorResponse(w, "Invalid info_hash")
		return
	}

	infoHash := hex.EncodeToString(infoHashBytes)

	ts.mu.RLock()
	swarm, exists := ts.swarms[infoHash]
	ts.mu.RUnlock()

	if !exists {
		ts.writeErrorResponse(w, "Torrent not found")
		return
	}

	swarm.mu.RLock()
	seeders := swarm.SeedCount
	leechers := swarm.LeechCount
	completed := swarm.CompletedCount
	swarm.mu.RUnlock()

	// Write scrape response
	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprintf(w, "d5:filesd20:%s", infoHashBytes)
	fmt.Fprintf(w, "d8:completei%de10:downloadedi%de10:incompletei%dee", seeders, completed, leechers)
	fmt.Fprintf(w, "ee")
}

// handleHTTPStats provides tracker statistics (NERD extension)
func (ts *TrackerServer) handleHTTPStats(w http.ResponseWriter, r *http.Request) {
	stats := ts.GetStats()

	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{
		"total_swarms": %d,
		"total_peers": %d,
		"total_seeders": %d,
		"total_leechers": %d,
		"total_completed": %d,
		"requests_per_hour": %d,
		"bytes_transferred": %d
	}`, stats.TotalSwarms, stats.TotalPeers, stats.TotalSeeders,
		stats.TotalLeechers, stats.TotalCompleted, stats.RequestsPerHour, stats.BytesTransferred)
}

// handleNERDQuality handles NERD quality metrics (NERD extension)
func (ts *TrackerServer) handleNERDQuality(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse quality metrics from request body
	var qualityMsg messages.QualityMetricsMsg
	if err := proto.Unmarshal([]byte(r.FormValue("data")), &qualityMsg); err != nil {
		http.Error(w, "Invalid quality data", http.StatusBadRequest)
		return
	}

	// Update peer quality metrics
	peerID := r.FormValue("peer_id")
	if peerID != "" {
		ts.updatePeerQuality(peerID, &qualityMsg)
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Quality metrics updated"))
}

// handleNERDPayments handles NERD payment information (NERD extension)
func (ts *TrackerServer) handleNERDPayments(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse payment data
	peerID := r.FormValue("peer_id")
	balanceStr := r.FormValue("nerd_balance")

	if peerID == "" || balanceStr == "" {
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	balance, err := strconv.ParseUint(balanceStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid balance", http.StatusBadRequest)
		return
	}

	// Update peer NERD balance
	ts.updatePeerBalance(peerID, balance)

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Payment information updated"))
}

// handleHealthCheck provides health status
func (ts *TrackerServer) handleHealthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"status": "healthy", "uptime": "%v"}`, time.Since(time.Now()))
}

// handleUDPRequests processes UDP tracker requests
func (ts *TrackerServer) handleUDPRequests() {
	buffer := make([]byte, 1024)

	for {
		n, addr, err := ts.udpConn.ReadFrom(buffer)
		if err != nil {
			if ts.isRunning {
				log.Printf("[Tracker] UDP read error: %v", err)
			}
			return
		}

		go ts.processUDPRequest(buffer[:n], addr)
	}
}

// processUDPRequest handles individual UDP requests
func (ts *TrackerServer) processUDPRequest(data []byte, addr net.Addr) {
	// TODO: Implement UDP tracker protocol (BEP 15)
	// For now, just log the request
	log.Printf("[Tracker] UDP request from %s: %d bytes", addr, len(data))
}

// parseAnnounceRequest parses HTTP announce request parameters
func (ts *TrackerServer) parseAnnounceRequest(r *http.Request) (*AnnounceRequest, error) {
	query := r.URL.Query()

	// Required parameters
	infoHashBytes, err := url.QueryUnescape(query.Get("info_hash"))
	if err != nil || len(infoHashBytes) != 20 {
		return nil, fmt.Errorf("invalid info_hash")
	}

	peerIDBytes, err := url.QueryUnescape(query.Get("peer_id"))
	if err != nil || len(peerIDBytes) != 20 {
		return nil, fmt.Errorf("invalid peer_id")
	}

	port, err := strconv.Atoi(query.Get("port"))
	if err != nil || port < 1 || port > 65535 {
		return nil, fmt.Errorf("invalid port")
	}

	uploaded, _ := strconv.ParseInt(query.Get("uploaded"), 10, 64)
	downloaded, _ := strconv.ParseInt(query.Get("downloaded"), 10, 64)
	left, _ := strconv.ParseInt(query.Get("left"), 10, 64)

	numWant, _ := strconv.Atoi(query.Get("numwant"))
	if numWant <= 0 || numWant > ts.config.MaxPeers {
		numWant = ts.config.MaxPeers
	}

	// Get client IP
	ip := net.ParseIP(r.RemoteAddr)
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		if forwardedIP := net.ParseIP(strings.Split(forwarded, ",")[0]); forwardedIP != nil {
			ip = forwardedIP
		}
	}

	return &AnnounceRequest{
		InfoHash:   hex.EncodeToString([]byte(infoHashBytes)),
		PeerID:     hex.EncodeToString([]byte(peerIDBytes)),
		Port:       uint16(port),
		Uploaded:   uploaded,
		Downloaded: downloaded,
		Left:       left,
		Compact:    query.Get("compact") == "1",
		NoPeerID:   query.Get("no_peer_id") == "1",
		Event:      query.Get("event"),
		IP:         ip,
		NumWant:    numWant,
		Key:        query.Get("key"),
		TrackerID:  query.Get("trackerid"),
		UserAgent:  r.Header.Get("User-Agent"),
	}, nil
}

// processAnnounce processes an announce request and returns a response
func (ts *TrackerServer) processAnnounce(req *AnnounceRequest) (*AnnounceResponse, error) {
	ts.mu.Lock()
	swarm, exists := ts.swarms[req.InfoHash]
	if !exists {
		swarm = &Swarm{
			InfoHash:    req.InfoHash,
			Peers:       make(map[string]*TrackerPeer),
			Created:     time.Now(),
			NERDEnabled: ts.config.EnableNERD,
		}
		ts.swarms[req.InfoHash] = swarm
	}
	ts.mu.Unlock()

	swarm.mu.Lock()
	defer swarm.mu.Unlock()

	// Update or add peer
	peer, exists := swarm.Peers[req.PeerID]
	if !exists {
		peer = &TrackerPeer{
			PeerID:       req.PeerID,
			QualityScore: 0.5, // Default quality
		}
		swarm.Peers[req.PeerID] = peer
	}

	// Update peer information
	peer.IP = req.IP
	peer.Port = req.Port
	peer.Uploaded = req.Uploaded
	peer.Downloaded = req.Downloaded
	peer.Left = req.Left
	peer.LastSeen = time.Now()
	peer.IsSeeder = req.Left == 0
	peer.UserAgent = req.UserAgent

	// Handle events
	switch req.Event {
	case "started":
		log.Printf("[Tracker] Peer %s started downloading %s", req.PeerID[:8], req.InfoHash[:8])
	case "completed":
		swarm.CompletedCount++
		log.Printf("[Tracker] Peer %s completed %s", req.PeerID[:8], req.InfoHash[:8])
	case "stopped":
		delete(swarm.Peers, req.PeerID)
		log.Printf("[Tracker] Peer %s stopped %s", req.PeerID[:8], req.InfoHash[:8])
	}

	// Update swarm counts
	swarm.SeedCount = 0
	swarm.LeechCount = 0
	for _, p := range swarm.Peers {
		if p.IsSeeder {
			swarm.SeedCount++
		} else {
			swarm.LeechCount++
		}
	}
	swarm.LastUpdate = time.Now()

	// Get peer list for response
	peers := ts.selectPeers(swarm, req.PeerID, req.NumWant)

	return &AnnounceResponse{
		Interval:    1800, // 30 minutes
		MinInterval: 300,  // 5 minutes
		TrackerID:   generateTrackerID(),
		Complete:    int32(swarm.SeedCount),
		Incomplete:  int32(swarm.LeechCount),
		Peers:       peers,
	}, nil
}

// selectPeers returns a list of peers for the announce response
func (ts *TrackerServer) selectPeers(swarm *Swarm, excludePeerID string, numWant int) []TrackerPeer {
	var peers []TrackerPeer

	for peerID, peer := range swarm.Peers {
		if peerID != excludePeerID && len(peers) < numWant {
			peers = append(peers, *peer)
		}
	}

	// Sort by quality score if NERD is enabled
	if ts.config.EnableNERD {
		sort.Slice(peers, func(i, j int) bool {
			return peers[i].QualityScore > peers[j].QualityScore
		})
	}

	return peers
}

// updatePeerQuality updates quality metrics for a peer
func (ts *TrackerServer) updatePeerQuality(peerID string, metrics *messages.QualityMetricsMsg) {
	// Calculate quality score based on metrics
	qualityScore := calculateQualityScore(metrics)

	ts.mu.RLock()
	defer ts.mu.RUnlock()

	// Update peer in all swarms
	for _, swarm := range ts.swarms {
		swarm.mu.Lock()
		if peer, exists := swarm.Peers[peerID]; exists {
			peer.QualityScore = qualityScore
		}
		swarm.mu.Unlock()
	}

	log.Printf("[Tracker] Updated quality score for peer %s: %.2f", peerID[:8], qualityScore)
}

// updatePeerBalance updates NERD token balance for a peer
func (ts *TrackerServer) updatePeerBalance(peerID string, balance uint64) {
	ts.mu.RLock()
	defer ts.mu.RUnlock()

	// Update peer balance in all swarms
	for _, swarm := range ts.swarms {
		swarm.mu.Lock()
		if peer, exists := swarm.Peers[peerID]; exists {
			peer.NERDBalance = balance
		}
		swarm.mu.Unlock()
	}

	log.Printf("[Tracker] Updated NERD balance for peer %s: %d tokens", peerID[:8], balance)
}

// calculateQualityScore computes quality score from metrics
func calculateQualityScore(metrics *messages.QualityMetricsMsg) float64 {
	// Weight different factors
	uptimeWeight := 0.3
	reliabilityWeight := 0.4
	speedWeight := 0.3

	// Normalize uptime (assume max 30 days)
	maxUptime := float64(30 * 24 * 3600) // 30 days in seconds
	uptimeScore := float64(metrics.UptimeSeconds) / maxUptime
	if uptimeScore > 1.0 {
		uptimeScore = 1.0
	}

	// Reliability score is already 0-1
	reliabilityScore := float64(metrics.ReliabilityScore)

	// Normalize speed (assume max 100 Mbps)
	speedScore := float64(metrics.UploadSpeedMbps) / 100.0
	if speedScore > 1.0 {
		speedScore = 1.0
	}

	qualityScore := (uptimeScore * uptimeWeight) +
		(reliabilityScore * reliabilityWeight) +
		(speedScore * speedWeight)

	return qualityScore
}

// writeAnnounceResponse writes the announce response
func (ts *TrackerServer) writeAnnounceResponse(w http.ResponseWriter, resp *AnnounceResponse) {
	w.Header().Set("Content-Type", "text/plain")

	if resp.FailureMsg != "" {
		fmt.Fprintf(w, "d14:failure reason%d:%se", len(resp.FailureMsg), resp.FailureMsg)
		return
	}

	// Start response dictionary
	fmt.Fprintf(w, "d8:intervali%de12:min intervali%de", resp.Interval, resp.MinInterval)

	if resp.TrackerID != "" {
		fmt.Fprintf(w, "10:tracker id%d:%s", len(resp.TrackerID), resp.TrackerID)
	}

	fmt.Fprintf(w, "8:completei%de10:incompletei%de", resp.Complete, resp.Incomplete)

	if resp.WarningMsg != "" {
		fmt.Fprintf(w, "15:warning message%d:%s", len(resp.WarningMsg), resp.WarningMsg)
	}

	// Write peers list
	fmt.Fprintf(w, "5:peersl")
	for _, peer := range resp.Peers {
		// Write peer dictionary
		fmt.Fprintf(w, "d2:ip%d:%s7:peer id20:%s4:porti%de",
			len(peer.IP.String()), peer.IP.String(),
			peer.PeerID, peer.Port)

		// Add NERD-specific fields if enabled
		if ts.config.EnableNERD {
			fmt.Fprintf(w, "12:quality scoref%fe11:nerd balancei%de",
				peer.QualityScore, peer.NERDBalance)
		}

		fmt.Fprintf(w, "e")
	}
	fmt.Fprintf(w, "ee") // End peers list and response dict
}

// writeErrorResponse writes an error response
func (ts *TrackerServer) writeErrorResponse(w http.ResponseWriter, msg string) {
	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(http.StatusBadRequest)
	fmt.Fprintf(w, "d14:failure reason%d:%se", len(msg), msg)
}

// GetStats returns tracker statistics
func (ts *TrackerServer) GetStats() *TrackerStats {
	ts.mu.RLock()
	defer ts.mu.RUnlock()

	stats := &TrackerStats{}
	stats.TotalSwarms = len(ts.swarms)

	for _, swarm := range ts.swarms {
		swarm.mu.RLock()
		stats.TotalSeeders += swarm.SeedCount
		stats.TotalLeechers += swarm.LeechCount
		stats.TotalCompleted += swarm.CompletedCount
		stats.TotalPeers += len(swarm.Peers)
		swarm.mu.RUnlock()
	}

	return stats
}

// maintenanceLoop performs periodic maintenance
func (ts *TrackerServer) maintenanceLoop() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		if !ts.isRunning {
			return
		}
		ts.cleanupOldPeers()
	}
}

// cleanupOldPeers removes inactive peers
func (ts *TrackerServer) cleanupOldPeers() {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	threshold := time.Now().Add(-ts.config.PeerTimeout)
	var totalRemoved int

	for infoHash, swarm := range ts.swarms {
		swarm.mu.Lock()
		var removed int

		for peerID, peer := range swarm.Peers {
			if peer.LastSeen.Before(threshold) {
				delete(swarm.Peers, peerID)
				removed++
			}
		}

		// Update counts
		swarm.SeedCount = 0
		swarm.LeechCount = 0
		for _, peer := range swarm.Peers {
			if peer.IsSeeder {
				swarm.SeedCount++
			} else {
				swarm.LeechCount++
			}
		}

		// Remove empty swarms
		if len(swarm.Peers) == 0 {
			delete(ts.swarms, infoHash)
		}

		swarm.mu.Unlock()
		totalRemoved += removed
	}

	if totalRemoved > 0 {
		log.Printf("[Tracker] Cleaned up %d inactive peers", totalRemoved)
	}
}

// statsLoop logs periodic statistics
func (ts *TrackerServer) statsLoop() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		if !ts.isRunning {
			return
		}

		stats := ts.GetStats()
		log.Printf("[Tracker Stats] Swarms: %d, Peers: %d (Seeders: %d, Leechers: %d), Completed: %d",
			stats.TotalSwarms, stats.TotalPeers, stats.TotalSeeders,
			stats.TotalLeechers, stats.TotalCompleted)
	}
}

// generateTrackerID creates a unique tracker ID
func generateTrackerID() string {
	hash := sha1.Sum([]byte(fmt.Sprintf("nerd-tracker-%d", time.Now().UnixNano())))
	return hex.EncodeToString(hash[:8])
}
