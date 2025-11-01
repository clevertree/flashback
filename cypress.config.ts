module.exports = {
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: false,
  },
  component: {
    devServer: {
      framework: 'next',
      bundler: 'webpack',
    },
    specPattern: '**/*.cy.{js,jsx,ts,tsx}',
  },
};
