// Enable accessing environment variables in Cypress tests
Cypress.on('window:before:load', (win) => {
  win.process = {
    env: {
      NODE_ENV: Cypress.env('NODE_ENV') || 'test'
    }
  };
});
