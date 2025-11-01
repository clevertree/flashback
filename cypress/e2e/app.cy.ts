describe('Fabric Desktop Client E2E Tests', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should render the home page', () => {
    cy.contains('Welcome to Fabric Desktop Client').should('be.visible');
  });

  it('should have navigation buttons', () => {
    cy.contains('button', 'Home').should('be.visible');
    cy.contains('button', 'Keys').should('be.visible');
    cy.contains('button', 'Network').should('be.visible');
  });

  it('should navigate to key management', () => {
    cy.contains('button', 'Keys').click();
    cy.contains('Key Management').should('be.visible');
    cy.contains('button', 'Generate New Keypair').should('be.visible');
  });

  it('should navigate to network connection', () => {
    cy.contains('button', 'Network').click();
    cy.contains('Network Connection').should('be.visible');
  });

  it('should display network status', () => {
    cy.contains('Network:').should('be.visible');
    cy.contains('Disconnected').should('be.visible');
  });

  it('should allow setting gateway URL', () => {
    cy.contains('button', 'Network').click();
    cy.get('input[placeholder*="kaleido"]')
      .first()
      .clear()
      .type('https://test.kaleido.io');
    cy.get('input[placeholder*="kaleido"]')
      .first()
      .should('have.value', 'https://test.kaleido.io');
  });

  it('should show channels after connection', () => {
    cy.contains('button', 'Network').click();
    cy.contains('button', 'Connect to Network').click();
    cy.contains('button', 'Channels').should('not.be.disabled');
  });
});
