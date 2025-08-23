package cache

import (
	"bytes"
	"context"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// CacheMiddlewareConfig configures the cache middleware
type CacheMiddlewareConfig struct {
	Cache              CacheInterface
	DefaultTTL         time.Duration
	KeyPrefix          string
	SkipIfError        bool              // Continue without cache if cache fails
	CacheHeaders       bool              // Include cache-related headers in response
	VaryHeaders        []string          // Headers to include in cache key generation
	SkipMethods        []string          // HTTP methods to skip caching (default: POST, PUT, DELETE, PATCH)
	SkipPaths          []string          // Paths to skip caching
	SkipQuery          []string          // Query parameters to exclude from cache key
	ConditionalHeaders bool              // Support conditional headers (ETag, Last-Modified)
	MaxBodySize        int64             // Maximum response body size to cache (default: 1MB)
	KeyGenerator       CacheKeyGenerator // Custom key generator
}

// CacheKeyGenerator generates cache keys for requests
type CacheKeyGenerator func(r *http.Request, config *CacheMiddlewareConfig) string

// CacheMiddleware provides HTTP response caching
type CacheMiddleware struct {
	config *CacheMiddlewareConfig
}

// CachedResponse represents a cached HTTP response
type CachedResponse struct {
	Status    int                 `json:"status"`
	Headers   map[string][]string `json:"headers"`
	Body      []byte              `json:"body"`
	ETag      string              `json:"etag,omitempty"`
	Timestamp time.Time           `json:"timestamp"`
}

// NewCacheMiddleware creates a new cache middleware instance
func NewCacheMiddleware(config *CacheMiddlewareConfig) *CacheMiddleware {
	// Set defaults
	if config.DefaultTTL == 0 {
		config.DefaultTTL = 15 * time.Minute
	}
	if config.KeyPrefix == "" {
		config.KeyPrefix = "http"
	}
	if len(config.SkipMethods) == 0 {
		config.SkipMethods = []string{"POST", "PUT", "DELETE", "PATCH"}
	}
	if config.MaxBodySize == 0 {
		config.MaxBodySize = 1024 * 1024 // 1MB
	}
	if config.KeyGenerator == nil {
		config.KeyGenerator = DefaultKeyGenerator
	}

	return &CacheMiddleware{
		config: config,
	}
}

// Handler returns an HTTP middleware handler
func (cm *CacheMiddleware) Handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip caching for certain methods
		if cm.shouldSkipMethod(r.Method) {
			next.ServeHTTP(w, r)
			return
		}

		// Skip caching for certain paths
		if cm.shouldSkipPath(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}

		// Generate cache key
		cacheKey := cm.config.KeyGenerator(r, cm.config)

		// Try to get from cache
		cached, err := cm.getFromCache(r.Context(), cacheKey)
		if err == nil && cached != nil {
			// Cache hit
			cm.serveCachedResponse(w, r, cached)
			return
		}

		// Cache miss or error - continue with request
		if err != nil && !cm.config.SkipIfError {
			// Log error but continue
			// In production, you might want to use a proper logger
			fmt.Printf("Cache error for key %s: %v\n", cacheKey, err)
		}

		// Create response writer wrapper to capture response
		wrapper := &responseWrapper{
			ResponseWriter: w,
			body:           &bytes.Buffer{},
			headers:        make(map[string][]string),
		}

		// Call next handler
		next.ServeHTTP(wrapper, r)

		// Cache the response if appropriate
		if cm.shouldCacheResponse(wrapper) {
			cm.cacheResponse(r.Context(), cacheKey, wrapper)
		}
	})
}

// getFromCache retrieves a cached response
func (cm *CacheMiddleware) getFromCache(ctx context.Context, key string) (*CachedResponse, error) {
	data, err := cm.config.Cache.Get(ctx, key)
	if err != nil {
		return nil, err
	}

	var cached CachedResponse
	if err := json.Unmarshal(data, &cached); err != nil {
		return nil, fmt.Errorf("failed to unmarshal cached response: %w", err)
	}

	return &cached, nil
}

// cacheResponse stores a response in cache
func (cm *CacheMiddleware) cacheResponse(ctx context.Context, key string, wrapper *responseWrapper) {
	// Don't cache if body is too large
	if wrapper.body.Len() > int(cm.config.MaxBodySize) {
		return
	}

	// Create cached response
	cached := &CachedResponse{
		Status:    wrapper.status,
		Headers:   wrapper.headers,
		Body:      wrapper.body.Bytes(),
		Timestamp: time.Now(),
	}

	// Generate ETag if enabled
	if cm.config.ConditionalHeaders {
		cached.ETag = cm.generateETag(cached.Body)
		cached.Headers["ETag"] = []string{cached.ETag}
	}

	// Serialize and store
	data, err := json.Marshal(cached)
	if err != nil {
		if !cm.config.SkipIfError {
			fmt.Printf("Failed to marshal response for caching: %v\n", err)
		}
		return
	}

	err = cm.config.Cache.Set(ctx, key, data, cm.config.DefaultTTL)
	if err != nil && !cm.config.SkipIfError {
		fmt.Printf("Failed to cache response: %v\n", err)
	}
}

// serveCachedResponse serves a cached response
func (cm *CacheMiddleware) serveCachedResponse(w http.ResponseWriter, r *http.Request, cached *CachedResponse) {
	// Handle conditional headers
	if cm.config.ConditionalHeaders && cached.ETag != "" {
		if ifNoneMatch := r.Header.Get("If-None-Match"); ifNoneMatch != "" {
			if ifNoneMatch == cached.ETag || ifNoneMatch == "*" {
				w.WriteHeader(http.StatusNotModified)
				return
			}
		}
	}

	// Set cache headers if enabled
	if cm.config.CacheHeaders {
		age := time.Since(cached.Timestamp).Seconds()
		w.Header().Set("X-Cache", "HIT")
		w.Header().Set("Age", strconv.FormatFloat(age, 'f', 0, 64))
	}

	// Copy cached headers
	for name, values := range cached.Headers {
		for _, value := range values {
			w.Header().Add(name, value)
		}
	}

	// Write status and body
	w.WriteHeader(cached.Status)
	w.Write(cached.Body)
}

// shouldSkipMethod checks if the HTTP method should skip caching
func (cm *CacheMiddleware) shouldSkipMethod(method string) bool {
	for _, skipMethod := range cm.config.SkipMethods {
		if strings.EqualFold(method, skipMethod) {
			return true
		}
	}
	return false
}

// shouldSkipPath checks if the path should skip caching
func (cm *CacheMiddleware) shouldSkipPath(path string) bool {
	for _, skipPath := range cm.config.SkipPaths {
		if strings.HasPrefix(path, skipPath) {
			return true
		}
	}
	return false
}

// shouldCacheResponse determines if a response should be cached
func (cm *CacheMiddleware) shouldCacheResponse(wrapper *responseWrapper) bool {
	// Only cache successful responses by default
	return wrapper.status >= 200 && wrapper.status < 300
}

// generateETag generates an ETag for the response body
func (cm *CacheMiddleware) generateETag(body []byte) string {
	hash := md5.Sum(body)
	return `"` + hex.EncodeToString(hash[:]) + `"`
}

// DefaultKeyGenerator generates cache keys based on request
func DefaultKeyGenerator(r *http.Request, config *CacheMiddlewareConfig) string {
	var keyParts []string

	// Add method and path
	keyParts = append(keyParts, r.Method, r.URL.Path)

	// Add query parameters (excluding skipped ones)
	if r.URL.RawQuery != "" {
		query := r.URL.Query()
		for key, values := range query {
			if !shouldSkipQueryParam(key, config.SkipQuery) {
				for _, value := range values {
					keyParts = append(keyParts, key+"="+value)
				}
			}
		}
	}

	// Add vary headers
	for _, header := range config.VaryHeaders {
		if value := r.Header.Get(header); value != "" {
			keyParts = append(keyParts, header+":"+value)
		}
	}

	// Create key
	key := strings.Join(keyParts, "|")

	// Hash if too long
	if len(key) > 200 {
		hash := md5.Sum([]byte(key))
		key = hex.EncodeToString(hash[:])
	}

	return config.KeyPrefix + ":" + key
}

// shouldSkipQueryParam checks if a query parameter should be skipped
func shouldSkipQueryParam(param string, skipParams []string) bool {
	for _, skipParam := range skipParams {
		if strings.EqualFold(param, skipParam) {
			return true
		}
	}
	return false
}

// responseWrapper captures HTTP responses for caching
type responseWrapper struct {
	http.ResponseWriter
	body    *bytes.Buffer
	status  int
	headers map[string][]string
}

func (rw *responseWrapper) Write(data []byte) (int, error) {
	// Write to both the original response and our buffer
	rw.body.Write(data)
	return rw.ResponseWriter.Write(data)
}

func (rw *responseWrapper) WriteHeader(statusCode int) {
	rw.status = statusCode

	// Copy headers
	for name, values := range rw.ResponseWriter.Header() {
		rw.headers[name] = values
	}

	rw.ResponseWriter.WriteHeader(statusCode)
}

// Invalidate provides cache invalidation functionality
func (cm *CacheMiddleware) Invalidate(ctx context.Context, patterns ...string) error {
	for _, pattern := range patterns {
		key := cm.config.KeyPrefix + ":" + pattern
		if err := cm.config.Cache.DeletePattern(ctx, key); err != nil {
			return fmt.Errorf("failed to invalidate pattern %s: %w", pattern, err)
		}
	}
	return nil
}

// InvalidateByPath invalidates cache entries for specific paths
func (cm *CacheMiddleware) InvalidateByPath(ctx context.Context, paths ...string) error {
	patterns := make([]string, len(paths))
	for i, path := range paths {
		patterns[i] = "*" + path + "*"
	}
	return cm.Invalidate(ctx, patterns...)
}

// Convenience functions for global middleware usage

var globalMiddleware *CacheMiddleware

// SetGlobalCacheMiddleware sets the global cache middleware instance
func SetGlobalCacheMiddleware(middleware *CacheMiddleware) {
	globalMiddleware = middleware
}

// GetGlobalCacheMiddleware returns the global cache middleware instance
func GetGlobalCacheMiddleware() *CacheMiddleware {
	return globalMiddleware
}

// InvalidateGlobal invalidates cache using the global middleware
func InvalidateGlobal(ctx context.Context, patterns ...string) error {
	if globalMiddleware == nil {
		return fmt.Errorf("global cache middleware not set")
	}
	return globalMiddleware.Invalidate(ctx, patterns...)
}

// InvalidateGlobalByPath invalidates cache by path using the global middleware
func InvalidateGlobalByPath(ctx context.Context, paths ...string) error {
	if globalMiddleware == nil {
		return fmt.Errorf("global cache middleware not set")
	}
	return globalMiddleware.InvalidateByPath(ctx, paths...)
}
