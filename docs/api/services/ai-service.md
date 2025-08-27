# AI Service API Documentation

## Overview

The AI Service provides intelligent conversation analysis and summarization capabilities for the Link platform. It integrates with OpenAI's GPT models to generate insights, summaries, and extract meaningful information from chat conversations and user interactions.

**Service Details:**
- **Base URL**: `http://localhost:8085/api/v1` (development)
- **Gateway Route**: `/ai/*` → `ai-svc/api/v1/*`
- **Authentication**: JWT Bearer tokens required for all endpoints
- **External Integration**: OpenAI GPT-4 API
- **Privacy**: GDPR/CCPA compliant with user consent management

## OpenAPI Specification

Full OpenAPI 3.0 specification available at: `backend/ai-svc/api/openapi.yaml`

## Core Features

- **Conversation Summarization**: AI-powered summaries of chat conversations
- **Content Analysis**: Extract key topics, action items, and decisions
- **Sentiment Analysis**: Analyze conversation tone and engagement
- **Privacy Compliance**: Full GDPR/CCPA consent management
- **Audit Logging**: Complete transparency for data processing activities

## Conversation Summarization

### Generate Conversation Summary
```http
POST /api/v1/ai/summarize
Authorization: Bearer {jwt-token}
```

**Request Body:**
```json
{
  "conversation_id": "conv_123456789",
  "limit": 50
}
```

**Parameters:**
- `conversation_id` (required): Conversation ID starting with `conv_` prefix
- `limit` (optional): Maximum messages to process (1-1000, default: 100)

**Response (200):**
```json
{
  "summary": "## Key Topics Discussed\n- Product roadmap planning for Q2 2024\n- Budget allocation for new feature development\n- Team restructuring and hiring plans\n\n## Decisions Made\n- Approved $100k budget for mobile app redesign\n- Decided to postpone internationalization until Q3\n\n## Action Items\n- Sarah to draft technical specifications by Friday\n- Mike to schedule follow-up with design team\n- Team lead to present findings at next board meeting",
  "generated_at": "2024-01-15T10:30:00Z",
  "expires_at": "2024-01-15T22:30:00Z"
}
```

**Summary Structure:**
The AI generates structured summaries in Markdown format including:
- **Key Topics Discussed**: Main conversation themes
- **Decisions Made**: Concrete decisions and resolutions
- **Action Items**: Tasks and follow-up actions assigned
- **Important Context**: Relevant background information

### Cached Summaries
Summaries are cached for 12 hours to improve performance:
- Cache key based on conversation ID and message count
- `expires_at` field indicates when cache expires
- New messages trigger cache invalidation

## Advanced AI Analysis

### Extract Action Items
```http
POST /api/v1/ai/extract-actions
Authorization: Bearer {jwt-token}
```

**Request Body:**
```json
{
  "conversation_id": "conv_123456789",
  "assignee_filter": "user-uuid-optional"
}
```

**Response (200):**
```json
{
  "action_items": [
    {
      "id": "action-uuid-1",
      "description": "Draft technical specifications for mobile app redesign",
      "assignee": "sarah-uuid",
      "assignee_name": "Sarah Johnson",
      "due_date": "2024-01-19T17:00:00Z",
      "priority": "high",
      "status": "pending",
      "context": "Discussed during budget planning meeting",
      "message_refs": ["msg-uuid-1", "msg-uuid-5"]
    },
    {
      "id": "action-uuid-2", 
      "description": "Schedule follow-up meeting with design team",
      "assignee": "mike-uuid",
      "assignee_name": "Mike Chen",
      "due_date": null,
      "priority": "medium",
      "status": "pending",
      "context": "Required before finalizing mobile app specifications",
      "message_refs": ["msg-uuid-8"]
    }
  ],
  "total_actions": 2,
  "extraction_confidence": 0.89,
  "generated_at": "2024-01-15T10:30:00Z"
}
```

### Analyze Conversation Sentiment
```http
POST /api/v1/ai/sentiment
Authorization: Bearer {jwt-token}
```

**Request Body:**
```json
{
  "conversation_id": "conv_123456789",
  "granularity": "message"
}
```

**Granularity Options:**
- `conversation`: Overall conversation sentiment
- `participant`: Per-participant sentiment analysis
- `message`: Individual message sentiment
- `topic`: Sentiment per discussion topic

**Response (200):**
```json
{
  "overall_sentiment": {
    "score": 0.65,
    "label": "positive",
    "confidence": 0.87
  },
  "participant_sentiment": [
    {
      "user_id": "user-uuid-1",
      "name": "Alice Johnson",
      "sentiment_score": 0.72,
      "sentiment_label": "positive",
      "engagement_level": "high",
      "message_count": 15,
      "dominant_emotions": ["enthusiasm", "agreement"]
    },
    {
      "user_id": "user-uuid-2",
      "name": "Bob Smith", 
      "sentiment_score": 0.45,
      "sentiment_label": "neutral",
      "engagement_level": "medium",
      "message_count": 8,
      "dominant_emotions": ["concern", "curiosity"]
    }
  ],
  "sentiment_timeline": [
    {
      "timestamp": "2024-01-15T10:00:00Z",
      "score": 0.3,
      "label": "neutral"
    },
    {
      "timestamp": "2024-01-15T10:15:00Z",
      "score": 0.7,
      "label": "positive"
    }
  ],
  "key_insights": [
    "Conversation started neutral but became increasingly positive",
    "High agreement on budget decisions",
    "Some concerns about timeline feasibility"
  ],
  "generated_at": "2024-01-15T10:30:00Z"
}
```

### Extract Key Topics
```http
POST /api/v1/ai/topics
Authorization: Bearer {jwt-token}
```

**Request Body:**
```json
{
  "conversation_id": "conv_123456789",
  "min_confidence": 0.7,
  "max_topics": 10
}
```

**Response (200):**
```json
{
  "topics": [
    {
      "id": "topic-uuid-1",
      "name": "Mobile App Redesign",
      "description": "Discussion about redesigning the mobile application",
      "confidence": 0.92,
      "relevance_score": 0.85,
      "message_count": 12,
      "first_mention": "2024-01-15T10:05:00Z",
      "last_mention": "2024-01-15T10:25:00Z",
      "participants": ["user-uuid-1", "user-uuid-2", "user-uuid-3"],
      "keywords": ["redesign", "mobile", "app", "UI", "user experience"],
      "related_topics": ["topic-uuid-2"]
    },
    {
      "id": "topic-uuid-2",
      "name": "Budget Planning",
      "description": "Financial planning and budget allocation discussions",
      "confidence": 0.88,
      "relevance_score": 0.90,
      "message_count": 8,
      "first_mention": "2024-01-15T10:02:00Z", 
      "last_mention": "2024-01-15T10:28:00Z",
      "participants": ["user-uuid-1", "user-uuid-3"],
      "keywords": ["budget", "allocation", "cost", "funding", "approval"],
      "related_topics": ["topic-uuid-1"]
    }
  ],
  "topic_transitions": [
    {
      "from_topic": "topic-uuid-2",
      "to_topic": "topic-uuid-1", 
      "timestamp": "2024-01-15T10:08:00Z",
      "transition_type": "natural"
    }
  ],
  "conversation_flow": {
    "coherence_score": 0.83,
    "topic_depth": "medium",
    "discussion_pattern": "focused"
  },
  "generated_at": "2024-01-15T10:30:00Z"
}
```

### Analyze Participant Engagement
```http
POST /api/v1/ai/participants
Authorization: Bearer {jwt-token}
```

**Request Body:**
```json
{
  "conversation_id": "conv_123456789"
}
```

**Response (200):**
```json
{
  "participants": [
    {
      "user_id": "user-uuid-1",
      "name": "Alice Johnson", 
      "role": "facilitator",
      "engagement_metrics": {
        "participation_rate": 0.68,
        "message_frequency": 2.3,
        "avg_message_length": 45,
        "question_asking_rate": 0.15,
        "response_rate": 0.85,
        "topic_initiation_count": 3
      },
      "communication_style": {
        "style": "collaborative",
        "traits": ["supportive", "detail-oriented", "decisive"],
        "formality": "professional",
        "emotional_tone": "positive"
      },
      "influence_metrics": {
        "conversation_steering": 0.72,
        "agreement_generation": 0.68,
        "decision_impact": 0.80
      }
    },
    {
      "user_id": "user-uuid-2",
      "name": "Bob Smith",
      "role": "contributor", 
      "engagement_metrics": {
        "participation_rate": 0.32,
        "message_frequency": 1.1,
        "avg_message_length": 28,
        "question_asking_rate": 0.25,
        "response_rate": 0.70,
        "topic_initiation_count": 1
      },
      "communication_style": {
        "style": "analytical",
        "traits": ["thoughtful", "cautious", "detail-focused"],
        "formality": "professional",
        "emotional_tone": "neutral"
      },
      "influence_metrics": {
        "conversation_steering": 0.25,
        "agreement_generation": 0.45,
        "decision_impact": 0.40
      }
    }
  ],
  "group_dynamics": {
    "overall_cohesion": 0.78,
    "balanced_participation": 0.65,
    "conflict_level": 0.12,
    "decision_efficiency": 0.82,
    "collaboration_quality": "high"
  },
  "conversation_health": {
    "inclusivity_score": 0.70,
    "productive_discourse": 0.85,
    "goal_achievement": 0.80,
    "time_efficiency": 0.75
  },
  "generated_at": "2024-01-15T10:30:00Z"
}
```

## Privacy and Consent Management

### Get User Consent Preferences
```http
GET /api/v1/ai/consent
Authorization: Bearer {jwt-token}
```

**Response (200):**
```json
{
  "user_id": "user-uuid",
  "ai_processing_consent": true,
  "data_anonymization_consent": true,
  "analytics_consent": false,
  "marketing_consent": false,
  "consent_version": "1.0",
  "consent_given_at": "2024-01-01T12:00:00Z",
  "consent_withdrawn_at": null,
  "updated_at": "2024-01-01T12:00:00Z"
}
```

### Update Consent Preferences
```http
PUT /api/v1/ai/consent
Authorization: Bearer {jwt-token}
```

**Request Body:**
```json
{
  "ai_processing_consent": true,
  "data_anonymization_consent": true,
  "analytics_consent": false,
  "marketing_consent": false
}
```

**Consent Types:**
- `ai_processing_consent`: Allow AI analysis of conversations
- `data_anonymization_consent`: Allow data anonymization for research
- `analytics_consent`: Allow usage analytics collection
- `marketing_consent`: Allow marketing communications

**Response (200):**
```json
{
  "user_id": "user-uuid",
  "ai_processing_consent": true,
  "data_anonymization_consent": true,
  "analytics_consent": false,
  "marketing_consent": false,
  "consent_version": "1.0",
  "consent_given_at": "2024-01-01T12:00:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

### Revoke All Consent (GDPR Right to Withdraw)
```http
DELETE /api/v1/ai/consent
Authorization: Bearer {jwt-token}
```

**Response (200):**
```json
{
  "message": "All consent has been successfully revoked",
  "user_id": "user-uuid",
  "revoked_at": "2024-01-15T10:30:00Z",
  "gdpr_compliant": true
}
```

**Effects of Consent Revocation:**
- All AI processing stops immediately for the user
- Existing analysis data is anonymized or deleted
- User excluded from future AI analysis
- Audit log created for compliance

### Get User Audit Logs (GDPR/CCPA Compliance)
```http
GET /api/v1/ai/consent/audit
Authorization: Bearer {jwt-token}
```

**Query Parameters:**
- `limit`: Results per page (default: 50, max: 200)
- `offset`: Pagination offset (default: 0)

**Response (200):**
```json
{
  "audit_logs": [
    {
      "id": "audit-uuid-1",
      "user_id": "user-uuid",
      "action": "AI_REQUEST_PROCESSED",
      "resource_type": "conversation_summary",
      "resource_id": "conv_123456789",
      "details": {
        "conversation_id": "conv_123456789",
        "processing_type": "summarization",
        "consent_verified": true,
        "data_anonymized": false
      },
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0...",
      "session_id": "session-uuid",
      "created_at": "2024-01-15T10:30:00Z",
      "expires_at": "2025-01-15T10:30:00Z"
    },
    {
      "id": "audit-uuid-2",
      "user_id": "user-uuid",
      "action": "CONSENT_UPDATED",
      "resource_type": "user_consent",
      "resource_id": "user-uuid",
      "details": {
        "previous_consent": {
          "ai_processing_consent": false
        },
        "new_consent": {
          "ai_processing_consent": true
        }
      },
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0...",
      "session_id": "session-uuid",
      "created_at": "2024-01-01T12:00:00Z",
      "expires_at": "2025-01-01T12:00:00Z"
    }
  ],
  "pagination": {
    "total_count": 25,
    "limit": 50,
    "offset": 0,
    "returned": 25,
    "has_next": false,
    "has_prev": false
  },
  "user_id": "user-uuid"
}
```

### Get Current Privacy Policy
```http
GET /api/v1/ai/consent/policy
```

**Response (200):**
```json
{
  "id": "policy-uuid",
  "version": "1.0",
  "content": "# Privacy Policy\n\n## AI Data Processing\n\nThis policy describes how we process your data using AI...",
  "effective_date": "2024-01-01T00:00:00Z",
  "created_at": "2023-12-15T10:00:00Z",
  "is_active": true
}
```

## Data Processing and Security

### Data Anonymization
```http
POST /api/v1/ai/anonymize
Authorization: Bearer {jwt-token}
```

**Request Body:**
```json
{
  "conversation_id": "conv_123456789",
  "anonymization_level": "full"
}
```

**Anonymization Levels:**
- `basic`: Remove direct identifiers (names, emails)
- `enhanced`: Remove indirect identifiers (context clues)
- `full`: Complete anonymization with synthetic substitution

**Response (200):**
```json
{
  "anonymized_data": {
    "conversation_id": "anon_456789123",
    "participant_count": 3,
    "message_count": 25,
    "anonymization_applied": [
      "names_replaced",
      "locations_generalized", 
      "dates_relative",
      "identifiers_removed"
    ]
  },
  "anonymization_id": "anon-job-uuid",
  "processed_at": "2024-01-15T10:30:00Z",
  "retention_expires_at": "2025-01-15T10:30:00Z"
}
```

### Data Export (GDPR Right to Portability)
```http
GET /api/v1/ai/export
Authorization: Bearer {jwt-token}
```

**Query Parameters:**
- `format`: Export format (`json`, `csv`, `xml`)
- `include_raw_data`: Include original conversation data (default: false)
- `date_from`: Start date for data export
- `date_to`: End date for data export

**Response (200):**
```json
{
  "export_id": "export-uuid",
  "user_id": "user-uuid",
  "format": "json",
  "data": {
    "summaries": [
      {
        "conversation_id": "conv_123456789",
        "summary": "Meeting summary content...",
        "generated_at": "2024-01-15T10:30:00Z"
      }
    ],
    "action_items": [
      {
        "id": "action-uuid-1",
        "description": "Complete project review",
        "assigned_at": "2024-01-15T10:30:00Z"
      }
    ],
    "consent_history": [
      {
        "consent_type": "ai_processing_consent",
        "value": true,
        "updated_at": "2024-01-01T12:00:00Z"
      }
    ]
  },
  "exported_at": "2024-01-15T10:30:00Z",
  "expires_at": "2024-01-22T10:30:00Z"
}
```

### Data Deletion (GDPR Right to Erasure)
```http
DELETE /api/v1/ai/user-data
Authorization: Bearer {jwt-token}
```

**Request Body:**
```json
{
  "deletion_scope": "all",
  "confirm_deletion": true,
  "reason": "user_request"
}
```

**Deletion Scopes:**
- `all`: Delete all AI-processed data
- `summaries`: Delete only conversation summaries
- `analytics`: Delete only analytics data
- `audit_logs`: Delete audit logs (where legally permitted)

**Response (200):**
```json
{
  "deletion_id": "del-uuid",
  "user_id": "user-uuid",
  "deletion_scope": "all",
  "items_deleted": {
    "summaries": 15,
    "action_items": 8,
    "sentiment_analyses": 12,
    "topic_extractions": 10
  },
  "deletion_completed_at": "2024-01-15T10:30:00Z",
  "gdpr_compliant": true,
  "retention_override": false
}
```

## Health and Monitoring

### Health Check
```http
GET /health
```

**Response (200):**
```json
{
  "status": "healthy",
  "service": "ai-svc",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "dependencies": {
    "openai_api": "healthy",
    "database": "healthy",
    "cache": "healthy"
  },
  "metrics": {
    "requests_per_minute": 45,
    "avg_response_time_ms": 1250,
    "cache_hit_rate": 0.78,
    "openai_api_latency_ms": 800
  }
}
```

### Service Statistics
```http
GET /api/v1/ai/stats
Authorization: Bearer {jwt-token}
```

**Response (200):**
```json
{
  "processing_stats": {
    "summaries_generated_today": 234,
    "total_summaries": 5678,
    "avg_summary_generation_time_ms": 1200,
    "cache_hit_rate": 0.78,
    "consent_compliance_rate": 1.0
  },
  "model_performance": {
    "openai_gpt4_latency_p95": 1500,
    "summary_quality_score": 0.92,
    "error_rate": 0.01
  },
  "privacy_metrics": {
    "users_with_consent": 8945,
    "total_users": 9123,
    "consent_rate": 0.98,
    "gdpr_requests_processed": 12,
    "data_deletion_requests": 3
  }
}
```

## Rate Limits and Quotas

### Rate Limits
- **Summarization**: 10 requests/hour per user, 1000/hour system-wide
- **Analysis endpoints**: 20 requests/hour per user
- **Consent management**: 100 requests/hour per user
- **Export requests**: 5 requests/day per user
- **Deletion requests**: 1 request/day per user

### OpenAI API Quotas
- **Token limits**: 50,000 tokens/hour per service
- **Request limits**: 500 requests/hour to OpenAI
- **Cost management**: $100/day budget limit
- **Fallback**: Graceful degradation when limits exceeded

## Error Handling

### Common Error Responses

```json
{
  "error": {
    "code": "CONVERSATION_NOT_FOUND",
    "message": "The specified conversation could not be found",
    "details": "No conversation exists with ID 'conv_123456789'"
  },
  "request_id": "req_789012345",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Error Codes:
- `INVALID_CONVERSATION_ID`: Invalid conversation ID format
- `CONVERSATION_NOT_FOUND`: Conversation doesn't exist or no access
- `INSUFFICIENT_PERMISSIONS`: User lacks required permissions
- `CONSENT_REQUIRED`: User consent required for AI processing
- `RATE_LIMIT_EXCEEDED`: API rate limit exceeded
- `AI_SERVICE_UNAVAILABLE`: OpenAI API temporarily unavailable
- `PROCESSING_ERROR`: Error during AI analysis
- `ANONYMIZATION_FAILED`: Data anonymization failed
- `EXPORT_GENERATION_FAILED`: Data export failed

## Security Features

- **JWT Authentication**: Required for all endpoints
- **Consent Verification**: Automatic consent checking before processing
- **Data Encryption**: All data encrypted in transit and at rest
- **Audit Logging**: Complete audit trail for all AI processing
- **Rate Limiting**: Comprehensive rate limiting and abuse prevention
- **PII Protection**: Automatic detection and protection of personal data
- **Secure API Communication**: mTLS for OpenAI API communication

## Example Usage

### Complete AI Analysis Workflow
```bash
# 1. Check user consent
curl -X GET http://localhost:8085/api/v1/ai/consent \
  -H "Authorization: Bearer ${TOKEN}"

# 2. Generate conversation summary
curl -X POST http://localhost:8085/api/v1/ai/summarize \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "conversation_id": "conv_123456789",
    "limit": 100
  }'

# 3. Extract action items
curl -X POST http://localhost:8085/api/v1/ai/extract-actions \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "conversation_id": "conv_123456789"
  }'

# 4. Analyze sentiment
curl -X POST http://localhost:8085/api/v1/ai/sentiment \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "conversation_id": "conv_123456789",
    "granularity": "participant"
  }'

# 5. Extract topics
curl -X POST http://localhost:8085/api/v1/ai/topics \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "conversation_id": "conv_123456789",
    "min_confidence": 0.7
  }'
```

### Privacy Management Workflow
```bash
# 1. Update consent preferences
curl -X PUT http://localhost:8085/api/v1/ai/consent \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "ai_processing_consent": true,
    "analytics_consent": false
  }'

# 2. View audit logs
curl -X GET "http://localhost:8085/api/v1/ai/consent/audit?limit=20" \
  -H "Authorization: Bearer ${TOKEN}"

# 3. Export user data
curl -X GET "http://localhost:8085/api/v1/ai/export?format=json" \
  -H "Authorization: Bearer ${TOKEN}"

# 4. Request data deletion (if needed)
curl -X DELETE http://localhost:8085/api/v1/ai/user-data \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "deletion_scope": "summaries",
    "confirm_deletion": true,
    "reason": "user_request"
  }'
```

## Service Integration

The AI Service integrates with:
- **Chat Service**: Retrieves conversation data for analysis
- **User Service**: Validates user permissions and profiles
- **Discovery Service**: Provides conversation insights for matching
- **Feature Service**: A/B testing for AI features and models
- **External APIs**: OpenAI GPT-4 for language processing

All service communication uses mTLS via Linkerd service mesh with comprehensive monitoring and observability through Prometheus metrics and distributed tracing.