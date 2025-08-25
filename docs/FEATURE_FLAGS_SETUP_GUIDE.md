# Feature Flags & A/B Testing Setup Guide

This guide walks you through setting up and using the Link app's feature flag and A/B testing system.

## Quick Start

### 1. Start the Feature Service

```bash
# Start the backend services (including feature-svc)
cd backend
docker-compose up -d

# Verify the feature service is running
curl http://localhost:8086/health
```

### 2. Seed Sample Data

```bash
# Connect to the database and run the seed script
docker exec -it link_postgres_primary psql -U linkuser -d linkdb -f /docker-entrypoint-initdb.d/seed_features.sql

# Or manually:
psql -h localhost -U linkuser -d linkdb -f backend/feature-svc/examples/seed_features.sql
```

### 3. Use the CLI Tool

Use the command-line interface for secure feature flag administration:

```bash
# Make the wrapper script executable
chmod +x scripts/feature-admin.sh

# List all feature flags
./scripts/feature-admin.sh list_flags

# Get help with available commands
./scripts/feature-admin.sh help
```

### 4. Use in Your Frontend Code

```tsx
import { useFeatureFlag, FeatureGate, SimpleABTest } from '../hooks/useFeatureFlag';

// Simple feature flag check
const isDarkModeEnabled = useFeatureFlag('dark_mode');

// Component-based gating
<FeatureGate flagKey="new_chat_ui">
  <NewChatInterface />
</FeatureGate>

// A/B testing
<SimpleABTest
  experimentKey="onboarding_flow_test"
  control={<StandardOnboarding />}
  treatment={<SimplifiedOnboarding />}
/>
```

## Feature Flag Management

### Using the CLI Tool

Build and install the CLI tool:

```bash
cd backend/feature-svc
make -f Makefile.cli build-cli
```

#### Create Feature Flags

```bash
# Create a boolean feature flag
./bin/feature-cli flag create new_dashboard \
  --name="New Dashboard Design" \
  --description="Enable the redesigned dashboard interface" \
  --type=boolean

# Create a percentage rollout flag
./bin/feature-cli flag create beta_features \
  --name="Beta Features" \
  --description="Access to beta testing features" \
  --type=percentage
```

#### Manage Rollouts

```bash
# Enable a flag globally
./bin/feature-cli flag toggle new_dashboard

# Set environment-specific rollout
./bin/feature-cli flag rollout beta_features 25 --env=production
./bin/feature-cli flag rollout beta_features 100 --env=development

# List all flags with their status
./bin/feature-cli flag list
```

### Using the Admin CLI Wrapper

The `scripts/feature-admin.sh` wrapper provides convenient commands for common operations:

```bash
# View all feature flags with their status
./scripts/feature-admin.sh list_flags

# Get detailed information about a specific flag
./scripts/feature-admin.sh get_flag new_dashboard

# Toggle a flag on/off
./scripts/feature-admin.sh toggle_flag new_dashboard production

# Enable a flag with gradual rollout percentage
./scripts/feature-admin.sh enable_flag beta_features production 25 "Gradual rollout to 25%"

# Disable a flag (reason required)
./scripts/feature-admin.sh disable_flag old_feature "Feature deprecated"

# View recent changes
./scripts/feature-admin.sh recent_changes 10

# View audit history for a specific flag
./scripts/feature-admin.sh flag_history new_dashboard 20
```

### Direct SQL Management

For advanced operations, you can manage flags directly in the database:

```sql
-- Create a new feature flag
INSERT INTO feature_flags (key, name, description, type, enabled) VALUES
  ('advanced_analytics', 'Advanced Analytics', 'Enable advanced analytics dashboard', 'boolean', false);

-- Configure for different environments
INSERT INTO feature_flag_configs (feature_flag_id, environment_id, enabled, rollout_percentage) VALUES
  ((SELECT id FROM feature_flags WHERE key = 'advanced_analytics'), 
   (SELECT id FROM feature_environments WHERE name = 'development'), 
   true, 100),
  ((SELECT id FROM feature_flags WHERE key = 'advanced_analytics'), 
   (SELECT id FROM feature_environments WHERE name = 'production'), 
   true, 10);
```

## A/B Testing

### Creating Experiments

#### Using the CLI

```bash
# Create a new A/B test
./bin/feature-cli experiment create checkout_flow_v2 \
  --name="Checkout Flow V2 Test" \
  --description="Test new streamlined checkout flow" \
  --traffic=50

# Update experiment status
./bin/feature-cli experiment update checkout_flow_v2 --status=running
```

#### Using SQL

```sql
-- Create experiment
INSERT INTO experiments (key, name, description, status, traffic_allocation) VALUES
  ('profile_layout_test', 'Profile Layout Test', 'Test new profile page layout', 'draft', 30);

-- Add variants
INSERT INTO experiment_variants (experiment_id, key, name, weight, is_control, payload) VALUES 
  ((SELECT id FROM experiments WHERE key = 'profile_layout_test'), 'control', 'Current Layout', 50, true, '{"layout": "sidebar"}'),
  ((SELECT id FROM experiments WHERE key = 'profile_layout_test'), 'centered', 'Centered Layout', 50, false, '{"layout": "centered", "photo_size": "large"}');

-- Enable in environments
INSERT INTO experiment_configs (experiment_id, environment_id, enabled) VALUES
  ((SELECT id FROM experiments WHERE key = 'profile_layout_test'), 
   (SELECT id FROM feature_environments WHERE name = 'development'), true);
```

### Frontend Implementation

```tsx
import { useExperimentAssignment, useExperimentVariant, useExperimentTracking } from '../hooks/useExperiment';

const ProfilePage = () => {
  const inExperiment = useExperimentAssignment('profile_layout_test');
  const variant = useExperimentVariant('profile_layout_test');
  const { trackConversion } = useExperimentTracking('profile_layout_test');

  const handleProfileUpdate = () => {
    // Track conversion when user updates their profile
    trackConversion('profile_updated', {
      variant,
      timestamp: Date.now()
    });
  };

  // Render based on variant
  if (inExperiment && variant === 'centered') {
    return <CenteredProfileLayout onUpdate={handleProfileUpdate} />;
  }
  
  return <StandardProfileLayout onUpdate={handleProfileUpdate} />;
};

// Or use the component approach
const ProfilePage = () => (
  <ExperimentVariantGate
    experimentKey="profile_layout_test"
    variants={{
      control: <StandardProfileLayout />,
      centered: <CenteredProfileLayout />
    }}
    fallback={<StandardProfileLayout />}
  />
);
```

## User Segmentation

### Creating User Segments

```sql
-- Create user segments for targeting
INSERT INTO user_segments (key, name, description, conditions) VALUES
  ('power_users', 'Power Users', 'Highly engaged users', 
   '[{"attribute": "connection_count", "operator": "greater_than", "value": 50}]'),
  ('mobile_users', 'Mobile Users', 'Users primarily on mobile', 
   '[{"attribute": "primary_device", "operator": "equals", "value": "mobile"}]'),
  ('new_users', 'New Users', 'Users who joined recently', 
   '[{"attribute": "days_since_signup", "operator": "less_than", "value": 30}]');
```

### Using Segments in Targeting

```sql
-- Target power users with a new feature
UPDATE feature_flag_configs 
SET targeting_rules = '{"segments": ["power_users"], "include_percentage": 100}'
WHERE feature_flag_id = (SELECT id FROM feature_flags WHERE key = 'advanced_features');
```

## Monitoring and Observability

### Grafana Dashboard

1. Import the dashboard: `monitoring/grafana/dashboards/feature-flags-admin.json`
2. Access at `http://localhost:3001` (Grafana)
3. View metrics:
   - Feature flag evaluation rates
   - Cache hit rates
   - A/B test assignment distributions
   - Error rates and latencies

### Prometheus Metrics

Key metrics available:
- `feature_flag_evaluations_total`: Total flag evaluations by flag and environment
- `feature_flag_cache_hits_total`: Cache performance metrics
- `experiment_assignments_total`: A/B test assignment tracking
- `feature_flag_errors_total`: Error tracking

### Alerts

Alerting rules are configured in `monitoring/prometheus/rules/feature-flags-alerts.yml`:

- High error rates in flag evaluation
- Low cache hit rates
- Service downtime
- Experiment assignment imbalances

## Best Practices

### Flag Lifecycle Management

1. **Development**: Enable at 100% for testing
2. **Staging**: Test with realistic traffic percentages
3. **Production**: Start with small percentages, gradually increase
4. **Cleanup**: Remove flags after successful rollout

### Naming Conventions

- Use descriptive, lowercase keys: `new_discovery_algorithm`
- Include context: `chat_ai_suggestions_v2`
- Avoid abbreviations: `user_profile_redesign` not `usr_prof_v2`

### A/B Testing Guidelines

1. **Define Success Metrics**: Before starting the experiment
2. **Adequate Sample Size**: Ensure statistical significance
3. **Run Duration**: Allow sufficient time for meaningful results
4. **Segment Analysis**: Analyze results by user segments
5. **Document Results**: Record learnings for future reference

### Performance Considerations

- **Caching**: Flag evaluations are cached for 5 minutes by default
- **Batch Evaluation**: Use `useFeatureFlags()` for multiple flags
- **Client-Side Caching**: Feature context automatically refreshes every 5 minutes
- **Database Indexes**: Proper indexing ensures fast lookups

### Security

- **CLI-Only Administration**: Admin operations are only available through secure CLI tools, not web interfaces
- **Database Authentication**: Direct database access required for admin operations, providing additional security layer  
- **Environment Separation**: Production flags isolated from development
- **Audit Logging**: All changes are logged with user attribution and reasons
- **Principle of Least Privilege**: Admin access is separated from user-facing application
- **Sensitive Data**: Never include sensitive information in flag configurations
- **Reason Tracking**: All production changes require documented reasons

## Troubleshooting

### Common Issues

#### Flag Not Updating
```bash
# Check flag status and configuration
./scripts/feature-admin.sh get_flag my_flag

# View recent changes to the flag
./scripts/feature-admin.sh flag_history my_flag 5

# Check if there are any recent system changes
./scripts/feature-admin.sh recent_changes 20
```

#### Database Connection Issues
```bash
# Test database connectivity
./scripts/feature-admin.sh list_environments

# Test basic functionality
./scripts/feature-admin.sh list_flags

# Check service health manually
curl http://localhost:8086/health
```

#### Experiment Not Working
```sql
-- Verify experiment is running and enabled
SELECT e.key, e.status, ec.enabled, env.name
FROM experiments e
JOIN experiment_configs ec ON e.id = ec.experiment_id
JOIN feature_environments env ON ec.environment_id = env.id
WHERE e.key = 'my_experiment';
```

### Debug Mode

Enable debug logging in the frontend:

```tsx
// In your app initialization
const App = () => (
  <FeatureProvider 
    userContext={{ userId: user.id }}
    refreshInterval={30000} // More frequent refresh for debugging
    debug={process.env.NODE_ENV === 'development'}
  >
    {/* Your app */}
  </FeatureProvider>
);
```

### Audit Trail

View all changes to a flag:

```bash
# View flag history using wrapper script
./scripts/feature-admin.sh flag_history my_flag 20

# View recent system-wide changes
./scripts/feature-admin.sh recent_changes 50

# SQL query for detailed audit information
SELECT * FROM recent_feature_changes WHERE entity_key = 'my_flag';
```

## Migration from Legacy System

If migrating from the legacy static feature flags:

1. **Map Legacy Flags**: Use `FEATURE_FLAG_MIGRATION` mapping in `frontend/src/config/featureFlags.ts`
2. **Create Database Entries**: For each legacy flag
3. **Update Code**: Replace `isFeatureEnabled()` with `useFeatureFlag()`
4. **Test Thoroughly**: Verify behavior in all environments
5. **Gradual Rollout**: Enable new system progressively

Example migration:

```tsx
// Before (legacy)
import { isFeatureEnabled } from '../config/featureFlags';
const showNewFeature = isFeatureEnabled('NEW_FEATURE');

// After (new system)  
import { useFeatureFlag } from '../hooks/useFeatureFlag';
const showNewFeature = useFeatureFlag('new_feature');
```

## API Reference

### Feature Flag Evaluation
```bash
# Single flag
GET /api/v1/flags/my_flag/evaluate?environment=production

# Multiple flags
POST /api/v1/flags/evaluate
{
  "flag_keys": ["flag1", "flag2"],
  "user_attributes": {
    "connection_count": 150
  }
}

# All flags for user
GET /api/v1/flags?environment=production
```

### Admin Operations

Admin operations should be performed using the CLI tools for security:

```bash
# Create a new feature flag
./scripts/feature-admin.sh create_flag new_feature "New Feature" "Description of new feature" boolean

# Enable a flag with specific rollout percentage
./scripts/feature-admin.sh enable_flag new_feature production 25 "Initial rollout to 25%"

# Get detailed configuration for a flag
./scripts/feature-admin.sh get_flag new_feature

# View audit trail for flag changes
./scripts/feature-admin.sh flag_history new_feature 10
```

### Experiment Evaluation
```bash
GET /api/v1/experiments/my_test/evaluate?user_id={uuid}
```

## Support

For questions or issues:
1. Check this documentation
2. Review the audit logs for recent changes
3. Check Grafana dashboards for system health
4. Examine application logs for errors
5. Use the CLI tool for quick diagnostics