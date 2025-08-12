package service

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"

	"github.com/link-app/chat-svc/internal/model"
)

// Simple unit tests that test validation logic without complex mocking

// Test validation functions directly
func TestValidateCreateRoomRequest(t *testing.T) {
	service := &ChatService{}

	tests := []struct {
		name    string
		req     model.CreateRoomRequest
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid request",
			req: model.CreateRoomRequest{
				Name:        "Test Room",
				Description: "A test room",
				MaxMembers:  100,
			},
			wantErr: false,
		},
		{
			name: "empty name",
			req: model.CreateRoomRequest{
				Name:       "",
				MaxMembers: 100,
			},
			wantErr: true,
			errMsg:  "room name is required",
		},
		{
			name: "name too long",
			req: model.CreateRoomRequest{
				Name:       string(make([]byte, 101)),
				MaxMembers: 100,
			},
			wantErr: true,
			errMsg:  "room name too long",
		},
		{
			name: "description too long",
			req: model.CreateRoomRequest{
				Name:        "Test",
				Description: string(make([]byte, 501)),
				MaxMembers:  100,
			},
			wantErr: true,
			errMsg:  "room description too long",
		},
		{
			name: "negative max members",
			req: model.CreateRoomRequest{
				Name:       "Test",
				MaxMembers: -1,
			},
			wantErr: true,
			errMsg:  "max members cannot be negative",
		},
		{
			name: "max members too high",
			req: model.CreateRoomRequest{
				Name:       "Test",
				MaxMembers: 10001,
			},
			wantErr: true,
			errMsg:  "max members too high",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := service.validateCreateRoomRequest(tt.req)
			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidateSendMessageRequest(t *testing.T) {
	service := &ChatService{}

	tests := []struct {
		name    string
		req     model.SendMessageRequest
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid text message",
			req: model.SendMessageRequest{
				Content:     "Hello, world!",
				MessageType: model.MessageTypeText,
			},
			wantErr: false,
		},
		{
			name: "empty content",
			req: model.SendMessageRequest{
				Content:     "",
				MessageType: model.MessageTypeText,
			},
			wantErr: true,
			errMsg:  "message content is required",
		},
		{
			name: "whitespace only content",
			req: model.SendMessageRequest{
				Content:     "   \n\t  ",
				MessageType: model.MessageTypeText,
			},
			wantErr: true,
			errMsg:  "message content is required",
		},
		{
			name: "content too long",
			req: model.SendMessageRequest{
				Content:     string(make([]byte, 4001)),
				MessageType: model.MessageTypeText,
			},
			wantErr: true,
			errMsg:  "message content too long",
		},
		{
			name: "invalid message type - system",
			req: model.SendMessageRequest{
				Content:     "Hello",
				MessageType: model.MessageTypeSystem,
			},
			wantErr: true,
			errMsg:  "invalid message type",
		},
		{
			name: "valid image message",
			req: model.SendMessageRequest{
				Content:     "image.jpg",
				MessageType: model.MessageTypeImage,
			},
			wantErr: false,
		},
		{
			name: "valid file message",
			req: model.SendMessageRequest{
				Content:     "document.pdf",
				MessageType: model.MessageTypeFile,
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := service.validateSendMessageRequest(tt.req)
			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

// Test some edge cases for specific functions
func TestCreateDirectConversation_SameUser(t *testing.T) {
	// This test can run without complex mocking since it checks early validation
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	
	service := &ChatService{
		logger: logger,
	}
	
	userID := uuid.New()
	ctx := context.Background()
	
	_, err := service.CreateDirectConversation(ctx, userID, userID)
	
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "cannot create conversation with yourself")
}

func TestMarkMessagesAsRead_EmptyMessageIDs(t *testing.T) {
	// This test can run without complex mocking since it checks early validation
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	
	service := &ChatService{
		logger: logger,
	}
	
	userID := uuid.New()
	roomID := uuid.New()
	messageIDs := []uuid.UUID{}
	ctx := context.Background()
	
	err := service.MarkMessagesAsRead(ctx, userID, messageIDs, roomID)
	
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no message IDs provided")
}

