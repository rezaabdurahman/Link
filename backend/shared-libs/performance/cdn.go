package performance

import (
	"fmt"
	"net/http"
	"strings"
	"time"
)

// CDNConfig holds CDN configuration
type CDNConfig struct {
	Provider       string        // cloudfront, cloudflare, fastly
	Domain         string        // CDN domain
	OriginDomain   string        // Origin server domain
	CacheRules     []CacheRule   // Cache rules by path pattern
	CompressionEnabled bool      // Enable gzip/brotli compression
	MinifyEnabled  bool          // Enable JS/CSS/HTML minification
	ImageOptimization bool       // Enable WebP conversion and optimization
	HTTPSRedirect  bool          // Force HTTPS redirects
	HSTSEnabled    bool          // Enable HTTP Strict Transport Security
	TTLDefault     time.Duration // Default cache TTL
}

// CacheRule defines caching behavior for specific paths
type CacheRule struct {
	PathPattern string        // Glob pattern for paths
	TTL         time.Duration // Cache time-to-live
	Headers     map[string]string // Additional cache headers
	Compress    bool          // Enable compression for this rule
}

// GetDefaultCDNConfig returns production-ready CDN configuration
func GetDefaultCDNConfig() *CDNConfig {
	return &CDNConfig{
		Provider:       "cloudfront",
		CompressionEnabled: true,
		MinifyEnabled:  true,
		ImageOptimization: true,
		HTTPSRedirect:  true,
		HSTSEnabled:    true,
		TTLDefault:     24 * time.Hour,
		CacheRules: []CacheRule{
			{
				PathPattern: "/static/*",
				TTL:         7 * 24 * time.Hour, // 1 week for static assets
				Headers: map[string]string{
					"Cache-Control": "public, max-age=604800, immutable",
				},
				Compress: true,
			},
			{
				PathPattern: "/api/*",
				TTL:         0, // No caching for API calls
				Headers: map[string]string{
					"Cache-Control": "no-cache, no-store, must-revalidate",
					"Pragma":        "no-cache",
					"Expires":       "0",
				},
				Compress: true,
			},
			{
				PathPattern: "/assets/images/*",
				TTL:         30 * 24 * time.Hour, // 30 days for images
				Headers: map[string]string{
					"Cache-Control": "public, max-age=2592000",
				},
				Compress: false, // Images are already compressed
			},
			{
				PathPattern: "/*.js",
				TTL:         7 * 24 * time.Hour, // 1 week for JS files
				Headers: map[string]string{
					"Cache-Control": "public, max-age=604800",
					"Content-Type":  "application/javascript",
				},
				Compress: true,
			},
			{
				PathPattern: "/*.css",
				TTL:         7 * 24 * time.Hour, // 1 week for CSS files
				Headers: map[string]string{
					"Cache-Control": "public, max-age=604800",
					"Content-Type":  "text/css",
				},
				Compress: true,
			},
			{
				PathPattern: "/",
				TTL:         1 * time.Hour, // 1 hour for HTML pages
				Headers: map[string]string{
					"Cache-Control": "public, max-age=3600",
				},
				Compress: true,
			},
		},
	}
}

// CDNMiddleware provides CDN-like optimizations for development/staging
func CDNMiddleware(config *CDNConfig) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Apply cache rules
			if rule := findMatchingRule(config.CacheRules, r.URL.Path); rule != nil {
				// Set cache headers
				for key, value := range rule.Headers {
					w.Header().Set(key, value)
				}
			}

			// Apply security headers
			if config.HSTSEnabled {
				w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
			}
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("X-XSS-Protection", "1; mode=block")

			// Handle HTTPS redirect
			if config.HTTPSRedirect && r.Header.Get("X-Forwarded-Proto") == "http" {
				httpsURL := "https://" + r.Host + r.RequestURI
				http.Redirect(w, r, httpsURL, http.StatusMovedPermanently)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// findMatchingRule finds the first cache rule that matches the given path
func findMatchingRule(rules []CacheRule, path string) *CacheRule {
	for _, rule := range rules {
		if matchPattern(rule.PathPattern, path) {
			return &rule
		}
	}
	return nil
}

// matchPattern performs simple glob-style pattern matching
func matchPattern(pattern, path string) bool {
	if pattern == path {
		return true
	}
	if strings.HasSuffix(pattern, "*") {
		prefix := strings.TrimSuffix(pattern, "*")
		return strings.HasPrefix(path, prefix)
	}
	if strings.HasPrefix(pattern, "*") {
		suffix := strings.TrimPrefix(pattern, "*")
		return strings.HasSuffix(path, suffix)
	}
	return false
}

// GenerateCloudFrontConfig generates CloudFront distribution configuration
func GenerateCloudFrontConfig(config *CDNConfig) string {
	template := `{
  "CallerReference": "link-app-%d",
  "Comment": "Link App CDN Distribution",
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "link-app-origin",
        "DomainName": "%s",
        "CustomOriginConfig": {
          "HTTPPort": 443,
          "HTTPSPort": 443,
          "OriginProtocolPolicy": "https-only",
          "OriginSslProtocols": {
            "Quantity": 1,
            "Items": ["TLSv1.2"]
          }
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "link-app-origin",
    "ViewerProtocolPolicy": "redirect-to-https",
    "MinTTL": 0,
    "ForwardedValues": {
      "QueryString": true,
      "Headers": {
        "Quantity": 3,
        "Items": ["Authorization", "Content-Type", "Origin"]
      }
    },
    "Compress": %t
  },
  "CacheBehaviors": {
    "Quantity": %d,
    "Items": %s
  },
  "Enabled": true,
  "PriceClass": "PriceClass_All",
  "ViewerCertificate": {
    "CloudFrontDefaultCertificate": false,
    "ACMCertificateArn": "arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT-ID",
    "SSLSupportMethod": "sni-only",
    "MinimumProtocolVersion": "TLSv1.2_2021"
  }
}`

	// Generate cache behaviors for each rule
	behaviors := generateCacheBehaviors(config.CacheRules)
	
	return fmt.Sprintf(template, 
		time.Now().Unix(),
		config.OriginDomain,
		config.CompressionEnabled,
		len(config.CacheRules),
		behaviors)
}

// generateCacheBehaviors generates CloudFront cache behaviors JSON
func generateCacheBehaviors(rules []CacheRule) string {
	if len(rules) == 0 {
		return "[]"
	}

	var behaviors []string
	for _, rule := range rules {
		behavior := fmt.Sprintf(`{
      "PathPattern": "%s",
      "TargetOriginId": "link-app-origin",
      "ViewerProtocolPolicy": "redirect-to-https",
      "MinTTL": %d,
      "DefaultTTL": %d,
      "MaxTTL": %d,
      "Compress": %t,
      "ForwardedValues": {
        "QueryString": %t,
        "Headers": {
          "Quantity": 0,
          "Items": []
        }
      }
    }`,
			rule.PathPattern,
			int(rule.TTL.Seconds()),
			int(rule.TTL.Seconds()),
			int(rule.TTL.Seconds()*2),
			rule.Compress,
			strings.Contains(rule.PathPattern, "/api/"))
		behaviors = append(behaviors, behavior)
	}

	return "[" + strings.Join(behaviors, ",") + "]"
}