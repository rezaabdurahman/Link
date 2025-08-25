// Setup file for unit tests (minimal dependencies)
import '@testing-library/jest-dom';
import { setupCommonMocks } from './__test-utils__/mock-helpers';

// Setup only essential mocks for unit tests
setupCommonMocks();

// Mock Sentry for unit tests
jest.mock('@sentry/react', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

// Mock environment variables for consistent unit testing
process.env.VITE_API_BASE_URL = 'http://localhost:8080';
process.env.VITE_APP_MODE = 'test';
process.env.VITE_ENABLE_MOCKING = 'true';

// Suppress console warnings in unit tests
const originalWarn = console.warn;
beforeAll(() => {
  console.warn = jest.fn();
});

afterAll(() => {
  console.warn = originalWarn;
});