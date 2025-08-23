import '@testing-library/jest-dom';

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