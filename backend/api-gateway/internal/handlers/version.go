package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/link-app/shared-libs/versioning"
)

// VersionHandler provides endpoints for API version information
type VersionHandler struct{}

// NewVersionHandler creates a new version handler
func NewVersionHandler() *VersionHandler {
	return &VersionHandler{}
}

// GetAPIInfo returns comprehensive API version information
func (h *VersionHandler) GetAPIInfo(c *gin.Context) {
	currentVersion := versioning.CurrentVersion
	supportedVersions := make([]map[string]interface{}, len(versioning.SupportedVersions))
	
	for i, version := range versioning.SupportedVersions {
		versionInfo := map[string]interface{}{
			"version": version.String(),
			"status":  "stable",
		}
		
		// Check if deprecated
		if deprecated, sunsetDate := version.IsDeprecated(); deprecated {
			versionInfo["status"] = "deprecated"
			versionInfo["sunset_date"] = sunsetDate
		}
		
		supportedVersions[i] = versionInfo
	}

	response := gin.H{
		"service": "link-api-gateway",
		"current_version": currentVersion.String(),
		"supported_versions": supportedVersions,
		"version_info": gin.H{
			"versioning_strategy": "header_and_path",
			"default_version": currentVersion.String(),
			"deprecation_policy": "6_months_notice",
			"migration_guide": "/docs/api-migration",
		},
		"endpoints": gin.H{
			"version_info": "/api/version",
			"health": "/health",
			"docs": "/docs/",
			"metrics": "/metrics",
		},
	}

	c.JSON(http.StatusOK, response)
}

// GetVersionCompatibility returns version compatibility matrix
func (h *VersionHandler) GetVersionCompatibility(c *gin.Context) {
	compatibility := make(map[string]interface{})
	
	for _, version := range versioning.SupportedVersions {
		versionKey := version.String()
		
		// Build compatibility info
		compatInfo := gin.H{
			"breaking_changes": []string{},
			"new_features": []string{},
			"bug_fixes": []string{},
			"migration_required": false,
		}
		
		// Add specific version details
		switch version.Major {
		case 1:
			if version.Minor == 0 {
				compatInfo["description"] = "Initial stable release"
				compatInfo["release_date"] = "2024-01-01"
			}
		}
		
		compatibility[versionKey] = compatInfo
	}

	c.JSON(http.StatusOK, gin.H{
		"compatibility_matrix": compatibility,
		"migration_guide": "/docs/api-migration",
		"support_policy": gin.H{
			"stable_versions": "supported indefinitely",
			"deprecated_versions": "supported for 6 months after deprecation",
			"beta_versions": "no SLA guarantee",
		},
	})
}