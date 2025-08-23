package profile

import "github.com/gin-gonic/gin"

// RegisterRoutes registers profile routes
func RegisterRoutes(router *gin.RouterGroup, profileHandler *ProfileHandler) {
	users := router.Group("/users")
	{
		// Current user profile (requires auth via gateway)
		users.GET("/profile/me", profileHandler.GetMyProfile)
		users.PUT("/profile", profileHandler.UpdateUserProfile)

		// Public user profiles (no auth required for viewing public profiles)
		users.GET("/profile/:userId", profileHandler.GetUserProfile)

		// Friends endpoints (require auth via gateway)
		users.GET("/friends", profileHandler.GetFriends)
		users.DELETE("/friends/:friendId", profileHandler.RemoveFriend)
		users.GET("/friend-requests", profileHandler.GetFriendRequests)
		users.POST("/friend-requests", profileHandler.SendFriendRequest)
		users.PUT("/friend-requests/:requestId", profileHandler.RespondToFriendRequest)
		users.DELETE("/friend-requests/:requesteeId", profileHandler.CancelFriendRequest)

		// Blocking endpoints (require auth via gateway)
		users.POST("/block", profileHandler.BlockUser)
		users.DELETE("/block/:userId", profileHandler.UnblockUser)
		users.GET("/blocked", profileHandler.GetBlockedUsers)

		// Hidden users endpoints (require auth via gateway)
		users.GET("/hidden", profileHandler.GetHiddenUsers)
		users.POST("/hidden", profileHandler.HideUser)
		users.DELETE("/hidden/:userId", profileHandler.UnhideUser)

	}
}
