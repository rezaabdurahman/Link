package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestRequireRole(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name               string
		userRoles          []string
		requiredRoles      []string
		expectedStatusCode int
		shouldProceed      bool
	}{
		{
			name:               "User has required role",
			userRoles:          []string{"community_moderator", "user"},
			requiredRoles:      []string{"community_moderator"},
			expectedStatusCode: http.StatusOK,
			shouldProceed:      true,
		},
		{
			name:               "User has one of required roles",
			userRoles:          []string{"community_moderator", "user"},
			requiredRoles:      []string{"community_moderator", "user"},
			expectedStatusCode: http.StatusOK,
			shouldProceed:      true,
		},
		{
			name:               "User does not have required role",
			userRoles:          []string{"user"},
			requiredRoles:      []string{"community_moderator"},
			expectedStatusCode: http.StatusForbidden,
			shouldProceed:      false,
		},
		{
			name:               "User has no roles",
			userRoles:          []string{},
			requiredRoles:      []string{"community_moderator"},
			expectedStatusCode: http.StatusForbidden,
			shouldProceed:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, router := gin.CreateTestContext(w)

			// Set up middleware and test route
			middleware := RequireRole(tt.requiredRoles...)
			router.Use(func(c *gin.Context) {
				c.Set("user_roles", tt.userRoles)
				c.Next()
			})
			router.GET("/test", middleware, func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"message": "success"})
			})

			// Make request
			req := httptest.NewRequest("GET", "/test", nil)
			c.Request = req
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatusCode, w.Code)

			if !tt.shouldProceed {
				var response map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "AUTHORIZATION_ERROR", response["error"])
				assert.Equal(t, "ROLE_REQUIRED", response["code"])
			}
		})
	}
}

func TestRequirePermission(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name               string
		userPermissions    []string
		requiredPermission string
		expectedStatusCode int
		shouldProceed      bool
	}{
		{
			name:               "User has required permission",
			userPermissions:    []string{"users.read", "users.write"},
			requiredPermission: "users.read",
			expectedStatusCode: http.StatusOK,
			shouldProceed:      true,
		},
		{
			name:               "User does not have required permission",
			userPermissions:    []string{"users.read"},
			requiredPermission: "users.delete",
			expectedStatusCode: http.StatusForbidden,
			shouldProceed:      false,
		},
		{
			name:               "User has no permissions",
			userPermissions:    []string{},
			requiredPermission: "users.read",
			expectedStatusCode: http.StatusForbidden,
			shouldProceed:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, router := gin.CreateTestContext(w)

			// Set up middleware and test route
			middleware := RequirePermission(tt.requiredPermission)
			router.Use(func(c *gin.Context) {
				c.Set("user_permissions", tt.userPermissions)
				c.Next()
			})
			router.GET("/test", middleware, func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"message": "success"})
			})

			// Make request
			req := httptest.NewRequest("GET", "/test", nil)
			c.Request = req
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatusCode, w.Code)

			if !tt.shouldProceed {
				var response map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "AUTHORIZATION_ERROR", response["error"])
				assert.Equal(t, "PERMISSION_REQUIRED", response["code"])
			}
		})
	}
}

func TestRequireCommunityModerator(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name               string
		userRoles          []string
		expectedStatusCode int
	}{
		{
			name:               "User is community moderator",
			userRoles:          []string{"community_moderator", "user"},
			expectedStatusCode: http.StatusOK,
		},
		{
			name:               "User is not community moderator",
			userRoles:          []string{"user"},
			expectedStatusCode: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, router := gin.CreateTestContext(w)

			middleware := RequireCommunityModerator()
			router.Use(func(c *gin.Context) {
				c.Set("user_roles", tt.userRoles)
				c.Next()
			})
			router.GET("/test", middleware, func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"message": "success"})
			})

			req := httptest.NewRequest("GET", "/test", nil)
			c.Request = req
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatusCode, w.Code)
		})
	}
}

func TestRequireModerator(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name               string
		userRoles          []string
		expectedStatusCode int
	}{
		{
			name:               "User is community moderator",
			userRoles:          []string{"community_moderator"},
			expectedStatusCode: http.StatusOK,
		},
		{
			name:               "User is community moderator (legacy test)",
			userRoles:          []string{"community_moderator"},
			expectedStatusCode: http.StatusOK,
		},
		{
			name:               "User is regular user",
			userRoles:          []string{"user"},
			expectedStatusCode: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, router := gin.CreateTestContext(w)

			middleware := RequireModerator()
			router.Use(func(c *gin.Context) {
				c.Set("user_roles", tt.userRoles)
				c.Next()
			})
			router.GET("/test", middleware, func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"message": "success"})
			})

			req := httptest.NewRequest("GET", "/test", nil)
			c.Request = req
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatusCode, w.Code)
		})
	}
}

func TestRequireResourceOwnership(t *testing.T) {
	gin.SetMode(gin.TestMode)

	userID := uuid.New()
	anotherUserID := uuid.New()

	tests := []struct {
		name               string
		userRoles          []string
		authenticatedUser  uuid.UUID
		resourceUserID     string
		expectedStatusCode int
	}{
		{
			name:               "Community moderator can access any resource",
			userRoles:          []string{"community_moderator"},
			authenticatedUser:  userID,
			resourceUserID:     anotherUserID.String(),
			expectedStatusCode: http.StatusOK,
		},
		{
			name:               "User can access own resource",
			userRoles:          []string{"user"},
			authenticatedUser:  userID,
			resourceUserID:     userID.String(),
			expectedStatusCode: http.StatusOK,
		},
		{
			name:               "User cannot access other's resource",
			userRoles:          []string{"user"},
			authenticatedUser:  userID,
			resourceUserID:     anotherUserID.String(),
			expectedStatusCode: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, router := gin.CreateTestContext(w)

			middleware := RequireResourceOwnership("userId")
			router.Use(func(c *gin.Context) {
				c.Set("user_roles", tt.userRoles)
				c.Set("user_id", tt.authenticatedUser)
				c.Next()
			})
			router.GET("/test/:userId", middleware, func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"message": "success"})
			})

			req := httptest.NewRequest("GET", "/test/"+tt.resourceUserID, nil)
			c.Request = req
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatusCode, w.Code)
		})
	}
}

func TestRequireFriendshipOrModerator(t *testing.T) {
	gin.SetMode(gin.TestMode)

	userID := uuid.New()
	targetUserID := uuid.New()

	tests := []struct {
		name               string
		userRoles          []string
		authenticatedUser  uuid.UUID
		targetUser         string
		expectedStatusCode int
	}{
		{
			name:               "Community moderator can access any user",
			userRoles:          []string{"community_moderator"},
			authenticatedUser:  userID,
			targetUser:         targetUserID.String(),
			expectedStatusCode: http.StatusOK,
		},
		{
			name:               "User can access own profile",
			userRoles:          []string{"user"},
			authenticatedUser:  userID,
			targetUser:         userID.String(),
			expectedStatusCode: http.StatusOK,
		},
		{
			name:               "Community moderator can access any user (legacy)",
			userRoles:          []string{"community_moderator"},
			authenticatedUser:  userID,
			targetUser:         targetUserID.String(),
			expectedStatusCode: http.StatusOK,
		},
		{
			name:               "Regular user cannot access other profiles (friendship check would go here)",
			userRoles:          []string{"user"},
			authenticatedUser:  userID,
			targetUser:         targetUserID.String(),
			expectedStatusCode: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, router := gin.CreateTestContext(w)

			middleware := RequireFriendshipOrModerator("targetUserId")
			router.Use(func(c *gin.Context) {
				c.Set("user_roles", tt.userRoles)
				c.Set("user_id", tt.authenticatedUser)
				c.Next()
			})
			router.GET("/test/:targetUserId", middleware, func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"message": "success"})
			})

			req := httptest.NewRequest("GET", "/test/"+tt.targetUser, nil)
			c.Request = req
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatusCode, w.Code)
		})
	}
}

func TestRateLimitByRole(t *testing.T) {
	gin.SetMode(gin.TestMode)

	limits := map[string]int{
		"community_moderator": 1000,
		"premium_user": 200,
		"user":         100,
		"guest":        50,
	}

	tests := []struct {
		name          string
		userRoles     []string
		expectedLimit int
	}{
		{
			name:          "Community moderator gets highest limit",
			userRoles:     []string{"community_moderator", "user"},
			expectedLimit: 1000,
		},
		{
		},
		{
			name:          "Premium user gets premium limit",
			userRoles:     []string{"premium_user", "user"},
			expectedLimit: 200,
		},
		{
			name:          "Regular user gets user limit",
			userRoles:     []string{"user"},
			expectedLimit: 100,
		},
		{
			name:          "No roles gets guest limit",
			userRoles:     []string{},
			expectedLimit: 50,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, router := gin.CreateTestContext(w)

			middleware := RateLimitByRole(limits)
			router.Use(func(c *gin.Context) {
				if len(tt.userRoles) > 0 {
					c.Set("user_roles", tt.userRoles)
				}
				c.Next()
			})
			router.GET("/test", middleware, func(c *gin.Context) {
				limit, exists := c.Get("rate_limit")
				assert.True(t, exists)
				assert.Equal(t, tt.expectedLimit, limit)
				c.JSON(http.StatusOK, gin.H{"rate_limit": limit})
			})

			req := httptest.NewRequest("GET", "/test", nil)
			c.Request = req
			router.ServeHTTP(w, req)

			assert.Equal(t, http.StatusOK, w.Code)

			var response map[string]interface{}
			err := json.Unmarshal(w.Body.Bytes(), &response)
			assert.NoError(t, err)
			assert.Equal(t, float64(tt.expectedLimit), response["rate_limit"])
		})
	}
}