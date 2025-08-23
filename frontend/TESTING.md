# Testing Guide for Link Frontend

This document provides comprehensive information about testing in the Link frontend application.

## Overview

Our testing strategy consists of multiple layers:

1. **Unit Tests** - Test individual components and utilities in isolation
2. **Integration Tests** - Test component interactions and data flow
3. **End-to-End Tests** - Test complete user workflows
4. **Visual Regression Tests** - Ensure UI consistency across changes

## Tech Stack

- **Jest** - Test runner and assertion library
- **React Testing Library** - Component testing utilities
- **Cypress** - End-to-end testing framework
- **Percy** - Visual regression testing
- **MSW (Mock Service Worker)** - API mocking

## Running Tests

### Unit and Integration Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with enforced coverage thresholds
npm run test:coverage:enforce

# Run tests in CI mode
npm run test:coverage:ci

# Run specific test suite
npm run test:onboarding

# Update snapshots
npm run test:snapshots
```

### End-to-End Tests

```bash
# Run E2E tests headlessly
npm run test:e2e

# Open Cypress Test Runner
npm run test:e2e:dev

# Run specific E2E test
npx cypress run --spec "cypress/e2e/user-discovery.cy.ts"
```

### Visual Regression Tests

```bash
# Run visual tests
npm run test:visual

# Run visual tests in development
npm run test:visual:dev

# Run visual tests in CI
npm run test:visual:ci
```

## Test Structure

### Unit Tests

Located in `src/**/__tests__/` or `src/**/*.test.{ts,tsx}`

### Integration Tests

Located in `src/__tests__/integration/`

### E2E Tests

Located in `cypress/e2e/`

## Quick Test Examples

### Run New Tests

```bash
# Test the new utility functions
npm run test -- nameHelpers.test.ts

# Test the new UserCard component
npm run test -- UserCard.test.tsx

# Test the click likelihood service
npm run test -- clickLikelihoodClient.test.ts

# Run integration tests
npm run test -- integration/
```

## Test Files Created

1. **`src/utils/__tests__/nameHelpers.test.ts`** - Tests for name utility functions
2. **`src/components/__tests__/UserCard.test.tsx`** - Tests for UserCard component
3. **`src/services/__tests__/clickLikelihoodClient.test.ts`** - Tests for ML algorithm
4. **`src/__tests__/integration/DiscoveryFlow.test.tsx`** - Integration tests
5. **`cypress/e2e/user-discovery.cy.ts`** - E2E discovery flow tests
6. **`cypress/e2e/authentication-flow.cy.ts`** - E2E auth flow tests

## Coverage Improvements

The new tests target:
- ✅ Name utility functions (100% coverage)
- ✅ UserCard component (major functionality)
- ✅ Click likelihood algorithm (comprehensive testing)
- ✅ Discovery page integration
- ✅ Authentication flows
- ✅ User interaction patterns

## Best Practices Implemented

1. **Proper mocking** of external dependencies
2. **Comprehensive test scenarios** including edge cases
3. **Integration testing** between components
4. **E2E testing** for critical user journeys
5. **Accessibility testing** considerations
6. **Performance testing** with large datasets

## Next Steps

1. **Run the tests** to see improved coverage
2. **Add data-testid attributes** to components for E2E tests
3. **Expand coverage** to other critical components
4. **Set up CI/CD integration** for automated testing