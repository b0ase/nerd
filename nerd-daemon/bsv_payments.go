package main

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"sync"
	"time"

	primitives "github.com/bsv-blockchain/go-sdk/primitives/ec"
	"github.com/bsv-blockchain/go-sdk/script"
	"github.com/bsv-blockchain/go-sdk/transaction"
	"github.com/nerd-daemon/messages"
)

// BSVPaymentConfig holds configuration for BSV payment system
type BSVPaymentConfig struct {
	PrivateKeyWIF        string  // WIF format private key for transactions
	MinPaymentSatoshis   int64   // Minimum payment amount
	MaxPaymentSatoshis   int64   // Maximum payment amount
	ChannelTimeoutBlocks int     // Timeout for payment channels in blocks
	FeeRate              float64 // Satoshis per byte for transaction fees
	NetworkType          string  // "mainnet" or "testnet"
	BroadcastURL         string  // URL for broadcasting transactions
}

// BSVPaymentSystem manages BSV micropayments and payment channels
type BSVPaymentSystem struct {
	config          *BSVPaymentConfig
	privateKey      *primitives.PrivateKey
	paymentChannels map[string]*PaymentChannel
	pendingPayments map[string]*PendingPayment
	walletBalance   int64
	mu              sync.RWMutex
	isRunning       bool
}

// PaymentChannel represents a bidirectional payment channel
type PaymentChannel struct {
	ChannelID       string
	PartyA          string // Address of party A
	PartyB          string // Address of party B
	InitialBalanceA int64  // Initial balance for party A
	InitialBalanceB int64  // Initial balance for party B
	CurrentBalanceA int64  // Current balance for party A
	CurrentBalanceB int64  // Current balance for party B
	SequenceNumber  uint32 // For channel state updates
	TimeoutBlock    int64  // Block height when channel expires
	FundingTxID     string // Transaction ID of funding transaction
	IsOpen          bool
	LastUpdate      time.Time
	mu              sync.RWMutex
}

// PendingPayment represents a payment awaiting confirmation
type PendingPayment struct {
	PaymentID   string
	FromAddress string
	ToAddress   string
	Amount      int64
	Purpose     string // "piece_payment", "quality_bonus", "nerd_token", etc.
	TxID        string
	CreatedAt   time.Time
	ConfirmedAt *time.Time
	Status      string // "pending", "confirmed", "failed"
}

// PaymentRequest represents a request for payment
type PaymentRequest struct {
	RequestID  string
	FromPeer   string
	ToPeer     string
	Amount     int64
	Purpose    string
	PieceIndex int32 // For piece-specific payments
	ExpiresAt  time.Time
}

// NewBSVPaymentSystem creates a new BSV payment system
func NewBSVPaymentSystem(config *BSVPaymentConfig) (*BSVPaymentSystem, error) {
	// Parse the private key from WIF format
	privateKey, err := primitives.PrivateKeyFromWif(config.PrivateKeyWIF)
	if err != nil {
		return nil, fmt.Errorf("failed to parse private key: %v", err)
	}

	system := &BSVPaymentSystem{
		config:          config,
		privateKey:      privateKey,
		paymentChannels: make(map[string]*PaymentChannel),
		pendingPayments: make(map[string]*PendingPayment),
		walletBalance:   0, // Will be updated when we check the blockchain
	}

	return system, nil
}

// Start initializes the BSV payment system
func (bps *BSVPaymentSystem) Start() error {
	bps.mu.Lock()
	defer bps.mu.Unlock()

	if bps.isRunning {
		return fmt.Errorf("BSV payment system is already running")
	}

	log.Printf("[BSV] Starting BSV payment system...")
	log.Printf("[BSV] Network: %s", bps.config.NetworkType)
	log.Printf("[BSV] Address: %s", bps.GetAddress())

	// Start background processes
	go bps.paymentMonitorLoop()
	go bps.channelMaintenanceLoop()

	bps.isRunning = true
	log.Printf("[BSV] BSV payment system started successfully")

	return nil
}

// Stop shuts down the BSV payment system
func (bps *BSVPaymentSystem) Stop() error {
	bps.mu.Lock()
	defer bps.mu.Unlock()

	if !bps.isRunning {
		return nil
	}

	log.Printf("[BSV] Stopping BSV payment system...")

	// Close all open payment channels
	for _, channel := range bps.paymentChannels {
		if channel.IsOpen {
			bps.closePaymentChannel(channel.ChannelID)
		}
	}

	bps.isRunning = false
	log.Printf("[BSV] BSV payment system stopped")

	return nil
}

// GetAddress returns the BSV address for this payment system
func (bps *BSVPaymentSystem) GetAddress() string {
	pubKey := bps.privateKey.PubKey()
	address, err := script.NewAddressFromPublicKey(pubKey, true)
	if err != nil {
		log.Printf("[BSV] Failed to generate address: %v", err)
		return ""
	}
	return address.AddressString
}

// CreatePaymentRequest creates a new payment request
func (bps *BSVPaymentSystem) CreatePaymentRequest(fromPeer, toPeer string, amount int64, purpose string, pieceIndex int32) (*PaymentRequest, error) {
	if amount < bps.config.MinPaymentSatoshis || amount > bps.config.MaxPaymentSatoshis {
		return nil, fmt.Errorf("payment amount %d is outside allowed range [%d, %d]",
			amount, bps.config.MinPaymentSatoshis, bps.config.MaxPaymentSatoshis)
	}

	requestID := generatePaymentID()

	request := &PaymentRequest{
		RequestID:  requestID,
		FromPeer:   fromPeer,
		ToPeer:     toPeer,
		Amount:     amount,
		Purpose:    purpose,
		PieceIndex: pieceIndex,
		ExpiresAt:  time.Now().Add(5 * time.Minute), // 5 minute expiry
	}

	log.Printf("[BSV] Created payment request: %s -> %s, %d satoshis for %s",
		fromPeer, toPeer, amount, purpose)

	return request, nil
}

// ProcessPaymentRequest processes an incoming payment request
func (bps *BSVPaymentSystem) ProcessPaymentRequest(request *PaymentRequest) (*PendingPayment, error) {
	if time.Now().After(request.ExpiresAt) {
		return nil, fmt.Errorf("payment request has expired")
	}

	// Check if we have sufficient balance
	if bps.walletBalance < request.Amount {
		return nil, fmt.Errorf("insufficient balance: have %d, need %d", bps.walletBalance, request.Amount)
	}

	// Create payment transaction
	txID, err := bps.createPaymentTransaction(request.ToPeer, request.Amount, request.Purpose)
	if err != nil {
		return nil, fmt.Errorf("failed to create payment transaction: %v", err)
	}

	payment := &PendingPayment{
		PaymentID:   generatePaymentID(),
		FromAddress: bps.GetAddress(),
		ToAddress:   request.ToPeer,
		Amount:      request.Amount,
		Purpose:     request.Purpose,
		TxID:        txID,
		CreatedAt:   time.Now(),
		Status:      "pending",
	}

	bps.mu.Lock()
	bps.pendingPayments[payment.PaymentID] = payment
	bps.mu.Unlock()

	log.Printf("[BSV] Created payment: %s, amount: %d satoshis, txid: %s",
		payment.PaymentID, payment.Amount, payment.TxID)

	return payment, nil
}

// createPaymentTransaction creates a BSV transaction for a payment
func (bps *BSVPaymentSystem) createPaymentTransaction(toAddress string, amount int64, purpose string) (string, error) {
	// Create new transaction
	tx := transaction.NewTransaction()

	// In a real implementation, you would:
	// 1. Query UTXOs for your address
	// 2. Add inputs from UTXOs
	// 3. Add output to recipient
	// 4. Add change output if necessary
	// 5. Sign the transaction
	// 6. Broadcast to network

	// For now, we'll create a mock transaction ID
	mockTxID := generateTransactionID()

	// Add OP_RETURN data with payment purpose
	opReturnData := fmt.Sprintf("NERD_PAYMENT:%s:%d:%s", purpose, amount, toAddress)
	if err := tx.AddOpReturnOutput([]byte(opReturnData)); err != nil {
		return "", fmt.Errorf("failed to add OP_RETURN output: %v", err)
	}

	log.Printf("[BSV] Created transaction %s for %d satoshis to %s (purpose: %s)",
		mockTxID, amount, toAddress, purpose)

	return mockTxID, nil
}

// OpenPaymentChannel opens a new payment channel with a peer
func (bps *BSVPaymentSystem) OpenPaymentChannel(peerAddress string, initialBalanceA, initialBalanceB int64) (*PaymentChannel, error) {
	channelID := generateChannelID()

	channel := &PaymentChannel{
		ChannelID:       channelID,
		PartyA:          bps.GetAddress(),
		PartyB:          peerAddress,
		InitialBalanceA: initialBalanceA,
		InitialBalanceB: initialBalanceB,
		CurrentBalanceA: initialBalanceA,
		CurrentBalanceB: initialBalanceB,
		SequenceNumber:  0,
		TimeoutBlock:    0,     // Will be set when funding is confirmed
		IsOpen:          false, // Will be set to true when funding is confirmed
		LastUpdate:      time.Now(),
	}

	// Create funding transaction
	fundingTxID, err := bps.createChannelFundingTransaction(channel)
	if err != nil {
		return nil, fmt.Errorf("failed to create funding transaction: %v", err)
	}

	channel.FundingTxID = fundingTxID

	bps.mu.Lock()
	bps.paymentChannels[channelID] = channel
	bps.mu.Unlock()

	log.Printf("[BSV] Opened payment channel %s with %s (funding: %s)",
		channelID, peerAddress, fundingTxID)

	return channel, nil
}

// createChannelFundingTransaction creates the funding transaction for a payment channel
func (bps *BSVPaymentSystem) createChannelFundingTransaction(channel *PaymentChannel) (string, error) {
	// In a real implementation, this would create a 2-of-2 multisig transaction
	// that locks funds until the channel is closed

	totalAmount := channel.InitialBalanceA + channel.InitialBalanceB
	mockTxID := generateTransactionID()

	log.Printf("[BSV] Created funding transaction %s for channel %s (amount: %d satoshis)",
		mockTxID, channel.ChannelID, totalAmount)

	return mockTxID, nil
}

// UpdateChannelBalance updates the balance in a payment channel
func (bps *BSVPaymentSystem) UpdateChannelBalance(channelID string, newBalanceA, newBalanceB int64) error {
	bps.mu.Lock()
	defer bps.mu.Unlock()

	channel, exists := bps.paymentChannels[channelID]
	if !exists {
		return fmt.Errorf("payment channel %s not found", channelID)
	}

	if !channel.IsOpen {
		return fmt.Errorf("payment channel %s is not open", channelID)
	}

	// Validate balance update
	totalBalance := channel.InitialBalanceA + channel.InitialBalanceB
	newTotal := newBalanceA + newBalanceB
	if newTotal != totalBalance {
		return fmt.Errorf("invalid balance update: total must remain %d, got %d", totalBalance, newTotal)
	}

	channel.mu.Lock()
	channel.CurrentBalanceA = newBalanceA
	channel.CurrentBalanceB = newBalanceB
	channel.SequenceNumber++
	channel.LastUpdate = time.Now()
	channel.mu.Unlock()

	log.Printf("[BSV] Updated channel %s balances: A=%d, B=%d (seq: %d)",
		channelID, newBalanceA, newBalanceB, channel.SequenceNumber)

	return nil
}

// ClosePaymentChannel closes a payment channel and settles on-chain
func (bps *BSVPaymentSystem) ClosePaymentChannel(channelID string) error {
	bps.mu.Lock()
	defer bps.mu.Unlock()

	return bps.closePaymentChannel(channelID)
}

// closePaymentChannel internal method to close a channel (assumes lock is held)
func (bps *BSVPaymentSystem) closePaymentChannel(channelID string) error {
	channel, exists := bps.paymentChannels[channelID]
	if !exists {
		return fmt.Errorf("payment channel %s not found", channelID)
	}

	if !channel.IsOpen {
		return fmt.Errorf("payment channel %s is already closed", channelID)
	}

	// Create settlement transaction
	settlementTxID, err := bps.createChannelSettlementTransaction(channel)
	if err != nil {
		return fmt.Errorf("failed to create settlement transaction: %v", err)
	}

	channel.IsOpen = false
	channel.LastUpdate = time.Now()

	log.Printf("[BSV] Closed payment channel %s (settlement: %s)", channelID, settlementTxID)

	return nil
}

// createChannelSettlementTransaction creates the settlement transaction for closing a channel
func (bps *BSVPaymentSystem) createChannelSettlementTransaction(channel *PaymentChannel) (string, error) {
	// In a real implementation, this would create a transaction that spends the
	// funding transaction and distributes funds according to the latest channel state

	mockTxID := generateTransactionID()

	log.Printf("[BSV] Created settlement transaction %s for channel %s (A: %d, B: %d)",
		mockTxID, channel.ChannelID, channel.CurrentBalanceA, channel.CurrentBalanceB)

	return mockTxID, nil
}

// ProcessNERDTokenPayment handles NERD token-related payments
func (bps *BSVPaymentSystem) ProcessNERDTokenPayment(fromPeer, toPeer string, tokenAmount uint64, purpose string) error {
	// Convert NERD tokens to satoshis (example: 1 NERD = 1000 satoshis)
	satoshiAmount := int64(tokenAmount * 1000)

	request, err := bps.CreatePaymentRequest(fromPeer, toPeer, satoshiAmount, fmt.Sprintf("NERD_TOKEN:%s", purpose), 0)
	if err != nil {
		return fmt.Errorf("failed to create NERD token payment request: %v", err)
	}

	_, err = bps.ProcessPaymentRequest(request)
	if err != nil {
		return fmt.Errorf("failed to process NERD token payment: %v", err)
	}

	log.Printf("[BSV] Processed NERD token payment: %d tokens (%d satoshis) from %s to %s",
		tokenAmount, satoshiAmount, fromPeer, toPeer)

	return nil
}

// GetPaymentStats returns statistics about payments
func (bps *BSVPaymentSystem) GetPaymentStats() map[string]interface{} {
	bps.mu.RLock()
	defer bps.mu.RUnlock()

	stats := make(map[string]interface{})
	stats["wallet_balance"] = bps.walletBalance
	stats["pending_payments"] = len(bps.pendingPayments)
	stats["open_channels"] = 0
	stats["total_channels"] = len(bps.paymentChannels)

	var totalChannelValue int64
	for _, channel := range bps.paymentChannels {
		if channel.IsOpen {
			stats["open_channels"] = stats["open_channels"].(int) + 1
		}
		totalChannelValue += channel.InitialBalanceA + channel.InitialBalanceB
	}
	stats["total_channel_value"] = totalChannelValue

	return stats
}

// paymentMonitorLoop monitors payment confirmations
func (bps *BSVPaymentSystem) paymentMonitorLoop() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		if !bps.isRunning {
			return
		}

		bps.checkPaymentConfirmations()
	}
}

// checkPaymentConfirmations checks for payment confirmations
func (bps *BSVPaymentSystem) checkPaymentConfirmations() {
	bps.mu.Lock()
	defer bps.mu.Unlock()

	for paymentID, payment := range bps.pendingPayments {
		if payment.Status == "pending" {
			// In a real implementation, you would query the BSV network
			// to check if the transaction has been confirmed

			// For demo purposes, we'll randomly confirm some payments
			if time.Since(payment.CreatedAt) > 2*time.Minute {
				now := time.Now()
				payment.ConfirmedAt = &now
				payment.Status = "confirmed"

				log.Printf("[BSV] Payment %s confirmed (txid: %s)", paymentID, payment.TxID)
			}
		}
	}
}

// channelMaintenanceLoop performs periodic channel maintenance
func (bps *BSVPaymentSystem) channelMaintenanceLoop() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		if !bps.isRunning {
			return
		}

		bps.performChannelMaintenance()
	}
}

// performChannelMaintenance performs periodic channel maintenance
func (bps *BSVPaymentSystem) performChannelMaintenance() {
	bps.mu.RLock()
	defer bps.mu.RUnlock()

	var channelsToClose []string

	for channelID, channel := range bps.paymentChannels {
		// Close channels that have been inactive for too long
		if channel.IsOpen && time.Since(channel.LastUpdate) > 24*time.Hour {
			channelsToClose = append(channelsToClose, channelID)
		}
	}

	// Close inactive channels
	for _, channelID := range channelsToClose {
		log.Printf("[BSV] Auto-closing inactive channel: %s", channelID)
		bps.closePaymentChannel(channelID)
	}

	if len(channelsToClose) > 0 {
		log.Printf("[BSV] Closed %d inactive channels during maintenance", len(channelsToClose))
	}
}

// ConvertToProtocolMessage converts a payment request to a protocol buffer message
func (bps *BSVPaymentSystem) ConvertToProtocolMessage(request *PaymentRequest) (*messages.PaymentRequestMsg, error) {
	return &messages.PaymentRequestMsg{
		AmountSatoshis: uint64(request.Amount),
		PieceIndex:     uint32(request.PieceIndex),
	}, nil
}

// ProcessProtocolPaymentRequest processes a payment request from protocol buffer
func (bps *BSVPaymentSystem) ProcessProtocolPaymentRequest(msg *messages.PaymentRequestMsg, fromPeer string) error {
	request, err := bps.CreatePaymentRequest(
		fromPeer,
		bps.GetAddress(),
		int64(msg.AmountSatoshis),
		"protocol_payment",
		int32(msg.PieceIndex),
	)
	if err != nil {
		return fmt.Errorf("failed to create payment request: %v", err)
	}

	_, err = bps.ProcessPaymentRequest(request)
	if err != nil {
		return fmt.Errorf("failed to process payment request: %v", err)
	}

	return nil
}

// Helper functions

func generatePaymentID() string {
	bytes := make([]byte, 16)
	rand.Read(bytes)
	return fmt.Sprintf("pay_%s", hex.EncodeToString(bytes)[:16])
}

func generateChannelID() string {
	bytes := make([]byte, 16)
	rand.Read(bytes)
	return fmt.Sprintf("chan_%s", hex.EncodeToString(bytes)[:16])
}

func generateTransactionID() string {
	bytes := make([]byte, 32)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}
