package models

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/link-app/user-svc/internal/security"
	"gorm.io/gorm"
)

// Role represents a system role for RBAC
type Role struct {
	ID          uuid.UUID    `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Name        string       `json:"name" gorm:"uniqueIndex;not null;size:50"`
	Description *string      `json:"description" gorm:"type:text"`
	IsSystem    bool         `json:"is_system" gorm:"default:false"` // System roles cannot be deleted
	CreatedAt   time.Time    `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt   time.Time    `json:"updated_at" gorm:"autoUpdateTime"`
	
	// Relationships
	Permissions []Permission `json:"permissions,omitempty" gorm:"many2many:role_permissions;"`
	Users       []User       `json:"users,omitempty" gorm:"many2many:user_roles;"`
}

// Permission represents a fine-grained permission
type Permission struct {
	ID          uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Name        string    `json:"name" gorm:"uniqueIndex;not null;size:100"`
	Description *string   `json:"description" gorm:"type:text"`
	Resource    string    `json:"resource" gorm:"not null;size:50"` // e.g., 'users', 'messages', 'admin' (admin only for content moderation)
	Action      string    `json:"action" gorm:"not null;size:50"`   // e.g., 'create', 'read', 'update', 'delete'
	CreatedAt   time.Time `json:"created_at" gorm:"autoCreateTime"`
	
	// Relationships
	Roles []Role `json:"roles,omitempty" gorm:"many2many:role_permissions;"`
}

// UserRole represents the junction table with additional metadata
type UserRole struct {
	ID         uuid.UUID  `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID     uuid.UUID  `json:"user_id" gorm:"type:uuid;not null;index"`
	RoleID     uuid.UUID  `json:"role_id" gorm:"type:uuid;not null;index"`
	AssignedBy *uuid.UUID `json:"assigned_by" gorm:"type:uuid"` // Who assigned this role
	AssignedAt time.Time  `json:"assigned_at" gorm:"autoCreateTime"`
	ExpiresAt  *time.Time `json:"expires_at,omitempty"` // Optional expiration
	IsActive   bool       `json:"is_active" gorm:"default:true"`
	CreatedAt  time.Time  `json:"created_at" gorm:"autoCreateTime"`
	
	// Relationships
	User       User  `json:"user,omitempty" gorm:"foreignKey:UserID"`
	Role       Role  `json:"role,omitempty" gorm:"foreignKey:RoleID"`
	AssignedByUser *User `json:"assigned_by_user,omitempty" gorm:"foreignKey:AssignedBy"`
}

// Ensure unique constraint
func (UserRole) TableName() string {
	return "user_roles"
}

// BeforeCreate sets up the role before creation
func (r *Role) BeforeCreate(tx *gorm.DB) error {
	if r.ID == uuid.Nil {
		r.ID = uuid.New()
	}
	return nil
}

// BeforeCreate sets up the permission before creation
func (p *Permission) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}

// BeforeCreate sets up the user role before creation
func (ur *UserRole) BeforeCreate(tx *gorm.DB) error {
	if ur.ID == uuid.Nil {
		ur.ID = uuid.New()
	}
	return nil
}

// SocialLink represents a social media link
type SocialLink struct {
	Platform string `json:"platform"`
	URL      string `json:"url"`
	Username string `json:"username,omitempty"`
}

// ProfileVisibility represents the visibility level of a user's profile
type ProfileVisibility string

const (
	ProfileVisibilityPublic  ProfileVisibility = "public"
	ProfileVisibilityPrivate ProfileVisibility = "private"
)

// PrivacySettings represents user privacy preferences
type PrivacySettings struct {
	ShowAge           bool `json:"show_age"`
	ShowLocation      bool `json:"show_location"`
	ShowMutualFriends bool `json:"show_mutual_friends"`
	ShowName          bool `json:"show_name"`
	ShowSocialMedia   bool `json:"show_social_media"`
	ShowMontages      bool `json:"show_montages"`
	ShowCheckins      bool `json:"show_checkins"`
}

// User represents a user in the system
type User struct {
	ID              uuid.UUID        `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Email           string           `json:"email" gorm:"uniqueIndex;not null;type:text"`
	Username        string           `json:"username" gorm:"uniqueIndex;not null"`
	FirstName       string           `json:"first_name" gorm:"not null;type:text"`
	LastName        string           `json:"last_name" gorm:"not null;type:text"`
	DateOfBirth     *time.Time       `json:"date_of_birth" gorm:"type:date"`
	ProfilePicture  *string          `json:"profile_picture" gorm:"type:text"`
	Bio             *string          `json:"bio" gorm:"type:text"`
	Location        *string          `json:"location" gorm:"type:text"`
	Interests       []string         `json:"interests" gorm:"type:text[];serializer:json"`
	SocialLinks     []SocialLink     `json:"social_links" gorm:"type:text;serializer:json"`
	AdditionalPhotos []string        `json:"additional_photos" gorm:"type:text;serializer:json"`
	PrivacySettings PrivacySettings  `json:"privacy_settings" gorm:"type:jsonb;serializer:json;default:'{\"show_age\": true, \"show_location\": true, \"show_mutual_friends\": true, \"show_name\": true, \"show_social_media\": true, \"show_montages\": true, \"show_checkins\": true}'"`
	ProfileVisibility ProfileVisibility `json:"profile_visibility" gorm:"type:varchar(20);default:'public'"`
	EmailVerified   bool             `json:"email_verified" gorm:"default:false"`
	IsActive        bool             `json:"is_active" gorm:"default:true"`
	PasswordHash    string           `json:"-" gorm:"not null"` // Never expose password hash
	LastLoginAt     *time.Time       `json:"last_login_at"`
	CreatedAt       time.Time        `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time        `json:"updated_at" gorm:"autoUpdateTime"`

	// Relationships
	SentFriendRequests     []FriendRequest `json:"-" gorm:"foreignKey:RequesterID"`
	ReceivedFriendRequests []FriendRequest `json:"-" gorm:"foreignKey:RequesteeID"`
	Friendships1           []Friendship    `json:"-" gorm:"foreignKey:User1ID"`
	Friendships2           []Friendship    `json:"-" gorm:"foreignKey:User2ID"`
	Roles                  []Role          `json:"roles,omitempty" gorm:"many2many:user_roles;"`
	UserRoles             []UserRole      `json:"user_roles,omitempty" gorm:"foreignKey:UserID"`
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
	ID               uuid.UUID         `json:"id"`
	Username         string            `json:"username"`
	FirstName        string            `json:"first_name"`
	LastName         string            `json:"last_name"`
	Age              *int              `json:"age,omitempty"`              // Calculated from date of birth, respecting privacy
	ProfilePicture   *string           `json:"profile_picture"`
	Bio              *string           `json:"bio"`
	Location         *string           `json:"location,omitempty"`         // Respecting privacy settings
	Interests        []string          `json:"interests"`
	SocialLinks      []SocialLink      `json:"social_links"`
	AdditionalPhotos []string          `json:"additional_photos"`
	PrivacySettings  PrivacySettings   `json:"privacy_settings"`
	ProfileVisibility ProfileVisibility `json:"profile_visibility"`
	CreatedAt        time.Time         `json:"created_at"`
	LastLoginAt      *time.Time        `json:"last_login_at,omitempty"`
	IsFriend         bool              `json:"is_friend,omitempty"`         // Populated dynamically
	MutualFriends    *int              `json:"mutual_friends,omitempty"`    // Populated dynamically, respecting privacy
}

// ToPublicUser converts User to PublicUser
func (u *User) ToPublicUser() PublicUser {
	return PublicUser{
		ID:               u.ID,
		Username:         u.Username,
		FirstName:        u.FirstName,
		LastName:         u.LastName,
		ProfilePicture:   u.ProfilePicture,
		Bio:              u.Bio,
		Location:         u.Location,
		Interests:        u.Interests,
		SocialLinks:      u.SocialLinks,
		AdditionalPhotos: u.AdditionalPhotos,
		PrivacySettings:  u.PrivacySettings,
		ProfileVisibility: u.ProfileVisibility,
		CreatedAt:        u.CreatedAt,
		LastLoginAt:      u.LastLoginAt,
	}
}

// ProfileUser represents user data for authenticated profile viewing
type ProfileUser struct {
	ID               uuid.UUID         `json:"id"`
	Email            string            `json:"email"`
	Username         string            `json:"username"`
	FirstName        string            `json:"first_name"`
	LastName         string            `json:"last_name"`
	DateOfBirth      *time.Time        `json:"date_of_birth"`
	ProfilePicture   *string           `json:"profile_picture"`
	Bio              *string           `json:"bio"`
	Location         *string           `json:"location"`
	Interests        []string          `json:"interests"`
	SocialLinks      []SocialLink      `json:"social_links"`
	AdditionalPhotos []string          `json:"additional_photos"`
	PrivacySettings  PrivacySettings   `json:"privacy_settings"`
	ProfileVisibility ProfileVisibility `json:"profile_visibility"`
	EmailVerified    bool              `json:"email_verified"`
	CreatedAt        time.Time         `json:"created_at"`
	UpdatedAt        time.Time         `json:"updated_at"`
}

// CalculateAge calculates age from date of birth
func (u *User) CalculateAge() *int {
	if u.DateOfBirth == nil {
		return nil
	}

	now := time.Now()
	age := now.Year() - u.DateOfBirth.Year()

	// Adjust if birthday hasn't occurred this year yet
	if now.YearDay() < u.DateOfBirth.YearDay() {
		age--
	}

	return &age
}

// ToPublicUserWithPrivacy converts User to PublicUser respecting privacy settings
func (u *User) ToPublicUserWithPrivacy() PublicUser {
	publicUser := PublicUser{
		ID:               u.ID,
		Username:         u.Username,
		FirstName:        u.FirstName,
		LastName:         u.LastName,
		ProfilePicture:   u.ProfilePicture,
		Bio:              u.Bio,
		Interests:        u.Interests,
		SocialLinks:      u.SocialLinks,
		AdditionalPhotos: u.AdditionalPhotos,
		PrivacySettings:  u.PrivacySettings,
		ProfileVisibility: u.ProfileVisibility,
		CreatedAt:        u.CreatedAt,
		LastLoginAt:      u.LastLoginAt,
	}

	// Apply privacy settings
	if u.PrivacySettings.ShowAge {
		publicUser.Age = u.CalculateAge()
	}

	if u.PrivacySettings.ShowLocation {
		publicUser.Location = u.Location
	}

	return publicUser
}

// ToPublicUserForViewer converts User to PublicUser based on profile visibility and friend status
func (u *User) ToPublicUserForViewer(isFriend bool) PublicUser {
	// For public profiles, show everything regardless of friend status
	if u.ProfileVisibility == ProfileVisibilityPublic {
		return u.ToPublicUser()
	}

	// For private profiles viewed by friends, show everything
	if u.ProfileVisibility == ProfileVisibilityPrivate && isFriend {
		return u.ToPublicUser()
	}

	// For private profiles viewed by non-friends, apply granular privacy settings
	publicUser := PublicUser{
		ID:                u.ID,
		ProfilePicture:    u.ProfilePicture, // Always show profile picture
		PrivacySettings:   u.PrivacySettings,
		ProfileVisibility: u.ProfileVisibility,
		CreatedAt:         u.CreatedAt,
	}

	// Apply granular privacy settings for private profiles viewed by non-friends
	if u.PrivacySettings.ShowName {
		publicUser.Username = u.Username
		publicUser.FirstName = u.FirstName
		publicUser.LastName = u.LastName
	}

	if u.PrivacySettings.ShowAge {
		publicUser.Age = u.CalculateAge()
	}

	if u.PrivacySettings.ShowLocation {
		publicUser.Location = u.Location
	}

	if u.PrivacySettings.ShowSocialMedia {
		publicUser.SocialLinks = u.SocialLinks
	}

	if u.PrivacySettings.ShowMontages {
		publicUser.AdditionalPhotos = u.AdditionalPhotos
	}

	// Bio and interests might be considered part of montages/profile content
	if u.PrivacySettings.ShowMontages {
		publicUser.Bio = u.Bio
		publicUser.Interests = u.Interests
	}

	// LastLoginAt might be considered check-in related
	if u.PrivacySettings.ShowCheckins {
		publicUser.LastLoginAt = u.LastLoginAt
	}

	return publicUser
}

// ToProfileUser converts User to ProfileUser (for own profile)
func (u *User) ToProfileUser() ProfileUser {
	return ProfileUser{
		ID:               u.ID,
		Email:            u.Email,
		Username:         u.Username,
		FirstName:        u.FirstName,
		LastName:         u.LastName,
		DateOfBirth:      u.DateOfBirth,
		ProfilePicture:   u.ProfilePicture,
		Bio:              u.Bio,
		Location:         u.Location,
		Interests:        u.Interests,
		SocialLinks:      u.SocialLinks,
		AdditionalPhotos: u.AdditionalPhotos,
		PrivacySettings:  u.PrivacySettings,
		ProfileVisibility: u.ProfileVisibility,
		EmailVerified:    u.EmailVerified,
		CreatedAt:        u.CreatedAt,
		UpdatedAt:        u.UpdatedAt,
	}
}

// Friend represents a friend for API responses
type Friend struct {
	ID           uuid.UUID `json:"id"`
	Username     string    `json:"username"`
	FirstName    string    `json:"first_name"`
	LastName     string    `json:"last_name"`
	Bio          *string   `json:"bio"`
	AvatarURL    *string   `json:"avatar_url"`
	Status       string    `json:"status"`       // "pending", "accepted", "blocked"
	FriendsSince time.Time `json:"friends_since"`
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
	Token     string    `json:"-" gorm:"type:text;uniqueIndex;not null"` // Encrypted JWT ID or session token
	UserAgent *string   `json:"user_agent" gorm:"type:text"`
	IPAddress *string   `json:"ip_address" gorm:"type:varchar(45)"`
	ExpiresAt time.Time `json:"expires_at" gorm:"not null"`
	CreatedAt time.Time `json:"created_at" gorm:"autoCreateTime"`

	// Relationships
	User User `json:"user,omitempty" gorm:"foreignKey:UserID"`
}

// EncryptFields encrypts sensitive session fields before database storage
func (s *Session) EncryptFields(ctx context.Context) error {
	if s.Token == "" {
		return nil
	}

	tokenEncryptor, err := security.GetGlobalSessionTokenEncryptor()
	if err != nil {
		return err
	}

	encryptedToken, err := tokenEncryptor.EncryptSessionToken(ctx, s.Token)
	if err != nil {
		return err
	}

	s.Token = encryptedToken
	return nil
}

// DecryptFields decrypts sensitive session fields after database retrieval
func (s *Session) DecryptFields(ctx context.Context) error {
	if s.Token == "" {
		return nil
	}

	tokenEncryptor, err := security.GetGlobalSessionTokenEncryptor()
	if err != nil {
		return err
	}

	decryptedToken, err := tokenEncryptor.DecryptSessionToken(ctx, s.Token)
	if err != nil {
		return err
	}

	s.Token = decryptedToken
	return nil
}

// Block represents a user blocking relationship
type Block struct {
	ID        uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	BlockerID uuid.UUID `json:"blocker_id" gorm:"type:uuid;not null;index"`
	BlockedID uuid.UUID `json:"blocked_id" gorm:"type:uuid;not null;index"`
	CreatedAt time.Time `json:"created_at" gorm:"autoCreateTime"`

	// Relationships
	Blocker User `json:"blocker,omitempty" gorm:"foreignKey:BlockerID"`
	Blocked User `json:"blocked,omitempty" gorm:"foreignKey:BlockedID"`
}

// Unique constraint on blocker_id and blocked_id combination
func (Block) TableName() string {
	return "blocks"
}


// EncryptFields encrypts sensitive PII fields before database storage
// Temporarily disabled - implementation will be added back later
// func (u *User) EncryptFields(ctx context.Context) error {
//     // Implementation temporarily removed to avoid security package dependency
//     return nil
// }

// DecryptFields decrypts sensitive PII fields after database retrieval  
// Temporarily disabled - implementation will be added back later
// func (u *User) DecryptFields(ctx context.Context) error {
//     // Implementation temporarily removed to avoid security package dependency
//     return nil
// }

// RBAC Helper Methods

// HasRole checks if user has a specific role
func (u *User) HasRole(roleName string) bool {
	for _, role := range u.Roles {
		if role.Name == roleName {
			return true
		}
	}
	return false
}

// HasAnyRole checks if user has any of the specified roles
func (u *User) HasAnyRole(roleNames ...string) bool {
	for _, roleName := range roleNames {
		if u.HasRole(roleName) {
			return true
		}
	}
	return false
}

// HasPermission checks if user has a specific permission through their roles
func (u *User) HasPermission(permissionName string) bool {
	for _, role := range u.Roles {
		for _, permission := range role.Permissions {
			if permission.Name == permissionName {
				return true
			}
		}
	}
	return false
}

// HasResourcePermission checks if user has permission for a specific resource and action
func (u *User) HasResourcePermission(resource, action string) bool {
	for _, role := range u.Roles {
		for _, permission := range role.Permissions {
			if permission.Resource == resource && permission.Action == action {
				return true
			}
		}
	}
	return false
}

// GetRoleNames returns a slice of role names for the user
func (u *User) GetRoleNames() []string {
	roleNames := make([]string, len(u.Roles))
	for i, role := range u.Roles {
		roleNames[i] = role.Name
	}
	return roleNames
}

// GetPermissionNames returns a slice of all permission names for the user
func (u *User) GetPermissionNames() []string {
	permissionMap := make(map[string]bool)
	for _, role := range u.Roles {
		for _, permission := range role.Permissions {
			permissionMap[permission.Name] = true
		}
	}
	
	permissions := make([]string, 0, len(permissionMap))
	for permissionName := range permissionMap {
		permissions = append(permissions, permissionName)
	}
	return permissions
}

// IsCommunityModerator checks if user has community moderator role
func (u *User) IsCommunityModerator() bool {
	return u.HasRole("community_moderator")
}


// IsModerator checks if user has community moderator role  
func (u *User) IsModerator() bool {
	return u.HasRole("community_moderator")
}

// IsPremiumUser checks if user has premium user or community moderator role
func (u *User) IsPremiumUser() bool {
	return u.HasAnyRole("premium_user", "community_moderator")
}

// VerifyPassword verifies the provided password against the stored hash
func (u *User) VerifyPassword(password string) (bool, error) {
	// TODO: Implement proper password verification using bcrypt
	// For now, this is a placeholder
	return u.PasswordHash != "", nil
}

// UserResponse represents user data for API responses  
type UserResponse struct {
	ID        uuid.UUID `json:"id"`
	Email     string    `json:"email"`
	Username  string    `json:"username"`
	FirstName string    `json:"first_name"`
	LastName  string    `json:"last_name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// RefreshToken represents a refresh token for JWT authentication
type RefreshToken struct {
	ID                uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID            uuid.UUID              `json:"user_id" gorm:"type:uuid;not null;index"`
	TokenHash         string                 `json:"-" gorm:"not null;uniqueIndex"`
	ExpiresAt         time.Time              `json:"expires_at" gorm:"not null"`
	FamilyID          uuid.UUID              `json:"family_id" gorm:"type:uuid;not null;index"`
	Platform          string                 `json:"platform" gorm:"type:varchar(20);default:'web'"`
	DeviceID          string                 `json:"device_id" gorm:"type:varchar(255)"`
	DeviceName        string                 `json:"device_name" gorm:"type:varchar(255)"`
	AppVersion        string                 `json:"app_version" gorm:"type:varchar(50)"`
	OSVersion         string                 `json:"os_version" gorm:"type:varchar(50)"`
	DeviceFingerprint string                 `json:"device_fingerprint" gorm:"type:varchar(255)"`
	DeviceRegisteredAt *time.Time            `json:"device_registered_at"`
	LastLocation      map[string]interface{} `json:"last_location" gorm:"type:jsonb"`
	IsJailbroken      bool                   `json:"is_jailbroken" gorm:"default:false"`
	IsEmulator        bool                   `json:"is_emulator" gorm:"default:false"`
	BiometricEnabled  bool                   `json:"biometric_enabled" gorm:"default:false"`
	RiskScore         float64                `json:"risk_score" gorm:"type:decimal(3,2);default:0.0"`
	TrustLevel        string                 `json:"trust_level" gorm:"type:varchar(20);default:'new'"`
	LastUsed          *time.Time             `json:"last_used"`
	CreatedAt         time.Time              `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt         time.Time              `json:"updated_at" gorm:"autoUpdateTime"`

	// Relationships
	User User `json:"user,omitempty" gorm:"foreignKey:UserID"`
}

// DeviceSession represents a mobile device session
type DeviceSession struct {
	ID                uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID            uuid.UUID              `json:"user_id" gorm:"type:uuid;not null;index"`
	DeviceID          string                 `json:"device_id" gorm:"type:varchar(255);not null"`
	DeviceName        string                 `json:"device_name" gorm:"type:varchar(255);not null"`
	Platform          string                 `json:"platform" gorm:"type:varchar(20);not null"`
	DeviceFingerprint string                 `json:"device_fingerprint" gorm:"type:varchar(255);not null"`
	AppVersion        string                 `json:"app_version" gorm:"type:varchar(50)"`
	OSVersion         string                 `json:"os_version" gorm:"type:varchar(50)"`
	FirstSeen         time.Time              `json:"first_seen" gorm:"autoCreateTime"`
	LastSeen          time.Time              `json:"last_seen" gorm:"autoUpdateTime"`
	LastIP            string                 `json:"last_ip" gorm:"type:inet"`
	LastLocation      map[string]interface{} `json:"last_location" gorm:"type:jsonb"`
	IsTrusted         bool                   `json:"is_trusted" gorm:"default:false"`
	IsJailbroken      bool                   `json:"is_jailbroken" gorm:"default:false"`
	IsEmulator        bool                   `json:"is_emulator" gorm:"default:false"`
	BiometricEnabled  bool                   `json:"biometric_enabled" gorm:"default:false"`
	DeviceInfo        map[string]interface{} `json:"device_info" gorm:"type:jsonb"`
	SessionCount      int                    `json:"session_count" gorm:"default:1"`
	RiskScore         float64                `json:"risk_score" gorm:"type:decimal(3,2);default:0.0"`
	TrustEstablishedAt *time.Time            `json:"trust_established_at"`
	CreatedAt         time.Time              `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt         time.Time              `json:"updated_at" gorm:"autoUpdateTime"`

	// Relationships
	User User `json:"user,omitempty" gorm:"foreignKey:UserID"`
}

// MobileSecurityEvent represents a mobile security event for audit and monitoring
type MobileSecurityEvent struct {
	ID           uuid.UUID              `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID       *uuid.UUID             `json:"user_id" gorm:"type:uuid;index"`
	DeviceID     string                 `json:"device_id" gorm:"type:varchar(255)"`
	EventType    string                 `json:"event_type" gorm:"type:varchar(50);not null"`
	EventDetails map[string]interface{} `json:"event_details" gorm:"type:jsonb;not null"`
	RiskScore    *float64               `json:"risk_score" gorm:"type:decimal(3,2)"`
	IPAddress    string                 `json:"ip_address" gorm:"type:inet"`
	UserAgent    string                 `json:"user_agent" gorm:"type:text"`
	Location     map[string]interface{} `json:"location" gorm:"type:jsonb"`
	CreatedAt    time.Time              `json:"created_at" gorm:"autoCreateTime"`

	// Relationships
	User *User `json:"user,omitempty" gorm:"foreignKey:UserID"`
}
