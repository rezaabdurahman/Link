// Jest configuration optimized for CI
const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  
  // CI-specific overrides
  maxWorkers: 2, // Limit workers for CI environment
  bail: 1, // Stop on first test failure to save time
  verbose: true, // Detailed output for debugging
  
  // Coverage settings for CI
  collectCoverage: true,
  coverageReporters: ['text', 'lcov', 'json-summary', 'html'],
  coverageDirectory: 'coverage',
  
  // Updated coverage thresholds
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    },
    // File-specific thresholds for critical files
    './src/utils/nameHelpers.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/services/clickLikelihoodClient.ts': {
      branches: 75,
      functions: 70,
      lines: 75,
      statements: 75
    }
  },
  
  // Test result reporting
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-results',
      outputName: 'jest-results.xml',
      suiteName: 'Frontend Unit Tests',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true,
    }],
    ['jest-html-reporters', {
      publicPath: 'test-results',
      filename: 'jest-report.html',
      expand: true,
      hideIcon: false,
      pageTitle: 'Frontend Test Report',
      logoImgPath: undefined,
      inlineSource: false,
    }]
  ],
  
  // Performance optimizations for CI
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  
  // Error handling
  errorOnDeprecated: true,
  
  // Test environment optimizations
  testEnvironmentOptions: {
    url: 'http://localhost',
  },
  
  // Timeout settings
  testTimeout: 10000, // 10 seconds max per test
  
  // File watching disabled in CI
  watchman: false,
  
  // Silent console logs in CI (except errors)
  silent: false,
  
  // Force exit to prevent hanging
  forceExit: true,
  detectOpenHandles: true,
};