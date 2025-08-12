package repository

import (
	"fmt"

	"github.com/google/uuid"
	"github.com/link-app/backend/location-svc/internal/models"
	"gorm.io/gorm"
)

// LocationRepository interface defines location data operations
type LocationRepository interface {
	CreateLocation(location *models.UserLocation) error
	UpdateLocation(userID uuid.UUID, location *models.UserLocation) error
	GetCurrentLocation(userID uuid.UUID) (*models.UserLocation, error)
	GetLocationHistory(userID uuid.UUID, limit int) ([]models.UserLocation, error)
	GetNearbyUsers(lat, lon float64, radiusMeters int, limit int, excludeUserID uuid.UUID) ([]NearbyUser, error)
	SetCurrentLocation(userID uuid.UUID, locationID uuid.UUID) error
	ClearOldLocations(userID uuid.UUID) error
}

// NearbyUser represents a user found in proximity search
type NearbyUser struct {
	UserID           uuid.UUID
	Latitude         float64
	Longitude        float64
	DistanceMeters   float64
	LastSeenAt       string
	LocationID       uuid.UUID
}

type locationRepository struct {
	db *gorm.DB
}

// NewLocationRepository creates a new location repository
func NewLocationRepository(db *gorm.DB) LocationRepository {
	return &locationRepository{
		db: db,
	}
}

// CreateLocation creates a new location record
func (r *locationRepository) CreateLocation(location *models.UserLocation) error {
	// Clear current flag for other locations
	if location.IsCurrent {
		if err := r.ClearOldLocations(location.UserID); err != nil {
			return fmt.Errorf("failed to clear old locations: %w", err)
		}
	}

	if err := r.db.Create(location).Error; err != nil {
		return fmt.Errorf("failed to create location: %w", err)
	}

	return nil
}

// UpdateLocation updates an existing location record
func (r *locationRepository) UpdateLocation(userID uuid.UUID, location *models.UserLocation) error {
	location.UserID = userID
	
	// Clear current flag for other locations if this is being set as current
	if location.IsCurrent {
		if err := r.ClearOldLocations(userID); err != nil {
			return fmt.Errorf("failed to clear old locations: %w", err)
		}
	}

	if err := r.db.Save(location).Error; err != nil {
		return fmt.Errorf("failed to update location: %w", err)
	}

	return nil
}

// GetCurrentLocation retrieves the current location for a user
func (r *locationRepository) GetCurrentLocation(userID uuid.UUID) (*models.UserLocation, error) {
	var location models.UserLocation
	
	if err := r.db.Where("user_id = ? AND is_current = true", userID).First(&location).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get current location: %w", err)
	}

	return &location, nil
}

// GetLocationHistory retrieves location history for a user
func (r *locationRepository) GetLocationHistory(userID uuid.UUID, limit int) ([]models.UserLocation, error) {
	var locations []models.UserLocation
	
	query := r.db.Where("user_id = ?", userID).Order("created_at DESC")
	
	if limit > 0 {
		query = query.Limit(limit)
	}
	
	if err := query.Find(&locations).Error; err != nil {
		return nil, fmt.Errorf("failed to get location history: %w", err)
	}

	return locations, nil
}

// GetNearbyUsers finds users within a specified radius using PostGIS
func (r *locationRepository) GetNearbyUsers(lat, lon float64, radiusMeters int, limit int, excludeUserID uuid.UUID) ([]NearbyUser, error) {
	var nearbyUsers []NearbyUser

	query := `
		SELECT 
			user_id,
			latitude,
			longitude,
			ST_Distance(
				ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
				ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography
			) as distance_meters,
			created_at as last_seen_at,
			id as location_id
		FROM user_locations 
		WHERE is_current = true 
			AND user_id != ?
			AND ST_DWithin(
				ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
				ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography,
				?
			)
		ORDER BY distance_meters ASC
	`

	if limit > 0 {
		query += fmt.Sprintf(" LIMIT %d", limit)
	}

	rows, err := r.db.Raw(query, lon, lat, excludeUserID, lon, lat, radiusMeters).Rows()
	if err != nil {
		return nil, fmt.Errorf("failed to execute nearby users query: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var user NearbyUser
		if err := rows.Scan(
			&user.UserID,
			&user.Latitude,
			&user.Longitude,
			&user.DistanceMeters,
			&user.LastSeenAt,
			&user.LocationID,
		); err != nil {
			return nil, fmt.Errorf("failed to scan nearby user: %w", err)
		}
		nearbyUsers = append(nearbyUsers, user)
	}

	return nearbyUsers, nil
}

// SetCurrentLocation sets a location as current for a user
func (r *locationRepository) SetCurrentLocation(userID uuid.UUID, locationID uuid.UUID) error {
	// Start transaction
	tx := r.db.Begin()
	if tx.Error != nil {
		return fmt.Errorf("failed to begin transaction: %w", tx.Error)
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Clear current flag for all locations of this user
	if err := tx.Model(&models.UserLocation{}).
		Where("user_id = ?", userID).
		Update("is_current", false).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to clear current locations: %w", err)
	}

	// Set the specified location as current
	if err := tx.Model(&models.UserLocation{}).
		Where("id = ? AND user_id = ?", locationID, userID).
		Update("is_current", true).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to set current location: %w", err)
	}

	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// ClearOldLocations clears the current flag from old locations
func (r *locationRepository) ClearOldLocations(userID uuid.UUID) error {
	if err := r.db.Model(&models.UserLocation{}).
		Where("user_id = ? AND is_current = true", userID).
		Update("is_current", false).Error; err != nil {
		return fmt.Errorf("failed to clear old locations: %w", err)
	}
	return nil
}
