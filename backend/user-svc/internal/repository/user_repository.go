package repository

import (
	"time"

	"github.com/google/uuid"
	"github.com/link-app/user-svc/internal/models"
	"gorm.io/gorm"
)

// UserRepository interface defines user data operations
type UserRepository interface {
	// Database access
	DB() *gorm.DB
	// Database transaction operations
	BeginTx() *gorm.DB
	
	// User CRUD operations
	CreateUser(user *models.User) error
	GetUserByID(id uuid.UUID) (*models.User, error)
	GetUserByEmail(email string) (*models.User, error)
	GetUserByUsername(username string) (*models.User, error)
	UpdateUser(user *models.User) error
	UpdateLastLogin(userID uuid.UUID) error
	DeactivateUser(userID uuid.UUID) error

// Friend operations
	GetUserFriends(userID uuid.UUID, limit, offset int) ([]models.PublicUser, error)
	GetFriendIDs(userID uuid.UUID) ([]uuid.UUID, error)
	GetFriendRequests(userID uuid.UUID, limit, offset int) ([]models.FriendRequest, error)
	GetSentFriendRequests(userID uuid.UUID, limit, offset int) ([]models.FriendRequest, error)
	CreateFriendRequest(friendRequest *models.FriendRequest) error
	UpdateFriendRequest(requestID uuid.UUID, status models.FriendRequestStatus) error
	GetFriendRequest(requestID uuid.UUID) (*models.FriendRequest, error)
	CancelFriendRequest(requesterID, requesteeID uuid.UUID) error
	AreFriends(userID1, userID2 uuid.UUID) (bool, error)
	HasPendingFriendRequest(requesterID, requesteeID uuid.UUID) (bool, error)
	CreateFriendship(userID1, userID2 uuid.UUID) error
	DeleteFriendship(userID1, userID2 uuid.UUID) error
	GetMutualFriendsCount(userID1, userID2 uuid.UUID) (int64, error)

	// Close friends operations  
	GetCloseFriends(userID uuid.UUID) ([]models.PublicUser, error)
	AddCloseFriend(userID, friendID uuid.UUID) error
	RemoveCloseFriend(userID, friendID uuid.UUID) error
	IsCloseFriend(userID, friendID uuid.UUID) (bool, error)
	UpdateCloseFriends(userID uuid.UUID, friendIDs []uuid.UUID) error

	// Session operations
	CreateSession(session *models.Session) error
	GetSessionByToken(token string) (*models.Session, error)
	DeleteSession(token string) error
	DeleteAllUserSessions(userID uuid.UUID) error
	CleanupExpiredSessions() error

	// Search operations
	SearchUsers(query string, excludeUserID uuid.UUID, limit, offset int) ([]models.PublicUser, error)
}

type userRepository struct {
	db *gorm.DB
}

// NewUserRepository creates a new user repository
func NewUserRepository(db *gorm.DB) UserRepository {
	return &userRepository{
		db: db,
	}
}

// DB returns the underlying database instance
func (r *userRepository) DB() *gorm.DB {
	return r.db
}

// BeginTx starts a new database transaction
func (r *userRepository) BeginTx() *gorm.DB {
	return r.db.Begin()
}

// CreateUser creates a new user
func (r *userRepository) CreateUser(user *models.User) error {
	return r.db.Create(user).Error
}

// GetUserByID retrieves a user by ID
func (r *userRepository) GetUserByID(id uuid.UUID) (*models.User, error) {
	var user models.User
	err := r.db.Where("id = ? AND is_active = ?", id, true).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetUserByEmail retrieves a user by email
func (r *userRepository) GetUserByEmail(email string) (*models.User, error) {
	var user models.User
	err := r.db.Where("email = ? AND is_active = ?", email, true).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetUserByUsername retrieves a user by username
func (r *userRepository) GetUserByUsername(username string) (*models.User, error) {
	var user models.User
	err := r.db.Where("username = ? AND is_active = ?", username, true).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// UpdateUser updates a user
func (r *userRepository) UpdateUser(user *models.User) error {
	return r.db.Save(user).Error
}

// UpdateLastLogin updates the user's last login timestamp
func (r *userRepository) UpdateLastLogin(userID uuid.UUID) error {
	now := time.Now()
	return r.db.Model(&models.User{}).
		Where("id = ?", userID).
		Update("last_login_at", now).Error
}

// DeactivateUser deactivates a user account
func (r *userRepository) DeactivateUser(userID uuid.UUID) error {
	return r.db.Model(&models.User{}).
		Where("id = ?", userID).
		Update("is_active", false).Error
}

// GetUserFriends retrieves a user's friends
func (r *userRepository) GetUserFriends(userID uuid.UUID, limit, offset int) ([]models.PublicUser, error) {
	var friends []models.PublicUser
	
	// Query friendships where user is either user1 or user2
	query := `
		SELECT DISTINCT u.id, u.username, u.first_name, u.last_name, u.profile_picture, 
		       u.bio, u.location, u.created_at, u.last_login_at
		FROM users u
		INNER JOIN friendships f ON (
			(f.user1_id = ? AND f.user2_id = u.id) OR 
			(f.user2_id = ? AND f.user1_id = u.id)
		)
		WHERE u.is_active = true
		ORDER BY f.created_at DESC
		LIMIT ? OFFSET ?
	`
	
	err := r.db.Raw(query, userID, userID, limit, offset).Scan(&friends).Error
	return friends, err
}

// GetFriendIDs retrieves just the friend IDs for a user (read-only, IDs-only query)
func (r *userRepository) GetFriendIDs(userID uuid.UUID) ([]uuid.UUID, error) {
	var friendIDs []uuid.UUID
	
	// Efficient query to get only friend IDs without joining user data
	query := `
		SELECT DISTINCT 
			CASE 
				WHEN f.user1_id = ? THEN f.user2_id 
				ELSE f.user1_id 
			END as friend_id
		FROM friendships f 
		WHERE f.user1_id = ? OR f.user2_id = ?
	`
	
	err := r.db.Raw(query, userID, userID, userID).Scan(&friendIDs).Error
	return friendIDs, err
}

// GetFriendRequests retrieves friend requests received by the user
func (r *userRepository) GetFriendRequests(userID uuid.UUID, limit, offset int) ([]models.FriendRequest, error) {
	var requests []models.FriendRequest
	err := r.db.Where("requestee_id = ? AND status = ?", userID, models.FriendRequestPending).
		Preload("Requester").
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&requests).Error
	return requests, err
}

// GetSentFriendRequests retrieves friend requests sent by the user
func (r *userRepository) GetSentFriendRequests(userID uuid.UUID, limit, offset int) ([]models.FriendRequest, error) {
	var requests []models.FriendRequest
	err := r.db.Where("requester_id = ?", userID).
		Preload("Requestee").
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&requests).Error
	return requests, err
}

// CreateFriendRequest creates a new friend request
func (r *userRepository) CreateFriendRequest(friendRequest *models.FriendRequest) error {
	return r.db.Create(friendRequest).Error
}

// UpdateFriendRequest updates the status of a friend request
func (r *userRepository) UpdateFriendRequest(requestID uuid.UUID, status models.FriendRequestStatus) error {
	return r.db.Model(&models.FriendRequest{}).
		Where("id = ?", requestID).
		Update("status", status).Error
}

// GetFriendRequest retrieves a friend request by ID
func (r *userRepository) GetFriendRequest(requestID uuid.UUID) (*models.FriendRequest, error) {
	var request models.FriendRequest
	err := r.db.Where("id = ?", requestID).
		Preload("Requester").
		Preload("Requestee").
		First(&request).Error
	if err != nil {
		return nil, err
	}
	return &request, nil
}

// CancelFriendRequest cancels a pending friend request
func (r *userRepository) CancelFriendRequest(requesterID, requesteeID uuid.UUID) error {
	return r.db.Where("requester_id = ? AND requestee_id = ? AND status = ?", 
		requesterID, requesteeID, models.FriendRequestPending).
		Delete(&models.FriendRequest{}).Error
}

// AreFriends checks if two users are friends
func (r *userRepository) AreFriends(userID1, userID2 uuid.UUID) (bool, error) {
	var count int64
	err := r.db.Model(&models.Friendship{}).
		Where("(user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)",
			userID1, userID2, userID2, userID1).
		Count(&count).Error
	return count > 0, err
}

// HasPendingFriendRequest checks if there's a pending friend request between users
func (r *userRepository) HasPendingFriendRequest(requesterID, requesteeID uuid.UUID) (bool, error) {
	var count int64
	err := r.db.Model(&models.FriendRequest{}).
		Where("((requester_id = ? AND requestee_id = ?) OR (requester_id = ? AND requestee_id = ?)) AND status = ?",
			requesterID, requesteeID, requesteeID, requesterID, models.FriendRequestPending).
		Count(&count).Error
	return count > 0, err
}

// CreateFriendship creates a friendship between two users
func (r *userRepository) CreateFriendship(userID1, userID2 uuid.UUID) error {
	friendship := &models.Friendship{
		User1ID: userID1,
		User2ID: userID2,
	}
	return r.db.Create(friendship).Error
}

// DeleteFriendship removes a friendship between two users
func (r *userRepository) DeleteFriendship(userID1, userID2 uuid.UUID) error {
	return r.db.Where("(user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)",
		userID1, userID2, userID2, userID1).
		Delete(&models.Friendship{}).Error
}

// GetMutualFriendsCount gets the count of mutual friends between two users
func (r *userRepository) GetMutualFriendsCount(userID1, userID2 uuid.UUID) (int64, error) {
	var count int64
	
	// Complex query to find mutual friends
	query := `
		SELECT COUNT(DISTINCT mutual_friend_id) as count FROM (
			-- Get friends of user1
			SELECT 
				CASE 
					WHEN f1.user1_id = ? THEN f1.user2_id 
					ELSE f1.user1_id 
				END as mutual_friend_id
			FROM friendships f1 
			WHERE f1.user1_id = ? OR f1.user2_id = ?
		) user1_friends
		INNER JOIN (
			-- Get friends of user2
			SELECT 
				CASE 
					WHEN f2.user1_id = ? THEN f2.user2_id 
					ELSE f2.user1_id 
				END as mutual_friend_id
			FROM friendships f2 
			WHERE f2.user1_id = ? OR f2.user2_id = ?
		) user2_friends ON user1_friends.mutual_friend_id = user2_friends.mutual_friend_id
	`
	
	err := r.db.Raw(query, userID1, userID1, userID1, userID2, userID2, userID2).Scan(&count).Error
	return count, err
}

// GetCloseFriends retrieves a user's close friends list with profile information
func (r *userRepository) GetCloseFriends(userID uuid.UUID) ([]models.PublicUser, error) {
	var closeFriends []models.PublicUser
	
	// Query close friends with user profile information
	query := `
		SELECT DISTINCT u.id, u.username, u.first_name, u.last_name, u.profile_picture, 
		       u.bio, u.location, u.created_at, u.last_login_at
		FROM users u
		INNER JOIN close_friends cf ON cf.friend_id = u.id
		WHERE cf.user_id = ? AND u.is_active = true
		ORDER BY cf.added_at DESC
	`
	
	err := r.db.Raw(query, userID).Scan(&closeFriends).Error
	return closeFriends, err
}

// AddCloseFriend adds a friend to the close friends list
func (r *userRepository) AddCloseFriend(userID, friendID uuid.UUID) error {
	// First verify they are actually friends
	areFriends, err := r.AreFriends(userID, friendID)
	if err != nil {
		return err
	}
	if !areFriends {
		return gorm.ErrRecordNotFound // or custom error "not friends"
	}

	closeFriend := &models.CloseFriend{
		UserID:   userID,
		FriendID: friendID,
	}
	
	// Use ON CONFLICT DO NOTHING equivalent (ignore if already exists)
	return r.db.Where(models.CloseFriend{UserID: userID, FriendID: friendID}).
		FirstOrCreate(closeFriend).Error
}

// RemoveCloseFriend removes a friend from the close friends list
func (r *userRepository) RemoveCloseFriend(userID, friendID uuid.UUID) error {
	return r.db.Where("user_id = ? AND friend_id = ?", userID, friendID).
		Delete(&models.CloseFriend{}).Error
}

// IsCloseFriend checks if a user is in another user's close friends list
func (r *userRepository) IsCloseFriend(userID, friendID uuid.UUID) (bool, error) {
	var count int64
	err := r.db.Model(&models.CloseFriend{}).
		Where("user_id = ? AND friend_id = ?", userID, friendID).
		Count(&count).Error
	return count > 0, err
}

// UpdateCloseFriends updates the entire close friends list for a user (bulk operation)
func (r *userRepository) UpdateCloseFriends(userID uuid.UUID, friendIDs []uuid.UUID) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// First, verify all provided IDs are actually friends
		for _, friendID := range friendIDs {
			areFriends, err := r.AreFriends(userID, friendID)
			if err != nil {
				return err
			}
			if !areFriends {
				return gorm.ErrRecordNotFound // or custom error for specific friend
			}
		}

		// Remove all existing close friends for this user
		if err := tx.Where("user_id = ?", userID).Delete(&models.CloseFriend{}).Error; err != nil {
			return err
		}

		// Add new close friends if any provided
		if len(friendIDs) > 0 {
			closeFriends := make([]models.CloseFriend, len(friendIDs))
			for i, friendID := range friendIDs {
				closeFriends[i] = models.CloseFriend{
					UserID:   userID,
					FriendID: friendID,
				}
			}
			
			if err := tx.Create(&closeFriends).Error; err != nil {
				return err
			}
		}

		return nil
	})
}

// CreateSession creates a new user session
func (r *userRepository) CreateSession(session *models.Session) error {
	return r.db.Create(session).Error
}

// GetSessionByToken retrieves a session by token
func (r *userRepository) GetSessionByToken(token string) (*models.Session, error) {
	var session models.Session
	err := r.db.Where("token = ? AND expires_at > ?", token, time.Now()).
		Preload("User").
		First(&session).Error
	if err != nil {
		return nil, err
	}
	return &session, nil
}

// DeleteSession deletes a session by token
func (r *userRepository) DeleteSession(token string) error {
	return r.db.Where("token = ?", token).Delete(&models.Session{}).Error
}

// DeleteAllUserSessions deletes all sessions for a user
func (r *userRepository) DeleteAllUserSessions(userID uuid.UUID) error {
	return r.db.Where("user_id = ?", userID).Delete(&models.Session{}).Error
}

// CleanupExpiredSessions removes expired sessions
func (r *userRepository) CleanupExpiredSessions() error {
	return r.db.Where("expires_at < ?", time.Now()).Delete(&models.Session{}).Error
}

// SearchUsers searches for users by name or username
func (r *userRepository) SearchUsers(query string, excludeUserID uuid.UUID, limit, offset int) ([]models.PublicUser, error) {
	var users []models.PublicUser
	
	searchQuery := "%" + query + "%"
	err := r.db.Model(&models.User{}).
		Select("id, username, first_name, last_name, profile_picture, bio, location, created_at, last_login_at").
		Where("(first_name ILIKE ? OR last_name ILIKE ? OR username ILIKE ?) AND id != ? AND is_active = ?",
			searchQuery, searchQuery, searchQuery, excludeUserID, true).
		Order("first_name, last_name").
		Limit(limit).
		Offset(offset).
		Find(&users).Error
	
	return users, err
}
