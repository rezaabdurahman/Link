package service

import (
	"fmt"
	"math"
	"time"

	"github.com/link-app/discovery-svc/internal/models"
	"github.com/link-app/discovery-svc/internal/repository"
)

// RankingService handles ranking algorithm calculations
type RankingService struct {
	configRepo *repository.RankingConfigRepository
}

// NewRankingService creates a new ranking service
func NewRankingService(configRepo *repository.RankingConfigRepository) *RankingService {
	return &RankingService{
		configRepo: configRepo,
	}
}

// CalculateRanking calculates the ranking score using the v1 algorithm:
// Score = 0.6 · semantic_similarity + 0.2 · interest_overlap + 0.1 · geo_proximity + 0.1 · recent_activity
func (s *RankingService) CalculateRanking(input *models.RankingInput, requesterInterests *models.UserInterests, requesterLocation *models.GeoLocation) (*models.RankingResult, error) {
	// Get current weights from config
	weights, err := s.configRepo.GetRankingWeights()
	if err != nil {
		return nil, fmt.Errorf("failed to get ranking weights: %w", err)
	}

	result := &models.RankingResult{
		UserID:             input.UserID,
		SemanticSimilarity: input.SemanticSimilarity,
	}

	// Calculate interest overlap (Jaccard coefficient)
	result.InterestOverlap = s.calculateInterestOverlap(input.InterestBitset, requesterInterests)

	// Calculate geographical proximity (normalized within 10 mi radius)
	result.GeoProximity = s.calculateGeoProximity(input.Latitude, input.Longitude, requesterLocation)

	// Calculate recent activity (inverse of minutes since last heartbeat)
	result.RecentActivity, result.LastHeartbeatMinutes = s.calculateRecentActivity(input.LastAvailableAt)

	// Calculate total weighted score
	result.TotalScore = (weights.SemanticSimilarity * result.SemanticSimilarity) +
		(weights.InterestOverlap * result.InterestOverlap) +
		(weights.GeoProximity * result.GeoProximity) +
		(weights.RecentActivity * result.RecentActivity)

	return result, nil
}

// CalculateBatchRanking calculates rankings for multiple users efficiently
func (s *RankingService) CalculateBatchRanking(inputs []models.RankingInput, requesterInterests *models.UserInterests, requesterLocation *models.GeoLocation) ([]models.RankingResult, error) {
	results := make([]models.RankingResult, len(inputs))

	// Get weights once for the entire batch
	weights, err := s.configRepo.GetRankingWeights()
	if err != nil {
		return nil, fmt.Errorf("failed to get ranking weights: %w", err)
	}

	for i, input := range inputs {
		result := models.RankingResult{
			UserID:             input.UserID,
			SemanticSimilarity: input.SemanticSimilarity,
		}

		// Calculate components
		result.InterestOverlap = s.calculateInterestOverlap(input.InterestBitset, requesterInterests)
		result.GeoProximity = s.calculateGeoProximity(input.Latitude, input.Longitude, requesterLocation)
		result.RecentActivity, result.LastHeartbeatMinutes = s.calculateRecentActivity(input.LastAvailableAt)

		// Calculate total weighted score
		result.TotalScore = (weights.SemanticSimilarity * result.SemanticSimilarity) +
			(weights.InterestOverlap * result.InterestOverlap) +
			(weights.GeoProximity * result.GeoProximity) +
			(weights.RecentActivity * result.RecentActivity)

		results[i] = result
	}

	return results, nil
}

// calculateInterestOverlap computes Jaccard coefficient between interest bitsets
func (s *RankingService) calculateInterestOverlap(userBitset []byte, requesterInterests *models.UserInterests) float64 {
	if requesterInterests == nil || len(requesterInterests.Bitset) == 0 || len(userBitset) == 0 {
		return 0.0
	}

	// Ensure bitsets are the same length (pad with zeros if needed)
	maxLen := len(userBitset)
	if len(requesterInterests.Bitset) > maxLen {
		maxLen = len(requesterInterests.Bitset)
	}

	// Pad bitsets to same length
	user := make([]byte, maxLen)
	requester := make([]byte, maxLen)
	copy(user, userBitset)
	copy(requester, requesterInterests.Bitset)

	// Calculate Jaccard coefficient: |A ∩ B| / |A ∪ B|
	intersectionCount := 0
	unionCount := 0

	for i := 0; i < maxLen; i++ {
		for bit := 0; bit < 8; bit++ {
			userBit := (user[i] >> bit) & 1
			requesterBit := (requester[i] >> bit) & 1

			if userBit == 1 && requesterBit == 1 {
				intersectionCount++
			}
			if userBit == 1 || requesterBit == 1 {
				unionCount++
			}
		}
	}

	if unionCount == 0 {
		return 0.0
	}

	return float64(intersectionCount) / float64(unionCount)
}

// calculateGeoProximity normalizes distance within 10-mile radius
func (s *RankingService) calculateGeoProximity(userLat, userLng *float64, requesterLocation *models.GeoLocation) float64 {
	if userLat == nil || userLng == nil || requesterLocation == nil {
		return 0.0
	}

	// Calculate distance using Haversine formula
	distance := s.calculateHaversineDistance(*userLat, *userLng, requesterLocation.Latitude, requesterLocation.Longitude)

	// Normalize within 10-mile radius (16.09 km)
	maxDistanceKm := 16.09
	if distance >= maxDistanceKm {
		return 0.0
	}

	// Linear decay: closer = higher score
	return math.Max(0.0, 1.0-(distance/maxDistanceKm))
}

// calculateHaversineDistance computes the great-circle distance between two points in kilometers
func (s *RankingService) calculateHaversineDistance(lat1, lng1, lat2, lng2 float64) float64 {
	const earthRadiusKm = 6371.0

	// Convert latitude and longitude from degrees to radians
	lat1Rad := lat1 * math.Pi / 180
	lng1Rad := lng1 * math.Pi / 180
	lat2Rad := lat2 * math.Pi / 180
	lng2Rad := lng2 * math.Pi / 180

	// Haversine formula
	dLat := lat2Rad - lat1Rad
	dLng := lng2Rad - lng1Rad

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1Rad)*math.Cos(lat2Rad)*
			math.Sin(dLng/2)*math.Sin(dLng/2)

	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return earthRadiusKm * c
}

// calculateRecentActivity computes inverse of minutes since last heartbeat
func (s *RankingService) calculateRecentActivity(lastAvailableAt *time.Time) (float64, int) {
	if lastAvailableAt == nil {
		return 0.0, -1 // No activity recorded
	}

	now := time.Now()
	minutes := int(now.Sub(*lastAvailableAt).Minutes())

	if minutes < 0 {
		minutes = 0 // Handle clock skew
	}

	// Recent activity score: higher for more recent activity
	// Use exponential decay with 60-minute half-life
	if minutes == 0 {
		return 1.0, 0
	}

	// Decay function: score = e^(-minutes/60)
	// This gives a score of ~0.5 at 60 minutes, ~0.25 at 120 minutes, etc.
	score := math.Exp(-float64(minutes) / 60.0)

	// Cap at 0.01 to avoid very small numbers
	if score < 0.01 {
		score = 0.01
	}

	return score, minutes
}

// GetCurrentWeights returns the current ranking weights
func (s *RankingService) GetCurrentWeights() (*models.RankingWeights, error) {
	return s.configRepo.GetRankingWeights()
}

// UpdateWeights updates the ranking weights with validation
func (s *RankingService) UpdateWeights(req *models.UpdateRankingConfigRequest) (*models.RankingWeights, error) {
	// Get current weights for validation
	current, err := s.configRepo.GetRankingWeights()
	if err != nil {
		return nil, fmt.Errorf("failed to get current weights: %w", err)
	}

	// Validate the request
	if err := req.Validate(current); err != nil {
		return nil, err
	}

	// Update in database
	return s.configRepo.UpdateRankingWeights(req)
}

// ResetWeightsToDefaults resets all weights to their default values
func (s *RankingService) ResetWeightsToDefaults() (*models.RankingWeights, error) {
	return s.configRepo.ResetToDefaults()
}

// GetAllConfigs returns all ranking configuration entries for debugging/admin
func (s *RankingService) GetAllConfigs() ([]models.RankingConfig, error) {
	return s.configRepo.GetAllConfigs()
}

// ValidateWeightsSum ensures current weights sum to approximately 1.0
func (s *RankingService) ValidateWeightsSum() error {
	weights, err := s.configRepo.GetRankingWeights()
	if err != nil {
		return fmt.Errorf("failed to get weights: %w", err)
	}

	total := weights.SemanticSimilarity + weights.InterestOverlap + weights.GeoProximity + weights.RecentActivity

	if total < 0.99 || total > 1.01 {
		return fmt.Errorf("ranking weights sum to %.3f, expected ~1.0", total)
	}

	return nil
}
