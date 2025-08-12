package onboarding

import "github.com/gin-gonic/gin"

// RegisterRoutes registers onboarding routes
func RegisterRoutes(router *gin.RouterGroup, onboardingHandler *Handler) {
	onboarding := router.Group("/onboarding")
	{
		// Get onboarding configuration and flow
		onboarding.GET("/flow", onboardingHandler.GetOnboardingFlow)

		// Get user's onboarding status
		onboarding.GET("/status", onboardingHandler.GetOnboardingStatus)

		// Start onboarding process
		onboarding.POST("/start", onboardingHandler.StartOnboarding)

		// Complete a specific step
		onboarding.POST("/steps/:step/complete", onboardingHandler.CompleteStep)

		// Skip onboarding entirely
		onboarding.POST("/skip", onboardingHandler.SkipOnboarding)

		// Preferences management
		onboarding.GET("/preferences", onboardingHandler.GetPreferences)
		onboarding.PUT("/preferences", onboardingHandler.UpdatePreferences)
	}
}
