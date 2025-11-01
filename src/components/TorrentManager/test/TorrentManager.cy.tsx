import React from 'react';
import TorrentManager from '../index';

describe('TorrentManager Component - Isolated Unit Tests', () => {
  it('renders the component with header and icon', () => {
    cy.mount(<TorrentManager />);
    
    cy.get('[data-testid="download-icon"]').should('exist');
    cy.contains('h2', 'Torrent Manager').should('be.visible');
  });

  it('displays magnet link input field', () => {
    cy.mount(<TorrentManager />);
    
    cy.contains('label', 'Magnet Link').should('be.visible');
    cy.get('input[placeholder*="magnet:"]').should('be.visible');
  });

  it('displays output path input field', () => {
    cy.mount(<TorrentManager />);
    
    cy.contains('label', 'Output Path').should('be.visible');
  });

  it('displays add torrent button', () => {
    cy.mount(<TorrentManager />);
    
    cy.contains('button', 'Add Torrent').should('be.visible');
  });

  it('renders with proper dark theme styling', () => {
    cy.mount(<TorrentManager />);
    
    cy.get('.bg-slate-800').should('exist');
    cy.get('.text-cyan-400').should('exist');
  });

  it('button is not disabled on initial render', () => {
    cy.mount(<TorrentManager />);
    
    cy.contains('button', 'Add Torrent').should('not.be.disabled');
  });

  it('output path has default value', () => {
    cy.mount(<TorrentManager />);
    
    cy.get('input').last().should('have.value', '/downloads');
  });

  it('does not display downloads section initially', () => {
    cy.mount(<TorrentManager />);
    
    cy.contains('Active Downloads').should('not.exist');
  });

  it('magnet link input is empty initially', () => {
    cy.mount(<TorrentManager />);
    
    cy.get('input[placeholder*="magnet:"]').should('have.value', '');
  });

  it('renders component without errors', () => {
    cy.mount(<TorrentManager />);
    
    // Check that main container renders
    cy.get('div').should('have.length.greaterThan', 0);
  });
});
