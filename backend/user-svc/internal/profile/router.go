package profile

import "github.com/gin-gonic/gin"

// RegisterRoutes registers profile routes
func RegisterRoutes(router *gin.RouterGroup, profileHandler *ProfileHandler) {
	users := router.Group("/users")
	{
		// Current user profile (requires auth via gateway)
		users.GET("/profile", profileHandler.GetCurrentUserProfile)
		users.PUT("/profile", profileHandler.UpdateUserProfile)

		// Public user profiles (no auth required for viewing public profiles)
		users.GET("/profile/:userId", profileHandler.GetUserProfile)

		// Friends endpoints (require auth via gateway)
		users.GET("/friends", profileHandler.GetFriends)
		users.GET("/friend-requests", profileHandler.GetFriendRequests)
		users.POST("/friend-requests", profileHandler.SendFriendRequest)
		users.PUT("/friend-requests/:requestId", profileHandler.RespondToFriendRequest)

		// Search endpoints (require auth via gateway)
		users.GET("/search", profileHandler.SearchUsers)
	}
}
