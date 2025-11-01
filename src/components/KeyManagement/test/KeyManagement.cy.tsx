import React from 'react';
import KeyManagement from '../index';

describe('KeyManagement Component', () => {
  beforeEach(() => {
    cy.mount(<KeyManagement />);
  });

  it('renders the Key Management header', () => {
    cy.get('[data-testid="key-icon"]').should('exist');
    cy.contains('h2', 'Key Management').should('be.visible');
  });

  it('displays generate keypair button', () => {
    cy.contains('button', 'Generate New Keypair').should('be.visible');
  });

  it('shows loading state when generating keypair', () => {
    cy.intercept('**/api/generate_keypair', { delay: 1000 }).as('generateKey');
    cy.contains('button', 'Generate New Keypair').click();
    cy.contains('button', 'Generating...').should('be.visible');
  });

  it('displays error message on failed generation', () => {
    cy.intercept('**/api/generate_keypair', {
      statusCode: 500,
      body: { error: 'Server error' },
    }).as('generateKeyError');
    
    cy.contains('button', 'Generate New Keypair').click();
    cy.contains('Failed to generate keypair').should('be.visible');
  });

  it('displays generated identity details', () => {
    cy.intercept('**/api/generate_keypair', {
      statusCode: 200,
      body: {
        private_key: 'test_private_key',
        public_key: 'test_public_key',
        certificate: 'test_cert',
      },
    }).as('generateKey');

    cy.contains('button', 'Generate New Keypair').click();
    cy.wait('@generateKey');

    cy.contains('Identity Generated').should('be.visible');
    cy.contains('User ID: user1').should('be.visible');
    cy.contains('Org: Org1').should('be.visible');
    cy.contains('MSPID: Org1MSP').should('be.visible');
  });

  it('enables save identity button after generation', () => {
    cy.intercept('**/api/generate_keypair', {
      statusCode: 200,
      body: {
        private_key: 'test_private_key',
        public_key: 'test_public_key',
        certificate: 'test_cert',
      },
    }).as('generateKey');

    cy.contains('button', 'Generate New Keypair').click();
    cy.wait('@generateKey');

    cy.contains('button', 'Save Identity').should('not.be.disabled');
  });

  it('saves identity successfully', () => {
    cy.intercept('**/api/generate_keypair', {
      statusCode: 200,
      body: {
        private_key: 'test_private_key',
        public_key: 'test_public_key',
        certificate: 'test_cert',
      },
    }).as('generateKey');

    cy.intercept('**/api/save_identity', {
      statusCode: 200,
      body: { success: true },
    }).as('saveIdentity');

    cy.contains('button', 'Generate New Keypair').click();
    cy.wait('@generateKey');
    cy.contains('button', 'Save Identity').click();
    cy.wait('@saveIdentity');
  });

  it('displays private key preview', () => {
    cy.intercept('**/api/generate_keypair', {
      statusCode: 200,
      body: {
        private_key: 'this_is_a_test_private_key_that_is_very_long_and_should_be_truncated_in_display',
        public_key: 'test_public_key',
        certificate: 'test_cert',
      },
    }).as('generateKey');

    cy.contains('button', 'Generate New Keypair').click();
    cy.wait('@generateKey');

    cy.contains('Private Key:').should('be.visible');
    cy.get('code').contains('this_is_a_test_private_key_that_is').should('be.visible');
  });
});
