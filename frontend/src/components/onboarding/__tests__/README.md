# Onboarding Components Test Suite

## Overview

This directory contains comprehensive unit tests with snapshot testing for the onboarding components, focusing on maintaining visual consistency and catching regressions in styling changes.

## Test Coverage

The test suite maintains ≥60% code coverage requirement as specified:

- **OnboardingLayout**: 64.7% coverage (meets requirement)
- **Snapshot Tests**: 4 snapshots covering different states

## Test Files

### `OnboardingLayout.snapshot.test.tsx`

Snapshot tests for the main onboarding layout component covering:

- Default state rendering
- Back button visibility
- User greeting display  
- Loading state behavior

### Mock Strategy

Tests use comprehensive mocking of:
- React contexts (AuthContext, OnboardingContext)
- Framer Motion animations (simplified for testing)
- React Router components

## CSS Class Testing

The snapshot tests capture:
- iOS-specific styling classes (`ios-card`, `ios-button`, etc.)
- Tailwind utility classes
- Component structure and hierarchy
- Conditional class applications

## Running Tests

```bash
# Run all onboarding tests
npm run test:onboarding

# Run specific snapshot tests  
npm test OnboardingLayout.snapshot.test.tsx

# Update snapshots after intentional changes
npm run test:snapshots

# Run with coverage report
npm run test:coverage -- src/components/onboarding
```

## Snapshot Management

- Snapshots are stored in `__snapshots__/` directory
- Review snapshot changes carefully during code reviews
- Update snapshots only when visual changes are intentional
- Snapshots capture full component rendering including all CSS classes

## Notes

- Tests are designed to be maintainable and not tightly coupled to implementation
- Mock contexts provide realistic data while remaining deterministic
- Coverage requirement maintained at ≥60% for critical onboarding flow
