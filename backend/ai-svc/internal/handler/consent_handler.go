package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"

	"github.com/link-app/ai-svc/internal/model"
	"github.com/link-app/ai-svc/internal/privacy"
)

// ConsentHandler handles privacy and consent endpoints
type ConsentHandler struct {
	privacyService privacy.PrivacyService
	logger         *zerolog.Logger
}

// NewConsentHandler creates a new consent handler
func NewConsentHandler(privacyService privacy.PrivacyService, logger *zerolog.Logger) *ConsentHandler {
	return &ConsentHandler{
		privacyService: privacyService,
		logger:         logger,
	}
}

// Routes sets up the consent-related routes
func (h *ConsentHandler) Routes() chi.Router {
	r := chi.NewRouter()

	// Consent management endpoints
	r.Get("/", h.GetUserConsent)    // GET /api/v1/ai/consent
	r.Put("/", h.UpdateUserConsent) // PUT /api/v1/ai/consent
	r.Delete("/", h.RevokeAllConsent) // DELETE /api/v1/ai/consent (GDPR right to withdraw)

	// Audit endpoints (for compliance)
	r.Get("/audit", h.GetUserAuditLogs) // GET /api/v1/ai/consent/audit
	
	// Privacy policy endpoints
	r.Get("/policy", h.GetPrivacyPolicy) // GET /api/v1/ai/consent/policy

	return r
}

// GetUserConsent handles GET /api/v1/ai/consent
// @Summary Get user consent preferences
// @Description Retrieve the current AI processing consent settings for the authenticated user
// @Tags Consent
// @Security BearerAuth
// @Produce json
// @Success 200 {object} model.ConsentResponse
// @Failure 400 {object} model.ErrorResponse
// @Failure 401 {object} model.ErrorResponse
// @Failure 500 {object} model.ErrorResponse
// @Router /api/v1/ai/consent [get]
func (h *ConsentHandler) GetUserConsent(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Extract user ID from request (JWT or header)
	userID, err := h.privacyService.ExtractUserIDFromRequest(r)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to extract user ID from request")
		h.writeErrorResponse(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required", err.Error())
		return
	}

	// Get user consent
	consent, err := h.privacyService.GetUserConsent(ctx, userID)
	if err != nil {
		h.logger.Error().Err(err).Str("user_id", userID.String()).Msg("Failed to get user consent")
		h.writeErrorResponse(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to retrieve consent", err.Error())
		return
	}

	// Convert to response format
	response := &model.ConsentResponse{
		UserID:                   consent.UserID,
		AIProcessingConsent:      consent.AIProcessingConsent,
		DataAnonymizationConsent: consent.DataAnonymizationConsent,
		AnalyticsConsent:         consent.AnalyticsConsent,
		MarketingConsent:         consent.MarketingConsent,
		ConsentVersion:           consent.ConsentVersion,
		ConsentGivenAt:           consent.ConsentGivenAt,
		ConsentWithdrawnAt:       consent.ConsentWithdrawnAt,
		UpdatedAt:                consent.UpdatedAt,
	}

	// Log the access for audit purposes
	ipAddress := getClientIP(r)
	userAgent := r.UserAgent()
	
	auditReq := &privacy.AuditLogRequest{
		UserID:       &userID,
		Action:       model.AuditActionDataAccessed,
		ResourceType: "user_consent",
		ResourceID:   &consent.ID,
		Details: map[string]interface{}{
			"access_type": "consent_retrieval",
			"endpoint":    "/api/v1/ai/consent",
		},
		IPAddress: &ipAddress,
		UserAgent: &userAgent,
	}

	if err := h.privacyService.LogAction(ctx, auditReq); err != nil {
		h.logger.Error().Err(err).Msg("Failed to log consent access audit")
		// Continue without failing the main operation
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

// UpdateUserConsent handles PUT /api/v1/ai/consent
// @Summary Update user consent preferences
// @Description Update AI processing consent settings for the authenticated user
// @Tags Consent
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param consent body model.ConsentRequest true "Consent preferences to update"
// @Success 200 {object} model.ConsentResponse
// @Failure 400 {object} model.ErrorResponse
// @Failure 401 {object} model.ErrorResponse
// @Failure 500 {object} model.ErrorResponse
// @Router /api/v1/ai/consent [put]
func (h *ConsentHandler) UpdateUserConsent(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Extract user ID from request (JWT or header)
	userID, err := h.privacyService.ExtractUserIDFromRequest(r)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to extract user ID from request")
		h.writeErrorResponse(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required", err.Error())
		return
	}

	// Parse request body
	var request model.ConsentRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		h.logger.Error().Err(err).Msg("Failed to decode consent request")
		h.writeErrorResponse(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body", err.Error())
		return
	}

	// Get client info for audit logging
	ipAddress := getClientIP(r)
	userAgent := r.UserAgent()

	// Update consent
	response, err := h.privacyService.UpdateUserConsent(ctx, userID, &request, ipAddress, userAgent)
	if err != nil {
		h.logger.Error().Err(err).Str("user_id", userID.String()).Msg("Failed to update user consent")
		h.writeErrorResponse(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to update consent", err.Error())
		return
	}

	h.logger.Info().
		Str("user_id", userID.String()).
		Bool("ai_processing_consent", response.AIProcessingConsent).
		Bool("data_anonymization_consent", response.DataAnonymizationConsent).
		Bool("analytics_consent", response.AnalyticsConsent).
		Bool("marketing_consent", response.MarketingConsent).
		Msg("User consent updated")

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

// RevokeAllConsent handles DELETE /api/v1/ai/consent
// @Summary Revoke all consent (GDPR right to withdraw)
// @Description Revoke all AI processing consent for the authenticated user
// @Tags Consent
// @Security BearerAuth
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} model.ErrorResponse
// @Failure 500 {object} model.ErrorResponse
// @Router /api/v1/ai/consent [delete]
func (h *ConsentHandler) RevokeAllConsent(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Extract user ID from request (JWT or header)
	userID, err := h.privacyService.ExtractUserIDFromRequest(r)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to extract user ID from request")
		h.writeErrorResponse(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required", err.Error())
		return
	}

	// Get client info for audit logging
	ipAddress := getClientIP(r)
	userAgent := r.UserAgent()

	// Revoke all consent
	err = h.privacyService.RevokeAllConsent(ctx, userID, ipAddress, userAgent)
	if err != nil {
		h.logger.Error().Err(err).Str("user_id", userID.String()).Msg("Failed to revoke consent")
		h.writeErrorResponse(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to revoke consent", err.Error())
		return
	}

	h.logger.Info().Str("user_id", userID.String()).Msg("All consent revoked for user")

	revokeResponse := map[string]interface{}{
		"message":    "All consent has been successfully revoked",
		"user_id":    userID,
		"revoked_at": time.Now(),
		"gdpr_compliant": true,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(revokeResponse)
}

// GetUserAuditLogs handles GET /api/v1/ai/consent/audit
// @Summary Get user audit logs
// @Description Retrieve audit logs for the authenticated user (GDPR/CCPA compliance)
// @Tags Consent
// @Security BearerAuth
// @Produce json
// @Param limit query int false "Limit number of results (default 50, max 200)"
// @Param offset query int false "Offset for pagination (default 0)"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} model.ErrorResponse
// @Failure 401 {object} model.ErrorResponse
// @Failure 500 {object} model.ErrorResponse
// @Router /api/v1/ai/consent/audit [get]
func (h *ConsentHandler) GetUserAuditLogs(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Extract user ID from request (JWT or header)
	userID, err := h.privacyService.ExtractUserIDFromRequest(r)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to extract user ID from request")
		h.writeErrorResponse(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required", err.Error())
		return
	}

	// Parse query parameters
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50 // default
	if limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 && parsedLimit <= 200 {
			limit = parsedLimit
		}
	}

	offset := 0 // default
	if offsetStr != "" {
		if parsedOffset, err := strconv.Atoi(offsetStr); err == nil && parsedOffset >= 0 {
			offset = parsedOffset
		}
	}

	// Get audit logs
	logs, totalCount, err := h.privacyService.GetUserAuditLogs(ctx, userID, limit, offset)
	if err != nil {
		h.logger.Error().Err(err).Str("user_id", userID.String()).Msg("Failed to get user audit logs")
		h.writeErrorResponse(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to retrieve audit logs", err.Error())
		return
	}

	// Calculate pagination info
	hasNext := (offset + len(logs)) < int(totalCount)
	hasPrev := offset > 0

	response := map[string]interface{}{
		"audit_logs": logs,
		"pagination": map[string]interface{}{
			"total_count": totalCount,
			"limit":       limit,
			"offset":      offset,
			"returned":    len(logs),
			"has_next":    hasNext,
			"has_prev":    hasPrev,
		},
		"user_id": userID,
	}

	// Log the audit access for compliance
	ipAddress := getClientIP(r)
	userAgent := r.UserAgent()
	
	auditReq := &privacy.AuditLogRequest{
		UserID:       &userID,
		Action:       model.AuditActionDataAccessed,
		ResourceType: "audit_logs",
		Details: map[string]interface{}{
			"access_type": "audit_log_retrieval",
			"endpoint":    "/api/v1/ai/consent/audit",
			"limit":       limit,
			"offset":      offset,
			"returned":    len(logs),
		},
		IPAddress: &ipAddress,
		UserAgent: &userAgent,
	}

	if err := h.privacyService.LogAction(ctx, auditReq); err != nil {
		h.logger.Error().Err(err).Msg("Failed to log audit access")
		// Continue without failing the main operation
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

// GetPrivacyPolicy handles GET /api/v1/ai/consent/policy
// @Summary Get current privacy policy
// @Description Retrieve the current active privacy policy version
// @Tags Consent
// @Produce json
// @Success 200 {object} model.PrivacyPolicyVersion
// @Failure 500 {object} model.ErrorResponse
// @Router /api/v1/ai/consent/policy [get]
func (h *ConsentHandler) GetPrivacyPolicy(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get active privacy policy
	policy, err := h.privacyService.GetActivePrivacyPolicyVersion(ctx)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get active privacy policy")
		h.writeErrorResponse(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to retrieve privacy policy", err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(policy)
}

// writeErrorResponse writes a standardized error response
func (h *ConsentHandler) writeErrorResponse(w http.ResponseWriter, statusCode int, errorCode, message, details string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	
	errorResponse := model.ErrorResponse{
		Error:   errorCode,
		Message: message,
		Code:    errorCode,
		Details: map[string]string{
			"details": details,
		},
	}
	
	json.NewEncoder(w).Encode(errorResponse)
}

// getClientIP extracts the client IP address from the request
func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header (from load balancers/proxies)
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		// Get the first IP in the chain
		if idx := strings.Index(forwarded, ","); idx != -1 {
			return strings.TrimSpace(forwarded[:idx])
		}
		return strings.TrimSpace(forwarded)
	}

	// Check X-Real-IP header (from reverse proxies)
	if realIP := r.Header.Get("X-Real-IP"); realIP != "" {
		return strings.TrimSpace(realIP)
	}

	// Fallback to RemoteAddr
	if idx := strings.LastIndex(r.RemoteAddr, ":"); idx != -1 {
		return r.RemoteAddr[:idx]
	}
	return r.RemoteAddr
}
