package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// User represents a user in the system
type User struct {
	ID              uuid.UUID  `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Email           string     `json:"email" gorm:"uniqueIndex;not null"`
	Username        string     `json:"username" gorm:"uniqueIndex;not null"`
	FirstName       string     `json:"first_name" gorm:"not null"`
	LastName        string     `json:"last_name" gorm:"not null"`
	DateOfBirth     *time.Time `json:"date_of_birth" gorm:"type:date"`
	ProfilePicture  *string    `json:"profile_picture" gorm:"type:text"`
	Bio             *string    `json:"bio" gorm:"type:text"`
	Location        *string    `json:"location" gorm:"type:varchar(255)"`
	EmailVerified   bool       `json:"email_verified" gorm:"default:false"`
	IsActive        bool       `json:"is_active" gorm:"default:true"`
	PasswordHash    string     `json:"-" gorm:"not null"` // Never expose password hash
	LastLoginAt     *time.Time `json:"last_login_at"`
	CreatedAt       time.Time  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time  `json:"updated_at" gorm:"autoUpdateTime"`

	// Relationships
	SentFriendRequests     []FriendRequest `json:"-" gorm:"foreignKey:RequesterID"`
	ReceivedFriendRequests []FriendRequest `json:"-" gorm:"foreignKey:RequesteeID"`
	Friendships1           []Friendship    `json:"-" gorm:"foreignKey:User1ID"`
	Friendships2           []Friendship    `json:"-" gorm:"foreignKey:User2ID"`
}

// BeforeCreate sets up the user before creation
func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}

// PublicUser represents user data safe for public viewing
type PublicUser struct {
	ID             uuid.UUID  `json:"id"`
	Username       string     `json:"username"`
	FirstName      string     `json:"first_name"`
	LastName       string     `json:"last_name"`
	ProfilePicture *string    `json:"profile_picture"`
	Bio            *string    `json:"bio"`
	Location       *string    `json:"location"`
	CreatedAt      time.Time  `json:"created_at"`
	LastLoginAt    *time.Time `json:"last_login_at,omitempty"`
	IsFriend       bool       `json:"is_friend,omitempty"`       // Populated dynamically
	MutualFriends  int        `json:"mutual_friends,omitempty"` // Populated dynamically
}

// ToPublicUser converts User to PublicUser
func (u *User) ToPublicUser() PublicUser {
	return PublicUser{
		ID:             u.ID,
		Username:       u.Username,
		FirstName:      u.FirstName,
		LastName:       u.LastName,
		ProfilePicture: u.ProfilePicture,
		Bio:            u.Bio,
		Location:       u.Location,
		CreatedAt:      u.CreatedAt,
		LastLoginAt:    u.LastLoginAt,
	}
}

// ProfileUser represents user data for authenticated profile viewing
type ProfileUser struct {
	ID             uuid.UUID  `json:"id"`
	Email          string     `json:"email"`
	Username       string     `json:"username"`
	FirstName      string     `json:"first_name"`
	LastName       string     `json:"last_name"`
	DateOfBirth    *time.Time `json:"date_of_birth"`
	ProfilePicture *string    `json:"profile_picture"`
	Bio            *string    `json:"bio"`
	Location       *string    `json:"location"`
	EmailVerified  bool       `json:"email_verified"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// ToProfileUser converts User to ProfileUser (for own profile)
func (u *User) ToProfileUser() ProfileUser {
	return ProfileUser{
		ID:             u.ID,
		Email:          u.Email,
		Username:       u.Username,
		FirstName:      u.FirstName,
		LastName:       u.LastName,
		DateOfBirth:    u.DateOfBirth,
		ProfilePicture: u.ProfilePicture,
		Bio:            u.Bio,
		Location:       u.Location,
		EmailVerified:  u.EmailVerified,
		CreatedAt:      u.CreatedAt,
		UpdatedAt:      u.UpdatedAt,
	}
}

// Friendship represents a friendship between two users
type Friendship struct {
	ID        uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	User1ID   uuid.UUID `json:"user1_id" gorm:"type:uuid;not null;index"`
	User2ID   uuid.UUID `json:"user2_id" gorm:"type:uuid;not null;index"`
	CreatedAt time.Time `json:"created_at" gorm:"autoCreateTime"`

	// Relationships
	User1 User `json:"user1,omitempty" gorm:"foreignKey:User1ID"`
	User2 User `json:"user2,omitempty" gorm:"foreignKey:User2ID"`
}

// FriendRequestStatus represents the status of a friend request
type FriendRequestStatus string

const (
	FriendRequestPending  FriendRequestStatus = "pending"
	FriendRequestAccepted FriendRequestStatus = "accepted"
	FriendRequestDeclined FriendRequestStatus = "declined"
)

// FriendRequest represents a friend request between users
type FriendRequest struct {
	ID          uuid.UUID           `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	RequesterID uuid.UUID           `json:"requester_id" gorm:"type:uuid;not null;index"`
	RequesteeID uuid.UUID           `json:"requestee_id" gorm:"type:uuid;not null;index"`
	Status      FriendRequestStatus `json:"status" gorm:"type:varchar(20);default:'pending'"`
	Message     *string             `json:"message" gorm:"type:text"`
	CreatedAt   time.Time           `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt   time.Time           `json:"updated_at" gorm:"autoUpdateTime"`

	// Relationships
	Requester User `json:"requester,omitempty" gorm:"foreignKey:RequesterID"`
	Requestee User `json:"requestee,omitempty" gorm:"foreignKey:RequesteeID"`
}

// Session represents a user session for tracking active logins
type Session struct {
	ID        uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID    uuid.UUID `json:"user_id" gorm:"type:uuid;not null;index"`
	Token     string    `json:"-" gorm:"type:varchar(255);uniqueIndex;not null"` // JWT ID or session token
	UserAgent *string   `json:"user_agent" gorm:"type:text"`
	IPAddress *string   `json:"ip_address" gorm:"type:varchar(45)"`
	ExpiresAt time.Time `json:"expires_at" gorm:"not null"`
	CreatedAt time.Time `json:"created_at" gorm:"autoCreateTime"`

	// Relationships
	User User `json:"user,omitempty" gorm:"foreignKey:UserID"`
}
