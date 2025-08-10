# Configuration Management

This directory contains centralized configuration files for the Link frontend application.

## Files

### `appConstants.ts`
Contains core app configuration including:
- **App Name**: "Link"
- **Tagline**: "connect with people around you"
- **Description**: "AI-powered real-life connections"
- **Meta Information**: Title, description, theme color
- **Feature Descriptions**: Brief descriptions of main features

### `featureFlags.ts`
Contains feature toggle configuration for development and gradual rollouts:
- `CONVERSATION_CUE_CARDS`: Enable/disable conversation cue cards
- `INTELLIGENT_MESSAGE_BOX`: Enable/disable intelligent message search

### `index.ts`
Barrel export file for easy importing of configuration values.

## Usage Examples

### Import app constants:
```typescript
import { APP_CONFIG } from '@/config';

// Use in component
const MyComponent = () => {
  return (
    <div>
      <h1>{APP_CONFIG.appName}</h1>
      <p>{APP_CONFIG.tagline}</p>
    </div>
  );
};
```

### Import feature flags:
```typescript
import { FeatureFlags, isFeatureEnabled } from '@/config';

// Check if feature is enabled
if (isFeatureEnabled('CONVERSATION_CUE_CARDS')) {
  // Render conversation cue cards
}
```

### Use meta information:
```typescript
import { APP_CONFIG } from '@/config';

// Set document title dynamically
document.title = APP_CONFIG.meta.title;
```

## Benefits

1. **Centralized Management**: All app constants in one place
2. **Type Safety**: Full TypeScript support with proper types
3. **Easy Updates**: Change tagline/description in one file
4. **Consistency**: Ensures consistent branding across the app
5. **Feature Flags**: Easy toggle for features during development

## Updating the Tagline

To update the app tagline, simply modify the `tagline` property in `appConstants.ts`. This will automatically update:
- Browser tab title
- Package.json description
- All documentation files
- Any components using the constant
