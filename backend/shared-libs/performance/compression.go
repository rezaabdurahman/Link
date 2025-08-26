package performance

import (
	"compress/gzip"
	"net/http"
	"strings"
)

// CompressionConfig holds compression settings
type CompressionConfig struct {
	Level           int      // Compression level (1-9)
	MinSize         int      // Minimum response size to compress (bytes)
	ExcludedTypes   []string // MIME types to exclude from compression
	ExcludedPaths   []string // URL paths to exclude from compression
}

// GetDefaultCompressionConfig returns production-optimized compression settings
func GetDefaultCompressionConfig() *CompressionConfig {
	return &CompressionConfig{
		Level:   6, // Balanced compression ratio vs speed
		MinSize: 1024, // Only compress responses > 1KB
		ExcludedTypes: []string{
			"image/jpeg",
			"image/png", 
			"image/gif",
			"image/webp",
			"video/mp4",
			"video/webm",
			"audio/mpeg",
			"audio/ogg",
			"application/zip",
			"application/gzip",
			"application/pdf",
		},
		ExcludedPaths: []string{
			"/api/v1/chat/stream", // Streaming endpoints
			"/api/v1/events",      // Server-sent events
			"/ws",                 // WebSocket connections
		},
	}
}

// compressionResponseWriter wraps http.ResponseWriter with gzip compression
type compressionResponseWriter struct {
	http.ResponseWriter
	gzipWriter *gzip.Writer
	config     *CompressionConfig
	buffer     []byte
	written    bool
}

// Write implements http.ResponseWriter.Write with compression
func (w *compressionResponseWriter) Write(data []byte) (int, error) {
	if !w.written {
		// Check if we should compress based on content type and size
		if w.shouldCompress(data) {
			w.initGzipWriter()
		}
		w.written = true
	}

	if w.gzipWriter != nil {
		return w.gzipWriter.Write(data)
	}
	return w.ResponseWriter.Write(data)
}

// Close finalizes the gzip stream
func (w *compressionResponseWriter) Close() error {
	if w.gzipWriter != nil {
		return w.gzipWriter.Close()
	}
	return nil
}

// shouldCompress determines if the response should be compressed
func (w *compressionResponseWriter) shouldCompress(data []byte) bool {
	// Check minimum size
	if len(data) < w.config.MinSize {
		return false
	}

	// Check content type
	contentType := w.Header().Get("Content-Type")
	for _, excludedType := range w.config.ExcludedTypes {
		if strings.Contains(contentType, excludedType) {
			return false
		}
	}

	return true
}

// initGzipWriter initializes the gzip writer and sets headers
func (w *compressionResponseWriter) initGzipWriter() {
	w.Header().Set("Content-Encoding", "gzip")
	w.Header().Set("Vary", "Accept-Encoding")
	w.Header().Del("Content-Length") // Let gzip set the correct length
	
	gzipWriter, _ := gzip.NewWriterLevel(w.ResponseWriter, w.config.Level)
	w.gzipWriter = gzipWriter
}

// CompressionMiddleware provides gzip compression for HTTP responses
func CompressionMiddleware(config *CompressionConfig) func(http.Handler) http.Handler {
	if config == nil {
		config = GetDefaultCompressionConfig()
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Check if client accepts gzip
			if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
				next.ServeHTTP(w, r)
				return
			}

			// Check if path is excluded
			for _, excludedPath := range config.ExcludedPaths {
				if strings.HasPrefix(r.URL.Path, excludedPath) {
					next.ServeHTTP(w, r)
					return
				}
			}

			// Wrap response writer with compression
			compressWriter := &compressionResponseWriter{
				ResponseWriter: w,
				config:         config,
			}
			defer compressWriter.Close()

			next.ServeHTTP(compressWriter, r)
		})
	}
}

// BrotliCompressionMiddleware provides Brotli compression (if supported)
// Note: This is a placeholder for future Brotli implementation
func BrotliCompressionMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Check if client accepts Brotli
			if strings.Contains(r.Header.Get("Accept-Encoding"), "br") {
				// TODO: Implement Brotli compression
				// For now, fall back to gzip
			}
			next.ServeHTTP(w, r)
		})
	}
}

// StaticFileOptimization provides optimizations for static file serving
type StaticFileOptimization struct {
	EnableGzip     bool
	EnableBrotli   bool
	CacheControl   string
	ETagEnabled    bool
	LastModified   bool
}

// GetDefaultStaticOptimization returns optimized settings for static files
func GetDefaultStaticOptimization() *StaticFileOptimization {
	return &StaticFileOptimization{
		EnableGzip:   true,
		EnableBrotli: true,
		CacheControl: "public, max-age=31536000, immutable", // 1 year for immutable assets
		ETagEnabled:  true,
		LastModified: true,
	}
}

// OptimizeStaticFileResponse applies optimizations to static file responses
func OptimizeStaticFileResponse(w http.ResponseWriter, r *http.Request, config *StaticFileOptimization) {
	if config == nil {
		config = GetDefaultStaticOptimization()
	}

	// Set cache headers for static files
	if config.CacheControl != "" {
		w.Header().Set("Cache-Control", config.CacheControl)
	}

	// Enable ETag for cache validation
	if config.ETagEnabled {
		// ETag implementation would go here
		// w.Header().Set("ETag", generateETag(filePath, modTime))
	}

	// Set security headers for static files
	w.Header().Set("X-Content-Type-Options", "nosniff")
}