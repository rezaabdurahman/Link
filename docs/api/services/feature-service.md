# Feature Service API Documentation

## Overview

The Feature Service provides dynamic feature flag management and A/B testing capabilities for the Link platform. It enables controlled feature rollouts, user segmentation, and experiment-driven development with real-time flag evaluation and comprehensive analytics.

**Service Details:**
- **Base URL**: `http://localhost:8086/api/v1` (development)
- **Gateway Route**: `/features/*` → `feature-svc/api/v1/*`
- **Authentication**: JWT Bearer tokens for evaluation, CLI tools for administration
- **Database**: PostgreSQL for flag configuration, Redis for caching
- **Administration**: CLI-only for security (no web admin interface)

## Core Features

- **Dynamic Feature Flags**: Real-time boolean, string, and numeric flags
- **A/B Testing**: Sophisticated experiment management with variant assignment
- **User Segmentation**: Target specific user groups based on attributes
- **Gradual Rollouts**: Percentage-based feature rollouts with traffic splitting
- **Environment Isolation**: Separate configurations for dev, staging, production
- **Performance**: Redis caching with 5-minute default TTL
- **Security**: CLI-only administration, database-level access control

## Flag Evaluation

### Evaluate Single Feature Flag
```http
GET /api/v1/flags/{key}/evaluate
Authorization: Bearer {jwt-token}
```

**Path Parameters:**
- `key`: Feature flag key (required)

**Query Parameters:**
- `user_id`: User ID for evaluation context
- `environment`: Target environment (`development`, `staging`, `production`)
- Additional user attributes as query parameters

**Headers from API Gateway:**
- `X-User-ID`: User ID (automatically set)
- `X-User-Email`: User email
- `X-User-Name`: Username  
- `X-User-Roles`: User roles
- `X-Environment`: Environment context

**Response (200):**
```json
{
  "flag_key": "dark_mode",
  "enabled": true,
  "value": true,
  "variant": null,
  "reason": "user_match",
  "evaluation_context": {
    "user_id": "user-uuid",
    "environment": "production",
    "user_attributes": {
      "email": "user@example.com",
      "role": "premium",
      "signup_date": "2024-01-01"
    }
  },
  "assignment_metadata": {
    "assigned_at": "2024-01-15T10:30:00Z",
    "rule_matched": "premium_users",
    "segment_id": "segment-uuid"
  }
}
```

**Evaluation Reasons:**
- `default`: Default value used (flag not found or no rules matched)
- `user_match`: User matched targeting rules
- `percentage`: User fell within percentage rollout
- `segment_match`: User matched segment criteria
- `override`: Admin override applied
- `experiment`: A/B test variant assigned

### Evaluate Multiple Flags (Batch)
```http
POST /api/v1/flags/evaluate
Authorization: Bearer {jwt-token}
```

**Request Body:**
```json
{
  "flag_keys": ["dark_mode", "new_chat_ui", "ai_suggestions"],
  "user_attributes": {
    "subscription_tier": "premium",
    "user_age": 28,
    "location": "US"
  },
  "custom": {
    "page": "settings",
    "campaign": "spring_2024"
  }
}
```

**Response (200):**
```json
{
  "flags": {
    "dark_mode": {
      "flag_key": "dark_mode",
      "enabled": true,
      "value": true,
      "reason": "user_match"
    },
    "new_chat_ui": {
      "flag_key": "new_chat_ui", 
      "enabled": true,
      "value": "variant_b",
      "variant": "variant_b",
      "reason": "experiment"
    },
    "ai_suggestions": {
      "flag_key": "ai_suggestions",
      "enabled": false,
      "value": false,
      "reason": "default"
    }
  },
  "evaluation_context": {
    "user_id": "user-uuid",
    "environment": "production",
    "evaluated_at": "2024-01-15T10:30:00Z"
  }
}
```

### Get All Flags for User
```http
GET /api/v1/flags
Authorization: Bearer {jwt-token}
```

**Alternative (POST for complex attributes):**
```http
POST /api/v1/flags
Authorization: Bearer {jwt-token}
```

**Request Body (POST method):**
```json
{
  "user_attributes": {
    "subscription_tier": "premium",
    "experiment_group": "cohort_2024_q1",
    "feature_usage": {
      "ai_chat_count": 156,
      "last_active": "2024-01-15T09:00:00Z"
    }
  }
}
```

**Response (200):**
```json
{
  "flags": {
    "dark_mode": {
      "flag_key": "dark_mode",
      "enabled": true,
      "value": true,
      "reason": "user_match"
    },
    "new_onboarding_flow": {
      "flag_key": "new_onboarding_flow",
      "enabled": true,
      "value": "simplified",
      "variant": "simplified",
      "reason": "experiment"
    },
    "beta_features": {
      "flag_key": "beta_features",
      "enabled": false,
      "value": false,
      "reason": "percentage"
    }
  },
  "evaluation_context": {
    "user_id": "user-uuid",
    "environment": "production",
    "total_flags": 3,
    "evaluated_at": "2024-01-15T10:30:00Z"
  }
}
```

## A/B Testing and Experiments

### Evaluate Experiment
```http
GET /api/v1/experiments/{key}/evaluate
Authorization: Bearer {jwt-token}
```

**Path Parameters:**
- `key`: Experiment key (required)

**Response (200):**
```json
{
  "experiment_key": "onboarding_flow_test",
  "enabled": true,
  "variant": "simplified_flow",
  "assignment_reason": "user_hash",
  "experiment_metadata": {
    "experiment_id": "exp-uuid",
    "name": "Onboarding Flow Optimization",
    "description": "Testing simplified vs standard onboarding",
    "start_date": "2024-01-01T00:00:00Z",
    "end_date": "2024-02-01T00:00:00Z",
    "traffic_allocation": 0.5
  },
  "variant_metadata": {
    "variant_id": "var-uuid",
    "name": "Simplified Flow",
    "description": "Streamlined 3-step onboarding",
    "traffic_split": 0.5,
    "configuration": {
      "steps": 3,
      "skip_optional": true,
      "auto_progress": true
    }
  },
  "assignment_metadata": {
    "assigned_at": "2024-01-15T10:30:00Z",
    "assignment_hash": "abc123",
    "stable_assignment": true
  }
}
```

**Experiment Variants:**
- **Control Group**: Original implementation (baseline)
- **Treatment Groups**: One or more test variants
- **Traffic Splitting**: Configurable percentage allocation
- **Stable Assignment**: Users consistently see same variant

### Experiment Types

#### Simple A/B Test
```json
{
  "experiment_key": "button_color_test",
  "variants": [
    {
      "key": "control",
      "name": "Blue Button",
      "traffic_split": 0.5,
      "configuration": {"color": "#007bff"}
    },
    {
      "key": "treatment",
      "name": "Green Button", 
      "traffic_split": 0.5,
      "configuration": {"color": "#28a745"}
    }
  ]
}
```

#### Multi-Variant Test
```json
{
  "experiment_key": "homepage_layout_test",
  "variants": [
    {
      "key": "control",
      "name": "Current Layout",
      "traffic_split": 0.4
    },
    {
      "key": "sidebar_left", 
      "name": "Left Sidebar",
      "traffic_split": 0.3
    },
    {
      "key": "sidebar_right",
      "name": "Right Sidebar",
      "traffic_split": 0.3
    }
  ]
}
```

## Event Tracking and Analytics

### Track Feature Event
```http
POST /api/v1/events
Authorization: Bearer {jwt-token}
```

**Request Body:**
```json
{
  "event_type": "conversion",
  "user_id": "user-uuid",
  "flag_key": "new_onboarding_flow",
  "experiment_key": "onboarding_flow_test",
  "variant_key": "simplified_flow",
  "properties": {
    "conversion_type": "signup_completed",
    "funnel_step": "step_3",
    "completion_time_seconds": 45,
    "user_feedback": "positive"
  }
}
```

**Event Types:**
- `impression`: Flag/experiment shown to user
- `click`: User clicked on feature element
- `conversion`: User completed target action
- `engagement`: User interacted with feature
- `error`: Feature caused an error
- `custom`: Custom event with properties

**Response (200):**
```json
{
  "success": true,
  "event_id": "event-uuid",
  "tracked_at": "2024-01-15T10:30:00Z"
}
```

### Common Event Tracking Examples

#### Track Feature Usage
```bash
curl -X POST http://localhost:8086/api/v1/events \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "impression",
    "flag_key": "ai_suggestions",
    "properties": {
      "page": "chat",
      "suggestion_count": 3,
      "context": "new_conversation"
    }
  }'
```

#### Track A/B Test Conversion
```bash
curl -X POST http://localhost:8086/api/v1/events \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "conversion",
    "experiment_key": "checkout_flow_test",
    "variant_key": "one_step_checkout",
    "properties": {
      "conversion_type": "purchase_completed",
      "order_value": 49.99,
      "payment_method": "stripe"
    }
  }'
```

## Cache Management

### Invalidate Cache
```http
POST /api/v1/cache/invalidate
Authorization: Bearer {jwt-token}
```

**Request Body:**
```json
{
  "keys": ["dark_mode", "new_chat_ui"]
}
```

**Cache Invalidation Scenarios:**
- Flag configuration changes (via CLI)
- User attribute updates
- Segment criteria modifications
- Manual cache refresh

**Response (200):**
```json
{
  "success": true,
  "invalidated_keys": ["dark_mode", "new_chat_ui"],
  "cache_cleared_at": "2024-01-15T10:30:00Z"
}
```

## User Context and Segmentation

### Evaluation Context Building

The feature service automatically builds evaluation context from:

#### API Gateway Headers (Preferred)
```http
X-User-ID: user-uuid
X-User-Email: user@example.com  
X-User-Name: username
X-User-Roles: premium,beta_tester
X-User-Permissions: feature_access,admin
X-Environment: production
```

#### Query Parameters
```http
GET /api/v1/flags/dark_mode/evaluate?user_id=uuid&subscription_tier=premium&location=US
```

#### Request Body Attributes
```json
{
  "user_attributes": {
    "subscription_tier": "premium",
    "signup_date": "2024-01-01",
    "feature_usage_count": 156,
    "last_login": "2024-01-15T09:00:00Z",
    "experiment_groups": ["ai_beta", "mobile_redesign"]
  },
  "custom": {
    "page_context": "settings",
    "campaign_source": "email_newsletter",
    "ab_test_eligible": true
  }
}
```

### User Segmentation Examples

#### Premium Users Segment
```json
{
  "segment_key": "premium_users",
  "criteria": {
    "subscription_tier": ["premium", "enterprise"],
    "account_age_days": {">=": 30}
  }
}
```

#### Geographic Segment  
```json
{
  "segment_key": "us_users",
  "criteria": {
    "country": ["US"],
    "state": ["CA", "NY", "TX"]
  }
}
```

#### Behavioral Segment
```json
{
  "segment_key": "power_users",
  "criteria": {
    "feature_usage_count": {">=": 100},
    "last_active_days": {"<=": 7},
    "engagement_score": {">=": 0.8}
  }
}
```

## CLI Administration

The Feature Service uses CLI-only administration for security. All flag management is performed via the `feature-cli` tool:

### Feature Flag CLI Commands

```bash
# Navigate to feature service directory
cd backend/feature-svc

# Build the CLI tool
make -f Makefile.cli build-cli

# List all feature flags
./bin/feature-cli flag list

# Get specific flag details
./bin/feature-cli flag get dark_mode

# Create a new boolean flag
./bin/feature-cli flag create new_feature \
  --type=boolean \
  --default-value=false \
  --description="New experimental feature"

# Enable flag for specific percentage
./bin/feature-cli flag rollout new_feature 25 --env=production

# Update flag targeting rules
./bin/feature-cli flag update new_feature \
  --add-segment=premium_users \
  --percentage=50

# Disable flag
./bin/feature-cli flag disable new_feature --env=production

# Delete flag (irreversible)
./bin/feature-cli flag delete old_feature --confirm
```

### A/B Testing CLI Commands

```bash
# Create new A/B test experiment
./bin/feature-cli experiment create onboarding_test \
  --description="Test simplified onboarding flow" \
  --start-date="2024-02-01" \
  --traffic-allocation=0.5

# Add experiment variants
./bin/feature-cli experiment add-variant onboarding_test control \
  --name="Current Onboarding" \
  --traffic-split=0.5

./bin/feature-cli experiment add-variant onboarding_test simplified \
  --name="Simplified Flow" \
  --traffic-split=0.5 \
  --config='{"steps":3,"skip_optional":true}'

# Start experiment
./bin/feature-cli experiment start onboarding_test

# Get experiment results
./bin/feature-cli experiment results onboarding_test \
  --start-date="2024-02-01" \
  --metric=conversion_rate

# Stop experiment
./bin/feature-cli experiment stop onboarding_test

# Promote winning variant
./bin/feature-cli experiment promote onboarding_test simplified
```

### Administrative Script Wrapper

The platform provides a convenient wrapper script:

```bash
# Use the administrative wrapper script
./scripts/feature-admin.sh list_flags
./scripts/feature-admin.sh get_flag dark_mode
./scripts/feature-admin.sh toggle_flag dark_mode production
./scripts/feature-admin.sh enable_flag new_feature production 25 "Gradual rollout"
./scripts/feature-admin.sh flag_history dark_mode 10
./scripts/feature-admin.sh recent_changes 20
```

## Frontend Integration

### React Hook Implementation
```javascript
import { useFeatureFlag, FeatureGate, SimpleABTest } from '../hooks/useFeatureFlag';

// Simple feature flag check
const isDarkModeEnabled = useFeatureFlag('dark_mode');

// Component-based feature gating
<FeatureGate flagKey="new_chat_ui">
  <NewChatInterface />
</FeatureGate>

// A/B testing with React
<SimpleABTest
  experimentKey="onboarding_flow_test"
  control={<StandardOnboarding />}
  treatment={<SimplifiedOnboarding />}
  onVariantAssigned={(variant) => {
    analytics.track('experiment_viewed', {
      experiment: 'onboarding_flow_test',
      variant: variant
    });
  }}
/>

// Advanced feature flag with user attributes
const chatFeatures = useFeatureFlags(['ai_suggestions', 'voice_messages'], {
  user_attributes: {
    subscription_tier: user.subscriptionTier,
    chat_usage_count: user.chatUsageCount
  }
});
```

### Feature Flag Service Client
```javascript
class FeatureFlagService {
  constructor(apiBase, authToken) {
    this.apiBase = apiBase;
    this.authToken = authToken;
    this.cache = new Map();
  }

  async evaluateFlag(flagKey, userAttributes = {}) {
    try {
      const response = await fetch(`${this.apiBase}/flags/${flagKey}/evaluate`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to evaluate flag: ${response.statusText}`);
      }

      const result = await response.json();
      return result.enabled;
    } catch (error) {
      console.warn(`Feature flag evaluation failed for ${flagKey}:`, error);
      return false; // Fail safely
    }
  }

  async evaluateFlags(flagKeys, userAttributes = {}) {
    try {
      const response = await fetch(`${this.apiBase}/flags/evaluate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          flag_keys: flagKeys,
          user_attributes: userAttributes
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to evaluate flags: ${response.statusText}`);
      }

      const result = await response.json();
      return result.flags;
    } catch (error) {
      console.warn('Batch flag evaluation failed:', error);
      // Return disabled flags for safe fallback
      return flagKeys.reduce((acc, key) => {
        acc[key] = { enabled: false, value: false };
        return acc;
      }, {});
    }
  }

  async trackEvent(eventType, properties = {}) {
    try {
      await fetch(`${this.apiBase}/events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          event_type: eventType,
          properties: properties
        })
      });
    } catch (error) {
      console.warn('Event tracking failed:', error);
      // Don't throw - tracking failures shouldn't break user experience
    }
  }
}
```

## Performance and Caching

### Caching Strategy
- **Redis Cache**: Feature flag evaluations cached for 5 minutes by default
- **Cache Keys**: Based on flag key + user context hash
- **Invalidation**: Automatic invalidation when flags are updated
- **Fallback**: Memory cache when Redis unavailable

### Performance Metrics
- **Flag Evaluation**: <10ms average response time
- **Batch Evaluation**: <25ms for up to 50 flags
- **Cache Hit Rate**: Typically 85-90%
- **Database Queries**: Minimized through aggressive caching

### Database Optimization
```sql
-- Indexes for fast flag lookups
CREATE INDEX idx_feature_flags_key_env ON feature_flags (flag_key, environment);
CREATE INDEX idx_experiments_key_active ON experiments (experiment_key, is_active);
CREATE INDEX idx_flag_assignments_user ON flag_assignments (user_id, flag_id);

-- Partial indexes for active flags
CREATE INDEX idx_active_flags ON feature_flags (flag_key) WHERE is_active = true;
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
  "service": "feature-svc",
  "timestamp": "2024-01-15T10:30:00Z",
  "dependencies": {
    "database": "healthy",
    "redis": "healthy"
  },
  "metrics": {
    "active_flags": 45,
    "active_experiments": 8,
    "cache_hit_rate": 0.87,
    "avg_evaluation_time_ms": 8
  }
}
```

### Monitoring Metrics

#### Prometheus Metrics
```
# Flag evaluation metrics
feature_flag_evaluations_total{flag_key, environment, result}
feature_flag_evaluation_duration_seconds{flag_key}

# Cache metrics  
feature_flag_cache_hits_total
feature_flag_cache_misses_total
feature_flag_cache_size

# Experiment metrics
experiment_assignments_total{experiment_key, variant}
experiment_conversions_total{experiment_key, variant, event_type}

# System metrics
feature_service_requests_total{method, endpoint, status}
feature_service_request_duration_seconds
```

#### Key Performance Indicators
- **Evaluation Success Rate**: >99.9%
- **Cache Hit Rate**: >85%
- **Average Response Time**: <15ms
- **Database Connection Pool**: Utilization <80%

## Error Handling

### Common Error Responses

```json
{
  "error": "FEATURE_FLAG_NOT_FOUND",
  "message": "Feature flag 'unknown_flag' not found",
  "flag_key": "unknown_flag",
  "environment": "production",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Error Codes:
- `FEATURE_FLAG_NOT_FOUND`: Flag doesn't exist for environment
- `INVALID_USER_CONTEXT`: Missing or invalid user context
- `EVALUATION_ERROR`: Error during flag evaluation
- `CACHE_ERROR`: Redis cache unavailable
- `DATABASE_ERROR`: Database connection issues
- `RATE_LIMIT_EXCEEDED`: Too many evaluation requests
- `EXPERIMENT_NOT_ACTIVE`: Experiment not currently running
- `INVALID_EVENT_TYPE`: Unknown event type for tracking

### Graceful Degradation
When the Feature Service is unavailable:
- Frontend falls back to default/disabled state
- Client-side caching continues serving cached values
- Static fallback configuration can be provided
- Feature gates fail "closed" (features disabled) for safety

## Security Features

- **CLI-Only Administration**: No web admin interface for security
- **Database-Level Access**: All flag changes require database access
- **JWT Authentication**: Required for all evaluation endpoints  
- **Rate Limiting**: Per-user and per-endpoint rate limits
- **Audit Logging**: Complete change history with user attribution
- **Environment Isolation**: Strict separation between environments
- **Input Validation**: Comprehensive validation of all inputs

## Rate Limits

- **Flag Evaluation**: 1000 requests/minute per user
- **Batch Evaluation**: 100 requests/minute per user (max 50 flags per request)
- **Event Tracking**: 500 events/minute per user
- **Cache Invalidation**: 10 requests/minute per user (admin operations)

Rate limit headers:
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 876
X-RateLimit-Reset: 1640995200
```

## Example Usage Patterns

### Gradual Feature Rollout
```bash
# Week 1: Enable for 1% of users
./bin/feature-cli flag rollout new_search_algorithm 1 --env=production

# Week 2: Increase to 10% 
./bin/feature-cli flag rollout new_search_algorithm 10 --env=production

# Week 3: Enable for premium users
./bin/feature-cli flag update new_search_algorithm --add-segment=premium_users

# Week 4: Full rollout at 100%
./bin/feature-cli flag rollout new_search_algorithm 100 --env=production
```

### A/B Test Management
```bash
# Create experiment
./bin/feature-cli experiment create checkout_optimization \
  --traffic-allocation=0.3 \
  --start-date="2024-02-01"

# Add variants
./bin/feature-cli experiment add-variant checkout_optimization control --traffic-split=0.5
./bin/feature-cli experiment add-variant checkout_optimization one_step --traffic-split=0.5

# Monitor results
./bin/feature-cli experiment results checkout_optimization --metric=conversion_rate

# If one_step wins, promote it
./bin/feature-cli experiment promote checkout_optimization one_step
```

## Service Integration

The Feature Service integrates with:
- **API Gateway**: JWT authentication and request routing
- **All Services**: Feature flag evaluation for service-specific features
- **Frontend Applications**: Client-side feature flag evaluation
- **Analytics Systems**: Event tracking and experiment metrics
- **Monitoring Stack**: Prometheus metrics and health checks

All service communication uses mTLS via Linkerd service mesh with comprehensive observability through Prometheus metrics, distributed tracing, and structured logging.