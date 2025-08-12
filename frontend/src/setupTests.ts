import '@testing-library/jest-dom';
import 'cross-fetch/polyfill';

// Polyfill for TextEncoder/TextDecoder used by MSW (must be before MSW import)
import { TextEncoder, TextDecoder } from 'util';

if (typeof global.TextEncoder === 'undefined') {
  // @ts-expect-error - Node.js util TextEncoder not compatible with DOM TextEncoder type
  global.TextEncoder = TextEncoder;
}

if (typeof global.TextDecoder === 'undefined') {
  // @ts-expect-error - Node.js util TextDecoder not compatible with DOM TextDecoder type
  global.TextDecoder = TextDecoder;
}

// Ensure fetch globals are available before importing MSW
if (typeof global.fetch === 'undefined') {
  const fetch = require('cross-fetch');
  global.fetch = fetch;
  global.Request = fetch.Request;
  global.Response = fetch.Response;
  global.Headers = fetch.Headers;
}

import { server } from './mocks/server';

// Mock import.meta for Vite compatibility in tests
const mockImportMeta = {
  env: {
    VITE_API_BASE_URL: 'http://localhost:8080',
    VITE_API_URL: 'http://localhost:8080',
    MODE: 'test',
    DEV: false,
    PROD: false
  }
};

// Create a global import object with meta property
(globalThis as any).import = {
  meta: mockImportMeta
};

// Also set on global for Node.js compatibility
(global as any).import = {
  meta: mockImportMeta
};

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
