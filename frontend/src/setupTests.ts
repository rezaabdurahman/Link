import '@testing-library/jest-dom';
import { setupCommonMocks } from './__test-utils__/mock-helpers';

// Setup common mocks for all tests
setupCommonMocks();

// Mock Sentry to avoid errors in tests
jest.mock('@sentry/react', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
  setContext: jest.fn(),
  addBreadcrumb: jest.fn(),
  startSpan: jest.fn(() => ({
    finish: jest.fn(),
    setTag: jest.fn(),
    setData: jest.fn(),
  })),
  browserTracingIntegration: jest.fn(),
}));

// Jest mocks are handled via moduleNameMapper in jest.config.js

// Mock console.warn for cleaner test output
const originalWarn = console.warn;
beforeAll(() => {
  console.warn = (...args) => {
    // Suppress known React Router warnings in tests
    if (args[0]?.includes?.('React Router Future Flag Warning')) {
      return;
    }
    originalWarn(...args);
  };
});

afterAll(() => {
  console.warn = originalWarn;
});

// MSW setup for API mocking
import { server } from './mocks/server';

// MSW test setup
beforeAll(() => {
  // Start the server before all tests
  server.listen({ onUnhandledRequest: 'warn' });
});

afterEach(() => {
  // Reset any request handlers that we may add during the tests,
  // so they don't affect other tests
  server.resetHandlers();
});

afterAll(() => {
  // Stop the server after all tests
  server.close();
});
