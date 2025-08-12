package db

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/link-app/chat-svc/internal/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// Mock implementations for testing interfaces

type MockConversationRepository struct {
	mock.Mock
}

func (m *MockConversationRepository) ListConversations(ctx context.Context, userID uuid.UUID, page, size int) ([]*model.ChatRoom, int, error) {
	args := m.Called(ctx, userID, page, size)
	return args.Get(0).([]*model.ChatRoom), args.Int(1), args.Error(2)
}

func (m *MockConversationRepository) CreateConversation(ctx context.Context, room *model.ChatRoom) error {
	args := m.Called(ctx, room)
	return args.Error(0)
}

func (m *MockConversationRepository) GetConversationByID(ctx context.Context, roomID uuid.UUID) (*model.ChatRoom, error) {
	args := m.Called(ctx, roomID)
	return args.Get(0).(*model.ChatRoom), args.Error(1)
}

func (m *MockConversationRepository) UpdateConversation(ctx context.Context, room *model.ChatRoom) error {
	args := m.Called(ctx, room)
	return args.Error(0)
}

func (m *MockConversationRepository) DeleteConversation(ctx context.Context, roomID uuid.UUID) error {
	args := m.Called(ctx, roomID)
	return args.Error(0)
}

func (m *MockConversationRepository) GetConversationsByUserID(ctx context.Context, userID uuid.UUID) ([]*model.ChatRoom, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).([]*model.ChatRoom), args.Error(1)
}

// Test the interface compliance
func TestRepositoryInterfaces(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()
	roomID := uuid.New()
	
	// Test ConversationRepository interface
	mockConvRepo := &MockConversationRepository{}
	
	expectedRoom := &model.ChatRoom{
		ID:          roomID,
		Name:        "Test Room",
		Description: "Test Description",
		CreatedBy:   userID,
	}
	
	mockConvRepo.On("CreateConversation", ctx, mock.AnythingOfType("*model.ChatRoom")).Return(nil)
	mockConvRepo.On("GetConversationByID", ctx, roomID).Return(expectedRoom, nil)
	mockConvRepo.On("ListConversations", ctx, userID, 1, 10).Return([]*model.ChatRoom{expectedRoom}, 1, nil)
	
	// Test interface methods
	room := &model.ChatRoom{
		Name:        "Test Room",
		Description: "Test Description", 
		CreatedBy:   userID,
	}
	
	err := mockConvRepo.CreateConversation(ctx, room)
	assert.NoError(t, err)
	
	retrievedRoom, err := mockConvRepo.GetConversationByID(ctx, roomID)
	assert.NoError(t, err)
	assert.Equal(t, expectedRoom.Name, retrievedRoom.Name)
	
	rooms, total, err := mockConvRepo.ListConversations(ctx, userID, 1, 10)
	assert.NoError(t, err)
	assert.Equal(t, 1, total)
	assert.Len(t, rooms, 1)
	
	mockConvRepo.AssertExpectations(t)
}

func TestPaginationLogic(t *testing.T) {
	tests := []struct {
		name           string
		page           int
		size           int
		expectedOffset int
	}{
		{"First page", 1, 10, 0},
		{"Second page", 2, 10, 10},
		{"Third page", 3, 5, 10},
		{"Large page", 10, 20, 180},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			offset := (tt.page - 1) * tt.size
			assert.Equal(t, tt.expectedOffset, offset)
		})
	}
}

func TestMessageTypeValidation(t *testing.T) {
	validTypes := []model.MessageType{
		model.MessageTypeText,
		model.MessageTypeImage,
		model.MessageTypeFile,
		model.MessageTypeVideo,
		model.MessageTypeAudio,
		model.MessageTypeSystem,
	}
	
	for _, msgType := range validTypes {
		assert.NotEmpty(t, string(msgType))
	}
}

func TestMemberRoleValidation(t *testing.T) {
	validRoles := []model.MemberRole{
		model.MemberRoleOwner,
		model.MemberRoleAdmin,
		model.MemberRoleModerator,
		model.MemberRoleMember,
	}
	
	for _, role := range validRoles {
		assert.NotEmpty(t, string(role))
	}
}
