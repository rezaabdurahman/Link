import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4173',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    
    // CI-optimized settings
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    videoCompression: 32, // Compress videos for faster upload
    screenshotOnRunFailure: true,
    screenshotsFolder: 'cypress/screenshots',
    videosFolder: 'cypress/videos',
    
    // Timeouts
    defaultCommandTimeout: 10000,
    pageLoadTimeout: 30000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    
    // Retry configuration
    retries: {
      runMode: 2, // Retry failed tests 2 times in CI
      openMode: 0, // No retries in interactive mode
    },
    
    // Test isolation
    testIsolation: true,
    
    // Performance optimizations for CI
    watchForFileChanges: false,
    chromeWebSecurity: false, // Disable for testing
    
    // Environment variables
    env: {
      coverage: false, // Disable coverage collection in E2E for speed
    },
    
    setupNodeEvents(on, config) {
      // Percy integration for visual testing
      if (config.env.percy) {
        require('@percy/cypress/task')(on, config);
      }
      
      // Code coverage (if enabled)
      if (config.env.coverage) {
        require('@cypress/code-coverage/task')(on, config);
      }
      
      // Custom task for test reporting
      on('task', {
        log(message) {
          console.log(message);
          return null;
        },
        table(message) {
          console.table(message);
          return null;
        },
      });
      
      // Browser launch configuration
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.name === 'chrome' && browser.isHeadless) {
          // Optimize Chrome for CI
          launchOptions.args.push('--disable-gpu');
          launchOptions.args.push('--no-sandbox');
          launchOptions.args.push('--disable-dev-shm-usage');
          launchOptions.args.push('--disable-extensions');
          launchOptions.args.push('--disable-background-timer-throttling');
          launchOptions.args.push('--disable-backgrounding-occluded-windows');
          launchOptions.args.push('--disable-renderer-backgrounding');
        }
        
        if (browser.name === 'firefox' && browser.isHeadless) {
          // Optimize Firefox for CI
          launchOptions.preferences = {
            ...launchOptions.preferences,
            'media.navigator.streams.fake': true,
            'media.navigator.permission.disabled': true,
          };
        }
        
        return launchOptions;
      });
      
      return config;
    },
  },
  
  // Component testing configuration (if used)
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
    specPattern: 'src/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/component.ts',
  },
});