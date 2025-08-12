package db

import (
	"context"
	"fmt"
	"log"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/link-app/chat-svc/internal/model"
	"github.com/stretchr/testify/suite"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
)

type RepositoryTestSuite struct {
	suite.Suite
	db         *pgxpool.Pool
	repo       *Repository
	pgContainer *postgres.PostgresContainer
	connString string
}

func (s *RepositoryTestSuite) SetupSuite() {
	ctx := context.Background()

	pgContainer, err := postgres.RunContainer(ctx,
		testcontainers.WithImage("postgres:13-alpine"),
		postgres.WithDatabase("test-db"),
		postgres.WithUsername("postgres"),
		postgres.WithPassword("postgres"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(5*time.Minute),
		),
	)
	if err != nil {
		log.Fatalf("failed to start postgres container: %s", err)
	}
	s.pgContainer = pgContainer

	connString, err := pgContainer.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		log.Fatalf("failed to get connection string: %s", err)
	}
	s.connString = connString

	pool, err := pgxpool.New(ctx, s.connString)
	if err != nil {
		log.Fatalf("failed to connect to test database: %s", err)
	}
	s.db = pool

	// Apply migrations
	migrations, err := os.ReadFile("../../migrations/001_create_chat_tables.up.sql")
	if err != nil {
		log.Fatalf("failed to read migration file: %s", err)
	}
	_, err = s.db.Exec(ctx, string(migrations))
	if err != nil {
		log.Fatalf("failed to apply migration: %s", err)
	}

	migrations, err = os.ReadFile("../../migrations/002_create_message_reads.up.sql")
	if err != nil {
		log.Fatalf("failed to read migration file: %s", err)
	}
	_, err = s.db.Exec(ctx, string(migrations))
	if err != nil {
		log.Fatalf("failed to apply migration: %s", err)
	}

	s.repo = NewRepository(s.db)
}

func (s *RepositoryTestSuite) TearDownSuite() {
	ctx := context.Background()
	if s.pgContainer != nil {
		if err := s.pgContainer.Terminate(ctx); err != nil {
			log.Fatalf("failed to terminate pgContainer: %s", err)
		}
	}
	s.db.Close()
}

func (s *RepositoryTestSuite) SetupTest() {
	// Clean up tables before each test
	ctx := context.Background()
	_, err := s.db.Exec(ctx, "TRUNCATE message_reads, room_members, messages, chat_rooms RESTART IDENTITY CASCADE")
	s.Require().NoError(err, "failed to truncate tables")
}

func TestRepositoryTestSuite(t *testing.T) {
	suite.Run(t, new(RepositoryTestSuite))
}

// Conversation Repository Tests
func (s *RepositoryTestSuite) TestCreateAndGetConversation() {
	ctx := context.Background()
	user_id := uuid.New()
	room := &model.ChatRoom{
		Name:        "Test Room",
		Description: "A room for testing",
		CreatedBy:   user_id,
		IsPrivate:   false,
		MaxMembers:  10,
	}

	err := s.repo.Conversations.CreateConversation(ctx, room)
	s.Require().NoError(err)
	s.Require().NotEqual(uuid.Nil, room.ID)

	retrievedRoom, err := s.repo.Conversations.GetConversationByID(ctx, room.ID)
	s.Require().NoError(err)
	s.Require().NotNil(retrievedRoom)
	s.Equal(room.Name, retrievedRoom.Name)
	s.Equal(room.Description, retrievedRoom.Description)
}

func (s *RepositoryTestSuite) TestListConversations() {
	ctx := context.Background()
	userID := uuid.New()
	
	// Create some rooms and add the user
	for i := 0; i < 5; i++ {
		room := &model.ChatRoom{
			Name:        fmt.Sprintf("Room %d", i),
			Description: "Test Room",
			CreatedBy:   uuid.New(),
		}
		err := s.repo.Conversations.CreateConversation(ctx, room)
		s.Require().NoError(err)
		
		member := &model.RoomMember{
			RoomID: room.ID,
			UserID: userID,
			Role:   model.MemberRoleMember,
		}
		err = s.repo.RoomMembers.AddMember(ctx, member)
		s.Require().NoError(err)
	}

	conversations, total, err := s.repo.Conversations.ListConversations(ctx, userID, 1, 3)
	s.Require().NoError(err)
	s.Equal(5, total)
	s.Len(conversations, 3)
}

// Message Repository Tests
func (s *RepositoryTestSuite) TestCreateAndGetMessage() {
	ctx := context.Background()
	userID := uuid.New()
	room := s.createTestRoom(ctx, userID)

	message := &model.Message{
		RoomID:      room.ID,
		UserID:      userID,
		Content:     "Hello, world!",
		MessageType: model.MessageTypeText,
	}

	err := s.repo.Messages.CreateMessage(ctx, message)
	s.Require().NoError(err)
	s.Require().NotEqual(uuid.Nil, message.ID)

	retrievedMessage, err := s.repo.Messages.GetMessageByID(ctx, message.ID)
	s.Require().NoError(err)
	s.Require().NotNil(retrievedMessage)
	s.Equal(message.Content, retrievedMessage.Content)
}

func (s *RepositoryTestSuite) TestListMessages() {
	ctx := context.Background()
	userID := uuid.New()
	room := s.createTestRoom(ctx, userID)
	s.addUserToRoom(ctx, room.ID, userID)

	for i := 0; i < 10; i++ {
		message := &model.Message{
			RoomID:  room.ID,
			UserID:  userID,
			Content: fmt.Sprintf("Message %d", i),
		}
		err := s.repo.Messages.CreateMessage(ctx, message)
		s.Require().NoError(err)
	}

	messages, total, err := s.repo.Messages.ListMessages(ctx, room.ID, userID, 1, 5)
	s.Require().NoError(err)
	s.Equal(10, total)
	s.Len(messages, 5)
}

func (s *RepositoryTestSuite) TestMarkMessagesAsRead() {
	ctx := context.Background()
	user1 := uuid.New()
	user2 := uuid.New()
	room := s.createTestRoom(ctx, user1)
	s.addUserToRoom(ctx, room.ID, user1)
	s.addUserToRoom(ctx, room.ID, user2)

	var messageIDs []uuid.UUID
	for i := 0; i < 3; i++ {
		msg := &model.Message{
			RoomID:  room.ID,
			UserID:  user1,
			Content: fmt.Sprintf("Message %d", i),
		}
		err := s.repo.Messages.CreateMessage(ctx, msg)
		s.Require().NoError(err)
		messageIDs = append(messageIDs, msg.ID)
	}

	unreadCount, err := s.repo.Messages.GetUnreadCount(ctx, user2, room.ID)
	s.Require().NoError(err)
	s.Equal(3, unreadCount)

	err = s.repo.Messages.MarkMessagesAsRead(ctx, user2, messageIDs[:2])
	s.Require().NoError(err)

	unreadCount, err = s.repo.Messages.GetUnreadCount(ctx, user2, room.ID)
	s.Require().NoError(err)
	s.Equal(1, unreadCount)
}

// Room Member Repository Tests
func (s *RepositoryTestSuite) TestAddAndGetRoomMember() {
	ctx := context.Background()
	userID := uuid.New()
	room := s.createTestRoom(ctx, userID)

	member := &model.RoomMember{
		RoomID: room.ID,
		UserID: userID,
		Role:   model.MemberRoleOwner,
	}

	err := s.repo.RoomMembers.AddMember(ctx, member)
	s.Require().NoError(err)
	
	isMember, err := s.repo.RoomMembers.IsUserMember(ctx, room.ID, userID)
	s.Require().NoError(err)
	s.True(isMember)

	members, err := s.repo.RoomMembers.GetRoomMembers(ctx, room.ID)
	s.Require().NoError(err)
	s.Len(members, 1)
	s.Equal(userID, members[0].UserID)
}

// Helper functions
func (s *RepositoryTestSuite) createTestRoom(ctx context.Context, userID uuid.UUID) *model.ChatRoom {
	room := &model.ChatRoom{
		Name:        "Test Room",
		Description: "A test room",
		CreatedBy:   userID,
	}
	err := s.repo.Conversations.CreateConversation(ctx, room)
	s.Require().NoError(err)
	return room
}

func (s *RepositoryTestSuite) addUserToRoom(ctx context.Context, roomID, userID uuid.UUID) {
	member := &model.RoomMember{
		RoomID: roomID,
		UserID: userID,
		Role:   model.MemberRoleMember,
	}
	err := s.repo.RoomMembers.AddMember(ctx, member)
	s.Require().NoError(err)
}
