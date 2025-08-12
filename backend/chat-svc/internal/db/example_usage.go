package db

import (
	"context"
	"fmt"
	"log"

	"github.com/google/uuid"
	"github.com/link-app/chat-svc/internal/config"
	"github.com/link-app/chat-svc/internal/model"
)

// ExampleUsage demonstrates how to use the repository layer
func ExampleUsage() {
	// Initialize database connection
	cfg := config.DatabaseConfig{
		Host:            "localhost",
		Port:            "5432",
		Name:            "chat_db",
		User:            "postgres", 
		Password:        "postgres",
		SSLMode:         "disable",
		MaxOpenConns:    25,
		MaxIdleConns:    25,
		ConnMaxLifetime: 300,
	}
	
	db, err := Connect(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()
	
	// Initialize repository
	repo := NewRepository(db.Pool)
	ctx := context.Background()
	
	// Example 1: Create a conversation and add members
	userID1 := uuid.New()
	userID2 := uuid.New()
	
	room := &model.ChatRoom{
		Name:        "Project Discussion",
		Description: "Discussion about the new project",
		CreatedBy:   userID1,
		IsPrivate:   false,
		MaxMembers:  50,
	}
	
	if err := repo.Conversations.CreateConversation(ctx, room); err != nil {
		log.Printf("Failed to create conversation: %v", err)
		return
	}
	fmt.Printf("Created conversation: %s\n", room.ID)
	
	// Add members to the room
	owner := &model.RoomMember{
		RoomID: room.ID,
		UserID: userID1,
		Role:   model.MemberRoleOwner,
	}
	
	member := &model.RoomMember{
		RoomID: room.ID,
		UserID: userID2,
		Role:   model.MemberRoleMember,
	}
	
	if err := repo.RoomMembers.AddMember(ctx, owner); err != nil {
		log.Printf("Failed to add owner: %v", err)
		return
	}
	
	if err := repo.RoomMembers.AddMember(ctx, member); err != nil {
		log.Printf("Failed to add member: %v", err)
		return
	}
	
	// Example 2: Send messages
	message1 := &model.Message{
		RoomID:      room.ID,
		UserID:      userID1,
		Content:     "Welcome to the project discussion!",
		MessageType: model.MessageTypeText,
	}
	
	message2 := &model.Message{
		RoomID:      room.ID,
		UserID:      userID2,
		Content:     "Thanks! Excited to be here.",
		MessageType: model.MessageTypeText,
	}
	
	if err := repo.Messages.CreateMessage(ctx, message1); err != nil {
		log.Printf("Failed to create message: %v", err)
		return
	}
	
	if err := repo.Messages.CreateMessage(ctx, message2); err != nil {
		log.Printf("Failed to create message: %v", err)
		return
	}
	
	fmt.Printf("Created messages: %s, %s\n", message1.ID, message2.ID)
	
	// Example 3: List conversations with pagination
	conversations, total, err := repo.Conversations.ListConversations(ctx, userID1, 1, 10)
	if err != nil {
		log.Printf("Failed to list conversations: %v", err)
		return
	}
	
	fmt.Printf("User has %d total conversations, showing %d\n", total, len(conversations))
	
	// Example 4: List messages with pagination
	messages, msgTotal, err := repo.Messages.ListMessages(ctx, room.ID, userID1, 1, 20)
	if err != nil {
		log.Printf("Failed to list messages: %v", err)
		return
	}
	
	fmt.Printf("Room has %d total messages, showing %d\n", msgTotal, len(messages))
	
	// Example 5: Mark messages as read
	var messageIDs []uuid.UUID
	for _, msg := range messages {
		messageIDs = append(messageIDs, msg.ID)
	}
	
	if err := repo.Messages.MarkMessagesAsRead(ctx, userID2, messageIDs); err != nil {
		log.Printf("Failed to mark messages as read: %v", err)
		return
	}
	
	// Check unread count
	unreadCount, err := repo.Messages.GetUnreadCount(ctx, userID2, room.ID)
	if err != nil {
		log.Printf("Failed to get unread count: %v", err)
		return
	}
	
	fmt.Printf("User2 has %d unread messages in the room\n", unreadCount)
	
	// Example 6: Get room members
	members, err := repo.RoomMembers.GetRoomMembers(ctx, room.ID)
	if err != nil {
		log.Printf("Failed to get room members: %v", err)
		return
	}
	
	fmt.Printf("Room has %d members\n", len(members))
	for _, m := range members {
		fmt.Printf("Member %s with role %s\n", m.UserID, m.Role)
	}
}
