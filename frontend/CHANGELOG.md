# Changelog

All notable changes to the Link Frontend project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Complete onboarding flow with 7 interactive steps
- Unified search system with semantic search capabilities
- Click-to-chat flow for friend discovery results
- Comprehensive design system documentation with onboarding examples
- Environment parity support across development, staging, and production
- Enhanced accessibility audit tooling and WCAG AA compliance tracking
- View mode description in Discovery page showing current sorting criteria (Grid: distance, Feed: AI similarity)

### Changed
- **BREAKING**: Search API migration from legacy endpoints to unified `/api/v1/search`
- **BREAKING**: Onboarding flow restructured with new step-based navigation
- Updated color palette to focus on aqua theme, removed green accents for brand coherence
- Chat system now supports both existing conversations and new conversation creation
- Improved error handling across all service layers

### Deprecated
- `GET /api/v1/users/friends/search` - Use `POST /api/v1/search` with `scope: "friends"` instead (sunset: 2025-12-31)
- `GET /discovery/available-users/search` - Use `POST /api/v1/search` with `scope: "discovery"` instead (sunset: 2025-12-31)
- Legacy onboarding API endpoints will be phased out in favor of step-based approach

### Removed
- Green accent colors from design system for better brand consistency
- Legacy search client implementations (replaced with unified search client)

### Fixed
- WebSocket connection handling for conversations without IDs
- Onboarding step progression edge cases
- Color contrast issues for WCAG AA compliance

### Security
- Enhanced environment variable handling to prevent secret exposure
- Improved API error response sanitization

---

## Migration Guide

### 🔄 Unified Search Migration

If you're upgrading from a version that used legacy search endpoints:

#### Before
```typescript
// Legacy friend search
const friends = await searchFriends(query);

// Legacy discovery search  
const users = await searchAvailableUsers({ query, distance: 10 });
```

#### After
```typescript
// Unified search approach
import { unifiedSearch } from './services/unifiedSearchClient';

// Friend search
const friendResults = await unifiedSearch({
  query,
  scope: 'friends'
});

// Discovery search
const discoveryResults = await unifiedSearch({
  query,
  scope: 'discovery', 
  filters: { distance: 10 }
});
```

#### Migration Steps
1. **Update imports**: Replace legacy search imports with `unifiedSearchClient`
2. **Update API calls**: Convert to unified search format with appropriate `scope`
3. **Add error handling**: Implement fallback mechanisms for backward compatibility
4. **Test thoroughly**: Verify search functionality works across all use cases

#### Backward Compatibility
The implementation includes automatic fallback to legacy endpoints if unified search fails, ensuring smooth transition during the migration period.

### 🎓 Onboarding System Migration

If upgrading from a version without structured onboarding:

#### New Onboarding Flow
1. **Profile Picture** - Upload and crop profile image
2. **Bio** - Write personal description
3. **Interests** - Select interests and hobbies
4. **Location Preferences** - Set location and distance preferences
5. **Privacy Settings** - Configure visibility and privacy options
6. **Notification Preferences** - Choose notification types
7. **Welcome Tutorial** - Interactive app introduction

#### Integration Steps
1. **Install dependencies**: Ensure React Hook Form and Zod are available
2. **Add routing**: Include `/onboarding` route in your router configuration
3. **Update auth flow**: Redirect new users to onboarding after registration
4. **Configure API**: Ensure onboarding endpoints are available
5. **Test user flows**: Verify complete user journey from registration to app usage

#### API Changes
- New endpoints under `/api/v1/onboarding/*`
- User profile updates integrated with onboarding steps
- Progress tracking and state management

### 🎨 Design System Updates

#### Color Palette Changes
- **Removed**: All green accent variants
- **Updated**: Success states now use aqua colors
- **Added**: Extended aqua color palette with more variants

#### Component Updates
```scss
// Old approach
.success-indicator { color: green; }
.online-status { background: green; }

// New approach  
.success-indicator { color: var(--aqua); }
.online-status { background: var(--aqua); }
```

#### Migration Steps
1. **Search and replace**: Update color references from green to aqua
2. **Update CSS classes**: Use new aqua-based utility classes
3. **Test visual consistency**: Ensure UI components maintain proper contrast
4. **Update brand assets**: Align with new aqua-focused brand palette

### 🔧 Environment Configuration Migration

#### New Environment Structure
```bash
# Old structure
.env
.env.local

# New structure
.env.demo        # Demo environment (committed)
.env.preview     # Preview/staging (committed)  
.env.production  # Production (committed)
.env.test        # Testing (git-ignored)
.env.local       # Local overrides (git-ignored)
```

#### Migration Steps
1. **Create environment files**: Add appropriate `.env.*` files for each environment
2. **Update deployment scripts**: Use `--mode` flag with Vite commands
3. **Configure CI/CD**: Set environment variables in deployment pipeline
4. **Update Docker**: Pass environment variables via Docker compose or runtime flags

#### Required Variables
All environments must define:
- `NODE_ENV` - Environment mode
- `VITE_APP_MODE` - Application mode
- `VITE_API_BASE_URL` - API base URL
- `VITE_REQUIRE_AUTH` - Authentication requirement
- Additional configuration per environment needs

### ⚠️ Breaking Changes Notice

1. **Search API**: Legacy search endpoints will stop working after 2025-12-31
2. **Onboarding**: New users will be redirected to onboarding flow
3. **Color System**: Green accents removed - update any custom CSS
4. **Environment**: New environment variable structure required

### 🧪 Testing Migration

Run these commands to verify your migration:

```bash
# Test unified search functionality
npm run test -- --testNamePattern="unified.*search"

# Test onboarding flow
npm run test:onboarding

# Test environment configuration
npm run test:env

# Run accessibility audit
npm run audit:full

# Test E2E functionality
npm run test:e2e
```

### 📞 Support

For migration assistance or questions:
- Check the [unified search documentation](./UNIFIED_SEARCH_MIGRATION.md)
- Review [onboarding implementation details](./docs/onboarding-implementation-summary.md)
- Run tests to identify breaking changes
- Monitor console warnings for deprecation notices

---

*For older versions, see individual git tags and release notes.*
