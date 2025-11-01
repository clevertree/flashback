import React from 'react';
import NetworkConnection from '../index';

describe('NetworkConnection Component - Isolated Unit Tests', () => {
  it('renders the component with header and icon', () => {
    cy.mount(<NetworkConnection />);
    
    cy.get('[data-testid="network-icon"]').should('exist');
    cy.contains('h2', 'Network Connection').should('be.visible');
  });

  it('displays gateway URL input field', () => {
    cy.mount(<NetworkConnection />);
    
    cy.contains('label', 'Gateway URL').should('be.visible');
  });

  it('displays CA URL input field', () => {
    cy.mount(<NetworkConnection />);
    
    cy.contains('label', 'CA URL').should('be.visible');
  });

  it('displays connect button', () => {
    cy.mount(<NetworkConnection />);
    
    cy.contains('button', 'Connect to Network').should('be.visible');
  });

  it('displays status section', () => {
    cy.mount(<NetworkConnection />);
    
    cy.contains('Status').should('be.visible');
  });

  it('renders with proper dark theme styling', () => {
    cy.mount(<NetworkConnection />);
    
    cy.get('.bg-slate-800').should('exist');
    cy.get('.text-cyan-400').should('exist');
  });

  it('button is not disabled on initial render', () => {
    cy.mount(<NetworkConnection />);
    
    cy.contains('button', 'Connect to Network').should('not.be.disabled');
  });

  it('displays disconnected status initially', () => {
    cy.mount(<NetworkConnection />);
    
    cy.contains('🔴 Disconnected').should('be.visible');
  });

  it('input fields have correct placeholder values', () => {
    cy.mount(<NetworkConnection />);
    
    cy.get('input').first().should('have.value', 'https://api.kaleido.io');
    cy.get('input').last().should('have.value', 'https://ca.kaleido.io');
  });

  it('renders component without errors', () => {
    cy.mount(<NetworkConnection />);
    
    // Check that main container renders
    cy.get('div').should('have.length.greaterThan', 0);
  });
});
