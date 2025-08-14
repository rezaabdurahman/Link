package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// RankingConfig represents a ranking algorithm configuration parameter
type RankingConfig struct {
	ID          uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	ConfigKey   string         `json:"config_key" gorm:"type:varchar(100);not null;unique;index"`
	ConfigValue float64        `json:"config_value" gorm:"type:decimal(3,2);not null"`
	Description string         `json:"description" gorm:"type:text"`
	CreatedAt   time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt   time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
}

// TableName returns the table name for the RankingConfig model
func (RankingConfig) TableName() string {
	return "ranking_config"
}

// BeforeCreate sets up the ranking config before creating
func (rc *RankingConfig) BeforeCreate(tx *gorm.DB) error {
	if rc.ID == uuid.Nil {
		rc.ID = uuid.New()
	}
	return nil
}

// RankingWeights represents the weights used in the ranking algorithm
type RankingWeights struct {
	SemanticSimilarity float64 `json:"semantic_similarity"`
	InterestOverlap    float64 `json:"interest_overlap"`
	GeoProximity       float64 `json:"geo_proximity"`
	RecentActivity     float64 `json:"recent_activity"`
}

// DefaultRankingWeights returns the default weights as specified in the task
func DefaultRankingWeights() *RankingWeights {
	return &RankingWeights{
		SemanticSimilarity: 0.6,
		InterestOverlap:    0.2,
		GeoProximity:       0.1,
		RecentActivity:     0.1,
	}
}

// RankingResult represents the result of ranking calculation
type RankingResult struct {
	UserID               uuid.UUID `json:"user_id"`
	TotalScore           float64   `json:"total_score"`
	SemanticSimilarity   float64   `json:"semantic_similarity"`
	InterestOverlap      float64   `json:"interest_overlap"`
	GeoProximity         float64   `json:"geo_proximity"`
	RecentActivity       float64   `json:"recent_activity"`
	LastHeartbeatMinutes int       `json:"last_heartbeat_minutes"`
}

// RankingInput represents the input data for ranking calculation
type RankingInput struct {
	UserID               uuid.UUID  `json:"user_id"`
	SemanticSimilarity   float64    `json:"semantic_similarity"`
	InterestBitset       []byte     `json:"interest_bitset,omitempty"`
	Latitude             *float64   `json:"latitude,omitempty"`
	Longitude            *float64   `json:"longitude,omitempty"`
	LastAvailableAt      *time.Time `json:"last_available_at,omitempty"`
}

// UserInterests represents user interests for overlap calculation
type UserInterests struct {
	UserID   uuid.UUID `json:"user_id"`
	Bitset   []byte    `json:"bitset"`
	Interests []string  `json:"interests,omitempty"` // Human-readable list for debugging
}

// GeoLocation represents geographical coordinates
type GeoLocation struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

// SearchRankingRequest represents enhanced search request with ranking context
type SearchRankingRequest struct {
	Query            string          `json:"query"`
	UserIDs          []uuid.UUID     `json:"user_ids"`
	RequesterInterests *UserInterests `json:"requester_interests,omitempty"`
	RequesterLocation *GeoLocation   `json:"requester_location,omitempty"`
	Limit            *int            `json:"limit,omitempty"`
}

// EnhancedSearchResult includes detailed ranking information
type EnhancedSearchResult struct {
	UserID         uuid.UUID      `json:"user_id"`
	Score          float64        `json:"score"`
	MatchReasons   []string       `json:"match_reasons,omitempty"`
	RankingDetails *RankingResult `json:"ranking_details,omitempty"`
}

// UpdateRankingConfigRequest represents a request to update ranking configuration
type UpdateRankingConfigRequest struct {
	SemanticSimilarityWeight *float64 `json:"semantic_similarity_weight,omitempty" binding:"omitempty,min=0,max=1"`
	InterestOverlapWeight    *float64 `json:"interest_overlap_weight,omitempty" binding:"omitempty,min=0,max=1"`
	GeoProximityWeight       *float64 `json:"geo_proximity_weight,omitempty" binding:"omitempty,min=0,max=1"`
	RecentActivityWeight     *float64 `json:"recent_activity_weight,omitempty" binding:"omitempty,min=0,max=1"`
}

// Validate ensures the weights sum to 1.0 (or close to it)
func (req *UpdateRankingConfigRequest) Validate(current *RankingWeights) error {
	// Calculate what the new weights would be
	newWeights := &RankingWeights{
		SemanticSimilarity: current.SemanticSimilarity,
		InterestOverlap:    current.InterestOverlap,
		GeoProximity:       current.GeoProximity,
		RecentActivity:     current.RecentActivity,
	}

	if req.SemanticSimilarityWeight != nil {
		newWeights.SemanticSimilarity = *req.SemanticSimilarityWeight
	}
	if req.InterestOverlapWeight != nil {
		newWeights.InterestOverlap = *req.InterestOverlapWeight
	}
	if req.GeoProximityWeight != nil {
		newWeights.GeoProximity = *req.GeoProximityWeight
	}
	if req.RecentActivityWeight != nil {
		newWeights.RecentActivity = *req.RecentActivityWeight
	}

	total := newWeights.SemanticSimilarity + newWeights.InterestOverlap + newWeights.GeoProximity + newWeights.RecentActivity
	
	// Allow some tolerance (0.01) for floating point precision
	if total < 0.99 || total > 1.01 {
		return &ValidationError{
			Field:   "weights",
			Message: "ranking weights must sum to approximately 1.0",
		}
	}

	return nil
}

// ValidationError represents a validation error
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

func (e *ValidationError) Error() string {
	return e.Message
}
