package main

import (
	"encoding/binary"
	"fmt"
	"io"
	"net"

	"github.com/nerd-daemon/messages"
	"google.golang.org/protobuf/proto"
)

// BitTorrent protocol message type constants
const (
	// Standard BitTorrent message types
	MsgTypeChoke         = 0
	MsgTypeUnchoke       = 1
	MsgTypeInterested    = 2
	MsgTypeNotInterested = 3
	MsgTypeHave          = 4
	MsgTypeBitfield      = 5
	MsgTypeRequest       = 6
	MsgTypePiece         = 7
	MsgTypeCancel        = 8
	MsgTypePort          = 9

	// NERD-specific message types (100+)
	MsgTypePaymentRequest = 100
	MsgTypePaymentProof   = 101
	MsgTypeTokenBalance   = 102
	MsgTypeQualityMetrics = 103
	MsgTypeGeographicHint = 104
)

// Protocol constants
const (
	ProtocolString    = "BitTorrent protocol"
	ProtocolStringLen = 19
	HandshakeLen      = 68 // 1 + 19 + 8 + 20 + 20
)

// WireProtocol handles BitTorrent wire protocol communication
type WireProtocol struct {
	conn   net.Conn
	peerID [20]byte
}

// NewWireProtocol creates a new wire protocol handler for a connection
func NewWireProtocol(conn net.Conn) *WireProtocol {
	return &WireProtocol{
		conn: conn,
		// TODO: Generate proper peer ID
		peerID: [20]byte{}, // Placeholder
	}
}

// SendHandshake sends a BitTorrent handshake message
func (wp *WireProtocol) SendHandshake(infoHash [20]byte) error {
	handshake := &messages.HandshakeMsg{
		ProtocolString: []byte(ProtocolString),
		Reserved:       make([]byte, 8), // Reserved bytes for extensions
		InfoHash:       infoHash[:],
		PeerId:         wp.peerID[:],
	}

	// For handshake, we use the traditional BitTorrent format
	// rather than our protobuf wrapper
	handshakeBytes := make([]byte, HandshakeLen)
	handshakeBytes[0] = ProtocolStringLen
	copy(handshakeBytes[1:20], ProtocolString)
	copy(handshakeBytes[20:28], handshake.Reserved)
	copy(handshakeBytes[28:48], handshake.InfoHash)
	copy(handshakeBytes[48:68], handshake.PeerId)

	_, err := wp.conn.Write(handshakeBytes)
	if err != nil {
		return fmt.Errorf("failed to send handshake: %v", err)
	}

	return nil
}

// ReceiveHandshake receives and parses a BitTorrent handshake
func (wp *WireProtocol) ReceiveHandshake() (*messages.HandshakeMsg, error) {
	handshakeBytes := make([]byte, HandshakeLen)
	_, err := io.ReadFull(wp.conn, handshakeBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to read handshake: %v", err)
	}

	// Parse traditional BitTorrent handshake format
	if handshakeBytes[0] != ProtocolStringLen {
		return nil, fmt.Errorf("invalid protocol string length: %d", handshakeBytes[0])
	}

	protocolStr := string(handshakeBytes[1:20])
	if protocolStr != ProtocolString {
		return nil, fmt.Errorf("invalid protocol string: %s", protocolStr)
	}

	handshake := &messages.HandshakeMsg{
		ProtocolString: handshakeBytes[1:20],
		Reserved:       handshakeBytes[20:28],
		InfoHash:       handshakeBytes[28:48],
		PeerId:         handshakeBytes[48:68],
	}

	return handshake, nil
}

// SendMessage sends a message using our protobuf wire protocol
func (wp *WireProtocol) SendMessage(messageType uint32, payload proto.Message) error {
	// Serialize the payload
	payloadBytes, err := proto.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %v", err)
	}

	// Create the message wrapper
	msg := &messages.Message{
		Length:    uint32(len(payloadBytes) + 4), // +4 for message_id
		MessageId: messageType,
		Payload:   payloadBytes,
	}

	// Serialize the complete message
	msgBytes, err := proto.Marshal(msg)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %v", err)
	}

	// Send length prefix (4 bytes, big endian)
	lengthBytes := make([]byte, 4)
	binary.BigEndian.PutUint32(lengthBytes, uint32(len(msgBytes)))

	// Send length + message
	_, err = wp.conn.Write(append(lengthBytes, msgBytes...))
	if err != nil {
		return fmt.Errorf("failed to send message: %v", err)
	}

	return nil
}

// ReceiveMessage receives and parses a message from the wire
func (wp *WireProtocol) ReceiveMessage() (*messages.Message, error) {
	// Read message length (4 bytes)
	lengthBytes := make([]byte, 4)
	_, err := io.ReadFull(wp.conn, lengthBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to read message length: %v", err)
	}

	msgLength := binary.BigEndian.Uint32(lengthBytes)
	if msgLength == 0 {
		// Keep-alive message
		return &messages.Message{
			Length:    0,
			MessageId: 999, // Special keep-alive ID
			Payload:   nil,
		}, nil
	}

	// Read the message data
	msgBytes := make([]byte, msgLength)
	_, err = io.ReadFull(wp.conn, msgBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to read message data: %v", err)
	}

	// Parse the message
	msg := &messages.Message{}
	err = proto.Unmarshal(msgBytes, msg)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal message: %v", err)
	}

	return msg, nil
}

// SendKeepAlive sends a keep-alive message (empty message)
func (wp *WireProtocol) SendKeepAlive() error {
	keepAlive := &messages.KeepAliveMsg{}
	return wp.SendMessage(999, keepAlive) // Special keep-alive ID
}

// SendInterested sends an interested message
func (wp *WireProtocol) SendInterested() error {
	interested := &messages.InterestedMsg{}
	return wp.SendMessage(MsgTypeInterested, interested)
}

// SendHave sends a have message for a specific piece
func (wp *WireProtocol) SendHave(pieceIndex uint32) error {
	have := &messages.HaveMsg{
		PieceIndex: pieceIndex,
	}
	return wp.SendMessage(MsgTypeHave, have)
}

// ParseMessagePayload parses a message payload based on its type
func ParseMessagePayload(messageType uint32, payload []byte) (proto.Message, error) {
	switch messageType {
	case MsgTypeChoke:
		msg := &messages.ChokeMsg{}
		err := proto.Unmarshal(payload, msg)
		return msg, err
	case MsgTypeUnchoke:
		msg := &messages.UnchokeMsg{}
		err := proto.Unmarshal(payload, msg)
		return msg, err
	case MsgTypeInterested:
		msg := &messages.InterestedMsg{}
		err := proto.Unmarshal(payload, msg)
		return msg, err
	case MsgTypeNotInterested:
		msg := &messages.NotInterestedMsg{}
		err := proto.Unmarshal(payload, msg)
		return msg, err
	case MsgTypeHave:
		msg := &messages.HaveMsg{}
		err := proto.Unmarshal(payload, msg)
		return msg, err
	case MsgTypeBitfield:
		msg := &messages.BitfieldMsg{}
		err := proto.Unmarshal(payload, msg)
		return msg, err
	case MsgTypeRequest:
		msg := &messages.RequestMsg{}
		err := proto.Unmarshal(payload, msg)
		return msg, err
	case MsgTypePiece:
		msg := &messages.PieceMsg{}
		err := proto.Unmarshal(payload, msg)
		return msg, err
	case MsgTypeCancel:
		msg := &messages.CancelMsg{}
		err := proto.Unmarshal(payload, msg)
		return msg, err
	case MsgTypePort:
		msg := &messages.PortMsg{}
		err := proto.Unmarshal(payload, msg)
		return msg, err
	case MsgTypePaymentRequest:
		msg := &messages.PaymentRequestMsg{}
		err := proto.Unmarshal(payload, msg)
		return msg, err
	case MsgTypePaymentProof:
		msg := &messages.PaymentProofMsg{}
		err := proto.Unmarshal(payload, msg)
		return msg, err
	case MsgTypeTokenBalance:
		msg := &messages.TokenBalanceMsg{}
		err := proto.Unmarshal(payload, msg)
		return msg, err
	case MsgTypeQualityMetrics:
		msg := &messages.QualityMetricsMsg{}
		err := proto.Unmarshal(payload, msg)
		return msg, err
	case MsgTypeGeographicHint:
		msg := &messages.GeographicHintMsg{}
		err := proto.Unmarshal(payload, msg)
		return msg, err
	case 999: // Keep-alive
		msg := &messages.KeepAliveMsg{}
		err := proto.Unmarshal(payload, msg)
		return msg, err
	default:
		return nil, fmt.Errorf("unknown message type: %d", messageType)
	}
}
