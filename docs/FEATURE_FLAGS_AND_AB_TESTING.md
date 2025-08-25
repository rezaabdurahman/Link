# Feature Flags & A/B Testing System

## Overview

The Link app implements a comprehensive feature flag and A/B testing system that allows for safe, controlled rollouts of new features and data-driven experimentation. The system consists of a backend feature service, shared libraries, API gateway integration, and frontend React components.

## Architecture

### Backend Components

1. **Feature Service** (`backend/feature-svc/`)
   - RESTful API for feature flag evaluation
   - Database storage with PostgreSQL
   - Redis caching for performance
   - Support for feature flags and A/B experiments

2. **Shared Libraries** (`backend/shared-libs/features/`)
   - Common types and interfaces
   - Feature evaluation logic
   - Caching abstractions
   - User segment evaluation

3. **API Gateway Integration**
   - Proxies requests to feature service
   - Adds authentication and request routing
   - Environment-aware evaluation

### Frontend Components

1. **Feature Context** (`frontend/src/contexts/FeatureContext.tsx`)
   - React context for feature flag state
   - Automatic refresh and caching
   - Event tracking integration

2. **Hooks** (`frontend/src/hooks/`)
   - `useFeatureFlag` - Check if flag is enabled
   - `useFeatureValue` - Get flag value with default
   - `useExperiment` - Get experiment assignment
   - `useExperimentTracking` - Track conversions

3. **Components** (`frontend/src/components/`)
   - `FeatureGate` - Conditional rendering
   - `ExperimentGate` - A/B test rendering
   - `ABTestGate` - Simple A/B testing

## Feature Flag Types

### Boolean Flags
Simple on/off switches for features.

```typescript
const isDarkModeEnabled = useFeatureFlag('dark_mode');
```

### Percentage Rollouts
Gradually roll out features to a percentage of users.

```sql
-- 25% rollout for production
UPDATE feature_flag_configs 
SET enabled = true, rollout_percentage = 25 
WHERE feature_flag_id = (SELECT id FROM feature_flags WHERE key = 'new_algorithm');
```

### Variant Flags
Multiple variants for feature variations.

```tsx
<VariantGate
  flagKey="chat_ui_design"
  variants={{
    control: <StandardChatUI />,
    modern: <ModernChatUI />,
    minimal: <MinimalChatUI />
  }}
/>
```

### User Targeting
Target specific user segments.

```sql
-- Target beta users
INSERT INTO user_segments (key, name, conditions) VALUES (
  'beta_users', 
  'Beta Users',
  '[{"attribute": "beta_tester", "operator": "equals", "value": true}]'
);
```

## A/B Testing

### Creating Experiments

```sql
-- Create experiment
INSERT INTO experiments (key, name, traffic_allocation, status) VALUES (
  'checkout_flow_test',
  'Checkout Flow A/B Test',
  50, -- 50% of users
  'running'
);

-- Add variants
INSERT INTO experiment_variants (experiment_id, key, name, weight) VALUES 
  ((SELECT id FROM experiments WHERE key = 'checkout_flow_test'), 'control', 'Current Flow', 50),
  ((SELECT id FROM experiments WHERE key = 'checkout_flow_test'), 'streamlined', 'Streamlined Flow', 50);
```

### Frontend Implementation

```tsx
// Simple A/B test
<SimpleABTest
  experimentKey="checkout_flow_test"
  control={<CurrentCheckoutFlow />}
  treatment={<StreamlinedCheckoutFlow />}
/>

// With conversion tracking
const { trackConversion } = useExperimentTracking('checkout_flow_test');

const handlePurchase = () => {
  trackConversion('purchase_completed', {
    amount: orderTotal,
    items: cartItems.length
  });
};
```

## Configuration Examples

### Environment-specific Rollouts

```sql
-- Development: 100% enabled
INSERT INTO feature_flag_configs (feature_flag_id, environment_id, enabled, rollout_percentage)
VALUES ((SELECT id FROM feature_flags WHERE key = 'new_feature'), 
        (SELECT id FROM feature_environments WHERE name = 'development'), 
        true, 100);

-- Staging: 50% rollout
INSERT INTO feature_flag_configs (feature_flag_id, environment_id, enabled, rollout_percentage)
VALUES ((SELECT id FROM feature_flags WHERE key = 'new_feature'), 
        (SELECT id FROM feature_environments WHERE name = 'staging'), 
        true, 50);

-- Production: Disabled initially
INSERT INTO feature_flag_configs (feature_flag_id, environment_id, enabled, rollout_percentage)
VALUES ((SELECT id FROM feature_flags WHERE key = 'new_feature'), 
        (SELECT id FROM feature_environments WHERE name = 'production'), 
        false, 0);
```

### User Segment Targeting

```sql
-- Target power users with high connection count
INSERT INTO user_segments (key, name, conditions) VALUES (
  'power_users',
  'Power Users',
  '[{
    "attribute": "connection_count",
    "operator": "greater_than",
    "value": 100
  }]'
);

-- Apply targeting rule to feature flag
UPDATE feature_flag_configs 
SET targeting_rules = '{"segments": ["power_users"]}'
WHERE feature_flag_id = (SELECT id FROM feature_flags WHERE key = 'advanced_analytics');
```

## API Endpoints

### Feature Flag Evaluation

```bash
# Evaluate single flag
GET /features/flags/{key}/evaluate?user_id={uuid}&environment=production

# Evaluate multiple flags
POST /features/flags/evaluate
{
  "flag_keys": ["dark_mode", "new_algorithm"],
  "user_attributes": {
    "connection_count": 150,
    "signup_date": "2024-01-15"
  }
}

# Get all flags for user
GET /features/flags?user_id={uuid}&environment=production
```

### Experiment Evaluation

```bash
# Evaluate experiment
GET /features/experiments/{key}/evaluate?user_id={uuid}

# Track event
POST /features/events
{
  "event_type": "feature_evaluated",
  "user_id": "uuid",
  "feature_key": "dark_mode",
  "properties": {
    "enabled": true,
    "reason": "rollout_included"
  }
}
```

## Frontend Usage Patterns

### Basic Feature Gating

```tsx
import { useFeatureFlag, FeatureGate } from '../hooks/useFeatureFlag';

// Using hooks
const isDarkMode = useFeatureFlag('dark_mode');

// Using components
<FeatureGate flagKey="dark_mode">
  <DarkModeUI />
</FeatureGate>

// With fallback
<FeatureGate 
  flagKey="premium_analytics" 
  fallback={<UpgradePrompt />}
>
  <PremiumAnalytics />
</FeatureGate>
```

### A/B Testing

```tsx
import { SimpleABTest, useExperimentTracking } from '../hooks/useExperiment';

const OnboardingFlow = () => {
  const { trackConversion } = useExperimentTracking('onboarding_test');
  
  const handleComplete = () => {
    trackConversion('onboarding_completed');
  };

  return (
    <SimpleABTest
      experimentKey="onboarding_test"
      control={<StandardOnboarding onComplete={handleComplete} />}
      treatment={<QuickOnboarding onComplete={handleComplete} />}
    />
  );
};
```

### Feature Provider Setup

```tsx
// In App.tsx
import { FeatureProvider } from './contexts/FeatureContext';

function App() {
  return (
    <AuthProvider>
      <FeatureProvider 
        userContext={{
          userId: user?.id,
          environment: process.env.NODE_ENV,
          attributes: {
            signupDate: user?.createdAt,
            connectionCount: user?.connectionCount
          }
        }}
        refreshInterval={5 * 60 * 1000} // 5 minutes
      >
        {/* Rest of app */}
      </FeatureProvider>
    </AuthProvider>
  );
}
```

## Database Schema

### Core Tables

- `feature_flags` - Flag definitions
- `feature_environments` - Environment configurations
- `feature_flag_configs` - Environment-specific settings
- `experiments` - A/B test definitions
- `experiment_variants` - Test variants
- `user_assignments` - Sticky user assignments
- `user_segments` - User targeting rules
- `feature_events` - Analytics events

### Indexes for Performance

```sql
-- Key lookups
CREATE INDEX idx_feature_flags_key ON feature_flags(key);
CREATE INDEX idx_experiments_key ON experiments(key);

-- User assignments
CREATE INDEX idx_user_assignments_user_env ON user_assignments(user_id, environment_id);

-- Analytics
CREATE INDEX idx_feature_events_timestamp ON feature_events(timestamp);
CREATE INDEX idx_feature_events_user_feature ON feature_events(user_id, feature_flag_id);
```

## Deployment Guide

### 1. Database Setup

```bash
# Run migrations
cd backend/feature-svc
make migrate-up

# Seed example data (development only)
psql -d linkdb -f examples/seed_features.sql
```

### 2. Service Deployment

```bash
# Build and run with Docker Compose
cd backend
docker-compose up feature-svc

# Or build locally
cd feature-svc
make build
make run
```

### 3. Environment Variables

```bash
# Feature Service
DB_HOST=postgres
DB_PORT=5432
DB_USER=linkuser
DB_PASSWORD=linkpass
DB_NAME=linkdb
REDIS_HOST=redis
REDIS_PORT=6379
ENVIRONMENT=development

# API Gateway
FEATURE_SVC_URL=http://feature-svc:8086
```

## Best Practices

### Feature Flag Management

1. **Naming Convention**: Use snake_case keys (e.g., `new_discovery_algorithm`)
2. **Description**: Always include clear descriptions
3. **Cleanup**: Remove flags after successful rollout
4. **Documentation**: Document each flag's purpose and timeline

### A/B Testing

1. **Statistical Significance**: Run tests until statistically significant
2. **Conversion Tracking**: Define clear success metrics
3. **Sample Size**: Ensure adequate sample size for reliable results
4. **Segment Analysis**: Analyze results by user segments

### Performance Considerations

1. **Caching**: Feature evaluations are cached for 5 minutes by default
2. **Batch Requests**: Use batch evaluation for multiple flags
3. **Sticky Assignments**: User assignments are persistent for consistency
4. **Database Indexes**: Ensure proper indexing for user lookups

### Security

1. **Authentication**: All feature endpoints require valid JWT
2. **Environment Separation**: Strict environment isolation
3. **Sensitive Data**: Never expose sensitive user data in targeting rules
4. **Audit Trail**: All changes logged with user attribution

## Monitoring and Analytics

### Key Metrics

- Feature flag evaluation rates
- Experiment conversion rates
- Assignment distribution
- System performance (latency, error rates)

### Dashboards

- Feature flag status by environment
- Experiment results and statistical significance
- User segment distributions
- System health metrics

### Alerts

- High error rates in feature evaluation
- Experiment imbalances
- Database connectivity issues
- Cache hit rate degradation

## Troubleshooting

### Common Issues

1. **Flag Not Updating**
   - Check cache TTL (5 minutes default)
   - Verify environment configuration
   - Check user segment targeting rules

2. **Experiment Assignment Issues**
   - Verify experiment is running
   - Check traffic allocation percentage
   - Validate user is in target segment

3. **Performance Issues**
   - Monitor Redis cache hit rates
   - Check database query performance
   - Review index usage

### Debug Tools

```bash
# Check flag evaluation for user
curl -H "X-User-ID: user-uuid" \
     -H "X-Environment: development" \
     http://localhost:8080/features/flags/feature_key/evaluate

# Invalidate cache
curl -X POST http://localhost:8080/features/cache/invalidate \
     -H "Content-Type: application/json" \
     -d '{"keys": ["feature_key"]}'
```

## Migration Guide

### From Legacy Feature Flags

1. **Map existing flags** to new system using `FEATURE_FLAG_MIGRATION`
2. **Create feature flag entries** in database
3. **Update component usage** from static config to hooks/components
4. **Test thoroughly** in development environment
5. **Gradual rollout** in staging and production

### Example Migration

```tsx
// Before (legacy)
import { isFeatureEnabled } from '../config/featureFlags';
const showFeature = isFeatureEnabled('NEW_FEATURE');

// After (new system)
import { useFeatureFlag } from '../hooks/useFeatureFlag';
const showFeature = useFeatureFlag('new_feature');
```

## Contributing

When adding new features to the feature flag system:

1. Update database schema with migrations
2. Add backend API endpoints if needed
3. Create frontend hooks/components
4. Add comprehensive tests
5. Update documentation
6. Create example usage

See `examples/FeatureFlagExample.tsx` for comprehensive usage examples.