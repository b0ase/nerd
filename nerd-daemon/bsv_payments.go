package main

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"strings" // Added for strings.ToLower
	"sync"
	"time"

	primitives "github.com/bsv-blockchain/go-sdk/primitives/ec"
	"github.com/bsv-blockchain/go-sdk/script"
	"github.com/bsv-blockchain/go-sdk/transaction"
	"github.com/bsv-blockchain/go-sdk/transaction/template/p2pkh"
	"github.com/nerd-daemon/messages"
)

// BSVPaymentConfig holds configuration for BSV payment system
type BSVPaymentConfig struct {
	PrivateKeyWIF        string  // WIF format private key for transactions
	MinPaymentSatoshis   int64   // Minimum payment amount
	MaxPaymentSatoshis   int64   // Maximum payment amount
	ChannelTimeoutBlocks int     // Timeout for payment channels in blocks
	FeeRate              float64 // Satoshis per byte for transaction fees (e.g., 0.05)
	NetworkType          string  // "mainnet" or "testnet", used for constructing API URLs
	BroadcastURL         string  // URL for broadcasting transactions (e.g., Whatsonchain API for testnet: https://api.whatsonchain.com/v1/bsv/test/tx/raw)
	UTXOFetchURLFormat   string  // URL format for fetching UTXOs, e.g., "https://api.whatsonchain.com/v1/bsv/%s/address/%s/unspent" (%s for network, %s for address)
	// UTXOFetchAPIKey      string  // API key if UTXO fetching service requires it (not used by Whatsonchain public)
}

// UTXO represents an Unspent Transaction Output.
type UTXO struct {
	TxID         string // Transaction ID where this UTXO was created
	Vout         uint32 // Output index in the transaction
	ScriptPubKey string // The scriptPubKey hex for this UTXO
	Satoshis     int64  // Amount in satoshis
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
	isTestnet       bool // Added to easily check network type based on config
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

// WhatsonchainUTXO represents the structure of a UTXO object from the Whatsonchain API
type WhatsonchainUTXO struct {
	Height int64  `json:"height"`  // Block height, 0 or -1 if unconfirmed
	TxPos  uint32 `json:"tx_pos"`  // Output index (vout)
	TxHash string `json:"tx_hash"` // Transaction hash (ID)
	Value  int64  `json:"value"`   // Value in satoshis
	Script string `json:"script"`  // ScriptPubKey in hex (this is what WOC returns as "script")
}

// NewBSVPaymentSystem creates a new BSV payment system
func NewBSVPaymentSystem(config *BSVPaymentConfig) (*BSVPaymentSystem, error) {
	if config.PrivateKeyWIF == "" {
		return nil, fmt.Errorf("private key WIF must be provided in config")
	}
	if config.BroadcastURL == "" {
		return nil, fmt.Errorf("broadcast URL must be provided in config")
	}
	if config.UTXOFetchURLFormat == "" {
		return nil, fmt.Errorf("UTXO fetch URL format must be provided in config")
	}

	privKey, err := primitives.PrivateKeyFromWif(config.PrivateKeyWIF)
	if err != nil {
		return nil, fmt.Errorf("failed to parse private key WIF: %v", err)
	}

	isTest := false
	if strings.ToLower(config.NetworkType) == "testnet" || strings.ToLower(config.NetworkType) == "test" {
		isTest = true
	}

	return &BSVPaymentSystem{
		config:          config,
		privateKey:      privKey,
		paymentChannels: make(map[string]*PaymentChannel),
		pendingPayments: make(map[string]*PendingPayment),
		isTestnet:       isTest,
	}, nil
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

	// In a real system, walletBalance should be dynamically updated.
	// For now, we rely on fetchUTXOs to determine spendability.
	// if bps.walletBalance < request.Amount {
	// 	return nil, fmt.Errorf("insufficient balance: have %d, need %d", bps.walletBalance, request.Amount)
	// }

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
		Status:      "broadcasted", // Changed from "pending" as it's broadcast by createPaymentTransaction
	}

	bps.mu.Lock()
	bps.pendingPayments[payment.PaymentID] = payment
	bps.mu.Unlock()

	log.Printf("[BSV] Created and broadcasted payment: %s, amount: %d satoshis, txid: %s",
		payment.PaymentID, payment.Amount, payment.TxID)

	return payment, nil
}

// fetchUTXOs fetches unspent transaction outputs for a given address from a blockchain explorer.
func (bps *BSVPaymentSystem) fetchUTXOs(address string, requiredAmount int64) ([]UTXO, int64, error) {
	// Determine network string for URL ("main" or "test")
	networkStr := "main"
	if bps.isTestnet {
		networkStr = "test"
	}

	// Construct the URL
	// Example: "https://api.whatsonchain.com/v1/bsv/%s/address/%s/unspent"
	// First %s is network (test/main), second %s is address
	fetchURL := fmt.Sprintf(bps.config.UTXOFetchURLFormat, networkStr, address)
	log.Printf("[BSV] Fetching UTXOs for address %s from %s", address, fetchURL)

	client := &http.Client{Timeout: 15 * time.Second}
	req, err := http.NewRequest("GET", fetchURL, nil)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to create UTXO fetch request: %v", err)
	}
	// Whatsonchain API typically doesn't require special headers for public GET requests
	// req.Header.Set("User-Agent", "nerd-daemon") // Optional: Good practice to set a User-Agent

	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to execute UTXO fetch request to %s: %v", fetchURL, err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to read UTXO fetch response body from %s: %v", fetchURL, err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, 0, fmt.Errorf("UTXO fetch from %s failed with status %s: %s", fetchURL, resp.Status, string(bodyBytes))
	}

	var wocUtxos []WhatsonchainUTXO
	if err := json.Unmarshal(bodyBytes, &wocUtxos); err != nil {
		// If unmarshal fails, it might be an empty array "[]" which is valid, or an error message from the API not in expected UTXO format.
		// Check if the body is "[]" for an empty list of UTXOs.
		if strings.TrimSpace(string(bodyBytes)) == "[]" {
			log.Printf("[BSV] No UTXOs found for address %s (empty array response)", address)
			return []UTXO{}, 0, nil // No UTXOs found is not an error, just an empty list.
		}
		return nil, 0, fmt.Errorf("failed to unmarshal UTXO response from %s (body: %s): %v", fetchURL, string(bodyBytes), err)
	}

	var utxos []UTXO
	var totalSatoshis int64
	foundSufficient := false

	for _, wocUtxo := range wocUtxos {
		utxo := UTXO{
			TxID:         wocUtxo.TxHash,
			Vout:         wocUtxo.TxPos,
			ScriptPubKey: wocUtxo.Script, // Assuming Whatsonchain 'script' field is the scriptPubKeyHex
			Satoshis:     wocUtxo.Value,
		}
		utxos = append(utxos, utxo)
		totalSatoshis += utxo.Satoshis
		log.Printf("[BSV] Fetched UTXO: %s:%d, Value: %d, Script: %.30s...", utxo.TxID, utxo.Vout, utxo.Satoshis, utxo.ScriptPubKey)

		// If requiredAmount is > 0, we can stop fetching if we have enough.
		// If requiredAmount is <= 0, it means fetch all available UTXOs.
		if requiredAmount > 0 && totalSatoshis >= requiredAmount {
			foundSufficient = true
			log.Printf("[BSV] Found sufficient UTXOs (%d sats) for required amount (%d sats).", totalSatoshis, requiredAmount)
			break // Stop if we've gathered enough for the requiredAmount
		}
	}

	if requiredAmount > 0 && !foundSufficient && totalSatoshis < requiredAmount {
		log.Printf("[BSV] Insufficient UTXOs: fetched %d satoshis, but required %d satoshis for address %s.", totalSatoshis, requiredAmount, address)
		// This is not an error in fetchUTXOs itself, but the caller (createPaymentTransaction) will handle it.
	}

	log.Printf("[BSV] Fetched %d UTXOs for address %s, total satoshis: %d", len(utxos), address, totalSatoshis)
	return utxos, totalSatoshis, nil
}

// broadcastTransaction broadcasts the raw transaction hex to the network.
// It uses the BroadcastURL from the configuration (e.g., Whatsonchain API).
func (bps *BSVPaymentSystem) broadcastTransaction(rawTxHex string) (string, error) {
	if bps.config.BroadcastURL == "" {
		log.Printf("[BSV] WARNING: BroadcastURL is not set. Transaction hex: %s... will not be broadcasted.", rawTxHex[:min(64, len(rawTxHex))])
		return "", fmt.Errorf("BroadcastURL is not configured")
	}
	log.Printf("[BSV] Broadcasting transaction hex to %s: %s...", bps.config.BroadcastURL, rawTxHex[:min(64, len(rawTxHex))])

	// Whatsonchain API expects a JSON payload like: {"txhex": "<your_tx_hex>"}
	payload := map[string]string{"txhex": rawTxHex}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal broadcast payload: %v", err)
	}

	req, err := http.NewRequest("POST", bps.config.BroadcastURL, bytes.NewBuffer(payloadBytes))
	if err != nil {
		return "", fmt.Errorf("failed to create broadcast request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to execute broadcast request: %v", err)
	}
	defer resp.Body.Close()

	bodyBytes, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		log.Printf("[BSV] Warning: failed to read broadcast response body: %v", readErr)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("broadcast failed with status %s: %s", resp.Status, string(bodyBytes))
	}

	// Whatsonchain returns the TXID as plain text (not JSON) on success.
	txID := string(bytes.TrimSpace(bodyBytes))

	if len(txID) != 64 { // Basic validation for a hex TXID format
		log.Printf("[BSV] Warning: Broadcast response doesn't look like a 64-char hex TXID: '%s'. Full response: '%s'", txID, string(bodyBytes))
		// Depending on the API, this might still be a success, or it might be an error wrapped in JSON.
		// For WOC, a non-200 status is the primary error indicator.
		// If it's 200 but not a TXID, it's an unexpected response from WOC.
		return "", fmt.Errorf("broadcast succeeded with status 200 but response was not a valid TXID: %s", txID)
	}

	log.Printf("[BSV] Transaction broadcast successful. Response TXID: %s", txID)
	return txID, nil
}

// calculateTransactionSize estimates the size of a transaction in bytes.
// This is based on the BSV SDK's fee modeling example.
func calculateTransactionSize(tx *transaction.Transaction) int {
	size := 4 // Version (4 bytes)

	size += transaction.VarInt(uint64(len(tx.Inputs))).Length() // Number of inputs
	for _, input := range tx.Inputs {
		size += 32 // Previous TxID (32 bytes)
		size += 4  // Previous Tx Output Index (4 bytes)
		// Unlocking script length (VarInt) + Unlocking script
		if input.UnlockingScript != nil {
			size += transaction.VarInt(uint64(len(*input.UnlockingScript))).Length()
			size += len(*input.UnlockingScript)
		} else {
			// Estimate size for P2PKH unlocking script (signature + pubkey)
			// DER signature: 70-72 bytes. Compressed PubKey: 33 bytes.
			// Script ops: OP_PUSHDATA(sig) + OP_PUSHDATA(pubkey) ~ 1 + 72 + 1 + 33 = 107
			// This is an estimate if UnlockingScript is not yet set (e.g. before signing)
			// If using UnlockingScriptTemplate, the template itself might not be the final script.
			// For P2PKH, after signing, it's typically around 107-110 bytes.
			// The SDK example panics if UnlockingScript is nil during fee computation.
			// For estimation *before* signing, we use a common P2PKH unlocking script size.
			// A safer bet might be to have a constant or ensure script templates are sized.
			// The p2pkh.Unlock template itself is small; the actual script is generated during signing.
			// For now, using a typical size.
			estimatedUnlockingScriptSize := 108 // Approximation for a P2PKH unlocking script
			size += transaction.VarInt(uint64(estimatedUnlockingScriptSize)).Length()
			size += estimatedUnlockingScriptSize
		}
		size += 4 // Sequence (4 bytes)
	}

	size += transaction.VarInt(uint64(len(tx.Outputs))).Length() // Number of outputs
	for _, out := range tx.Outputs {
		size += 8 // Satoshis (8 bytes)
		// Locking script length (VarInt) + Locking script
		if out.LockingScript != nil {
			size += transaction.VarInt(uint64(len(*out.LockingScript))).Length()
			size += len(*out.LockingScript)
		}
		// else: an output must have a locking script.
	}

	size += 4 // LockTime (4 bytes)
	return size
}

// createPaymentTransaction creates, signs, and broadcasts a BSV transaction for a payment.
func (bps *BSVPaymentSystem) createPaymentTransaction(toAddress string, amount int64, purpose string) (string, error) {
	daemonAddress := bps.GetAddress()
	if daemonAddress == "" {
		return "", fmt.Errorf("failed to get daemon's BSV address")
	}

	initialEstimatedFee := int64(100)
	requiredSatoshisForUTXOFetch := amount + initialEstimatedFee

	log.Printf("[BSV] Creating payment tx to %s for %d sats (purpose: '%s'). Initial estimated fee for UTXO fetch: %d",
		toAddress, amount, purpose, initialEstimatedFee)

	utxos, totalInputSatoshis, err := bps.fetchUTXOs(daemonAddress, requiredSatoshisForUTXOFetch)
	if err != nil {
		return "", fmt.Errorf("failed to fetch UTXOs for %s (amount needed ~%d): %v", daemonAddress, requiredSatoshisForUTXOFetch, err)
	}
	if totalInputSatoshis < amount {
		return "", fmt.Errorf("insufficient funds from fetched UTXOs: have %d, need at least %d for payment amount alone", totalInputSatoshis, amount)
	}

	tx := transaction.NewTransaction()

	unlockingScriptTemplate, err := p2pkh.Unlock(bps.privateKey, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create unlocking script template: %v", err)
	}

	var actualInputsValue int64
	for _, utxo := range utxos {
		err := tx.AddInputFrom(
			utxo.TxID,
			utxo.Vout,
			utxo.ScriptPubKey,
			uint64(utxo.Satoshis),
			unlockingScriptTemplate,
		)
		if err != nil {
			return "", fmt.Errorf("failed to add input from UTXO %s:%d: %v", utxo.TxID, utxo.Vout, err)
		}
		actualInputsValue += utxo.Satoshis
	}
	log.Printf("[BSV] Added %d inputs with total value %d satoshis.", len(tx.Inputs), actualInputsValue)

	if err := tx.PayToAddress(toAddress, uint64(amount)); err != nil {
		return "", fmt.Errorf("failed to add payment output to %s for %d satoshis: %v", toAddress, amount, err)
	}

	if purpose != "" {
		opReturnData := []byte("NERD_PAYMENT:" + purpose)
		if len(opReturnData) > 220 {
			log.Printf("[BSV] Warning: OP_RETURN data is too long (%d bytes), it will be truncated.", len(opReturnData))
			opReturnData = opReturnData[:220]
		}
		if err := tx.AddOpReturnOutput(opReturnData); err != nil {
			log.Printf("[BSV] Warning: failed to add OP_RETURN output (data: '%s'): %v. Continuing without OP_RETURN.", string(opReturnData), err)
		}
	}

	sizeWithoutChange := calculateTransactionSize(tx)
	calculatedFee := int64(math.Ceil(float64(sizeWithoutChange) * bps.config.FeeRate))
	if calculatedFee < 1 {
		calculatedFee = 1
	}
	log.Printf("[BSV] Estimated tx size (no change): %d bytes. Calculated fee (at %.4f sat/byte): %d satoshis.",
		sizeWithoutChange, bps.config.FeeRate, calculatedFee)

	changeAmount := actualInputsValue - amount - calculatedFee
	dustThreshold := int64(1)

	if changeAmount >= dustThreshold {
		log.Printf("[BSV] Calculated change: %d satoshis. Adding change output to %s.", changeAmount, daemonAddress)
		if err := tx.PayToAddress(daemonAddress, uint64(changeAmount)); err != nil {
			return "", fmt.Errorf("failed to add change output to %s for %d satoshis: %v", daemonAddress, changeAmount, err)
		}

		finalSize := calculateTransactionSize(tx)
		finalFee := int64(math.Ceil(float64(finalSize) * bps.config.FeeRate))
		if finalFee < 1 {
			finalFee = 1
		}

		if finalFee > calculatedFee {
			log.Printf("[BSV] Fee increased after adding change. Original: %d, New: %d (size: %d bytes). Adjusting change.", calculatedFee, finalFee, finalSize)
			changeAmountAfterRecalc := actualInputsValue - amount - finalFee
			if changeAmountAfterRecalc < dustThreshold {
				log.Printf("[BSV] Change (%d) became dust after fee recalc. Removing change output; fee will absorb diff.", changeAmountAfterRecalc)
				if len(tx.Outputs) > 0 {
					// Assuming change was the last output added
					isChangeOutput := false
					lastOutput := tx.Outputs[len(tx.Outputs)-1]

					// Check if the last output script matches the daemon's address script
					addressObj, err := script.NewAddressFromString(daemonAddress)
					if err == nil {
						lockingScriptForDaemon, err := p2pkh.Lock(addressObj)
						if err == nil && lockingScriptForDaemon != nil && lastOutput.LockingScript != nil && lastOutput.LockingScript.Equals(lockingScriptForDaemon) {
							isChangeOutput = true
						}
					}

					if isChangeOutput {
						tx.Outputs = tx.Outputs[:len(tx.Outputs)-1]
						log.Printf("[BSV] Removed last output (assumed to be change).")
					} else {
						log.Printf("[BSV] Could not confirm last output was change, not removing. Higher fee may be paid.")
					}
				}
			} else {
				if len(tx.Outputs) > 0 {
					tx.Outputs[len(tx.Outputs)-1].Satoshis = uint64(changeAmountAfterRecalc)
					log.Printf("[BSV] Adjusted change output to %d satoshis.", changeAmountAfterRecalc)
				}
			}
			calculatedFee = finalFee
		} else if finalFee < calculatedFee {
			log.Printf("[BSV] Warning: Fee unexpectedly decreased after adding change output. Original: %d, New: %d.", calculatedFee, finalFee)
			calculatedFee = finalFee
		}
	} else if changeAmount < 0 {
		return "", fmt.Errorf("insufficient funds for payment (%d) and initial fee (%d): inputs %d. Deficit: %d",
			amount, calculatedFee, actualInputsValue, -changeAmount)
	} else {
		log.Printf("[BSV] Change is dust (%d satoshis). It will be added to transaction fee.", changeAmount)
	}

	log.Printf("[BSV] Signing transaction. Total inputs: %d, Payment: %d, Final Calculated Fee: %d",
		actualInputsValue, amount, calculatedFee)

	if err := tx.Sign(); err != nil {
		return "", fmt.Errorf("failed to sign transaction: %v", err)
	}

	rawTxHex := tx.Hex()
	log.Printf("[BSV] Signed raw transaction hex generated (len: %d): %s...", len(rawTxHex), rawTxHex[:min(64, len(rawTxHex))])

	broadcastTxID, broadcastErr := bps.broadcastTransaction(rawTxHex)
	if broadcastErr != nil {
		log.Printf("[BSV] Broadcast failed for TxHex: %s", rawTxHex)
		return "", fmt.Errorf("transaction broadcast failed: %v", broadcastErr)
	}

	actualTxIDHash := tx.TxID()
	actualTxIDStr := actualTxIDHash.String()

	if broadcastTxID != "" && broadcastTxID != actualTxIDStr {
		log.Printf("[BSV] Warning: Calculated TxID from SDK (%s) differs from broadcast response TxID (%s). Using SDK's calculated TxID.", actualTxIDStr, broadcastTxID)
	}
	log.Printf("[BSV] Transaction created and broadcasted successfully. TxID: %s", actualTxIDStr)

	return actualTxIDStr, nil
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

	var confirmedPayments []string

	for paymentID, payment := range bps.pendingPayments {
		// Only check payments that are thought to be on the network but not yet confirmed.
		if payment.Status == "broadcasted" {
			log.Printf("[BSV] Placeholder: Checking confirmation for payment %s (txid: %s), current status: %s", paymentID, payment.TxID, payment.Status)

			// In a real implementation, query the BSV network (e.g. Whatsonchain)
			// using payment.TxID: GET https://api.whatsonchain.com/v1/bsv/<network>/tx/hash/<txid>
			// Look for block height or confirmations.

			// For demo purposes, simulate confirmation after a delay (if on testnet)
			if bps.isTestnet && time.Since(payment.CreatedAt) > 30*time.Second {
				now := time.Now()
				payment.ConfirmedAt = &now
				payment.Status = "confirmed"
				confirmedPayments = append(confirmedPayments, paymentID)
				log.Printf("[BSV] DEMO: Payment %s (txid: %s) marked as confirmed on testnet.", paymentID, payment.TxID)
			}
		}
	}

	if len(confirmedPayments) > 0 {
		log.Printf("[BSV] %d payments processed for confirmation during this cycle.", len(confirmedPayments))
		// TODO: Update bps.walletBalance if managing it directly, or re-fetch UTXOs.
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

// min is a helper function to get the minimum of two integers.
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
