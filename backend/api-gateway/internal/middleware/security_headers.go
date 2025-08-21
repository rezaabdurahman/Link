package middleware

import (
	"os"

	"github.com/gin-gonic/gin"
)

// SecurityHeadersMiddleware adds security headers to all responses
func SecurityHeadersMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		environment := os.Getenv("ENVIRONMENT")

		// Content Security Policy - restrictive by default
		csp := "default-src 'self'; " +
			"script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
			"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
			"font-src 'self' https://fonts.gstatic.com; " +
			"img-src 'self' data: https:; " +
			"connect-src 'self' ws: wss:; " +
			"object-src 'none'; " +
			"base-uri 'self'; " +
			"form-action 'self'; " +
			"frame-ancestors 'none';"

		// Loosen CSP in development for better DX
		if environment == "development" {
			csp = "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: ws: wss: http: https:;"
		}

		c.Header("Content-Security-Policy", csp)

		// X-Content-Type-Options: Prevent MIME type sniffing
		c.Header("X-Content-Type-Options", "nosniff")

		// X-Frame-Options: Prevent clickjacking
		c.Header("X-Frame-Options", "DENY")

		// X-XSS-Protection: Enable XSS filtering (legacy browsers)
		c.Header("X-XSS-Protection", "1; mode=block")

		// Referrer-Policy: Control referrer information
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")

		// Permissions-Policy: Control browser features
		c.Header("Permissions-Policy",
			"accelerometer=(), camera=(), geolocation=(self), gyroscope=(), "+
				"magnetometer=(), microphone=(), payment=(), usb=()")

		// Strict-Transport-Security: Force HTTPS (only in production)
		if environment == "production" {
			c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
		}

		// Expect-CT: Certificate transparency (production only)
		if environment == "production" {
			c.Header("Expect-CT", "max-age=86400, enforce")
		}

		c.Next()
	}
}
