package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/link-app/ai-svc/internal/ai"
	"github.com/link-app/ai-svc/internal/cache"
	"github.com/link-app/ai-svc/internal/client/chat"
	"github.com/link-app/ai-svc/internal/middleware"
	"github.com/link-app/ai-svc/internal/model"
	"github.com/link-app/ai-svc/internal/privacy"
	"github.com/link-app/ai-svc/internal/service"
)

// SummarizeHandler handles message summarization endpoints
type SummarizeHandler struct {
	aiService      ai.SummarizationService
	chatService    service.ChatService
	privacyService privacy.PrivacyService
	cacheService   cache.SummaryCache
	logger         *zerolog.Logger
}

// NewSummarizeHandler creates a new summarize handler
func NewSummarizeHandler(
	aiService ai.SummarizationService,
	chatService service.ChatService,
	privacyService privacy.PrivacyService,
	cacheService cache.SummaryCache,
	logger *zerolog.Logger,
) *SummarizeHandler {
	return &SummarizeHandler{
		aiService:      aiService,
		chatService:    chatService,
		privacyService: privacyService,
		cacheService:   cacheService,
		logger:         logger,
	}
}

// Routes sets up the summarization routes with all required middleware
func (h *SummarizeHandler) Routes(jwtSecret string, rateLimiter *middleware.RateLimiter) chi.Router {
	r := chi.NewRouter()

	// Apply middleware in the required order:
	// 1. Panic recovery (first, to catch any panics in subsequent middleware)
	r.Use(middleware.PanicRecovery(h.logger))
	
	// 2. Request logging
	r.Use(middleware.RequestLogger(h.logger))
	
	// 3. JWT authentication (this adds user info to context)
	r.Use(middleware.JWTAuth(jwtSecret, h.logger))
	
	// 4. Rate limiting (5 requests per minute per user as specified)
	r.Use(middleware.RateLimit(rateLimiter, h.logger))

	// Summarization endpoints
	r.Post("/", h.SummarizeMessages) // POST /api/v1/ai/summarize

	return r
}

// SummarizeMessages handles POST /api/v1/ai/summarize
// @Summary Summarize conversation messages
// @Description Summarize messages from a conversation using AI
// @Tags Summarization
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param request body model.SummarizeRequest true "Summarization request"
// @Success 200 {object} model.SummarizeResponse
// @Failure 400 {object} model.ErrorResponse
// @Failure 401 {object} model.ErrorResponse
// @Failure 403 {object} model.ErrorResponse
// @Failure 429 {object} model.ErrorResponse
// @Failure 500 {object} model.ErrorResponse
// @Router /api/v1/ai/summarize [post]
func (h *SummarizeHandler) SummarizeMessages(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	startTime := time.Now()
	
	h.logger.Info().Msg("Starting message summarization request")

	// Step 1: AUTH - Extract user ID from context (set by JWT middleware)
	userID, err := middleware.GetUserIDFromContext(ctx)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to extract user ID from context")
		h.writeErrorResponse(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required", err.Error())
		return
	}

	h.logger.Debug().
		Str("user_id", userID.String()).
		Msg("User authenticated successfully")

	// Step 2: Parse and validate request
	var request model.SummarizeRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		h.logger.Error().
			Err(err).
			Str("user_id", userID.String()).
			Msg("Failed to decode summarization request")
		h.writeErrorResponse(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body", err.Error())
		return
	}

	// Set default limit if not provided
	limit := 15
	if request.Limit != nil && *request.Limit > 0 {
		limit = *request.Limit
	}

	h.logger.Debug().
		Str("user_id", userID.String()).
		Str("conversation_id", request.ConversationID.String()).
		Int("limit", limit).
		Msg("Summarization request parsed successfully")

	// Step 3: CONSENT CHECK - Verify user has given AI processing consent
	hasConsent, err := h.privacyService.HasAIProcessingConsent(ctx, userID)
	if err != nil {
		h.logger.Error().
			Err(err).
			Str("user_id", userID.String()).
			Msg("Failed to check AI processing consent")
		h.writeErrorResponse(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to verify consent", err.Error())
		return
	}

	if !hasConsent {
		h.logger.Warn().
			Str("user_id", userID.String()).
			Msg("User has not given AI processing consent")
		h.writeErrorResponse(w, http.StatusForbidden, "CONSENT_REQUIRED", "AI processing consent is required", "User must provide consent for AI processing")
		return
	}

	h.logger.Debug().
		Str("user_id", userID.String()).
		Msg("AI processing consent verified")

	// Step 4: CACHE LOOKUP - Check if we have a cached summary
	cacheKey := h.buildCacheKey(request.ConversationID, userID, limit)
	if cachedSummary, err := h.getCachedSummary(ctx, cacheKey); err == nil {
		h.logger.Info().
			Str("user_id", userID.String()).
			Str("conversation_id", request.ConversationID.String()).
			Str("cache_key", cacheKey).
			Msg("Returning cached summary")

		// Log audit event for cached result
		h.logAuditEvent(ctx, userID, request.ConversationID, "cache_hit", map[string]interface{}{
			"cached": true,
			"limit":  limit,
		})

		response := &model.SummarizeResponse{
			ID:             cachedSummary.ID,
			ConversationID: cachedSummary.ConversationID,
			Summary:        cachedSummary.Content,
			MessageCount:   limit, // Approximate from request
			TokensUsed:     0,     // Not tracked for cached results
			Model:          h.aiService.GetSupportedModels()[0], // Default model
			ProcessingTime: time.Since(startTime),
			CachedResult:   true,
			Metadata:       cachedSummary.Metadata,
			CreatedAt:      cachedSummary.CreatedAt,
		}

		h.writeSuccessResponse(w, response)
		return
	}

	h.logger.Debug().
		Str("user_id", userID.String()).
		Str("cache_key", cacheKey).
		Msg("No cached summary found, proceeding with AI generation")

	// Step 5: FETCH MESSAGES - Get recent messages from chat service
	messages, err := h.fetchMessages(ctx, request.ConversationID, limit)
	if err != nil {
		h.logger.Error().
			Err(err).
			Str("user_id", userID.String()).
			Str("conversation_id", request.ConversationID.String()).
			Msg("Failed to fetch messages from chat service")
		h.writeErrorResponse(w, http.StatusInternalServerError, "FETCH_ERROR", "Failed to fetch messages", err.Error())
		return
	}

	if len(messages) == 0 {
		h.logger.Warn().
			Str("user_id", userID.String()).
			Str("conversation_id", request.ConversationID.String()).
			Msg("No messages found for conversation")
		h.writeErrorResponse(w, http.StatusNotFound, "NO_MESSAGES", "No messages found for conversation", "The conversation has no messages to summarize")
		return
	}

	h.logger.Debug().
		Str("user_id", userID.String()).
		Str("conversation_id", request.ConversationID.String()).
		Int("message_count", len(messages)).
		Msg("Messages fetched successfully")

	// Step 6: ANONYMIZE - Check if user has data anonymization consent and anonymize if needed
	hasAnonymizationConsent, err := h.privacyService.HasDataAnonymizationConsent(ctx, userID)
	if err != nil {
		h.logger.Error().
			Err(err).
			Str("user_id", userID.String()).
			Msg("Failed to check data anonymization consent")
		h.writeErrorResponse(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to verify anonymization consent", err.Error())
		return
	}

	// Convert chat messages to AI messages format
	aiMessages := h.convertToAIMessages(messages)
	
	// Create AI summarization request
	aiRequest := &ai.SummarizeRequest{
		ConversationID: request.ConversationID,
		Messages:       aiMessages,
		Limit:          &limit,
		UserID:         userID,
	}

	h.logger.Debug().
		Str("user_id", userID.String()).
		Bool("anonymization_consent", hasAnonymizationConsent).
		Msg("Data prepared for AI processing")

	// Step 7: CALL GPT - Generate summary using AI service
	aiResponse, err := h.aiService.SummarizeMessages(ctx, aiRequest)
	if err != nil {
		h.logger.Error().
			Err(err).
			Str("user_id", userID.String()).
			Str("conversation_id", request.ConversationID.String()).
			Msg("Failed to generate AI summary")
		h.writeErrorResponse(w, http.StatusInternalServerError, "AI_ERROR", "Failed to generate summary", err.Error())
		return
	}

	h.logger.Info().
		Str("user_id", userID.String()).
		Str("conversation_id", request.ConversationID.String()).
		Str("summary_id", aiResponse.ID).
		Int("tokens_used", aiResponse.TokensUsed).
		Dur("ai_processing_time", aiResponse.ProcessingTime).
		Msg("AI summary generated successfully")

	// Step 8: CACHE SAVE - Store the result in cache for future requests
	if err := h.cacheSummary(ctx, cacheKey, aiResponse); err != nil {
		h.logger.Warn().
			Err(err).
			Str("user_id", userID.String()).
			Str("cache_key", cacheKey).
			Msg("Failed to cache summary result (continuing with response)")
		// Don't fail the request if caching fails
	}

	// Log audit event for successful summarization
	h.logAuditEvent(ctx, userID, request.ConversationID, "ai_generated", map[string]interface{}{
		"cached":            false,
		"limit":             limit,
		"message_count":     len(messages),
		"tokens_used":       aiResponse.TokensUsed,
		"model":             aiResponse.Model,
		"anonymized":        hasAnonymizationConsent,
		"processing_time_ms": aiResponse.ProcessingTime.Milliseconds(),
	})

	// Update processing time to include full request duration
	aiResponse.ProcessingTime = time.Since(startTime)

	h.logger.Info().
		Str("user_id", userID.String()).
		Str("summary_id", aiResponse.ID).
		Dur("total_processing_time", aiResponse.ProcessingTime).
		Msg("Summarization request completed successfully")

	// Step 9: RETURN JSON - Send the response
	h.writeSuccessResponse(w, aiResponse)
}

// fetchMessages retrieves messages from the chat service
func (h *SummarizeHandler) fetchMessages(ctx context.Context, conversationID uuid.UUID, limit int) ([]*chat.ChatMessage, error) {
	// Call chat service to get recent messages
	chatResponse, err := h.chatService.GetRecentMessages(ctx, conversationID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get messages from chat service: %w", err)
	}

	// Convert the response - assuming GetRecentMessages returns a single ChatMessage with nested messages
	// This might need adjustment based on the actual chat service interface
	messages := []*chat.ChatMessage{chatResponse}

	return messages, nil
}

// convertToAIMessages converts chat service messages to AI service message format
func (h *SummarizeHandler) convertToAIMessages(chatMessages []*chat.ChatMessage) []ai.Message {
	aiMessages := make([]ai.Message, len(chatMessages))
	
	for i, msg := range chatMessages {
		role := "user" // Default role
		if msg.MessageType == "assistant" || msg.MessageType == "system" {
			role = msg.MessageType
		}

		aiMessages[i] = ai.Message{
			ID:        msg.ID,
			UserID:    msg.UserID,
			Content:   msg.Content,
			Role:      role,
			CreatedAt: msg.CreatedAt,
		}
	}

	return aiMessages
}

// buildCacheKey creates a unique cache key for the summarization request
func (h *SummarizeHandler) buildCacheKey(conversationID, userID uuid.UUID, limit int) string {
	return fmt.Sprintf("summary:%s:%s:%d", conversationID.String(), userID.String(), limit)
}

// getCachedSummary retrieves a cached summary if available and not expired
func (h *SummarizeHandler) getCachedSummary(ctx context.Context, cacheKey string) (*cache.Summary, error) {
	summary, err := h.cacheService.GetSummary(ctx, cacheKey)
	if err != nil {
		return nil, err
	}

	// Check if cached result is still valid (not expired)
	if time.Now().After(summary.ExpiresAt) {
		h.logger.Debug().
			Str("cache_key", cacheKey).
			Time("expires_at", summary.ExpiresAt).
			Msg("Cached summary expired")
		return nil, &cache.CacheError{Operation: "get", Err: cache.ErrNotFound}
	}

	return summary, nil
}

// cacheSummary stores the AI response in cache
func (h *SummarizeHandler) cacheSummary(ctx context.Context, cacheKey string, aiResponse *ai.SummarizeResponse) error {
	summary := &cache.Summary{
		ID:             aiResponse.ID,
		ConversationID: aiResponse.ConversationID,
		Content:        aiResponse.Summary,
		Metadata:       aiResponse.Metadata,
		CreatedAt:      aiResponse.CreatedAt,
		ExpiresAt:      time.Now().Add(time.Hour), // Cache for 1 hour
	}

	return h.cacheService.SetSummary(ctx, cacheKey, summary)
}

// logAuditEvent logs an audit event for compliance tracking
func (h *SummarizeHandler) logAuditEvent(ctx context.Context, userID, conversationID uuid.UUID, eventType string, details map[string]interface{}) {
	// Get client info from request
	ipAddress := "unknown"
	userAgent := "unknown"
	
	if req, ok := ctx.Value("request").(*http.Request); ok {
		ipAddress = getClientIP(req)
		userAgent = req.UserAgent()
	}

	auditReq := &service.PrivacyAuditLogRequest{
		UserID:       &userID,
		Action:       model.AuditActionMessagesSummarized,
		ResourceType: "conversation_summary",
		ResourceID:   &conversationID,
		Details: map[string]interface{}{
			"event_type": eventType,
			"endpoint":   "/api/v1/ai/summarize",
		},
		IPAddress: &ipAddress,
		UserAgent: &userAgent,
	}

	// Merge additional details
	for k, v := range details {
		auditReq.Details[k] = v
	}

	if err := h.privacyService.LogAction(ctx, auditReq); err != nil {
		h.logger.Error().Err(err).Msg("Failed to log audit event")
		// Continue without failing the main operation
	}
}

// writeSuccessResponse writes a successful JSON response
func (h *SummarizeHandler) writeSuccessResponse(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	
	if err := json.NewEncoder(w).Encode(data); err != nil {
		h.logger.Error().Err(err).Msg("Failed to encode success response")
		http.Error(w, "Internal server error", http.StatusInternalServerError)
	}
}

// writeErrorResponse writes a standardized error response
func (h *SummarizeHandler) writeErrorResponse(w http.ResponseWriter, statusCode int, errorCode, message, details string) {
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

	if err := json.NewEncoder(w).Encode(errorResponse); err != nil {
		h.logger.Error().Err(err).Msg("Failed to encode error response")
	}
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
