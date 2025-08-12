package auth

import "github.com/gin-gonic/gin"

// RegisterRoutes registers authentication routes
func RegisterRoutes(router *gin.RouterGroup, authHandler *AuthHandler) {
	auth := router.Group("/auth")
	{
		auth.POST("/register", authHandler.RegisterUser)
		auth.POST("/login", authHandler.LoginUser)
		auth.POST("/refresh", authHandler.RefreshToken)
		auth.POST("/logout", authHandler.LogoutUser)
	}
}
