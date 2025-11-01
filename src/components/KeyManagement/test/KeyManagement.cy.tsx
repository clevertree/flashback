import React from 'react';
import KeyManagement from '../index';

describe('KeyManagement Component - Isolated Unit Tests', () => {
  it('renders the component with header and icon', () => {
    cy.mount(<KeyManagement />);
    
    cy.get('[data-testid="key-icon"]').should('exist');
    cy.contains('h2', 'Key Management').should('be.visible');
  });

  it('displays the generate keypair button', () => {
    cy.mount(<KeyManagement />);
    
    cy.contains('button', 'Generate New Keypair').should('be.visible');
  });

  it('button is not disabled on initial render', () => {
    cy.mount(<KeyManagement />);
    
    cy.contains('button', 'Generate New Keypair').should('not.be.disabled');
  });

  it('renders with proper dark theme styling', () => {
    cy.mount(<KeyManagement />);
    
    cy.get('.bg-slate-800').should('exist');
    cy.get('.text-cyan-400').should('exist');
  });

  it('displays proper spacing and layout', () => {
    cy.mount(<KeyManagement />);
    
    cy.get('.space-y-6').should('exist');
    cy.get('.rounded-lg').should('exist');
  });

  it('renders button with correct styling', () => {
    cy.mount(<KeyManagement />);
    
    cy.contains('button', 'Generate New Keypair')
      .should('have.class', 'bg-cyan-600');
  });

  it('renders component without errors', () => {
    cy.mount(<KeyManagement />);
    
    // Check that main container renders
    cy.get('div').should('have.length.greaterThan', 0);
  });
});
