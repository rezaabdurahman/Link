# Onboarding Frontend System

This directory contains the complete onboarding flow implementation for the Link application. The onboarding system guides new users through setting up their profile with a multi-step, interactive process.

## Architecture

### Components Structure

```
onboarding/
├── OnboardingLayout.tsx           # Layout wrapper with navigation and styling
├── OnboardingProgressBar.tsx      # Visual progress indicator
├── ProfilePictureStep.tsx         # Step 1: Profile picture upload
├── BioStep.tsx                    # Step 2: User bio/description
├── InterestsStep.tsx              # Step 3: Interest selection
├── LocationPreferencesStep.tsx    # Step 4: Location settings
├── PrivacySettingsStep.tsx        # Step 5: Privacy preferences
├── NotificationPreferencesStep.tsx # Step 6: Notification settings
├── WelcomeTutorialStep.tsx        # Step 7: Welcome and completion
└── README.md                      # This documentation
```

### State Management

The onboarding system uses React Context for state management:

- **OnboardingContext** (`../../contexts/OnboardingContext.tsx`): Global onboarding state
- **OnboardingProvider**: Context provider wrapping the application
- **useOnboarding()**: Hook for accessing onboarding state and actions

### API Integration

The frontend communicates with the backend through:

- **onboardingClient** (`../../services/onboardingClient.ts`): API service layer
- **authClient** (`../../services/authClient.ts`): Authentication utilities

## Features

### Multi-Step Flow

1. **Profile Picture**: Upload or skip profile image with drag-and-drop support
2. **Bio**: Write a personal description with character limits and suggestions
3. **Interests**: Select from categorized interest tags with search functionality
4. **Location Preferences**: Configure location-based settings (placeholder)
5. **Privacy Settings**: Set profile visibility and privacy options (placeholder)
6. **Notification Preferences**: Choose notification delivery methods (placeholder)
7. **Welcome Tutorial**: Final step with feature highlights and completion

### User Experience

- **Progress Tracking**: Visual progress bar with step indicators
- **Navigation**: Forward/backward navigation with skip options
- **Error Handling**: Comprehensive error messaging and retry mechanisms
- **Loading States**: Loading indicators during API operations
- **Responsive Design**: Mobile-friendly responsive layouts
- **Accessibility**: ARIA labels and keyboard navigation support

### State Persistence

- **Step Data**: Form data persists across navigation
- **Backend Sync**: Real-time synchronization with backend API
- **Error Recovery**: Graceful handling of network issues

## Integration Points

### Routing

The onboarding flow is integrated into the main app routing:

```typescript
// In App.tsx
<Route element={<RequireAuth />}>
  <Route path="/onboarding" element={<OnboardingPage />} />
</Route>
```

### Authentication Flow

New users are automatically redirected to onboarding after registration:

```typescript
// In SignupPage.tsx
setTimeout(() => {
  navigate('/onboarding', { replace: true });
}, 1500);
```

### Completion Handling

Users are redirected to the main app after completing or skipping onboarding:

```typescript
// In OnboardingPage.tsx
if (isInitialized && (isCompleted || isSkipped)) {
  return <Navigate to="/discovery" replace />;
}
```

## API Endpoints

The onboarding system uses the following backend endpoints:

- `GET /onboarding/status` - Get current onboarding status
- `POST /onboarding/start` - Start onboarding process
- `POST /onboarding/step` - Update specific step data
- `POST /onboarding/complete` - Complete entire flow
- `POST /onboarding/skip` - Skip entire flow
- `POST /onboarding/skip-step` - Skip individual step
- `POST /users/profile` - Update user profile data

## Development

### Adding New Steps

1. Create new step component in this directory
2. Add step type to `OnboardingStepType` enum
3. Update step order in helper functions
4. Add step to `OnboardingPage.tsx` render logic
5. Update progress calculation

### Customizing Styles

The components use Tailwind CSS classes and can be customized by:

- Modifying existing classes in component files
- Updating the global Tailwind configuration
- Adding custom CSS for specific styling needs

### Testing

Components can be tested individually by:

- Mocking the `useOnboarding()` hook
- Providing test data for form interactions
- Testing API integration with mock services

## Backend Integration

This frontend system is designed to work with the Link backend onboarding API:

- **Event-driven architecture**: Publishes events for user registration and onboarding completion
- **Modular design**: Prepared for future extraction of onboarding service
- **Error handling**: Comprehensive error responses and retry mechanisms
- **Data validation**: Client-side and server-side validation

## Future Enhancements

- **A/B Testing**: Support for different onboarding flows
- **Personalization**: Dynamic step ordering based on user type
- **Analytics**: Tracking of user interaction and completion rates
- **Offline Support**: Local storage for offline form completion
- **Animations**: Enhanced transitions between steps
