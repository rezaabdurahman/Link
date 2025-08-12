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
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fetch = require('cross-fetch');
  global.fetch = fetch;
  global.Request = fetch.Request;
  global.Response = fetch.Response;
  global.Headers = fetch.Headers;
}

// Conditional MSW setup - only import if module is available
try {
  const { server } = require('./mocks/server');
  
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
} catch (error) {
  console.warn('MSW setup skipped due to module resolution issues:', error instanceof Error ? error.message : String(error));
  // Provide mock implementations for tests that depend on MSW
  (global as any).mockServer = {
    listen: () => {},
    close: () => {},
    resetHandlers: () => {},
    use: () => {},
  };
}
