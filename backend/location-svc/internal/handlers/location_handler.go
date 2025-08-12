package handlers

import (
	"strconv"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"github.com/link-app/backend/location-svc/internal/dto"
	"github.com/link-app/backend/location-svc/internal/middleware"
	"github.com/link-app/backend/location-svc/internal/service"
)

// LocationHandler handles location-related HTTP requests
type LocationHandler struct {
	locationService service.LocationService
	privacyService  service.PrivacyService
	validator       *validator.Validate
}

// NewLocationHandler creates a new location handler
func NewLocationHandler(locationService service.LocationService, privacyService service.PrivacyService) *LocationHandler {
	return &LocationHandler{
		locationService: locationService,
		privacyService:  privacyService,
		validator:       validator.New(),
	}
}

// UpdateLocation handles POST /location endpoint
func (h *LocationHandler) UpdateLocation(c *fiber.Ctx) error {
	// Get user ID from JWT token
	userID, err := middleware.GetUserIDFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(dto.ErrorResponse{
			Error:   "unauthorized",
			Message: "User not authenticated",
			Code:    fiber.StatusUnauthorized,
		})
	}

	// Parse request body
	var req dto.LocationUpdateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(dto.ErrorResponse{
			Error:   "invalid_request",
			Message: "Invalid request body",
			Code:    fiber.StatusBadRequest,
		})
	}

	// Validate request
	if err := h.validator.Struct(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(dto.ErrorResponse{
			Error:   "validation_error",
			Message: err.Error(),
			Code:    fiber.StatusBadRequest,
		})
	}

	// Update location
	response, err := h.locationService.UpdateLocation(c.Context(), userID, &req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(dto.ErrorResponse{
			Error:   "internal_error",
			Message: "Failed to update location",
			Code:    fiber.StatusInternalServerError,
		})
	}

	return c.Status(fiber.StatusOK).JSON(dto.SuccessResponse{
		Success: true,
		Message: "Location updated successfully",
		Data:    response,
	})
}

// GetNearby handles GET /nearby endpoint
func (h *LocationHandler) GetNearby(c *fiber.Ctx) error {
	// Get user ID from JWT token
	userID, err := middleware.GetUserIDFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(dto.ErrorResponse{
			Error:   "unauthorized",
			Message: "User not authenticated",
			Code:    fiber.StatusUnauthorized,
		})
	}

	// Parse query parameters
	latStr := c.Query("latitude")
	lonStr := c.Query("longitude")
	radiusStr := c.Query("radius", "1000") // default 1km
	limitStr := c.Query("limit", "50")
	friendsOnlyStr := c.Query("friends_only", "false")

	if latStr == "" || lonStr == "" {
		return c.Status(fiber.StatusBadRequest).JSON(dto.ErrorResponse{
			Error:   "missing_parameters",
			Message: "Latitude and longitude are required",
			Code:    fiber.StatusBadRequest,
		})
	}

	// Parse values
	latitude, err := strconv.ParseFloat(latStr, 64)
	if err != nil || latitude < -90 || latitude > 90 {
		return c.Status(fiber.StatusBadRequest).JSON(dto.ErrorResponse{
			Error:   "invalid_latitude",
			Message: "Invalid latitude value",
			Code:    fiber.StatusBadRequest,
		})
	}

	longitude, err := strconv.ParseFloat(lonStr, 64)
	if err != nil || longitude < -180 || longitude > 180 {
		return c.Status(fiber.StatusBadRequest).JSON(dto.ErrorResponse{
			Error:   "invalid_longitude",
			Message: "Invalid longitude value",
			Code:    fiber.StatusBadRequest,
		})
	}

	radius, err := strconv.Atoi(radiusStr)
	if err != nil || radius < 1 || radius > 50000 {
		return c.Status(fiber.StatusBadRequest).JSON(dto.ErrorResponse{
			Error:   "invalid_radius",
			Message: "Radius must be between 1 and 50000 meters",
			Code:    fiber.StatusBadRequest,
		})
	}

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit < 1 || limit > 100 {
		limit = 50 // default
	}

	friendsOnly, _ := strconv.ParseBool(friendsOnlyStr)

	// Create request
	req := &dto.NearbyRequest{
		Latitude:     latitude,
		Longitude:    longitude,
		RadiusMeters: radius,
		Limit:        &limit,
		FriendsOnly:  &friendsOnly,
	}

	// Validate request
	if err := h.validator.Struct(req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(dto.ErrorResponse{
			Error:   "validation_error",
			Message: err.Error(),
			Code:    fiber.StatusBadRequest,
		})
	}

	// Get nearby users
	response, err := h.locationService.GetNearbyUsers(c.Context(), userID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(dto.ErrorResponse{
			Error:   "internal_error",
			Message: "Failed to get nearby users",
			Code:    fiber.StatusInternalServerError,
		})
	}

	return c.Status(fiber.StatusOK).JSON(dto.SuccessResponse{
		Success: true,
		Message: "Nearby users retrieved successfully",
		Data:    response,
	})
}

// GetCurrentLocation handles GET /location/current endpoint
func (h *LocationHandler) GetCurrentLocation(c *fiber.Ctx) error {
	// Get user ID from JWT token
	userID, err := middleware.GetUserIDFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(dto.ErrorResponse{
			Error:   "unauthorized",
			Message: "User not authenticated",
			Code:    fiber.StatusUnauthorized,
		})
	}

	// Get current location
	response, err := h.locationService.GetCurrentLocation(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(dto.ErrorResponse{
			Error:   "internal_error",
			Message: "Failed to get current location",
			Code:    fiber.StatusInternalServerError,
		})
	}

	if response == nil {
		return c.Status(fiber.StatusNotFound).JSON(dto.ErrorResponse{
			Error:   "not_found",
			Message: "No current location found",
			Code:    fiber.StatusNotFound,
		})
	}

	return c.Status(fiber.StatusOK).JSON(dto.SuccessResponse{
		Success: true,
		Message: "Current location retrieved successfully",
		Data:    response,
	})
}

// GetLocationHistory handles GET /location/history endpoint
func (h *LocationHandler) GetLocationHistory(c *fiber.Ctx) error {
	// Get user ID from JWT token
	userID, err := middleware.GetUserIDFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(dto.ErrorResponse{
			Error:   "unauthorized",
			Message: "User not authenticated",
			Code:    fiber.StatusUnauthorized,
		})
	}

	// Parse limit parameter
	limitStr := c.Query("limit", "50")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit < 1 || limit > 1000 {
		limit = 50 // default
	}

	// Get location history
	response, err := h.locationService.GetLocationHistory(c.Context(), userID, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(dto.ErrorResponse{
			Error:   "internal_error",
			Message: "Failed to get location history",
			Code:    fiber.StatusInternalServerError,
		})
	}

	return c.Status(fiber.StatusOK).JSON(dto.SuccessResponse{
		Success: true,
		Message: "Location history retrieved successfully",
		Data:    response,
	})
}

// DeleteLocation handles DELETE /location endpoint
func (h *LocationHandler) DeleteLocation(c *fiber.Ctx) error {
	// Get user ID from JWT token
	userID, err := middleware.GetUserIDFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(dto.ErrorResponse{
			Error:   "unauthorized",
			Message: "User not authenticated",
			Code:    fiber.StatusUnauthorized,
		})
	}

	// Delete user location
	if err := h.locationService.DeleteUserLocation(c.Context(), userID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(dto.ErrorResponse{
			Error:   "internal_error",
			Message: "Failed to delete location",
			Code:    fiber.StatusInternalServerError,
		})
	}

	return c.Status(fiber.StatusOK).JSON(dto.SuccessResponse{
		Success: true,
		Message: "Location deleted successfully",
	})
}

// GetPrivacySettings handles GET /privacy endpoint
func (h *LocationHandler) GetPrivacySettings(c *fiber.Ctx) error {
	// Get user ID from JWT token
	userID, err := middleware.GetUserIDFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(dto.ErrorResponse{
			Error:   "unauthorized",
			Message: "User not authenticated",
			Code:    fiber.StatusUnauthorized,
		})
	}

	// Get privacy settings
	response, err := h.privacyService.GetPrivacySettings(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(dto.ErrorResponse{
			Error:   "internal_error",
			Message: "Failed to get privacy settings",
			Code:    fiber.StatusInternalServerError,
		})
	}

	return c.Status(fiber.StatusOK).JSON(dto.SuccessResponse{
		Success: true,
		Message: "Privacy settings retrieved successfully",
		Data:    response,
	})
}

// UpdatePrivacySettings handles PUT /privacy endpoint
func (h *LocationHandler) UpdatePrivacySettings(c *fiber.Ctx) error {
	// Get user ID from JWT token
	userID, err := middleware.GetUserIDFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(dto.ErrorResponse{
			Error:   "unauthorized",
			Message: "User not authenticated",
			Code:    fiber.StatusUnauthorized,
		})
	}

	// Parse request body
	var req dto.PrivacySettingsUpdateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(dto.ErrorResponse{
			Error:   "invalid_request",
			Message: "Invalid request body",
			Code:    fiber.StatusBadRequest,
		})
	}

	// Validate request
	if err := h.validator.Struct(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(dto.ErrorResponse{
			Error:   "validation_error",
			Message: err.Error(),
			Code:    fiber.StatusBadRequest,
		})
	}

	// Update privacy settings
	response, err := h.privacyService.UpdatePrivacySettings(c.Context(), userID, &req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(dto.ErrorResponse{
			Error:   "internal_error",
			Message: "Failed to update privacy settings",
			Code:    fiber.StatusInternalServerError,
		})
	}

	return c.Status(fiber.StatusOK).JSON(dto.SuccessResponse{
		Success: true,
		Message: "Privacy settings updated successfully",
		Data:    response,
	})
}
