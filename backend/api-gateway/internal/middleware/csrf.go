package middleware

import (
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	CSRFTokenHeader = "X-CSRF-Token"
	CSRFTokenCookie = "csrf_token"
	CSRFTokenLength = 32
)

// CSRFMiddleware provides CSRF protection for state-changing requests
func CSRFMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip CSRF for safe methods and public endpoints
		if isSafeMethod(c.Request.Method) {
			c.Next()
			return
		}

		// Generate CSRF token if not present
		csrfToken, err := c.Cookie(CSRFTokenCookie)
		if err != nil || csrfToken == "" {
			csrfToken, err = generateCSRFToken()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"error":   "CSRF_TOKEN_ERROR",
					"message": "Failed to generate CSRF token",
					"code":    "CSRF_GENERATION_FAILED",
				})
				c.Abort()
				return
			}

			// Set CSRF token in cookie
			c.SetSameSite(http.SameSiteStrictMode)
			c.SetCookie(CSRFTokenCookie, csrfToken, 3600, "/", "",
				c.GetString("ENVIRONMENT") == "production", true)
		}

		// For state-changing requests, validate CSRF token
		if !isSafeMethod(c.Request.Method) {
			headerToken := c.GetHeader(CSRFTokenHeader)
			if headerToken == "" || headerToken != csrfToken {
				c.JSON(http.StatusForbidden, gin.H{
					"error":     "CSRF_ERROR",
					"message":   "Invalid or missing CSRF token",
					"code":      "CSRF_TOKEN_MISMATCH",
					"timestamp": time.Now(),
				})
				c.Abort()
				return
			}
		}

		// Expose CSRF token to frontend in response header
		c.Header("X-CSRF-Token", csrfToken)
		c.Next()
	}
}

// generateCSRFToken creates a cryptographically secure random token
func generateCSRFToken() (string, error) {
	bytes := make([]byte, CSRFTokenLength)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(bytes), nil
}

// isSafeMethod checks if the HTTP method is considered safe (doesn't change state)
func isSafeMethod(method string) bool {
	safeMethods := []string{"GET", "HEAD", "OPTIONS", "TRACE"}
	method = strings.ToUpper(method)

	for _, safe := range safeMethods {
		if method == safe {
			return true
		}
	}

	return false
}
