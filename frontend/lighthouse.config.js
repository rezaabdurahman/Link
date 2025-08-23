module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:4173/', 'http://localhost:4173/discovery', 'http://localhost:4173/login'],
      startServerCommand: 'npm run preview',
      startServerReadyPattern: 'Local:',
      startServerReadyTimeout: 30000,
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        'categories:performance': ['warn', {minScore: 0.8}],
        'categories:accessibility': ['error', {minScore: 0.9}],
        'categories:best-practices': ['warn', {minScore: 0.9}],
        'categories:seo': ['warn', {minScore: 0.8}],
        
        // Custom performance metrics
        'first-contentful-paint': ['warn', {maxNumericValue: 2000}],
        'largest-contentful-paint': ['warn', {maxNumericValue: 3000}],
        'cumulative-layout-shift': ['warn', {maxNumericValue: 0.1}],
        'total-blocking-time': ['warn', {maxNumericValue: 300}],
        
        // Bundle size checks
        'unused-javascript': ['warn', {maxNumericValue: 40000}], // 40KB max unused JS
        'modern-image-formats': 'warn',
        'efficiently-encode-images': 'warn',
        'unused-css-rules': 'warn',
        
        // Best practices
        'uses-https': 'off', // We're testing locally
        'uses-http2': 'off', // Not applicable for local testing
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
    server: {
      port: 9001,
      storage: './.lighthouseci',
    },
  },
};