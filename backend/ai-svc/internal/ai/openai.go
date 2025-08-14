package ai

import (
	"context"
	"crypto/sha256"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/sashabaranov/go-openai"

	"github.com/link-app/ai-svc/internal/cache"
	"github.com/link-app/ai-svc/internal/config"
	"github.com/link-app/ai-svc/internal/privacy"
)

// OpenAIService implements AI service using OpenAI GPT models
type OpenAIService struct {
	client      *openai.Client
	config      *config.AIConfig
	cache       cache.SummaryCache
	anonymizer  *privacy.Anonymizer
	logger      zerolog.Logger
	keyBuilder  *cache.KeyBuilder
}

// SummarizeRequest represents a request to summarize messages
type SummarizeRequest struct {
	ConversationID uuid.UUID `json:"conversation_id"`
	Messages       []Message `json:"messages"`
	Limit          *int      `json:"limit,omitempty"` // Default 15 if not specified
	UserID         uuid.UUID `json:"user_id"`
}

// Message represents a single chat message
type Message struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	Content   string    `json:"content"`
	Role      string    `json:"role"` // user, assistant, system
	CreatedAt time.Time `json:"created_at"`
}

// SummarizeResponse represents the response from summarization
type SummarizeResponse struct {
	ID             string                 `json:"id"`
	ConversationID uuid.UUID              `json:"conversation_id"`
	Summary        string                 `json:"summary"`
	MessageCount   int                    `json:"message_count"`
	TokensUsed     int                    `json:"tokens_used"`
	Model          string                 `json:"model"`
	ProcessingTime time.Duration          `json:"processing_time"`
	CachedResult   bool                   `json:"cached_result"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt      time.Time              `json:"created_at"`
}

// RetryConfig holds configuration for retry logic
type RetryConfig struct {
	MaxRetries      int
	BaseDelay       time.Duration
	MaxDelay        time.Duration
	BackoffFactor   float64
}

// NewOpenAIService creates a new OpenAI service instance
func NewOpenAIService(
	cfg *config.AIConfig,
	cacheService cache.SummaryCache,
	logger zerolog.Logger,
) *OpenAIService {
	client := openai.NewClient(cfg.APIKey)
	
	return &OpenAIService{
		client:     client,
		config:     cfg,
		cache:      cacheService,
		anonymizer: privacy.NewAnonymizer(),
		logger:     logger.With().Str("component", "openai_service").Logger(),
		keyBuilder: cache.NewKeyBuilder(),
	}
}

// SummarizeMessages summarizes a conversation's messages using OpenAI GPT
func (s *OpenAIService) SummarizeMessages(ctx context.Context, req *SummarizeRequest) (*SummarizeResponse, error) {
	startTime := time.Now()
	
	// Set default limit if not provided
	limit := 15
	if req.Limit != nil && *req.Limit > 0 {
		limit = *req.Limit
	}
	
	s.logger.Info().
		Str("conversation_id", req.ConversationID.String()).
		Str("user_id", req.UserID.String()).
		Int("message_count", len(req.Messages)).
		Int("limit", limit).
		Msg("Starting message summarization")

	// Check cache first
	cacheKey := s.buildCacheKey(req.ConversationID, req.Messages, limit)
	if cachedSummary, err := s.getCachedSummary(ctx, cacheKey); err == nil {
		s.logger.Info().
			Str("cache_key", cacheKey).
			Msg("Returning cached summary")
		
		return &SummarizeResponse{
			ID:             cachedSummary.ID,
			ConversationID: cachedSummary.ConversationID,
			Summary:        cachedSummary.Content,
			MessageCount:   limit,
			TokensUsed:     0, // Not tracked for cached results
			Model:          s.config.Model,
			ProcessingTime: time.Since(startTime),
			CachedResult:   true,
			Metadata:       cachedSummary.Metadata,
			CreatedAt:      cachedSummary.CreatedAt,
		}, nil
	}

	// Prepare messages for summarization (apply limit)
	messagesToProcess := s.limitMessages(req.Messages, limit)
	
	// Anonymize PII before sending to OpenAI
	anonymizedContent, err := s.anonymizeMessages(ctx, messagesToProcess)
	if err != nil {
		s.logger.Error().Err(err).Msg("Failed to anonymize messages")
		return nil, fmt.Errorf("anonymization failed: %w", err)
	}

	// Create prompt for summarization
	prompt := s.buildSummarizationPrompt(anonymizedContent)

	// Call OpenAI API with retry logic
	response, err := s.callOpenAIWithRetry(ctx, prompt)
	if err != nil {
		s.logger.Error().Err(err).Msg("OpenAI API call failed")
		return nil, fmt.Errorf("OpenAI API call failed: %w", err)
	}

	// Create response
	summaryResponse := &SummarizeResponse{
		ID:             generateSummaryID(),
		ConversationID: req.ConversationID,
		Summary:        response.Summary,
		MessageCount:   len(messagesToProcess),
		TokensUsed:     response.TokensUsed,
		Model:          s.config.Model,
		ProcessingTime: time.Since(startTime),
		CachedResult:   false,
		Metadata: map[string]interface{}{
			"anonymized_fields": response.AnonymizedFields,
			"model_used":        s.config.Model,
			"prompt_tokens":     response.PromptTokens,
			"completion_tokens": response.CompletionTokens,
		},
		CreatedAt: time.Now(),
	}

	// Cache the result
	if err := s.cacheSummary(ctx, cacheKey, summaryResponse); err != nil {
		s.logger.Warn().Err(err).Msg("Failed to cache summary")
		// Don't fail the request if caching fails
	}

	s.logger.Info().
		Str("summary_id", summaryResponse.ID).
		Int("tokens_used", summaryResponse.TokensUsed).
		Dur("processing_time", summaryResponse.ProcessingTime).
		Msg("Successfully generated summary")

	return summaryResponse, nil
}

// OpenAIResponse represents the internal response from OpenAI
type OpenAIResponse struct {
	Summary           string   `json:"summary"`
	TokensUsed        int      `json:"tokens_used"`
	PromptTokens      int      `json:"prompt_tokens"`
	CompletionTokens  int      `json:"completion_tokens"`
	AnonymizedFields  []string `json:"anonymized_fields"`
}

// callOpenAIWithRetry makes API calls with exponential backoff retry logic
func (s *OpenAIService) callOpenAIWithRetry(ctx context.Context, prompt string) (*OpenAIResponse, error) {
	retryConfig := RetryConfig{
		MaxRetries:    s.config.MaxRetries,
		BaseDelay:     250 * time.Millisecond,
		MaxDelay:      30 * time.Second,
		BackoffFactor: 2.0,
	}

	var lastErr error
	
	for attempt := 0; attempt <= retryConfig.MaxRetries; attempt++ {
		if attempt > 0 {
			delay := s.calculateBackoffDelay(attempt-1, retryConfig)
			s.logger.Debug().
				Int("attempt", attempt).
				Dur("delay", delay).
				Msg("Retrying OpenAI API call after delay")
			
			select {
			case <-time.After(delay):
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		}

		// Create context with timeout for this specific attempt
		requestCtx, cancel := context.WithTimeout(ctx, s.config.Timeout)
		
		response, err := s.makeOpenAIRequest(requestCtx, prompt)
		cancel() // Clean up the timeout context
		
		if err == nil {
			if attempt > 0 {
				s.logger.Info().
					Int("attempt", attempt).
					Msg("OpenAI API call succeeded after retry")
			}
			return response, nil
		}
		
		lastErr = err
		
		// Check if error is retryable
		if !s.isRetryableError(err) {
			s.logger.Error().
				Err(err).
				Int("attempt", attempt).
				Msg("Non-retryable error from OpenAI API")
			return nil, err
		}
		
		s.logger.Warn().
			Err(err).
			Int("attempt", attempt).
			Int("max_retries", retryConfig.MaxRetries).
			Msg("OpenAI API call failed, will retry")
	}

	s.logger.Error().
		Err(lastErr).
		Int("max_retries", retryConfig.MaxRetries).
		Msg("All OpenAI API retry attempts failed")
	
	return nil, fmt.Errorf("OpenAI API failed after %d retries: %w", retryConfig.MaxRetries, lastErr)
}

// makeOpenAIRequest makes the actual API request to OpenAI
func (s *OpenAIService) makeOpenAIRequest(ctx context.Context, prompt string) (*OpenAIResponse, error) {
	request := openai.ChatCompletionRequest{
		Model: s.config.Model,
		Messages: []openai.ChatCompletionMessage{
			{
				Role:    openai.ChatMessageRoleSystem,
				Content: "You are a helpful assistant that creates concise summaries of chat conversations. Focus on key points, decisions, and important information while maintaining context.",
			},
			{
				Role:    openai.ChatMessageRoleUser,
				Content: prompt,
			},
		},
		MaxTokens:   s.config.MaxTokens,
		Temperature: float32(s.config.Temperature),
	}

	resp, err := s.client.CreateChatCompletion(ctx, request)
	if err != nil {
		return nil, fmt.Errorf("OpenAI API request failed: %w", err)
	}

	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("no response choices returned from OpenAI")
	}

	summary := strings.TrimSpace(resp.Choices[0].Message.Content)
	if summary == "" {
		return nil, fmt.Errorf("empty summary returned from OpenAI")
	}

	return &OpenAIResponse{
		Summary:          summary,
		TokensUsed:       resp.Usage.TotalTokens,
		PromptTokens:     resp.Usage.PromptTokens,
		CompletionTokens: resp.Usage.CompletionTokens,
		AnonymizedFields: []string{}, // Will be populated by anonymization logic
	}, nil
}

// buildSummarizationPrompt creates the prompt for message summarization
func (s *OpenAIService) buildSummarizationPrompt(messages string) string {
	template := `Summarize the following messages in 2-3 sentences, focusing on key points, decisions, and important information:

Messages:
%s

Please provide a clear, concise summary that captures the main topics and any conclusions or next steps discussed.`

	return fmt.Sprintf(template, messages)
}

// anonymizeMessages redacts PII from messages before sending to OpenAI
func (s *OpenAIService) anonymizeMessages(ctx context.Context, messages []Message) (string, error) {
	options := privacy.DefaultAnonymizationOptions()
	var messageTexts []string
	var allAnonymizedFields []string

	for i, msg := range messages {
		// Create a formatted message string
		timestamp := msg.CreatedAt.Format("2006-01-02 15:04:05")
		originalText := fmt.Sprintf("[%s] %s: %s", timestamp, msg.Role, msg.Content)

		// Anonymize the message content
		anonymizedText, fieldsAnonymized, err := s.anonymizer.AnonymizeText(originalText, options)
		if err != nil {
			s.logger.Error().
				Err(err).
				Int("message_index", i).
				Str("message_id", msg.ID.String()).
				Msg("Failed to anonymize message")
			return "", fmt.Errorf("failed to anonymize message %d: %w", i, err)
		}

		messageTexts = append(messageTexts, anonymizedText)
		allAnonymizedFields = append(allAnonymizedFields, fieldsAnonymized...)

		if len(fieldsAnonymized) > 0 {
			s.logger.Debug().
				Str("message_id", msg.ID.String()).
				Strs("anonymized_fields", fieldsAnonymized).
				Msg("Anonymized PII in message")
		}
	}

	combinedMessages := strings.Join(messageTexts, "\n\n")
	
	s.logger.Info().
		Int("message_count", len(messages)).
		Int("total_chars", len(combinedMessages)).
		Strs("anonymized_fields", uniqueStrings(allAnonymizedFields)).
		Msg("Messages anonymized for OpenAI processing")

	return combinedMessages, nil
}

// limitMessages applies the limit to the number of messages to process
func (s *OpenAIService) limitMessages(messages []Message, limit int) []Message {
	if len(messages) <= limit {
		return messages
	}

	// Take the most recent messages up to the limit
	startIndex := len(messages) - limit
	return messages[startIndex:]
}

// getCachedSummary retrieves a cached summary if available
func (s *OpenAIService) getCachedSummary(ctx context.Context, cacheKey string) (*cache.Summary, error) {
	summary, err := s.cache.GetSummary(ctx, cacheKey)
	if err != nil {
		return nil, err
	}

	// Check if cached result is still valid (not expired)
	if time.Now().After(summary.ExpiresAt) {
		s.logger.Debug().
			Str("cache_key", cacheKey).
			Time("expires_at", summary.ExpiresAt).
			Msg("Cached summary expired")
		return nil, &cache.CacheError{Operation: "get", Err: cache.ErrNotFound}
	}

	return summary, nil
}

// cacheSummary stores the summary in cache
func (s *OpenAIService) cacheSummary(ctx context.Context, cacheKey string, response *SummarizeResponse) error {
	summary := &cache.Summary{
		ID:             response.ID,
		ConversationID: response.ConversationID,
		Content:        response.Summary,
		Metadata:       response.Metadata,
		CreatedAt:      response.CreatedAt,
		ExpiresAt:      time.Now().Add(time.Hour), // Cache for 1 hour
	}

	return s.cache.SetSummary(ctx, cacheKey, summary)
}

// buildCacheKey creates a unique cache key for the summarization request
func (s *OpenAIService) buildCacheKey(conversationID uuid.UUID, messages []Message, limit int) string {
	// Create a hash of the message content for cache key uniqueness
	hasher := sha256.New()
	
	// Include conversation ID and limit
	hasher.Write([]byte(conversationID.String()))
	hasher.Write([]byte(fmt.Sprintf("limit:%d", limit)))
	
	// Include recent message IDs and timestamps to ensure uniqueness
	for i, msg := range messages {
		if i >= limit { // Only consider messages within the limit
			break
		}
		hasher.Write([]byte(msg.ID.String()))
		hasher.Write([]byte(msg.CreatedAt.Format(time.RFC3339)))
	}

	hashSum := fmt.Sprintf("%x", hasher.Sum(nil))
	return s.keyBuilder.BuildSummaryKey(conversationID, hashSum[:16]) // Use first 16 chars of hash
}

// calculateBackoffDelay calculates the delay for exponential backoff
func (s *OpenAIService) calculateBackoffDelay(attempt int, config RetryConfig) time.Duration {
	delay := time.Duration(float64(config.BaseDelay) * math.Pow(config.BackoffFactor, float64(attempt)))
	
	if delay > config.MaxDelay {
		delay = config.MaxDelay
	}
	
	return delay
}

// isRetryableError determines if an error should trigger a retry
func (s *OpenAIService) isRetryableError(err error) bool {
	if err == nil {
		return false
	}
	
	// Check for context timeout/cancellation (don't retry these)
	if err == context.DeadlineExceeded || err == context.Canceled {
		return false
	}
	
	errStr := err.Error()
	
	// Retry on common transient errors
	retryableErrors := []string{
		"rate limit",
		"rate_limit",
		"too many requests",
		"server error",
		"internal error",
		"service unavailable",
		"timeout",
		"connection",
		"network",
		"502",
		"503",
		"504",
	}
	
	for _, retryableError := range retryableErrors {
		if strings.Contains(strings.ToLower(errStr), retryableError) {
			return true
		}
	}
	
	return false
}

// Health checks the health of the OpenAI service
func (s *OpenAIService) Health(ctx context.Context) error {
	// Create a simple test request to verify API connectivity
	testCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	
	request := openai.ChatCompletionRequest{
		Model: s.config.Model,
		Messages: []openai.ChatCompletionMessage{
			{
				Role:    openai.ChatMessageRoleUser,
				Content: "Hello, this is a health check.",
			},
		},
		MaxTokens: 10,
	}

	_, err := s.client.CreateChatCompletion(testCtx, request)
	if err != nil {
		s.logger.Error().Err(err).Msg("OpenAI health check failed")
		return fmt.Errorf("OpenAI health check failed: %w", err)
	}

	return nil
}

// GetSupportedModels returns the list of supported OpenAI models
func (s *OpenAIService) GetSupportedModels() []string {
	return []string{
		"gpt-4",
		"gpt-4-turbo-preview",
		"gpt-4-1106-preview",
		"gpt-3.5-turbo",
		"gpt-3.5-turbo-1106",
		"gpt-3.5-turbo-16k",
	}
}

// ValidateModel checks if a model is supported
func (s *OpenAIService) ValidateModel(model string) bool {
	supportedModels := s.GetSupportedModels()
	for _, supportedModel := range supportedModels {
		if supportedModel == model {
			return true
		}
	}
	return false
}

// InvalidateConversationSummaries invalidates cached summaries for a conversation
func (s *OpenAIService) InvalidateConversationSummaries(ctx context.Context, conversationID uuid.UUID) error {
	err := s.cache.InvalidateByConversation(ctx, conversationID)
	if err != nil {
		s.logger.Error().
			Err(err).
			Str("conversation_id", conversationID.String()).
			Msg("Failed to invalidate conversation summaries")
		return fmt.Errorf("failed to invalidate conversation summaries: %w", err)
	}

	s.logger.Info().
		Str("conversation_id", conversationID.String()).
		Msg("Invalidated cached summaries for conversation")

	return nil
}

// Utility functions

// generateSummaryID generates a unique ID for the summary
func generateSummaryID() string {
	return uuid.New().String()
}

// uniqueStrings returns unique strings from a slice
func uniqueStrings(strings []string) []string {
	keys := make(map[string]bool)
	var result []string
	
	for _, str := range strings {
		if !keys[str] {
			keys[str] = true
			result = append(result, str)
		}
	}
	
	return result
}
