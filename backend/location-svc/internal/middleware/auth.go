package middleware

import (
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// JWTClaims represents the JWT token claims
type JWTClaims struct {
	UserID uuid.UUID `json:"user_id"`
	jwt.RegisteredClaims
}

// JWTMiddleware validates JWT tokens
func JWTMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Get the Authorization header
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error":   true,
				"message": "Authorization header is required",
			})
		}

		// Check if the header starts with "Bearer "
		if !strings.HasPrefix(authHeader, "Bearer ") {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error":   true,
				"message": "Authorization header must start with 'Bearer '",
			})
		}

		// Extract the token
		tokenString := strings.TrimPrefix(authHeader, "Bearer ")

		// Parse and validate the token
		token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
			// Validate the signing method
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fiber.NewError(fiber.StatusUnauthorized, "Invalid signing method")
			}
			
			// Return the JWT secret key
			jwtSecret := os.Getenv("JWT_SECRET")
			if jwtSecret == "" {
				jwtSecret = "your-secret-key" // Default for development
			}
			return []byte(jwtSecret), nil
		})

		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error":   true,
				"message": "Invalid token: " + err.Error(),
			})
		}

		// Check if token is valid
		if !token.Valid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error":   true,
				"message": "Token is not valid",
			})
		}

		// Extract claims
		claims, ok := token.Claims.(*JWTClaims)
		if !ok {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error":   true,
				"message": "Invalid token claims",
			})
		}

		// Store user ID in context for use in handlers
		c.Locals("userID", claims.UserID)

		return c.Next()
	}
}

// GetUserIDFromContext retrieves user ID from Fiber context
func GetUserIDFromContext(c *fiber.Ctx) (uuid.UUID, error) {
	userID, ok := c.Locals("userID").(uuid.UUID)
	if !ok {
		return uuid.Nil, fiber.NewError(fiber.StatusUnauthorized, "User ID not found in context")
	}
	return userID, nil
}
