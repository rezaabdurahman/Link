package repository

import (
	"fmt"

	"github.com/link-app/discovery-svc/internal/models"
	"gorm.io/gorm"
)

// RankingConfigRepository handles database operations for ranking configuration
type RankingConfigRepository struct {
	db *gorm.DB
}

// NewRankingConfigRepository creates a new ranking config repository
func NewRankingConfigRepository(db *gorm.DB) *RankingConfigRepository {
	return &RankingConfigRepository{
		db: db,
	}
}

// GetRankingWeights retrieves the current ranking weights from the database
func (r *RankingConfigRepository) GetRankingWeights() (*models.RankingWeights, error) {
	// Define the config keys we need
	configKeys := []string{
		"semantic_similarity_weight",
		"interest_overlap_weight",
		"geo_proximity_weight",
		"recent_activity_weight",
	}

	// Fetch all configs in one query
	var configs []models.RankingConfig
	err := r.db.Where("config_key IN ?", configKeys).Find(&configs).Error
	if err != nil {
		return nil, fmt.Errorf("failed to fetch ranking config: %w", err)
	}

	// If no configs found, return defaults
	if len(configs) == 0 {
		return models.DefaultRankingWeights(), nil
	}

	// Build weights from configs
	weights := models.DefaultRankingWeights() // Start with defaults
	for _, config := range configs {
		switch config.ConfigKey {
		case "semantic_similarity_weight":
			weights.SemanticSimilarity = config.ConfigValue
		case "interest_overlap_weight":
			weights.InterestOverlap = config.ConfigValue
		case "geo_proximity_weight":
			weights.GeoProximity = config.ConfigValue
		case "recent_activity_weight":
			weights.RecentActivity = config.ConfigValue
		}
	}

	return weights, nil
}

// UpdateRankingWeights updates the ranking weights in the database
func (r *RankingConfigRepository) UpdateRankingWeights(req *models.UpdateRankingConfigRequest) (*models.RankingWeights, error) {
	// Start a transaction to ensure atomicity
	tx := r.db.Begin()
	if tx.Error != nil {
		return nil, fmt.Errorf("failed to start transaction: %w", tx.Error)
	}
	defer tx.Rollback()

	// Update each weight if provided
	updates := map[string]*float64{
		"semantic_similarity_weight": req.SemanticSimilarityWeight,
		"interest_overlap_weight":    req.InterestOverlapWeight,
		"geo_proximity_weight":       req.GeoProximityWeight,
		"recent_activity_weight":     req.RecentActivityWeight,
	}

	for configKey, value := range updates {
		if value != nil {
			err := tx.Model(&models.RankingConfig{}).
				Where("config_key = ?", configKey).
				Update("config_value", *value).Error
			if err != nil {
				return nil, fmt.Errorf("failed to update config %s: %w", configKey, err)
			}
		}
	}

	// Commit the transaction
	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Return the updated weights
	return r.GetRankingWeights()
}

// GetAllConfigs retrieves all ranking configuration entries
func (r *RankingConfigRepository) GetAllConfigs() ([]models.RankingConfig, error) {
	var configs []models.RankingConfig
	err := r.db.Order("config_key").Find(&configs).Error
	if err != nil {
		return nil, fmt.Errorf("failed to fetch all ranking configs: %w", err)
	}
	return configs, nil
}

// GetConfigByKey retrieves a specific configuration by key
func (r *RankingConfigRepository) GetConfigByKey(key string) (*models.RankingConfig, error) {
	var config models.RankingConfig
	err := r.db.Where("config_key = ?", key).First(&config).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to fetch config %s: %w", key, err)
	}
	return &config, nil
}

// UpsertConfig creates or updates a configuration entry
func (r *RankingConfigRepository) UpsertConfig(key string, value float64, description string) (*models.RankingConfig, error) {
	config := &models.RankingConfig{
		ConfigKey:   key,
		ConfigValue: value,
		Description: description,
	}

	err := r.db.Where("config_key = ?", key).FirstOrCreate(config).Error
	if err != nil {
		return nil, fmt.Errorf("failed to upsert config %s: %w", key, err)
	}

	// If it existed, update the value and description
	if config.ConfigValue != value || config.Description != description {
		config.ConfigValue = value
		config.Description = description
		err = r.db.Save(config).Error
		if err != nil {
			return nil, fmt.Errorf("failed to update config %s: %w", key, err)
		}
	}

	return config, nil
}

// ResetToDefaults resets all ranking weights to their default values
func (r *RankingConfigRepository) ResetToDefaults() (*models.RankingWeights, error) {
	defaults := models.DefaultRankingWeights()
	
	// Start a transaction
	tx := r.db.Begin()
	if tx.Error != nil {
		return nil, fmt.Errorf("failed to start transaction: %w", tx.Error)
	}
	defer tx.Rollback()

	// Update each weight to default
	updates := map[string]float64{
		"semantic_similarity_weight": defaults.SemanticSimilarity,
		"interest_overlap_weight":    defaults.InterestOverlap,
		"geo_proximity_weight":       defaults.GeoProximity,
		"recent_activity_weight":     defaults.RecentActivity,
	}

	for configKey, value := range updates {
		err := tx.Model(&models.RankingConfig{}).
			Where("config_key = ?", configKey).
			Update("config_value", value).Error
		if err != nil {
			return nil, fmt.Errorf("failed to reset config %s: %w", configKey, err)
		}
	}

	// Commit the transaction
	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return defaults, nil
}
