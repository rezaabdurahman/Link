# Testing Guide for Link Frontend

## Overview

This project uses a comprehensive testing strategy with three main types of testing:
- **Unit Tests**: Jest + React Testing Library
- **End-to-End Tests**: Cypress 
- **Visual Regression Tests**: Percy + Cypress

## Quick Start

```bash
# Run all unit tests
npm test

# Run unit tests with coverage
npm run test:coverage

# Run unit tests with coverage enforcement (60% minimum)
npm run test:coverage:enforce

# Run E2E tests
npm run test:e2e

# Run visual regression tests (requires Percy token)
npm run test:visual

# Run all tests
npm test && npm run test:e2e
```

## Jest Unit Testing

### Configuration
- **Config file**: `jest.config.js`
- **Test environment**: jsdom (browser simulation)
- **Coverage threshold**: 60% minimum globally, 70% for services

### Running Tests
```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- src/components/Button.test.tsx

# Run tests with coverage
npm run test:coverage

# Update snapshots
npm run test:snapshots
```

### Coverage Thresholds
```javascript
// Global minimum: 60%
coverageThreshold: {
  global: { branches: 60, functions: 60, lines: 60, statements: 60 },
  'src/services/*.ts': { branches: 70, functions: 70, lines: 70, statements: 70 },
  'src/contexts/*.tsx': { branches: 65, functions: 65, lines: 65, statements: 65 }
}
```

### Best Practices
- Place unit tests adjacent to components: `Button.tsx` → `Button.test.tsx`
- Use `describe` blocks to group related tests
- Use `it` for individual test cases
- Mock external dependencies and API calls
- Test component behavior, not implementation details

### Example Unit Test
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import Button from './Button'

describe('Button Component', () => {
  it('should render with correct text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('should handle click events', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Click me</Button>)
    
    fireEvent.click(screen.getByText('Click me'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

## Cypress E2E Testing

### Configuration
- **Config file**: `cypress.config.ts`
- **Test files**: `cypress/e2e/**/*.cy.ts`
- **Support files**: `cypress/support/`

### Running E2E Tests
```bash
# Run E2E tests (headless)
npm run test:e2e

# Open Cypress Test Runner (interactive)
npm run test:e2e:dev

# Run specific spec
npx cypress run --spec "cypress/e2e/login.cy.ts"
```

### Custom Commands
Available in `cypress/support/commands.ts`:
- `cy.loginAsTestUser()` - Sets up authenticated user
- `cy.mockFriendSearch()` - Mocks friend search API

### Best Practices
- Test complete user workflows
- Use data-testid attributes for element selection
- Mock external API calls for reliability
- Test error scenarios and edge cases
- Keep tests isolated and independent

### Example E2E Test
```typescript
describe('User Authentication', () => {
  it('should allow user to login', () => {
    cy.visit('/login')
    cy.get('[data-testid="email-input"]').type('user@example.com')
    cy.get('[data-testid="password-input"]').type('password123')
    cy.get('[data-testid="login-button"]').click()
    
    cy.url().should('include', '/dashboard')
    cy.get('[data-testid="welcome-message"]').should('be.visible')
  })
})
```

## Percy Visual Regression Testing

### Setup
1. **Install Percy CLI globally** (optional):
   ```bash
   npm install -g @percy/cli
   ```

2. **Get Percy token** from [percy.io](https://percy.io):
   ```bash
   export PERCY_TOKEN=your-percy-token-here
   ```

3. **Add to CI environment variables**:
   ```bash
   PERCY_TOKEN=your-percy-token-here
   ```

### Configuration
- **Config file**: `.percy.yml`
- **Test widths**: 414px (mobile), 768px (tablet), 1200px (desktop)
- **Integration**: Cypress + Percy

### Running Visual Tests
```bash
# Run visual regression tests
npm run test:visual

# Run visual tests in development mode
npm run test:visual:dev

# Run visual tests for CI
npm run test:visual:ci
```

### Creating Visual Tests
```typescript
describe('Visual Regression Tests', () => {
  it('should capture homepage snapshots', () => {
    cy.visit('/')
    cy.get('[data-testid="main-content"]').should('be.visible')
    
    // Capture screenshot at multiple breakpoints
    cy.percySnapshot('Homepage', {
      widths: [414, 768, 1200],
      minHeight: 1024
    })
  })
})
```

### Best Practices
- Capture screenshots at key breakpoints
- Test different component states (loading, error, success)
- Use semantic snapshot names
- Test both light and dark themes (if applicable)
- Ensure consistent test data across runs

## Mock Service Worker (MSW)

### Purpose
MSW intercepts network requests during testing to provide consistent, reliable test data without hitting real APIs.

### Setup
- **Server setup**: `src/mocks/server.ts`
- **Handlers**: `src/mocks/handlers.ts`
- **Browser setup**: `src/mocks/browser.ts`

### Usage in Tests
```typescript
import { server } from '../mocks/server'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run test:coverage:ci
      - run: npm run test:e2e
      - run: npm run test:visual:ci
        env:
          PERCY_TOKEN: ${{ secrets.PERCY_TOKEN }}
```

### Coverage Reports
Coverage reports are generated in `coverage/` directory:
- `coverage/lcov-report/index.html` - HTML report
- `coverage/lcov.info` - LCOV format for CI tools

## Debugging Tests

### Jest Debugging
```bash
# Run tests in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand

# Run specific test in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand Button.test.tsx
```

### Cypress Debugging
```bash
# Open Cypress with DevTools
npm run test:e2e:dev

# Run with additional logging
DEBUG=cypress:* npm run test:e2e
```

### Common Issues

#### Jest `import.meta` Errors
If you see `import.meta` errors, ensure `testEnv.ts` is properly configured and imported in jest setup.

#### MSW Import Errors
If MSW fails to import, check that `@mswjs/interceptors` is installed and MSW handlers are properly configured.

#### Cypress Timeouts
If Cypress tests timeout, check that:
- Application is running on correct port
- Data-testid attributes exist
- API mocks are properly configured

## Testing Rules Compliance

This testing setup adheres to the project rules:
- ✅ **≥60% Coverage**: Enforced via coverage thresholds
- ✅ **TypeScript Strict Mode**: All test files use strict TypeScript
- ✅ **Containerized Parity**: Docker support for consistent test environments
- ✅ **Branching Strategy**: Tests run on feature branches before merge

## Environment Variables

Create `.env.test` file for test-specific configuration:
```bash
NODE_ENV=test
VITE_API_BASE_URL=http://localhost:8080
VITE_ENABLE_MOCKING=true
VITE_REQUIRE_AUTH=false
```

## Performance Considerations

### Jest Performance
- Tests run with `maxWorkers: 1` for stability
- `isolatedModules: true` for faster TypeScript compilation
- `bail: true` to stop on first failure

### Cypress Performance
- Videos disabled by default (`video: false`)
- Screenshots only on failure
- Headless mode for CI (`--headless` flag)

## Contributing

When adding new features:
1. **Write unit tests** for components and utilities
2. **Add E2E tests** for new user workflows
3. **Create visual tests** for UI changes
4. **Ensure coverage thresholds** are met
5. **Update documentation** as needed

For questions about testing, refer to this guide or check the test examples in the codebase.
