package versioning

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// VersioningConfig holds configuration for API versioning middleware
type VersioningConfig struct {
	// DefaultVersion is used when no version is specified
	DefaultVersion APIVersion
	// StrictVersioning when true, rejects requests without explicit version
	StrictVersioning bool
	// HeaderName is the name of the header used for versioning (default: "API-Version")
	HeaderName string
	// QueryParam is the name of the query parameter used for versioning (default: "version")
	QueryParam string
}

// DefaultConfig returns a default versioning configuration
func DefaultConfig() VersioningConfig {
	return VersioningConfig{
		DefaultVersion:   CurrentVersion,
		StrictVersioning: false,
		HeaderName:       "API-Version",
		QueryParam:       "version",
	}
}

// VersioningMiddleware creates a Gin middleware for API versioning
func VersioningMiddleware(config VersioningConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		version, err := extractVersion(c, config)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "INVALID_API_VERSION",
				"message": err.Error(),
				"code":    "API_VERSION_INVALID",
			})
			c.Abort()
			return
		}

		// Check if version is supported
		if !version.IsSupported() {
			c.JSON(http.StatusNotFound, gin.H{
				"error":             "UNSUPPORTED_API_VERSION",
				"message":           "API version not supported",
				"code":              "API_VERSION_UNSUPPORTED",
				"requested_version": version.String(),
				"supported_versions": getSupportedVersionStrings(),
			})
			c.Abort()
			return
		}

		// Check if version is deprecated
		if deprecated, sunsetDate := version.IsDeprecated(); deprecated {
			c.Header("Deprecation", "true")
			c.Header("Sunset", sunsetDate)
			c.Header("Link", `</docs/api-migration>; rel="successor-version"`)
		}

		// Set version in context and response headers
		c.Set("api_version", version)
		c.Header("API-Version", version.String())
		
		// Add version info to request path for service routing
		originalPath := c.Request.URL.Path
		if !strings.HasPrefix(originalPath, "/api/") {
			c.Request.URL.Path = "/api/" + version.ShortString() + originalPath
		}

		c.Next()
	}
}

// extractVersion extracts the API version from the request
func extractVersion(c *gin.Context, config VersioningConfig) (APIVersion, error) {
	var versionStr string

	// 1. Check URL path first (e.g., /api/v1/users)
	path := c.Request.URL.Path
	if strings.HasPrefix(path, "/api/v") {
		pathParts := strings.Split(path, "/")
		if len(pathParts) >= 3 {
			versionStr = pathParts[2] // e.g., "v1" from "/api/v1/users"
		}
	}

	// 2. Check header if no version in path
	if versionStr == "" {
		versionStr = c.GetHeader(config.HeaderName)
	}

	// 3. Check query parameter if no version in header
	if versionStr == "" {
		versionStr = c.Query(config.QueryParam)
	}

	// 4. Use default version if none specified and not strict
	if versionStr == "" {
		if config.StrictVersioning {
			return APIVersion{}, gin.Error{
				Err:  nil,
				Type: gin.ErrorTypePublic,
				Meta: "API version is required",
			}
		}
		return config.DefaultVersion, nil
	}

	// Parse the version string
	version, err := ParseVersion(versionStr)
	if err != nil {
		return APIVersion{}, err
	}

	return version, nil
}

// getSupportedVersionStrings returns a slice of supported version strings
func getSupportedVersionStrings() []string {
	versions := make([]string, len(SupportedVersions))
	for i, v := range SupportedVersions {
		versions[i] = v.String()
	}
	return versions
}

// VersionFromContext extracts the API version from gin context
func VersionFromContext(c *gin.Context) APIVersion {
	if version, exists := c.Get("api_version"); exists {
		if v, ok := version.(APIVersion); ok {
			return v
		}
	}
	return CurrentVersion
}