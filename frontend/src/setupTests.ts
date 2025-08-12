import '@testing-library/jest-dom';

// Polyfill for TextEncoder/TextDecoder used by MSW
import { TextEncoder, TextDecoder } from 'util';

if (typeof global.TextEncoder === 'undefined') {
  // @ts-ignore
  global.TextEncoder = TextEncoder;
}

if (typeof global.TextDecoder === 'undefined') {
  // @ts-ignore
  global.TextDecoder = TextDecoder;
}

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
