import React from 'react';
import { Provider } from 'zustand';
import NetworkConnection from '../index';
import { useAppStore } from '@/lib/store';

// Mock the store
const MockedNetworkConnection = () => {
  return <NetworkConnection />;
};

describe('NetworkConnection Component', () => {
  beforeEach(() => {
    cy.mount(<MockedNetworkConnection />);
  });

  it('renders the Network Connection header', () => {
    cy.get('[data-testid="network-icon"]').should('exist');
    cy.contains('h2', 'Network Connection').should('be.visible');
  });

  it('displays gateway URL input field', () => {
    cy.contains('label', 'Gateway URL').should('be.visible');
    cy.get('input').first().should('have.value', 'https://api.kaleido.io');
  });

  it('displays CA URL input field', () => {
    cy.contains('label', 'CA URL').should('be.visible');
    cy.get('input').last().should('have.value', 'https://ca.kaleido.io');
  });

  it('displays connect to network button', () => {
    cy.contains('button', 'Connect to Network').should('be.visible');
  });

  it('allows updating gateway URL', () => {
    cy.get('input').first().clear().type('https://new-gateway.example.com');
    cy.get('input').first().should('have.value', 'https://new-gateway.example.com');
  });

  it('allows updating CA URL', () => {
    cy.get('input').last().clear().type('https://new-ca.example.com');
    cy.get('input').last().should('have.value', 'https://new-ca.example.com');
  });

  it('shows loading state when connecting', () => {
    cy.intercept('**/api/connect_network', { delay: 1000 }).as('connect');
    cy.contains('button', 'Connect to Network').click();
    cy.contains('button', 'Connecting...').should('be.visible');
  });

  it('displays error on failed connection', () => {
    cy.intercept('**/api/connect_network', {
      statusCode: 500,
      body: { error: 'Connection failed' },
    }).as('connectError');

    cy.contains('button', 'Connect to Network').click();
    cy.contains('Failed to connect').should('be.visible');
  });

  it('displays initial disconnected status', () => {
    cy.contains('Status').should('be.visible');
    cy.contains('🔴 Disconnected').should('be.visible');
  });

  it('shows connected status after successful connection', () => {
    cy.intercept('**/api/connect_network', {
      statusCode: 200,
      body: { success: true },
    }).as('connect');

    cy.contains('button', 'Connect to Network').click();
    cy.wait('@connect');
    
    // The button should show connected state
    cy.contains('✓ Connected').should('be.visible');
  });

  it('disables connect button when already connected', () => {
    cy.intercept('**/api/connect_network', {
      statusCode: 200,
      body: { success: true },
    }).as('connect');

    cy.contains('button', 'Connect to Network').click();
    cy.wait('@connect');
    
    // After connection, button should be disabled
    cy.contains('button', '✓ Connected').should('be.disabled');
  });
});
