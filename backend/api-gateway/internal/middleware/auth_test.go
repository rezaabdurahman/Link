package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestGetUserRoles(t *testing.T) {
	gin.SetMode(gin.TestMode)
	
	tests := []struct {
		name           string
		roles          []string
		expectedRoles  []string
		expectedExists bool
	}{
		{
			name:           "Valid roles",
			roles:          []string{"community_moderator", "user"},
			expectedRoles:  []string{"community_moderator", "user"},
			expectedExists: true,
		},
		{
			name:           "Empty roles",
			roles:          []string{},
			expectedRoles:  []string{},
			expectedExists: true,
		},
		{
			name:           "No roles set",
			roles:          nil,
			expectedRoles:  nil,
			expectedExists: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)

			if tt.roles != nil {
				c.Set("user_roles", tt.roles)
			}

			roles, exists := GetUserRoles(c)
			assert.Equal(t, tt.expectedExists, exists)
			if exists {
				assert.Equal(t, tt.expectedRoles, roles)
			}
		})
	}
}

func TestGetUserPermissions(t *testing.T) {
	gin.SetMode(gin.TestMode)
	
	tests := []struct {
		name                string
		permissions         []string
		expectedPermissions []string
		expectedExists      bool
	}{
		{
			name:                "Valid permissions",
			permissions:         []string{"users.read", "users.write"},
			expectedPermissions: []string{"users.read", "users.write"},
			expectedExists:      true,
		},
		{
			name:                "Empty permissions",
			permissions:         []string{},
			expectedPermissions: []string{},
			expectedExists:      true,
		},
		{
			name:                "No permissions set",
			permissions:         nil,
			expectedPermissions: nil,
			expectedExists:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)

			if tt.permissions != nil {
				c.Set("user_permissions", tt.permissions)
			}

			permissions, exists := GetUserPermissions(c)
			assert.Equal(t, tt.expectedExists, exists)
			if exists {
				assert.Equal(t, tt.expectedPermissions, permissions)
			}
		})
	}
}

func TestHasRole(t *testing.T) {
	gin.SetMode(gin.TestMode)
	
	tests := []struct {
		name     string
		roles    []string
		testRole string
		expected bool
	}{
		{
			name:     "Has role",
			roles:    []string{"community_moderator", "user"},
			testRole: "community_moderator",
			expected: true,
		},
		{
			name:     "Does not have role",
			roles:    []string{"user"},
			testRole: "community_moderator",
			expected: false,
		},
		{
			name:     "No roles set",
			roles:    nil,
			testRole: "community_moderator",
			expected: false,
		},
		{
			name:     "Empty roles",
			roles:    []string{},
			testRole: "community_moderator",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)

			if tt.roles != nil {
				c.Set("user_roles", tt.roles)
			}

			result := HasRole(c, tt.testRole)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestHasAnyRole(t *testing.T) {
	gin.SetMode(gin.TestMode)
	
	tests := []struct {
		name      string
		roles     []string
		testRoles []string
		expected  bool
	}{
		{
			name:      "Has one of the roles",
			roles:     []string{"user", "community_moderator"},
			testRoles: []string{"community_moderator", "user"},
			expected:  true,
		},
		{
			name:      "Has none of the roles",
			roles:     []string{"user"},
			testRoles: []string{"community_moderator"},
			expected:  false,
		},
		{
			name:      "Has all of the roles",
			roles:     []string{"community_moderator", "user"},
			testRoles: []string{"community_moderator", "user"},
			expected:  true,
		},
		{
			name:      "No roles set",
			roles:     nil,
			testRoles: []string{"community_moderator"},
			expected:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)

			if tt.roles != nil {
				c.Set("user_roles", tt.roles)
			}

			result := HasAnyRole(c, tt.testRoles...)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestHasPermission(t *testing.T) {
	gin.SetMode(gin.TestMode)
	
	tests := []struct {
		name           string
		permissions    []string
		testPermission string
		expected       bool
	}{
		{
			name:           "Has permission",
			permissions:    []string{"users.read", "users.write"},
			testPermission: "users.read",
			expected:       true,
		},
		{
			name:           "Does not have permission",
			permissions:    []string{"users.read"},
			testPermission: "users.write",
			expected:       false,
		},
		{
			name:           "No permissions set",
			permissions:    nil,
			testPermission: "users.read",
			expected:       false,
		},
		{
			name:           "Empty permissions",
			permissions:    []string{},
			testPermission: "users.read",
			expected:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)

			if tt.permissions != nil {
				c.Set("user_permissions", tt.permissions)
			}

			result := HasPermission(c, tt.testPermission)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestIsCommunityModerator(t *testing.T) {
	gin.SetMode(gin.TestMode)
	
	tests := []struct {
		name     string
		roles    []string
		expected bool
	}{
		{
			name:     "Is community moderator",
			roles:    []string{"community_moderator", "user"},
			expected: true,
		},
		{
			name:     "Is not community moderator",
			roles:    []string{"user"},
			expected: false,
		},
		{
			name:     "No roles",
			roles:    []string{},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)

			c.Set("user_roles", tt.roles)

			result := IsCommunityModerator(c)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestIsModerator(t *testing.T) {
	gin.SetMode(gin.TestMode)
	
	tests := []struct {
		name     string
		roles    []string
		expected bool
	}{
		{
			name:     "Is community moderator",
			roles:    []string{"community_moderator", "user"},
			expected: true,
		},
		{
			name:     "Is community moderator (different test)",
			roles:    []string{"community_moderator"},
			expected: true,
		},
		{
			name:     "Is not community moderator",
			roles:    []string{"user", "premium_user"},
			expected: false,
		},
		{
			name:     "No roles",
			roles:    []string{},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)

			c.Set("user_roles", tt.roles)

			result := IsModerator(c)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestGetUserID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	
	testUUID := uuid.New()

	tests := []struct {
		name           string
		userID         interface{}
		expectedID     uuid.UUID
		expectedExists bool
	}{
		{
			name:           "Valid UUID",
			userID:         testUUID,
			expectedID:     testUUID,
			expectedExists: true,
		},
		{
			name:           "Invalid type",
			userID:         "not-a-uuid",
			expectedID:     uuid.Nil,
			expectedExists: false,
		},
		{
			name:           "No user ID set",
			userID:         nil,
			expectedID:     uuid.Nil,
			expectedExists: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)

			if tt.userID != nil {
				c.Set("user_id", tt.userID)
			}

			id, exists := GetUserID(c)
			assert.Equal(t, tt.expectedExists, exists)
			assert.Equal(t, tt.expectedID, id)
		})
	}
}

func TestGetUserEmail(t *testing.T) {
	gin.SetMode(gin.TestMode)
	
	tests := []struct {
		name           string
		email          interface{}
		expectedEmail  string
		expectedExists bool
	}{
		{
			name:           "Valid email",
			email:          "test@example.com",
			expectedEmail:  "test@example.com",
			expectedExists: true,
		},
		{
			name:           "Invalid type",
			email:          123,
			expectedEmail:  "",
			expectedExists: false,
		},
		{
			name:           "No email set",
			email:          nil,
			expectedEmail:  "",
			expectedExists: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)

			if tt.email != nil {
				c.Set("user_email", tt.email)
			}

			email, exists := GetUserEmail(c)
			assert.Equal(t, tt.expectedExists, exists)
			assert.Equal(t, tt.expectedEmail, email)
		})
	}
}