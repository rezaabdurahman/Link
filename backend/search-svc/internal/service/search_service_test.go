package service

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/link-app/search-svc/internal/config"
	"github.com/link-app/search-svc/internal/dto"
	"github.com/link-app/search-svc/internal/models"
	"github.com/link-app/search-svc/internal/repository"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// Mock repository
type mockSearchRepository struct {
	mock.Mock
}

func (m *mockSearchRepository) StoreUserEmbedding(ctx context.Context, userID uuid.UUID, embedding []float32, profileText, provider, model string) error {
	args := m.Called(ctx, userID, embedding, profileText, provider, model)
	return args.Error(0)
}

func (m *mockSearchRepository) GetUserEmbedding(ctx context.Context, userID uuid.UUID) (*models.UserEmbedding, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.UserEmbedding), args.Error(1)
}

func (m *mockSearchRepository) UpdateUserEmbedding(ctx context.Context, userID uuid.UUID, embedding []float32, profileText, provider, model string) error {
	args := m.Called(ctx, userID, embedding, profileText, provider, model)
	return args.Error(0)
}

func (m *mockSearchRepository) DeleteUserEmbedding(ctx context.Context, userID uuid.UUID) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

func (m *mockSearchRepository) SearchSimilarUsers(ctx context.Context, queryEmbedding []float32, limit int, userIDFilter []uuid.UUID, excludeUserID *uuid.UUID) ([]models.UserEmbedding, []float64, error) {
	args := m.Called(ctx, queryEmbedding, limit, userIDFilter, excludeUserID)
	if args.Get(0) == nil {
		return nil, nil, args.Error(2)
	}
	return args.Get(0).([]models.UserEmbedding), args.Get(1).([]float64), args.Error(2)
}

func (m *mockSearchRepository) GetTotalUserCount(ctx context.Context, userIDFilter []uuid.UUID, excludeUserID *uuid.UUID) (int, error) {
	args := m.Called(ctx, userIDFilter, excludeUserID)
	return args.Int(0), args.Error(1)
}

func (m *mockSearchRepository) LogSearchQuery(ctx context.Context, userID uuid.UUID, query string, queryEmbedding []float32, resultsCount, searchTimeMs, totalCandidates int) (*models.SearchQuery, error) {
	args := m.Called(ctx, userID, query, queryEmbedding, resultsCount, searchTimeMs, totalCandidates)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.SearchQuery), args.Error(1)
}

func (m *mockSearchRepository) LogSearchResults(ctx context.Context, queryID uuid.UUID, results []models.SearchResult) error {
	args := m.Called(ctx, queryID, results)
	return args.Error(0)
}

func (m *mockSearchRepository) GetAllUserIDs(ctx context.Context) ([]uuid.UUID, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]uuid.UUID), args.Error(1)
}

func (m *mockSearchRepository) GetUserIDsPage(ctx context.Context, offset, limit int) ([]uuid.UUID, error) {
	args := m.Called(ctx, offset, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]uuid.UUID), args.Error(1)
}

// Mock embedding provider
type mockEmbeddingProvider struct {
	mock.Mock
}

func (m *mockEmbeddingProvider) GenerateEmbedding(ctx context.Context, text string) ([]float32, error) {
	args := m.Called(ctx, text)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]float32), args.Error(1)
}

func (m *mockEmbeddingProvider) GetDimensions() int {
	args := m.Called()
	return args.Int(0)
}

func (m *mockEmbeddingProvider) GetProviderName() string {
	args := m.Called()
	return args.String(0)
}

func TestSearchService_Search(t *testing.T) {
	tests := []struct {
		name           string
		userID         uuid.UUID
		request        *dto.SearchRequest
		setupMocks     func(*mockSearchRepository, *mockEmbeddingProvider)
		expectedError  bool
		expectedCount  int
	}{
		{
			name:   "successful search",
			userID: uuid.New(),
			request: &dto.SearchRequest{
				Query: "software engineer",
				Limit: intPtr(5),
			},
			setupMocks: func(repo *mockSearchRepository, provider *mockEmbeddingProvider) {
				queryEmbedding := []float32{0.1, 0.2, 0.3}
				provider.On("GenerateEmbedding", mock.Anything, "software engineer").Return(queryEmbedding, nil)
				
				repo.On("GetTotalUserCount", mock.Anything, mock.Anything, mock.Anything).Return(100, nil)
				
				// Mock search results
				embeddings := []models.UserEmbedding{
					{UserID: uuid.New(), ProfileText: "Software engineer with Go experience"},
					{UserID: uuid.New(), ProfileText: "Senior software engineer"},
				}
				scores := []float64{0.9, 0.8}
				repo.On("SearchSimilarUsers", mock.Anything, queryEmbedding, 5, mock.Anything, mock.Anything).Return(embeddings, scores, nil)
				
				// Analytics logging is asynchronous, so we can't mock it reliably in tests
			},
			expectedError: false,
			expectedCount: 2,
		},
		{
			name:   "embedding generation failure",
			userID: uuid.New(),
			request: &dto.SearchRequest{
				Query: "test query",
			},
			setupMocks: func(repo *mockSearchRepository, provider *mockEmbeddingProvider) {
				provider.On("GenerateEmbedding", mock.Anything, "test query").Return(nil, errors.New("API error"))
			},
			expectedError: true,
		},
		{
			name:   "repository error",
			userID: uuid.New(),
			request: &dto.SearchRequest{
				Query: "test query",
			},
			setupMocks: func(repo *mockSearchRepository, provider *mockEmbeddingProvider) {
				queryEmbedding := []float32{0.1, 0.2, 0.3}
				provider.On("GenerateEmbedding", mock.Anything, "test query").Return(queryEmbedding, nil)
				repo.On("GetTotalUserCount", mock.Anything, mock.Anything, mock.Anything).Return(0, errors.New("DB error"))
			},
			expectedError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &mockSearchRepository{}
			mockProvider := &mockEmbeddingProvider{}
			
			tt.setupMocks(mockRepo, mockProvider)
			
		service := newSearchServiceForTest(mockRepo, mockProvider)
			
			ctx := context.Background()
			result, err := service.Search(ctx, tt.userID, tt.request)
			
			if tt.expectedError {
				assert.Error(t, err)
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
				assert.Equal(t, tt.expectedCount, len(result.Results))
			}
			
			mockRepo.AssertExpectations(t)
			mockProvider.AssertExpectations(t)
		})
	}
}

func TestSearchService_UpdateUserEmbedding(t *testing.T) {
	tests := []struct {
		name          string
		userID        uuid.UUID
		profileText   string
		setupMocks    func(*mockSearchRepository, *mockEmbeddingProvider)
		expectedError bool
	}{
		{
			name:        "successful new embedding creation",
			userID:      uuid.New(),
			profileText: "Software engineer with React experience",
			setupMocks: func(repo *mockSearchRepository, provider *mockEmbeddingProvider) {
				embedding := []float32{0.1, 0.2, 0.3}
				provider.On("GenerateEmbedding", mock.Anything, "Software engineer with React experience").Return(embedding, nil)
				provider.On("GetProviderName").Return("openai")
				
				repo.On("GetUserEmbedding", mock.Anything, mock.Anything).Return(nil, errors.New("record not found"))
				repo.On("StoreUserEmbedding", mock.Anything, mock.Anything, embedding, "Software engineer with React experience", "openai", "text-embedding-3-small").Return(nil)
			},
			expectedError: false,
		},
		{
			name:        "successful embedding update",
			userID:      uuid.New(),
			profileText: "Updated profile text",
			setupMocks: func(repo *mockSearchRepository, provider *mockEmbeddingProvider) {
				embedding := []float32{0.4, 0.5, 0.6}
				provider.On("GenerateEmbedding", mock.Anything, "Updated profile text").Return(embedding, nil)
				provider.On("GetProviderName").Return("openai")
				
				existingEmbedding := &models.UserEmbedding{ID: uuid.New()}
				repo.On("GetUserEmbedding", mock.Anything, mock.Anything).Return(existingEmbedding, nil)
				repo.On("UpdateUserEmbedding", mock.Anything, mock.Anything, embedding, "Updated profile text", "openai", "text-embedding-3-small").Return(nil)
			},
			expectedError: false,
		},
		{
			name:        "empty profile text",
			userID:      uuid.New(),
			profileText: "",
			setupMocks: func(repo *mockSearchRepository, provider *mockEmbeddingProvider) {
				// No mocks needed as it should fail validation
			},
			expectedError: true,
		},
		{
			name:        "embedding generation failure",
			userID:      uuid.New(),
			profileText: "Valid profile text",
			setupMocks: func(repo *mockSearchRepository, provider *mockEmbeddingProvider) {
				provider.On("GenerateEmbedding", mock.Anything, "Valid profile text").Return(nil, errors.New("API error"))
			},
			expectedError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &mockSearchRepository{}
			mockProvider := &mockEmbeddingProvider{}
			
			tt.setupMocks(mockRepo, mockProvider)
			
			service := NewSearchService(mockRepo, mockProvider)
			
			ctx := context.Background()
			err := service.UpdateUserEmbedding(ctx, tt.userID, tt.profileText)
			
			if tt.expectedError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
			
			mockRepo.AssertExpectations(t)
			mockProvider.AssertExpectations(t)
		})
	}
}

func TestSearchService_DeleteUserEmbedding(t *testing.T) {
	mockRepo := &mockSearchRepository{}
	mockProvider := &mockEmbeddingProvider{}
	
	userID := uuid.New()
	
	mockRepo.On("DeleteUserEmbedding", mock.Anything, userID).Return(nil)
	
	service := NewSearchService(mockRepo, mockProvider)
	
	ctx := context.Background()
	err := service.DeleteUserEmbedding(ctx, userID)
	
	assert.NoError(t, err)
	mockRepo.AssertExpectations(t)
}

func TestSearchService_HasUserEmbedding(t *testing.T) {
	tests := []struct {
		name           string
		userID         uuid.UUID
		setupMocks     func(*mockSearchRepository)
		expectedResult bool
		expectedError  bool
	}{
		{
			name:   "user has embedding",
			userID: uuid.New(),
			setupMocks: func(repo *mockSearchRepository) {
				embedding := &models.UserEmbedding{ID: uuid.New()}
				repo.On("GetUserEmbedding", mock.Anything, mock.Anything).Return(embedding, nil)
			},
			expectedResult: true,
			expectedError:  false,
		},
		{
			name:   "user has no embedding",
			userID: uuid.New(),
			setupMocks: func(repo *mockSearchRepository) {
				repo.On("GetUserEmbedding", mock.Anything, mock.Anything).Return(nil, errors.New("record not found"))
			},
			expectedResult: false,
			expectedError:  false,
		},
		{
			name:   "database error",
			userID: uuid.New(),
			setupMocks: func(repo *mockSearchRepository) {
				repo.On("GetUserEmbedding", mock.Anything, mock.Anything).Return(nil, errors.New("connection error"))
			},
			expectedResult: false,
			expectedError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &mockSearchRepository{}
			mockProvider := &mockEmbeddingProvider{}
			
			tt.setupMocks(mockRepo)
			
			service := NewSearchService(mockRepo, mockProvider)
			
			ctx := context.Background()
			result, err := service.HasUserEmbedding(ctx, tt.userID)
			
			assert.Equal(t, tt.expectedResult, result)
			if tt.expectedError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
			
			mockRepo.AssertExpectations(t)
		})
	}
}

func TestSearchService_preprocessQuery(t *testing.T) {
	mockRepo := &mockSearchRepository{}
	mockProvider := &mockEmbeddingProvider{}
	service := &searchService{repo: mockRepo, embeddingProvider: mockProvider}

	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "basic preprocessing",
			input:    "  Software Engineer  ",
			expected: "software engineer",
		},
		{
			name:     "multiple spaces",
			input:    "React   JavaScript    Developer",
			expected: "react javascript developer",
		},
		{
			name:     "mixed case",
			input:    "Senior Full-Stack DEVELOPER",
			expected: "senior full-stack developer",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := service.preprocessQuery(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestSearchService_generateMatchReasons(t *testing.T) {
	mockRepo := &mockSearchRepository{}
	mockProvider := &mockEmbeddingProvider{}
	service := &searchService{repo: mockRepo, embeddingProvider: mockProvider}

	tests := []struct {
		name         string
		query        string
		profileText  string
		score        float64
		expectedMin  int // Minimum number of reasons expected
	}{
		{
			name:        "high similarity with keyword matches",
			query:       "software engineer react",
			profileText: "Senior software engineer with React and Go experience",
			score:       0.9,
			expectedMin: 2, // Should have both keyword match and high similarity
		},
		{
			name:        "moderate similarity",
			query:       "developer python",
			profileText: "Backend developer with Python skills",
			score:       0.7,
			expectedMin: 2, // Keyword match and moderate similarity
		},
		{
			name:        "low similarity no keywords",
			query:       "marketing manager",
			profileText: "Software engineer with technical skills",
			score:       0.5,
			expectedMin: 1, // At least related content
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reasons := service.generateMatchReasons(tt.query, tt.profileText, tt.score)
			assert.GreaterOrEqual(t, len(reasons), tt.expectedMin)
			assert.Greater(t, len(reasons), 0) // Should always have at least one reason
		})
	}
}

// Test helper functions
func newSearchServiceForTest(repo repository.SearchRepository, embeddingProvider config.EmbeddingProvider) SearchService {
	return &searchService{
		repo:              repo,
		embeddingProvider: embeddingProvider,
		disableAnalytics:  true, // Disable analytics for tests
	}
}

// Helper function
func intPtr(i int) *int {
	return &i
}
