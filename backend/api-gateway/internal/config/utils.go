package config

import (
	"fmt"
	"os"
)

// getEnv gets an environment variable with a default value (private)
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// GetEnv gets an environment variable with a default value (public)
func GetEnv(key, defaultValue string) string {
	return getEnv(key, defaultValue)
}

// getEnvAsInt gets an environment variable as integer with default
func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		// Simple integer parsing - could use strconv.Atoi for better error handling
		var result int
		if n, err := fmt.Sscanf(value, "%d", &result); n == 1 && err == nil {
			return result
		}
	}
	return defaultValue
}
