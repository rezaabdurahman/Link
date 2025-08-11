import '@testing-library/jest-dom';

// Polyfill for TextEncoder/TextDecoder used by MSW
import { TextEncoder, TextDecoder } from 'util';

if (typeof global.TextEncoder === 'undefined') {
  (global as any).TextEncoder = TextEncoder;
}

if (typeof global.TextDecoder === 'undefined') {
  (global as any).TextDecoder = TextDecoder;
}

// Mock environment variables for testing
const mockEnv = {
  API_BASE_URL: 'http://localhost:8080',
  REACT_APP_API_BASE_URL: 'http://localhost:8080',
  NODE_ENV: 'test'
};

// Set environment variables for Node.js
Object.assign(process.env, mockEnv);

// Mock fetch for Node.js environment if not available
if (typeof global.fetch === 'undefined') {
  // This will be provided by MSW, but we need to ensure it's available
  const { fetch, Headers, Request, Response } = require('cross-fetch');
  global.fetch = fetch;
  global.Headers = Headers;
  global.Request = Request;
  global.Response = Response;
}

// Mock BroadcastChannel for MSW
if (typeof global.BroadcastChannel === 'undefined') {
  global.BroadcastChannel = class BroadcastChannel {
    constructor(public name: string) {}
    postMessage() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() { return true; }
  } as any;
}
