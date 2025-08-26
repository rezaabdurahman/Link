package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/link-app/shared-libs/performance"
)

// CompressionMiddleware applies gzip compression to responses
func CompressionMiddleware() gin.HandlerFunc {
	config := performance.GetDefaultCompressionConfig()
	compressionHandler := performance.CompressionMiddleware(config)
	
	return gin.WrapH(compressionHandler(nil))
}