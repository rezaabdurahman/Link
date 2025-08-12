package onboarding

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/link-app/user-svc/internal/middleware"
)

// Handler handles HTTP requests for onboarding
type Handler struct {
	service Service
}

// NewHandler creates a new onboarding handler
func NewHandler(service Service) *Handler {
	return &Handler{
		service: service,
	}
}

// GetOnboardingStatus gets the current onboarding status for the authenticated user
// GET /api/v1/onboarding/status
func (h *Handler) GetOnboardingStatus(c *gin.Context) {
	userID, exists := middleware.GetUserIDFromHeader(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "AUTHENTICATION_ERROR",
			"message": "User context required",
			"code":    "MISSING_USER_CONTEXT",
		})
		return
	}

	status, err := h.service.GetOnboardingStatus(c.Request.Context(), userID)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": status,
	})
}

// StartOnboarding starts the onboarding process for the authenticated user
// POST /api/v1/onboarding/start
func (h *Handler) StartOnboarding(c *gin.Context) {
	userID, exists := middleware.GetUserIDFromHeader(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "AUTHENTICATION_ERROR",
			"message": "User context required",
			"code":    "MISSING_USER_CONTEXT",
		})
		return
	}

	status, err := h.service.StartOnboarding(c.Request.Context(), userID)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Onboarding started successfully",
		"status":  status,
	})
}

// CompleteStep marks a step as completed for the authenticated user
// POST /api/v1/onboarding/steps/:step/complete
func (h *Handler) CompleteStep(c *gin.Context) {
	userID, exists := middleware.GetUserIDFromHeader(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "AUTHENTICATION_ERROR",
			"message": "User context required",
			"code":    "MISSING_USER_CONTEXT",
		})
		return
	}

	stepStr := c.Param("step")
	if stepStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Step parameter is required",
			"code":    "MISSING_STEP",
		})
		return
	}

	step := OnboardingStep(stepStr)
	status, err := h.service.CompleteStep(c.Request.Context(), userID, step)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Step completed successfully",
		"status":  status,
	})
}

// SkipOnboarding allows the user to skip the onboarding process
// POST /api/v1/onboarding/skip
func (h *Handler) SkipOnboarding(c *gin.Context) {
	userID, exists := middleware.GetUserIDFromHeader(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "AUTHENTICATION_ERROR",
			"message": "User context required",
			"code":    "MISSING_USER_CONTEXT",
		})
		return
	}

	status, err := h.service.SkipOnboarding(c.Request.Context(), userID)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Onboarding skipped successfully",
		"status":  status,
	})
}

// UpdatePreferences updates user preferences
// PUT /api/v1/onboarding/preferences
func (h *Handler) UpdatePreferences(c *gin.Context) {
	userID, exists := middleware.GetUserIDFromHeader(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "AUTHENTICATION_ERROR",
			"message": "User context required",
			"code":    "MISSING_USER_CONTEXT",
		})
		return
	}

	var req UpdatePreferencesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Invalid request data",
			"details": err.Error(),
		})
		return
	}

	preferences, err := h.service.UpdatePreferences(c.Request.Context(), userID, req)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":     "Preferences updated successfully",
		"preferences": preferences,
	})
}

// GetPreferences retrieves user preferences
// GET /api/v1/onboarding/preferences
func (h *Handler) GetPreferences(c *gin.Context) {
	userID, exists := middleware.GetUserIDFromHeader(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "AUTHENTICATION_ERROR",
			"message": "User context required",
			"code":    "MISSING_USER_CONTEXT",
		})
		return
	}

	preferences, err := h.service.GetPreferences(c.Request.Context(), userID)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"preferences": preferences,
	})
}

// GetOnboardingFlow returns the available onboarding steps and their configuration
// GET /api/v1/onboarding/flow
func (h *Handler) GetOnboardingFlow(c *gin.Context) {
	// Define the onboarding flow configuration
	flow := gin.H{
		"steps": []gin.H{
			{
				"id":          "profile_setup",
				"title":       "Complete Your Profile",
				"description": "Add your profile information to help friends find you",
				"required":    true,
				"order":       1,
			},
			{
				"id":          "preferences",
				"title":       "Set Your Preferences",
				"description": "Configure your privacy and notification settings",
				"required":    true,
				"order":       2,
			},
			{
				"id":          "find_friends",
				"title":       "Find Friends",
				"description": "Connect with people you know",
				"required":    false,
				"order":       3,
			},
			{
				"id":          "notifications",
				"title":       "Notification Settings",
				"description": "Choose how you want to be notified",
				"required":    false,
				"order":       4,
			},
			{
				"id":          "tutorial",
				"title":       "Quick Tutorial",
				"description": "Learn how to use the platform",
				"required":    false,
				"order":       5,
			},
		},
		"metadata": gin.H{
			"total_steps":     5,
			"required_steps":  2,
			"optional_steps":  3,
			"can_skip":        true,
			"auto_advance":    false,
		},
	}

	c.JSON(http.StatusOK, flow)
}

// handleServiceError maps service errors to HTTP responses
func (h *Handler) handleServiceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrOnboardingAlreadyCompleted):
		c.JSON(http.StatusConflict, gin.H{
			"error":   "CONFLICT_ERROR",
			"message": "Onboarding already completed",
			"code":    "ONBOARDING_ALREADY_COMPLETED",
		})
	case errors.Is(err, ErrOnboardingAlreadySkipped):
		c.JSON(http.StatusConflict, gin.H{
			"error":   "CONFLICT_ERROR",
			"message": "Onboarding already skipped",
			"code":    "ONBOARDING_ALREADY_SKIPPED",
		})
	case errors.Is(err, ErrInvalidStep):
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Invalid onboarding step",
			"code":    "INVALID_STEP",
		})
	case errors.Is(err, ErrStepNotCompleted):
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Previous step not completed",
			"code":    "STEP_NOT_COMPLETED",
		})
	case errors.Is(err, ErrOnboardingProgressNotFound):
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "NOT_FOUND",
			"message": "Onboarding progress not found",
			"code":    "ONBOARDING_PROGRESS_NOT_FOUND",
		})
	case errors.Is(err, ErrUserPreferencesNotFound):
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "NOT_FOUND",
			"message": "User preferences not found",
			"code":    "USER_PREFERENCES_NOT_FOUND",
		})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "SERVER_ERROR",
			"message": "Internal server error",
			"code":    "INTERNAL_ERROR",
		})
	}
}
