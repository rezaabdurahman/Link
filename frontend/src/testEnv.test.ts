/**
 * Test for the import.meta.env polyfill
 */

import { initializeTestEnvironment, isTestEnvironment } from './testEnv';

describe('testEnv polyfill', () => {
  beforeAll(() => {
    // Clear any existing polyfill
    delete (globalThis as any).import;
  });

  test('should detect test environment correctly', () => {
    // Set NODE_ENV to test for this test
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    
    expect(isTestEnvironment()).toBe(true);
    
    // Restore original
    process.env.NODE_ENV = originalEnv;
  });

  test('should not run in production environment', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    
    // Clear any existing polyfill
    delete (globalThis as any).import;
    
    // Try to initialize
    initializeTestEnvironment();
    
    // Should not have created the polyfill
    expect((globalThis as any).import).toBeUndefined();
    
    // Restore original
    process.env.NODE_ENV = originalEnv;
  });

  test('should initialize polyfill with correct values', () => {
    // Clear any existing polyfill
    delete (globalThis as any).import;
    
    // Initialize the polyfill
    initializeTestEnvironment();
    
    // Check that the polyfill was created
    expect((globalThis as any).import).toBeDefined();
    expect((globalThis as any).import.meta).toBeDefined();
    expect((globalThis as any).import.meta.env).toBeDefined();
    
    const env = (globalThis as any).import.meta.env;
    
    // Check all the expected values
    expect(env.NODE_ENV).toBe('test');
    expect(env.MODE).toBe('test');
    expect(env.DEV).toBe(false);
    expect(env.PROD).toBe(false);
    expect(env.VITE_API_BASE_URL).toBe('http://localhost:8080');
    expect(env.VITE_API_URL).toBe('http://localhost:8080');
    expect(env.VITE_APP_MODE).toBe('test');
    expect(env.VITE_ENABLE_MOCKING).toBe('true');
  });

  test('should not override existing import.meta', () => {
    const existingImportMeta = {
      meta: {
        env: {
          NODE_ENV: 'existing',
          MODE: 'existing'
        }
      }
    };
    
    // Set up existing import.meta
    (globalThis as any).import = existingImportMeta;
    
    // Try to initialize
    initializeTestEnvironment();
    
    // Should not have changed the existing values
    expect((globalThis as any).import.meta.env.NODE_ENV).toBe('existing');
    expect((globalThis as any).import.meta.env.MODE).toBe('existing');
  });
});
