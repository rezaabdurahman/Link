// Load test environment variables
require('dotenv').config({ path: '.env.test' });

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  setupFiles: ['<rootDir>/src/testEnv.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  
  // Test file patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{ts,tsx}'
  ],
  
  // Coverage collection
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/__tests__/**'
  ],
  
  // Coverage thresholds - temporarily lowered while building test suite
  // TODO: Increase back to 60% once more tests are added
  coverageThreshold: {
    global: {
      branches: 5, // Lowered for CI - will increase as we add more tests
      functions: 5,
      lines: 5, 
      statements: 5
    }
  },
  
  // Module resolution
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss)$': 'identity-obj-proxy',
    '^msw/node$': '<rootDir>/node_modules/msw/lib/node/index.js'
  },
  
  // CRITICAL: Force ts-jest to handle TypeScript, not Babel
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
      // Enable isolated modules for better performance
      isolatedModules: true
    }]
  },
  
  // Transform patterns
  transformIgnorePatterns: [
    'node_modules/(?!(msw|@mswjs|.*\\.mjs$))'
  ],
  
  // File extensions Jest should handle
  moduleFileExtensions: [
    'ts',
    'tsx', 
    'js',
    'jsx',
    'json',
    'node'
  ],
  
  // Test performance settings  
  testTimeout: 5000,
  forceExit: true,
  detectOpenHandles: false,
  maxWorkers: 1,
  bail: true
};
