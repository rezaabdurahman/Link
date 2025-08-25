// Setup file for integration tests (full environment)
import '@testing-library/jest-dom';
import { setupCommonMocks } from './__test-utils__/mock-helpers';

// Setup all mocks for integration tests
setupCommonMocks();

// Mock Sentry with full interface for integration tests
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

// MSW setup for API mocking in integration tests
import { server } from './mocks/server';

// Start MSW server
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

// Mock environment variables for integration testing
process.env.VITE_API_BASE_URL = 'http://localhost:8080';
process.env.VITE_APP_MODE = 'test';
process.env.VITE_ENABLE_MOCKING = 'true';
process.env.VITE_REQUIRE_AUTH = 'false';
process.env.VITE_AUTO_LOGIN = 'true';

// Allow some console output for integration tests but suppress known warnings
const originalWarn = console.warn;
beforeAll(() => {
  console.warn = (...args) => {
    if (args[0]?.includes?.('React Router Future Flag Warning')) {
      return;
    }
    originalWarn(...args);
  };
});

afterAll(() => {
  console.warn = originalWarn;
});