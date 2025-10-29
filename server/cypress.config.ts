import { defineConfig } from 'cypress'

const baseUrl = process.env.CYPRESS_BASE_URL || 'http://localhost:8080'

export default defineConfig({
  e2e: {
    baseUrl,
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: false,
    video: false,
    screenshotOnRunFailure: false,
    defaultCommandTimeout: 10000,
    env: {
      NODE_ENV: 'test'
    }
  },
})
