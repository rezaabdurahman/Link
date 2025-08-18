import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    viewportWidth: 414,
    viewportHeight: 896,
    video: false,
    screenshotOnRunFailure: true,
    setupNodeEvents(on, config) {
      // Percy integration
      // Load Percy plugin if running with Percy
      if (config.env.percy) {
        require('@percy/cypress/task')(on, config)
      }
      
      return config
    },
  },
})
