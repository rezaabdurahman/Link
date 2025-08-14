# Privacy & Consent Management Implementation

This document describes the implementation of privacy and consent management features for the AI service, ensuring GDPR and CCPA compliance.

## Overview

The privacy and consent management system provides:

1. **User Consent Management**: Allow users to opt-in/opt-out of AI processing
2. **Data Anonymization**: Replace sensitive data (emails, names, phone numbers) with placeholders
3. **Audit Logging**: Track all data access and processing for compliance
4. **Privacy Policy Management**: Version-controlled privacy policies

## Architecture

### Components

```
├── internal/
│   ├── model/models.go           # Extended with privacy models
│   ├── privacy/
│   │   ├── interfaces.go         # Privacy service interfaces
│   │   ├── service.go            # Privacy service implementation
│   │   └── anonymizer.go         # Data anonymization utilities
│   └── handler/
│       └── consent_handler.go    # HTTP handlers for consent endpoints
├── migrations/
│   └── 002_create_privacy_consent_tables.up.sql  # Database schema
└── api/openapi.yaml              # Updated API specification
```

### Database Schema

#### `user_consent` table
- Stores user consent preferences for different data processing types
- Tracks consent version, timestamps, and metadata
- Unique constraint on `user_id`

#### `audit_logs` table  
- Records all data access and processing events
- Includes TTL mechanism for automatic cleanup (GDPR compliant)
- Stores IP addresses, user agents, and detailed action information

#### `privacy_policy_versions` table
- Maintains versioned privacy policies
- Tracks which version users consented to
- Supports policy evolution over time

#### `data_anonymization_records` table
- Tracks all data anonymization operations
- Stores hashes for data integrity verification
- Records which fields were anonymized

## API Endpoints

### Consent Management

#### `GET /api/v1/ai/consent`
Retrieve user's current consent preferences.

**Response:**
```json
{
  "user_id": "uuid",
  "ai_processing_consent": true,
  "data_anonymization_consent": true,
  "analytics_consent": false,
  "marketing_consent": false,
  "consent_version": "1.0",
  "consent_given_at": "2024-01-15T10:30:00Z",
  "consent_withdrawn_at": null,
  "updated_at": "2024-01-15T10:30:00Z"
}
```

#### `PUT /api/v1/ai/consent`
Update user consent preferences.

**Request Body:**
```json
{
  "ai_processing_consent": true,
  "data_anonymization_consent": true,
  "analytics_consent": false,
  "marketing_consent": false
}
```

#### `DELETE /api/v1/ai/consent`
Revoke all consent (GDPR right to withdraw).

**Response:**
```json
{
  "message": "All consent has been successfully revoked",
  "user_id": "uuid",
  "revoked_at": "2024-01-15T10:30:00Z",
  "gdpr_compliant": true
}
```

### Audit & Compliance

#### `GET /api/v1/ai/consent/audit`
Retrieve user's audit logs for transparency.

**Query Parameters:**
- `limit` (default: 50, max: 200)
- `offset` (default: 0)

**Response:**
```json
{
  "audit_logs": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "action": "CONSENT_UPDATED",
      "resource_type": "user_consent",
      "resource_id": "uuid",
      "details": {
        "ai_processing_consent": true,
        "consent_version": "1.0"
      },
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0...",
      "created_at": "2024-01-15T10:30:00Z",
      "expires_at": "2031-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total_count": 150,
    "limit": 50,
    "offset": 0,
    "returned": 50,
    "has_next": true,
    "has_prev": false
  },
  "user_id": "uuid"
}
```

#### `GET /api/v1/ai/consent/policy`
Get current privacy policy version.

## Data Anonymization

The anonymization system automatically detects and replaces sensitive data:

### Supported Data Types

1. **Email Addresses**: `user@example.com` → `user1@example.com`
2. **Phone Numbers**: `(555) 123-4567` → `555-0123`
3. **Personal Names**: `John Smith` → `John Doe`

### Anonymization Options

```go
type AnonymizationOptions struct {
    ReplaceEmails     bool     // Replace email addresses
    ReplacePhones     bool     // Replace phone numbers
    ReplaceNames      bool     // Replace personal names
    PreserveDomains   bool     // Keep original email domains
    SaltForHashing    string   // Salt for consistent hashing
    PlaceholderEmails []string // Custom placeholder emails
    PlaceholderNames  []string // Custom placeholder names
}
```

### Usage Example

```go
// Initialize anonymizer
anonymizer := privacy.NewAnonymizer()
options := privacy.DefaultAnonymizationOptions()

// Anonymize text
result, fields, err := anonymizer.AnonymizeText(
    "Contact John Smith at john.smith@company.com or (555) 123-4567",
    options,
)

// Result: "Contact John Doe at user1@example.com or 555-0123"
// Fields: ["emails", "phone_numbers", "names"]
```

## Consent-Based Processing

### Middleware Integration

Before processing any AI request, check user consent:

```go
func (s *AIService) ProcessRequest(ctx context.Context, userID uuid.UUID, request *AIRequest) error {
    // Check consent before processing
    if err := s.privacyService.CheckAIProcessingConsent(userID); err != nil {
        return fmt.Errorf("user consent required: %w", err)
    }
    
    // Proceed with AI processing...
    return s.processAIRequest(ctx, request)
}
```

### JWT Claims Integration

The system extracts user IDs from JWT tokens:

```go
// JWT should contain user ID in 'sub' or 'user_id' claim
func (s *PrivacyService) ExtractUserIDFromRequest(r *http.Request) (uuid.UUID, error) {
    // First try JWT token
    if userID, err := s.extractUserIDFromJWT(r); err == nil {
        return userID, nil
    }
    
    // Fallback to X-User-ID header (development/testing)
    return s.extractUserIDFromHeader(r)
}
```

## Audit Logging

### Automatic Logging

All privacy-related actions are automatically logged:

- Consent updates
- Data anonymization
- Data access
- Policy changes

### Audit Log Cleanup

Expired logs are automatically cleaned up:

```sql
-- Manual cleanup
SELECT cleanup_expired_audit_logs();

-- Scheduled cleanup (with pg_cron extension)
SELECT cron.schedule('audit-cleanup', '0 2 * * *', 'SELECT cleanup_expired_audit_logs();');
```

### Retention Policy

- Default retention: 7 years (GDPR compliant)
- Configurable per log entry
- Automatic cleanup prevents database bloat

## GDPR Compliance Features

### Right to Access
- `GET /api/v1/ai/consent` - View current consent settings
- `GET /api/v1/ai/consent/audit` - View all data processing activities

### Right to Rectification
- `PUT /api/v1/ai/consent` - Update consent preferences

### Right to Withdraw Consent
- `DELETE /api/v1/ai/consent` - Revoke all consent
- Stops all AI processing immediately

### Right to Data Portability
- Audit logs provide complete processing history
- Structured JSON format for easy export

### Data Minimization
- Only essential data is stored
- Automatic anonymization options
- TTL-based log cleanup

## CCPA Compliance Features

### Consumer Rights Support
- **Right to Know**: Audit logs show all data processing
- **Right to Delete**: Consent revocation stops processing
- **Right to Opt-Out**: Granular consent controls
- **Right to Non-Discrimination**: Service works regardless of consent status

### Do Not Sell
- Marketing consent controls data sharing for marketing purposes
- Clear opt-out mechanisms

## Configuration

### Environment Variables

```bash
# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here

# Database Configuration  
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_db
DB_USER=postgres
DB_PASSWORD=your_password

# Privacy Settings (optional)
PRIVACY_DEFAULT_CONSENT_VERSION=1.0
PRIVACY_AUDIT_RETENTION_YEARS=7
PRIVACY_ANONYMIZATION_ENABLED=true
```

### Docker Support

The system includes Docker configuration for consistent deployment:

```yaml
# docker-compose.yml snippet
services:
  ai-service:
    environment:
      - JWT_SECRET=${JWT_SECRET}
      - DB_HOST=postgres
      - PRIVACY_ANONYMIZATION_ENABLED=true
  
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: ai_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
```

## Security Considerations

### Data Protection
- All PII is hashed before storage
- IP addresses and user agents are stored for audit purposes only
- Session IDs help track related activities

### Access Controls
- JWT-based authentication required for all endpoints
- User can only access their own consent data and audit logs
- Admin endpoints require elevated permissions

### Encryption
- Database connections use SSL/TLS
- JWT tokens are signed and validated
- Sensitive data is hashed with salts

## Testing

### Unit Tests
```bash
go test ./internal/privacy/... -v
go test ./internal/handler/... -v -run TestConsent
```

### Integration Tests
```bash
go test ./integration/... -v -run TestPrivacyCompliance
```

### Manual Testing
```bash
# Test consent management
curl -X GET http://localhost:8081/api/v1/ai/consent \
  -H "Authorization: Bearer $JWT_TOKEN"

# Test anonymization
curl -X POST http://localhost:8081/api/v1/ai/anonymize \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "Contact john.doe@example.com"}'
```

## Deployment

### Database Migrations
```bash
# Apply privacy and consent tables
migrate -database "postgres://user:pass@localhost/db?sslmode=disable" \
        -path ./migrations up
```

### Production Checklist
- [ ] JWT secrets are properly configured
- [ ] Database SSL is enabled
- [ ] Audit log cleanup is scheduled
- [ ] Privacy policy content is updated
- [ ] CORS settings are restrictive
- [ ] Rate limiting is enabled
- [ ] Monitoring is configured for compliance metrics

## Monitoring & Alerts

### Key Metrics
- Consent opt-in/opt-out rates
- Audit log storage growth
- Privacy policy version adoption
- Anonymization success rates

### Recommended Alerts
- High audit log storage usage
- Failed consent checks
- Privacy policy version mismatches
- Anonymization failures

## Future Enhancements

### Planned Features
- **Cookie Consent**: Web-based consent management
- **Data Portability**: Full data export capabilities
- **Privacy Dashboard**: User-friendly privacy management UI
- **Advanced Anonymization**: ML-based PII detection
- **Cross-Service Integration**: Consent sharing between services

### Extensibility
The system is designed for easy extension:
- Pluggable anonymization strategies
- Configurable audit log retention policies  
- Custom consent types
- External privacy policy integration

## Support & Documentation

### Additional Resources
- [GDPR Compliance Guide](https://gdpr.eu/)
- [CCPA Compliance Overview](https://oag.ca.gov/privacy/ccpa)
- [Privacy by Design Principles](https://iapp.org/resources/article/privacy-by-design/)

### Getting Help
- Check the API documentation in `api/openapi.yaml`
- Review test cases for usage examples
- Consult audit logs for troubleshooting
- Monitor application logs for error details

This implementation provides a solid foundation for privacy-compliant AI services while maintaining flexibility for future requirements and regulations.
