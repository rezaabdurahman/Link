// Load test environment variables
require('dotenv').config({ path: '.env.test' });

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  setupFiles: [
    'jest-fetch-mock/setupJest.js',
    '<rootDir>/src/testEnv.ts'
  ],
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
  
  // Coverage thresholds - enforcing minimum quality standards
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60, 
      statements: 60
    },
    // More lenient thresholds for specific directories
    './src/components/': {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    },
    './src/services/': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Allow lower coverage for pages (integration tested differently)
    './src/pages/': {
      branches: 40,
      functions: 40,
      lines: 40,
      statements: 40
    }
  },
  
  // Module resolution
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss)$': 'identity-obj-proxy'
  },
  
  // CRITICAL: Force ts-jest to handle TypeScript, not Babel
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
      // Enable isolated modules for better performance
      isolatedModules: true,
      // Handle import.meta for Jest
      useESM: false
    }]
  },
  
  // Define globals for import.meta
  globals: {
    'ts-jest': {
      tsconfig: {
        target: 'es2020',
        module: 'commonjs'
      }
    },
    'import.meta': {
      env: {
        VITE_API_BASE_URL: 'http://localhost:8080',
        VITE_API_URL: 'http://localhost:8080',
        NODE_ENV: 'test'
      }
    }
  },
  
  // Transform patterns
  transformIgnorePatterns: [
    'node_modules/(?!(msw|@mswjs/.*|.*\\.mjs$))'
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
