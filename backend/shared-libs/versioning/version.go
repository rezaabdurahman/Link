package versioning

import (
	"fmt"
	"strconv"
	"strings"
)

// APIVersion represents a semantic version for API endpoints
type APIVersion struct {
	Major int
	Minor int
	Patch int
}

// CurrentVersion defines the latest stable API version
var CurrentVersion = APIVersion{Major: 1, Minor: 0, Patch: 0}

// SupportedVersions defines all currently supported API versions
var SupportedVersions = []APIVersion{
	{Major: 1, Minor: 0, Patch: 0}, // v1.0.0 - current stable
}

// DeprecatedVersions defines versions that are deprecated but still supported
var DeprecatedVersions = map[APIVersion]string{
	// Future deprecated versions will be added here
	// Example: {Major: 0, Minor: 9, Patch: 0}: "2024-12-31", // sunset date
}

// String returns the version as a string (e.g., "v1.0.0")
func (v APIVersion) String() string {
	return fmt.Sprintf("v%d.%d.%d", v.Major, v.Minor, v.Patch)
}

// ShortString returns the version as a short string (e.g., "v1")
func (v APIVersion) ShortString() string {
	return fmt.Sprintf("v%d", v.Major)
}

// ParseVersion parses a version string into an APIVersion
func ParseVersion(versionStr string) (APIVersion, error) {
	// Remove 'v' prefix if present
	versionStr = strings.TrimPrefix(versionStr, "v")
	
	parts := strings.Split(versionStr, ".")
	if len(parts) < 1 || len(parts) > 3 {
		return APIVersion{}, fmt.Errorf("invalid version format: %s", versionStr)
	}
	
	// Parse major version
	major, err := strconv.Atoi(parts[0])
	if err != nil {
		return APIVersion{}, fmt.Errorf("invalid major version: %s", parts[0])
	}
	
	version := APIVersion{Major: major}
	
	// Parse minor version if provided
	if len(parts) > 1 {
		minor, err := strconv.Atoi(parts[1])
		if err != nil {
			return APIVersion{}, fmt.Errorf("invalid minor version: %s", parts[1])
		}
		version.Minor = minor
	}
	
	// Parse patch version if provided
	if len(parts) > 2 {
		patch, err := strconv.Atoi(parts[2])
		if err != nil {
			return APIVersion{}, fmt.Errorf("invalid patch version: %s", parts[2])
		}
		version.Patch = patch
	}
	
	return version, nil
}

// IsSupported checks if the version is currently supported
func (v APIVersion) IsSupported() bool {
	for _, supported := range SupportedVersions {
		if v.Major == supported.Major {
			return true
		}
	}
	return false
}

// IsDeprecated checks if the version is deprecated
func (v APIVersion) IsDeprecated() (bool, string) {
	sunsetDate, exists := DeprecatedVersions[v]
	return exists, sunsetDate
}

// Compare compares two versions (-1: less, 0: equal, 1: greater)
func (v APIVersion) Compare(other APIVersion) int {
	if v.Major != other.Major {
		if v.Major < other.Major {
			return -1
		}
		return 1
	}
	
	if v.Minor != other.Minor {
		if v.Minor < other.Minor {
			return -1
		}
		return 1
	}
	
	if v.Patch != other.Patch {
		if v.Patch < other.Patch {
			return -1
		}
		return 1
	}
	
	return 0
}

// GetCompatibleVersion returns the latest compatible version for a requested version
func GetCompatibleVersion(requested APIVersion) (APIVersion, error) {
	// For now, we only support exact major version matches
	for _, supported := range SupportedVersions {
		if supported.Major == requested.Major {
			return supported, nil
		}
	}
	
	return APIVersion{}, fmt.Errorf("unsupported API version: %s", requested.String())
}