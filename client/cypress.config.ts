import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",
    supportFile: false,
    specPattern: "test/**/*.cy.{js,jsx,ts,tsx}",
  },

  component: {
    specPattern: "src/components/**/*.cy.{js,jsx,ts,tsx}",
    supportFile: "cypress/support/component.ts",
    devServer: {
      framework: "next",
      bundler: "webpack",
    },
  },
});
