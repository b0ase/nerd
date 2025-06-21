package main

import (
	"crypto/sha256"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	"github.com/nerd-daemon/messages"
	"google.golang.org/protobuf/proto"
)

// BSVSocialSystem manages the social protocol layer
type BSVSocialSystem struct {
	bsvPayments   *BSVPaymentSystem
	socialGraph   *SocialGraph
	socialStorage *SocialStorage
	socialRewards *SocialRewards

	// Social message handlers
	followHandler       func(*messages.SocialFollowMsg)
	commentHandler      func(*messages.SocialCommentMsg)
	reactionHandler     func(*messages.SocialReactionMsg)
	shareHandler        func(*messages.SocialShareMsg)
	notificationHandler func(*messages.SocialNotificationMsg)
	directMsgHandler    func(*messages.SocialDirectMsg)
	profileHandler      func(*messages.SocialProfileMsg)
	statusHandler       func(*messages.SocialStatusMsg)
	discoveryHandler    func(*messages.SocialDiscoveryMsg)

	mu      sync.RWMutex
	running bool
}

// SocialGraph manages the on-chain and in-memory social relationships
type SocialGraph struct {
	// In-memory social graph for fast lookups
	following map[string][]string // creator_address -> [follower_addresses]
	followers map[string][]string // follower_address -> [creator_addresses]

	// Content social data
	contentLikes    map[string]map[string]bool // content_address -> user_address -> liked
	contentShares   map[string][]SocialShare
	contentComments map[string][]SocialComment

	// Creator profiles
	profiles map[string]*CreatorProfile

	mu sync.RWMutex
}

// SocialStorage handles persistent storage of social data
type SocialStorage struct {
	dataDir string
	mu      sync.RWMutex
}

// SocialRewards manages NERD token distribution for social engagement
type SocialRewards struct {
	rewardRates map[string]uint32 // action_type -> NERD reward amount
	mu          sync.RWMutex
}

// Social data structures
type SocialShare struct {
	SharerAddress  string    `json:"sharer_address"`
	ContentAddress string    `json:"content_address"`
	ShareMessage   string    `json:"share_message"`
	Timestamp      time.Time `json:"timestamp"`
	ViralReward    uint32    `json:"viral_reward"`
}

type SocialComment struct {
	CommenterAddress string    `json:"commenter_address"`
	ContentAddress   string    `json:"content_address"`
	CommentText      string    `json:"comment_text"`
	Timestamp        time.Time `json:"timestamp"`
	ParentCommentID  string    `json:"parent_comment_id,omitempty"`
	NERDTip          uint32    `json:"nerd_tip"`
}

type CreatorProfile struct {
	CreatorAddress string    `json:"creator_address"`
	DisplayName    string    `json:"display_name"`
	Bio            string    `json:"bio"`
	AvatarHash     string    `json:"avatar_hash"`
	BannerHash     string    `json:"banner_hash"`
	SocialLinks    []string  `json:"social_links"`
	LastUpdated    time.Time `json:"last_updated"`
	ContentCount   uint32    `json:"content_count"`
	TotalEarnings  uint64    `json:"total_earnings"`
	FollowerCount  uint32    `json:"follower_count"`
}

// Social message type constants (200-299)
const (
	SocialFollowMsgType       = 200
	SocialCommentMsgType      = 201
	SocialReactionMsgType     = 202
	SocialShareMsgType        = 203
	SocialNotificationMsgType = 204
	SocialDirectMsgType       = 205
	SocialProfileMsgType      = 206
	SocialStatusMsgType       = 207
	SocialDiscoveryMsgType    = 208
)

// NewBSVSocialSystem creates a new BSV Social Protocol system
func NewBSVSocialSystem(bsvPayments *BSVPaymentSystem, dataDir string) *BSVSocialSystem {
	social := &BSVSocialSystem{
		bsvPayments: bsvPayments,
		socialGraph: &SocialGraph{
			following:       make(map[string][]string),
			followers:       make(map[string][]string),
			contentLikes:    make(map[string]map[string]bool),
			contentShares:   make(map[string][]SocialShare),
			contentComments: make(map[string][]SocialComment),
			profiles:        make(map[string]*CreatorProfile),
		},
		socialStorage: &SocialStorage{
			dataDir: dataDir + "/social",
		},
		socialRewards: &SocialRewards{
			rewardRates: map[string]uint32{
				"follow":  10, // 10 NERD for following
				"like":    1,  // 1 NERD for liking
				"comment": 5,  // 5 NERD for commenting
				"share":   15, // 15 NERD for sharing
				"tip":     0,  // Variable NERD for tipping
				"viral":   50, // 50 NERD bonus for viral content
			},
		},
	}

	// Initialize handlers
	social.initializeHandlers()

	return social
}

// Start initializes the BSV Social Protocol system
func (s *BSVSocialSystem) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.running {
		return fmt.Errorf("BSV Social Protocol system is already running")
	}

	// Create social data directory
	err := os.MkdirAll(s.socialStorage.dataDir, 0755)
	if err != nil {
		return fmt.Errorf("failed to create social data directory: %v", err)
	}

	// Load existing social data
	err = s.loadSocialData()
	if err != nil {
		log.Printf("Warning: Failed to load existing social data: %v", err)
	}

	s.running = true
	log.Println("BSV Social Protocol system started successfully")

	return nil
}

// Stop shuts down the BSV Social Protocol system
func (s *BSVSocialSystem) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.running {
		return nil
	}

	// Save social data
	err := s.saveSocialData()
	if err != nil {
		log.Printf("Warning: Failed to save social data: %v", err)
	}

	s.running = false
	log.Println("BSV Social Protocol system stopped")

	return nil
}

// ProcessSocialMessage processes incoming social protocol messages
func (s *BSVSocialSystem) ProcessSocialMessage(msgType uint32, payload []byte) error {
	s.mu.RLock()
	if !s.running {
		s.mu.RUnlock()
		return fmt.Errorf("BSV Social Protocol system is not running")
	}
	s.mu.RUnlock()

	switch msgType {
	case SocialFollowMsgType:
		var msg messages.SocialFollowMsg
		if err := proto.Unmarshal(payload, &msg); err != nil {
			return fmt.Errorf("failed to unmarshal SocialFollowMsg: %v", err)
		}
		return s.handleFollowMessage(&msg)

	case SocialCommentMsgType:
		var msg messages.SocialCommentMsg
		if err := proto.Unmarshal(payload, &msg); err != nil {
			return fmt.Errorf("failed to unmarshal SocialCommentMsg: %v", err)
		}
		return s.handleCommentMessage(&msg)

	case SocialReactionMsgType:
		var msg messages.SocialReactionMsg
		if err := proto.Unmarshal(payload, &msg); err != nil {
			return fmt.Errorf("failed to unmarshal SocialReactionMsg: %v", err)
		}
		return s.handleReactionMessage(&msg)

	case SocialShareMsgType:
		var msg messages.SocialShareMsg
		if err := proto.Unmarshal(payload, &msg); err != nil {
			return fmt.Errorf("failed to unmarshal SocialShareMsg: %v", err)
		}
		return s.handleShareMessage(&msg)

	case SocialNotificationMsgType:
		var msg messages.SocialNotificationMsg
		if err := proto.Unmarshal(payload, &msg); err != nil {
			return fmt.Errorf("failed to unmarshal SocialNotificationMsg: %v", err)
		}
		return s.handleNotificationMessage(&msg)

	case SocialDirectMsgType:
		var msg messages.SocialDirectMsg
		if err := proto.Unmarshal(payload, &msg); err != nil {
			return fmt.Errorf("failed to unmarshal SocialDirectMsg: %v", err)
		}
		return s.handleDirectMessage(&msg)

	case SocialProfileMsgType:
		var msg messages.SocialProfileMsg
		if err := proto.Unmarshal(payload, &msg); err != nil {
			return fmt.Errorf("failed to unmarshal SocialProfileMsg: %v", err)
		}
		return s.handleProfileMessage(&msg)

	case SocialStatusMsgType:
		var msg messages.SocialStatusMsg
		if err := proto.Unmarshal(payload, &msg); err != nil {
			return fmt.Errorf("failed to unmarshal SocialStatusMsg: %v", err)
		}
		return s.handleStatusMessage(&msg)

	case SocialDiscoveryMsgType:
		var msg messages.SocialDiscoveryMsg
		if err := proto.Unmarshal(payload, &msg); err != nil {
			return fmt.Errorf("failed to unmarshal SocialDiscoveryMsg: %v", err)
		}
		return s.handleDiscoveryMessage(&msg)

	default:
		return fmt.Errorf("unknown social message type: %d", msgType)
	}
}

// Social message handlers
func (s *BSVSocialSystem) handleFollowMessage(msg *messages.SocialFollowMsg) error {
	// Verify BSV signature
	if !s.verifyBSVSignature(msg.FollowerAddress, msg.BsvSignature, s.createFollowSignatureData(msg)) {
		return fmt.Errorf("invalid BSV signature for follow message")
	}

	creatorAddr := string(msg.CreatorAddress)
	followerAddr := string(msg.FollowerAddress)

	s.socialGraph.mu.Lock()
	defer s.socialGraph.mu.Unlock()

	if msg.IsFollow {
		// Add follow relationship
		s.socialGraph.following[creatorAddr] = append(s.socialGraph.following[creatorAddr], followerAddr)
		s.socialGraph.followers[followerAddr] = append(s.socialGraph.followers[followerAddr], creatorAddr)

		// Reward NERD tokens for following
		s.rewardNERDTokens(followerAddr, "follow")

		log.Printf("Social: %s followed %s", followerAddr, creatorAddr)
	} else {
		// Remove follow relationship
		s.socialGraph.following[creatorAddr] = removeFromSlice(s.socialGraph.following[creatorAddr], followerAddr)
		s.socialGraph.followers[followerAddr] = removeFromSlice(s.socialGraph.followers[followerAddr], creatorAddr)

		log.Printf("Social: %s unfollowed %s", followerAddr, creatorAddr)
	}

	// Update creator follower count
	if profile, exists := s.socialGraph.profiles[creatorAddr]; exists {
		profile.FollowerCount = uint32(len(s.socialGraph.following[creatorAddr]))
	}

	return nil
}

func (s *BSVSocialSystem) handleCommentMessage(msg *messages.SocialCommentMsg) error {
	// Verify BSV signature
	if !s.verifyBSVSignature(msg.CommenterAddress, msg.BsvSignature, s.createCommentSignatureData(msg)) {
		return fmt.Errorf("invalid BSV signature for comment message")
	}

	contentAddr := string(msg.ContentAddress)
	comment := SocialComment{
		CommenterAddress: string(msg.CommenterAddress),
		ContentAddress:   contentAddr,
		CommentText:      msg.CommentText,
		Timestamp:        time.Unix(int64(msg.Timestamp), 0),
		ParentCommentID:  string(msg.ParentCommentId),
		NERDTip:          msg.NerdTip,
	}

	s.socialGraph.mu.Lock()
	s.socialGraph.contentComments[contentAddr] = append(s.socialGraph.contentComments[contentAddr], comment)
	s.socialGraph.mu.Unlock()

	// Reward NERD tokens for commenting
	s.rewardNERDTokens(comment.CommenterAddress, "comment")

	// If there's a NERD tip, handle it
	if msg.NerdTip > 0 {
		s.rewardNERDTokens(comment.CommenterAddress, "tip")
	}

	log.Printf("Social: Comment on %s by %s", contentAddr, comment.CommenterAddress)
	return nil
}

func (s *BSVSocialSystem) handleReactionMessage(msg *messages.SocialReactionMsg) error {
	// Verify BSV signature
	if !s.verifyBSVSignature(msg.ReactorAddress, msg.BsvSignature, s.createReactionSignatureData(msg)) {
		return fmt.Errorf("invalid BSV signature for reaction message")
	}

	contentAddr := string(msg.ContentAddress)
	reactorAddr := string(msg.ReactorAddress)

	s.socialGraph.mu.Lock()
	defer s.socialGraph.mu.Unlock()

	if s.socialGraph.contentLikes[contentAddr] == nil {
		s.socialGraph.contentLikes[contentAddr] = make(map[string]bool)
	}

	if msg.IsRemoval {
		delete(s.socialGraph.contentLikes[contentAddr], reactorAddr)
		log.Printf("Social: %s removed %s from %s", reactorAddr, msg.ReactionType, contentAddr)
	} else {
		s.socialGraph.contentLikes[contentAddr][reactorAddr] = true
		// Reward NERD tokens for reacting
		s.rewardNERDTokens(reactorAddr, "like")
		log.Printf("Social: %s reacted %s to %s", reactorAddr, msg.ReactionType, contentAddr)
	}

	return nil
}

func (s *BSVSocialSystem) handleShareMessage(msg *messages.SocialShareMsg) error {
	// Verify BSV signature
	if !s.verifyBSVSignature(msg.SharerAddress, msg.BsvSignature, s.createShareSignatureData(msg)) {
		return fmt.Errorf("invalid BSV signature for share message")
	}

	contentAddr := string(msg.ContentAddress)
	share := SocialShare{
		SharerAddress:  string(msg.SharerAddress),
		ContentAddress: contentAddr,
		ShareMessage:   msg.ShareMessage,
		Timestamp:      time.Unix(int64(msg.Timestamp), 0),
		ViralReward:    msg.ViralReward,
	}

	s.socialGraph.mu.Lock()
	s.socialGraph.contentShares[contentAddr] = append(s.socialGraph.contentShares[contentAddr], share)
	s.socialGraph.mu.Unlock()

	// Reward NERD tokens for sharing
	s.rewardNERDTokens(share.SharerAddress, "share")

	// If viral reward, give bonus
	if msg.ViralReward > 0 {
		s.rewardNERDTokens(share.SharerAddress, "viral")
	}

	log.Printf("Social: Content %s shared by %s", contentAddr, share.SharerAddress)
	return nil
}

// Additional handler implementations...
func (s *BSVSocialSystem) handleNotificationMessage(msg *messages.SocialNotificationMsg) error {
	// Implementation for notification handling
	log.Printf("Social: Notification from %s to %s: %s", string(msg.SenderAddress), string(msg.RecipientAddress), msg.Message)
	return nil
}

func (s *BSVSocialSystem) handleDirectMessage(msg *messages.SocialDirectMsg) error {
	// Implementation for direct messaging
	log.Printf("Social: Direct message from %s to %s", string(msg.SenderAddress), string(msg.RecipientAddress))
	return nil
}

func (s *BSVSocialSystem) handleProfileMessage(msg *messages.SocialProfileMsg) error {
	// Verify BSV signature
	if !s.verifyBSVSignature(msg.CreatorAddress, msg.BsvSignature, s.createProfileSignatureData(msg)) {
		return fmt.Errorf("invalid BSV signature for profile message")
	}

	creatorAddr := string(msg.CreatorAddress)
	profile := &CreatorProfile{
		CreatorAddress: creatorAddr,
		DisplayName:    msg.DisplayName,
		Bio:            msg.Bio,
		AvatarHash:     msg.AvatarHash,
		BannerHash:     msg.BannerHash,
		SocialLinks:    msg.SocialLinks,
		LastUpdated:    time.Unix(int64(msg.Timestamp), 0),
		ContentCount:   msg.ContentCount,
		TotalEarnings:  msg.TotalEarnings,
		FollowerCount:  msg.FollowerCount,
	}

	s.socialGraph.mu.Lock()
	s.socialGraph.profiles[creatorAddr] = profile
	s.socialGraph.mu.Unlock()

	log.Printf("Social: Profile updated for %s", creatorAddr)
	return nil
}

func (s *BSVSocialSystem) handleStatusMessage(msg *messages.SocialStatusMsg) error {
	// Implementation for status updates
	log.Printf("Social: Status update from %s: %s (%s)", string(msg.CreatorAddress), msg.StatusText, msg.StatusType)
	return nil
}

func (s *BSVSocialSystem) handleDiscoveryMessage(msg *messages.SocialDiscoveryMsg) error {
	// Implementation for content discovery
	log.Printf("Social: Discovery request from %s, type: %s", string(msg.RequesterAddress), msg.DiscoveryType)
	return nil
}

// Helper functions
func (s *BSVSocialSystem) initializeHandlers() {
	// Initialize default handlers
	s.followHandler = func(msg *messages.SocialFollowMsg) {}
	s.commentHandler = func(msg *messages.SocialCommentMsg) {}
	s.reactionHandler = func(msg *messages.SocialReactionMsg) {}
	s.shareHandler = func(msg *messages.SocialShareMsg) {}
	s.notificationHandler = func(msg *messages.SocialNotificationMsg) {}
	s.directMsgHandler = func(msg *messages.SocialDirectMsg) {}
	s.profileHandler = func(msg *messages.SocialProfileMsg) {}
	s.statusHandler = func(msg *messages.SocialStatusMsg) {}
	s.discoveryHandler = func(msg *messages.SocialDiscoveryMsg) {}
}

func (s *BSVSocialSystem) verifyBSVSignature(address []byte, signature []byte, data []byte) bool {
	// For now, return true - in production this would verify BSV signatures
	// TODO: Implement actual BSV signature verification
	return true
}

func (s *BSVSocialSystem) createFollowSignatureData(msg *messages.SocialFollowMsg) []byte {
	data := fmt.Sprintf("follow:%s:%s:%t:%d", string(msg.CreatorAddress), string(msg.FollowerAddress), msg.IsFollow, msg.Timestamp)
	hash := sha256.Sum256([]byte(data))
	return hash[:]
}

func (s *BSVSocialSystem) createCommentSignatureData(msg *messages.SocialCommentMsg) []byte {
	data := fmt.Sprintf("comment:%s:%s:%s:%d", string(msg.ContentAddress), string(msg.CommenterAddress), msg.CommentText, msg.Timestamp)
	hash := sha256.Sum256([]byte(data))
	return hash[:]
}

func (s *BSVSocialSystem) createReactionSignatureData(msg *messages.SocialReactionMsg) []byte {
	data := fmt.Sprintf("reaction:%s:%s:%s:%t:%d", string(msg.ContentAddress), string(msg.ReactorAddress), msg.ReactionType, msg.IsRemoval, msg.Timestamp)
	hash := sha256.Sum256([]byte(data))
	return hash[:]
}

func (s *BSVSocialSystem) createShareSignatureData(msg *messages.SocialShareMsg) []byte {
	data := fmt.Sprintf("share:%s:%s:%s:%d", string(msg.ContentAddress), string(msg.SharerAddress), msg.ShareMessage, msg.Timestamp)
	hash := sha256.Sum256([]byte(data))
	return hash[:]
}

func (s *BSVSocialSystem) createProfileSignatureData(msg *messages.SocialProfileMsg) []byte {
	data := fmt.Sprintf("profile:%s:%s:%s:%d", string(msg.CreatorAddress), msg.DisplayName, msg.Bio, msg.Timestamp)
	hash := sha256.Sum256([]byte(data))
	return hash[:]
}

func (s *BSVSocialSystem) rewardNERDTokens(address string, actionType string) {
	s.socialRewards.mu.RLock()
	reward, exists := s.socialRewards.rewardRates[actionType]
	s.socialRewards.mu.RUnlock()

	if exists && reward > 0 {
		log.Printf("Social: Rewarding %d NERD tokens to %s for %s", reward, address, actionType)
		// TODO: Integrate with actual NERD token system
	}
}

func (s *BSVSocialSystem) loadSocialData() error {
	// TODO: Implement loading social data from persistent storage
	return nil
}

func (s *BSVSocialSystem) saveSocialData() error {
	// TODO: Implement saving social data to persistent storage
	return nil
}

// Utility functions
func removeFromSlice(slice []string, item string) []string {
	for i, v := range slice {
		if v == item {
			return append(slice[:i], slice[i+1:]...)
		}
	}
	return slice
}

// Public API methods for social features
func (s *BSVSocialSystem) GetFollowers(creatorAddress string) []string {
	s.socialGraph.mu.RLock()
	defer s.socialGraph.mu.RUnlock()

	followers := s.socialGraph.following[creatorAddress]
	result := make([]string, len(followers))
	copy(result, followers)
	return result
}

func (s *BSVSocialSystem) GetFollowing(userAddress string) []string {
	s.socialGraph.mu.RLock()
	defer s.socialGraph.mu.RUnlock()

	following := s.socialGraph.followers[userAddress]
	result := make([]string, len(following))
	copy(result, following)
	return result
}

func (s *BSVSocialSystem) GetContentLikes(contentAddress string) int {
	s.socialGraph.mu.RLock()
	defer s.socialGraph.mu.RUnlock()

	likes := s.socialGraph.contentLikes[contentAddress]
	return len(likes)
}

func (s *BSVSocialSystem) GetContentComments(contentAddress string) []SocialComment {
	s.socialGraph.mu.RLock()
	defer s.socialGraph.mu.RUnlock()

	comments := s.socialGraph.contentComments[contentAddress]
	result := make([]SocialComment, len(comments))
	copy(result, comments)
	return result
}

func (s *BSVSocialSystem) GetCreatorProfile(creatorAddress string) *CreatorProfile {
	s.socialGraph.mu.RLock()
	defer s.socialGraph.mu.RUnlock()

	profile := s.socialGraph.profiles[creatorAddress]
	if profile == nil {
		return nil
	}

	// Return a copy
	result := *profile
	return &result
}

// GetStats returns social protocol statistics
func (s *BSVSocialSystem) GetStats() map[string]interface{} {
	s.socialGraph.mu.RLock()
	defer s.socialGraph.mu.RUnlock()

	totalFollows := 0
	for _, followers := range s.socialGraph.following {
		totalFollows += len(followers)
	}

	totalLikes := 0
	for _, likes := range s.socialGraph.contentLikes {
		totalLikes += len(likes)
	}

	totalComments := 0
	for _, comments := range s.socialGraph.contentComments {
		totalComments += len(comments)
	}

	totalShares := 0
	for _, shares := range s.socialGraph.contentShares {
		totalShares += len(shares)
	}

	return map[string]interface{}{
		"total_follows":  totalFollows,
		"total_likes":    totalLikes,
		"total_comments": totalComments,
		"total_shares":   totalShares,
		"total_profiles": len(s.socialGraph.profiles),
		"running":        s.running,
	}
}
