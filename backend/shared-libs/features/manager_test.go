package features

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// Mock repository for testing
type mockRepository struct {
	mock.Mock
}

func (m *mockRepository) GetFeatureFlag(ctx context.Context, key string) (*FeatureFlag, error) {
	args := m.Called(ctx, key)
	if flag := args.Get(0); flag != nil {
		return flag.(*FeatureFlag), args.Error(1)
	}
	return nil, args.Error(1)
}

func (m *mockRepository) GetExperiment(ctx context.Context, key string) (*Experiment, error) {
	args := m.Called(ctx, key)
	if experiment := args.Get(0); experiment != nil {
		return experiment.(*Experiment), args.Error(1)
	}
	return nil, args.Error(1)
}

func (m *mockRepository) GetUserSegments(ctx context.Context, userID string) ([]string, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).([]string), args.Error(1)
}

func (m *mockRepository) CreateUserAssignment(ctx context.Context, assignment *UserAssignment) error {
	args := m.Called(ctx, assignment)
	return args.Error(0)
}

func (m *mockRepository) GetUserAssignment(ctx context.Context, userID, entityID string, entityType EntityType) (*UserAssignment, error) {
	args := m.Called(ctx, userID, entityID, entityType)
	if assignment := args.Get(0); assignment != nil {
		return assignment.(*UserAssignment), args.Error(1)
	}
	return nil, args.Error(1)
}

// Mock cache for testing
type mockCache struct {
	mock.Mock
}

func (m *mockCache) Get(ctx context.Context, key string) (interface{}, bool) {
	args := m.Called(ctx, key)
	return args.Get(0), args.Bool(1)
}

func (m *mockCache) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	args := m.Called(ctx, key, value, ttl)
	return args.Error(0)
}

func TestFeatureManager_EvaluateFlag(t *testing.T) {
	mockRepo := &mockRepository{}
	mockCache := &mockCache{}
	manager := NewFeatureManager(mockRepo, mockCache)

	ctx := context.Background()
	evalCtx := &EvaluationContext{
		UserID:     "user-123",
		Attributes: map[string]interface{}{"plan": "premium"},
	}

	t.Run("should evaluate enabled boolean flag", func(t *testing.T) {
		flag := &FeatureFlag{
			ID:          1,
			Key:         "dark_mode",
			Name:        "Dark Mode",
			Type:        FlagTypeBoolean,
			Enabled:     true,
			Value:       "true",
			Description: "Enable dark mode",
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}

		mockCache.On("Get", ctx, "flag:dark_mode").Return(nil, false).Once()
		mockRepo.On("GetFeatureFlag", ctx, "dark_mode").Return(flag, nil).Once()
		mockCache.On("Set", ctx, "flag:dark_mode", flag, 5*time.Minute).Return(nil).Once()

		result, err := manager.EvaluateFlag(ctx, "dark_mode", evalCtx)

		assert.NoError(t, err)
		assert.True(t, result.Enabled)
		assert.Equal(t, true, result.Value)
		assert.Equal(t, "FLAG_ENABLED", result.Reason)
		mockRepo.AssertExpectations(t)
		mockCache.AssertExpectations(t)
	})

	t.Run("should evaluate disabled flag", func(t *testing.T) {
		flag := &FeatureFlag{
			ID:          2,
			Key:         "beta_feature",
			Name:        "Beta Feature",
			Type:        FlagTypeBoolean,
			Enabled:     false,
			Value:       "false",
			Description: "Beta feature",
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}

		mockCache.On("Get", ctx, "flag:beta_feature").Return(nil, false).Once()
		mockRepo.On("GetFeatureFlag", ctx, "beta_feature").Return(flag, nil).Once()
		mockCache.On("Set", ctx, "flag:beta_feature", flag, 5*time.Minute).Return(nil).Once()

		result, err := manager.EvaluateFlag(ctx, "beta_feature", evalCtx)

		assert.NoError(t, err)
		assert.False(t, result.Enabled)
		assert.Equal(t, false, result.Value)
		assert.Equal(t, "FLAG_DISABLED", result.Reason)
		mockRepo.AssertExpectations(t)
		mockCache.AssertExpectations(t)
	})

	t.Run("should use cached flag", func(t *testing.T) {
		flag := &FeatureFlag{
			ID:          1,
			Key:         "cached_flag",
			Name:        "Cached Flag",
			Type:        FlagTypeBoolean,
			Enabled:     true,
			Value:       "true",
			Description: "Cached flag",
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}

		mockCache.On("Get", ctx, "flag:cached_flag").Return(flag, true).Once()

		result, err := manager.EvaluateFlag(ctx, "cached_flag", evalCtx)

		assert.NoError(t, err)
		assert.True(t, result.Enabled)
		assert.Equal(t, true, result.Value)
		assert.Equal(t, "FLAG_ENABLED", result.Reason)
		mockCache.AssertExpectations(t)
		// Should not call repository since flag was cached
		mockRepo.AssertNotCalled(t, "GetFeatureFlag")
	})

	t.Run("should handle percentage rollout", func(t *testing.T) {
		flag := &FeatureFlag{
			ID:          3,
			Key:         "percentage_flag",
			Name:        "Percentage Flag",
			Type:        FlagTypePercentage,
			Enabled:     true,
			Value:       "50", // 50% rollout
			Description: "Percentage rollout flag",
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}

		mockCache.On("Get", ctx, "flag:percentage_flag").Return(nil, false).Once()
		mockRepo.On("GetFeatureFlag", ctx, "percentage_flag").Return(flag, nil).Once()
		mockCache.On("Set", ctx, "flag:percentage_flag", flag, 5*time.Minute).Return(nil).Once()

		result, err := manager.EvaluateFlag(ctx, "percentage_flag", evalCtx)

		assert.NoError(t, err)
		assert.True(t, result.Enabled)
		// Result should be boolean based on percentage calculation
		assert.Contains(t, []interface{}{true, false}, result.Value)
		mockRepo.AssertExpectations(t)
		mockCache.AssertExpectations(t)
	})
}

func TestFeatureManager_EvaluateExperiment(t *testing.T) {
	mockRepo := &mockRepository{}
	mockCache := &mockCache{}
	manager := NewFeatureManager(mockRepo, mockCache)

	ctx := context.Background()
	evalCtx := &EvaluationContext{
		UserID:     "user-123",
		Attributes: map[string]interface{}{"region": "US"},
	}

	t.Run("should evaluate experiment and assign variant", func(t *testing.T) {
		experiment := &Experiment{
			ID:          1,
			Key:         "button_color_test",
			Name:        "Button Color Test",
			Description: "Test different button colors",
			Status:      ExperimentStatusActive,
			TrafficAllocation: 100,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}

		variants := []ExperimentVariant{
			{
				ID:           1,
				ExperimentID: 1,
				Name:         "control",
				Weight:       50,
				Config:       `{"color": "blue"}`,
			},
			{
				ID:           2,
				ExperimentID: 1,
				Name:         "treatment",
				Weight:       50,
				Config:       `{"color": "red"}`,
			},
		}

		experiment.Variants = variants

		mockCache.On("Get", ctx, "experiment:button_color_test").Return(nil, false).Once()
		mockRepo.On("GetExperiment", ctx, "button_color_test").Return(experiment, nil).Once()
		mockCache.On("Set", ctx, "experiment:button_color_test", experiment, 5*time.Minute).Return(nil).Once()
		mockRepo.On("GetUserAssignment", ctx, "user-123", "button_color_test", EntityTypeExperiment).Return(nil, nil).Once()
		mockRepo.On("CreateUserAssignment", ctx, mock.AnythingOfType("*features.UserAssignment")).Return(nil).Once()

		result, err := manager.EvaluateExperiment(ctx, "button_color_test", evalCtx)

		assert.NoError(t, err)
		assert.True(t, result.InExperiment)
		assert.Contains(t, []string{"control", "treatment"}, result.Variant)
		assert.Equal(t, "USER_IN_EXPERIMENT", result.Reason)
		mockRepo.AssertExpectations(t)
		mockCache.AssertExpectations(t)
	})

	t.Run("should return existing assignment", func(t *testing.T) {
		experiment := &Experiment{
			ID:          1,
			Key:         "existing_test",
			Name:        "Existing Test",
			Description: "Test with existing assignment",
			Status:      ExperimentStatusActive,
			TrafficAllocation: 100,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}

		assignment := &UserAssignment{
			ID:         1,
			UserID:     "user-123",
			EntityID:   "existing_test",
			EntityType: EntityTypeExperiment,
			Variant:    "treatment",
			AssignedAt: time.Now(),
		}

		mockCache.On("Get", ctx, "experiment:existing_test").Return(experiment, true).Once()
		mockRepo.On("GetUserAssignment", ctx, "user-123", "existing_test", EntityTypeExperiment).Return(assignment, nil).Once()

		result, err := manager.EvaluateExperiment(ctx, "existing_test", evalCtx)

		assert.NoError(t, err)
		assert.True(t, result.InExperiment)
		assert.Equal(t, "treatment", result.Variant)
		assert.Equal(t, "EXISTING_ASSIGNMENT", result.Reason)
		mockCache.AssertExpectations(t)
		mockRepo.AssertExpectations(t)
	})

	t.Run("should handle inactive experiment", func(t *testing.T) {
		experiment := &Experiment{
			ID:          2,
			Key:         "inactive_test",
			Name:        "Inactive Test",
			Description: "Inactive experiment",
			Status:      ExperimentStatusInactive,
			TrafficAllocation: 0,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}

		mockCache.On("Get", ctx, "experiment:inactive_test").Return(nil, false).Once()
		mockRepo.On("GetExperiment", ctx, "inactive_test").Return(experiment, nil).Once()
		mockCache.On("Set", ctx, "experiment:inactive_test", experiment, 5*time.Minute).Return(nil).Once()

		result, err := manager.EvaluateExperiment(ctx, "inactive_test", evalCtx)

		assert.NoError(t, err)
		assert.False(t, result.InExperiment)
		assert.Equal(t, "control", result.Variant)
		assert.Equal(t, "EXPERIMENT_INACTIVE", result.Reason)
		mockRepo.AssertExpectations(t)
		mockCache.AssertExpectations(t)
	})
}