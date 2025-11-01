/// <reference types="cypress" />

// Disable uncaught exception handling for development
Cypress.on('uncaught:exception', (err: any, runnable: any) => {
  // Return false to prevent Cypress from failing the test
  return false;
});
