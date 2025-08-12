package service

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/link-app/backend/location-svc/internal/dto"
	"github.com/link-app/backend/location-svc/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// Mock repositories
type MockLocationRepository struct {
	mock.Mock
}

func (m *MockLocationRepository) CreateLocation(location *models.UserLocation) error {
	args := m.Called(location)
	return args.Error(0)
}

func (m *MockLocationRepository) UpdateLocation(userID uuid.UUID, location *models.UserLocation) error {
	args := m.Called(userID, location)
	return args.Error(0)
}

func (m *MockLocationRepository) GetCurrentLocation(userID uuid.UUID) (*models.UserLocation, error) {
	args := m.Called(userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.UserLocation), args.Error(1)
}

func (m *MockLocationRepository) GetLocationHistory(userID uuid.UUID, limit int) ([]models.UserLocation, error) {
	args := m.Called(userID, limit)
	return args.Get(0).([]models.UserLocation), args.Error(1)
}

func (m *MockLocationRepository) GetNearbyUsers(lat, lon float64, radiusMeters int, limit int, excludeUserID uuid.UUID) ([]NearbyUser, error) {
	args := m.Called(lat, lon, radiusMeters, limit, excludeUserID)
	return args.Get(0).([]NearbyUser), args.Error(1)
}

func (m *MockLocationRepository) SetCurrentLocation(userID uuid.UUID, locationID uuid.UUID) error {
	args := m.Called(userID, locationID)
	return args.Error(0)
}

func (m *MockLocationRepository) ClearOldLocations(userID uuid.UUID) error {
	args := m.Called(userID)
	return args.Error(0)
}

type MockPrivacyRepository struct {
	mock.Mock
}

func (m *MockPrivacyRepository) CreatePrivacySettings(settings *models.PrivacySettings) error {
	args := m.Called(settings)
	return args.Error(0)
}

func (m *MockPrivacyRepository) UpdatePrivacySettings(userID uuid.UUID, settings *models.PrivacySettings) error {
	args := m.Called(userID, settings)
	return args.Error(0)
}

func (m *MockPrivacyRepository) GetPrivacySettings(userID uuid.UUID) (*models.PrivacySettings, error) {
	args := m.Called(userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.PrivacySettings), args.Error(1)
}

func (m *MockPrivacyRepository) GetPrivacySettingsBatch(userIDs []uuid.UUID) ([]models.PrivacySettings, error) {
	args := m.Called(userIDs)
	return args.Get(0).([]models.PrivacySettings), args.Error(1)
}

func (m *MockPrivacyRepository) DeletePrivacySettings(userID uuid.UUID) error {
	args := m.Called(userID)
	return args.Error(0)
}

type MockRedisRepository struct {
	mock.Mock
}

func (m *MockRedisRepository) SetUserLocation(ctx context.Context, userID uuid.UUID, lat, lon float64) error {
	args := m.Called(ctx, userID, lat, lon)
	return args.Error(0)
}

func (m *MockRedisRepository) GetUserLocation(ctx context.Context, userID uuid.UUID) (interface{}, error) {
	args := m.Called(ctx, userID)
	return args.Get(0), args.Error(1)
}

func (m *MockRedisRepository) GetNearbyUsers(ctx context.Context, lat, lon float64, radius float64, unit string, count int64) (interface{}, error) {
	args := m.Called(ctx, lat, lon, radius, unit, count)
	return args.Get(0), args.Error(1)
}

func (m *MockRedisRepository) RemoveUserLocation(ctx context.Context, userID uuid.UUID) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

func (m *MockRedisRepository) GetUserDistance(ctx context.Context, userID1, userID2 uuid.UUID) (float64, error) {
	args := m.Called(ctx, userID1, userID2)
	return args.Get(0).(float64), args.Error(1)
}

func (m *MockRedisRepository) SetLocationCache(ctx context.Context, key string, data interface{}, ttl time.Duration) error {
	args := m.Called(ctx, key, data, ttl)
	return args.Error(0)
}

func (m *MockRedisRepository) GetLocationCache(ctx context.Context, key string, dest interface{}) error {
	args := m.Called(ctx, key, dest)
	return args.Error(0)
}

func (m *MockRedisRepository) DeleteLocationCache(ctx context.Context, key string) error {
	args := m.Called(ctx, key)
	return args.Error(0)
}

func (m *MockRedisRepository) SetPrivacyCache(ctx context.Context, userID uuid.UUID, settings interface{}, ttl time.Duration) error {
	args := m.Called(ctx, userID, settings, ttl)
	return args.Error(0)
}

func (m *MockRedisRepository) GetPrivacyCache(ctx context.Context, userID uuid.UUID, dest interface{}) error {
	args := m.Called(ctx, userID, dest)
	return args.Error(0)
}

func (m *MockRedisRepository) PublishUserAvailable(ctx context.Context, event *dto.UserAvailableEvent) error {
	args := m.Called(ctx, event)
	return args.Error(0)
}

func (m *MockRedisRepository) PublishLocationUpdate(ctx context.Context, userID uuid.UUID, lat, lon float64) error {
	args := m.Called(ctx, userID, lat, lon)
	return args.Error(0)
}

func (m *MockRedisRepository) PublishProximityEvent(ctx context.Context, userID, otherUserID uuid.UUID, distance float64, eventType string) error {
	args := m.Called(ctx, userID, otherUserID, distance, eventType)
	return args.Error(0)
}

func TestLocationService_UpdateLocation(t *testing.T) {
	// Arrange
	mockLocationRepo := new(MockLocationRepository)
	mockPrivacyRepo := new(MockPrivacyRepository)
	mockRedisRepo := new(MockRedisRepository)

	service := NewLocationService(mockLocationRepo, mockPrivacyRepo, mockRedisRepo)

	userID := uuid.New()
	req := &dto.LocationUpdateRequest{
		Latitude:  40.7128,
		Longitude: -74.0060,
	}

	// Mock expectations
	mockLocationRepo.On("CreateLocation", mock.AnythingOfType("*models.UserLocation")).Return(nil)
	mockRedisRepo.On("SetUserLocation", mock.Anything, userID, req.Latitude, req.Longitude).Return(nil)
	mockRedisRepo.On("PublishUserAvailable", mock.Anything, mock.AnythingOfType("*dto.UserAvailableEvent")).Return(nil)
	mockRedisRepo.On("PublishLocationUpdate", mock.Anything, userID, req.Latitude, req.Longitude).Return(nil)

	// Act
	response, err := service.UpdateLocation(context.Background(), userID, req)

	// Assert
	assert.NoError(t, err)
	assert.NotNil(t, response)
	assert.Equal(t, userID, response.UserID)
	assert.Equal(t, req.Latitude, response.Latitude)
	assert.Equal(t, req.Longitude, response.Longitude)
	assert.True(t, response.IsCurrent)

	// Verify mock expectations
	mockLocationRepo.AssertExpectations(t)
	mockRedisRepo.AssertExpectations(t)
}

func TestLocationService_GetCurrentLocation(t *testing.T) {
	// Arrange
	mockLocationRepo := new(MockLocationRepository)
	mockPrivacyRepo := new(MockPrivacyRepository)
	mockRedisRepo := new(MockRedisRepository)

	service := NewLocationService(mockLocationRepo, mockPrivacyRepo, mockRedisRepo)

	userID := uuid.New()
	expectedLocation := &models.UserLocation{
		ID:        uuid.New(),
		UserID:    userID,
		Latitude:  40.7128,
		Longitude: -74.0060,
		IsCurrent: true,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Mock expectations
	mockLocationRepo.On("GetCurrentLocation", userID).Return(expectedLocation, nil)

	// Act
	response, err := service.GetCurrentLocation(context.Background(), userID)

	// Assert
	assert.NoError(t, err)
	assert.NotNil(t, response)
	assert.Equal(t, expectedLocation.ID, response.ID)
	assert.Equal(t, expectedLocation.UserID, response.UserID)
	assert.Equal(t, expectedLocation.Latitude, response.Latitude)
	assert.Equal(t, expectedLocation.Longitude, response.Longitude)

	// Verify mock expectations
	mockLocationRepo.AssertExpectations(t)
}

func TestLocationService_GetCurrentLocation_NotFound(t *testing.T) {
	// Arrange
	mockLocationRepo := new(MockLocationRepository)
	mockPrivacyRepo := new(MockPrivacyRepository)
	mockRedisRepo := new(MockRedisRepository)

	service := NewLocationService(mockLocationRepo, mockPrivacyRepo, mockRedisRepo)

	userID := uuid.New()

	// Mock expectations
	mockLocationRepo.On("GetCurrentLocation", userID).Return(nil, nil)

	// Act
	response, err := service.GetCurrentLocation(context.Background(), userID)

	// Assert
	assert.NoError(t, err)
	assert.Nil(t, response)

	// Verify mock expectations
	mockLocationRepo.AssertExpectations(t)
}
