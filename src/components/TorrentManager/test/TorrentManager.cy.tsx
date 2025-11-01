import React from 'react';
import TorrentManager from '../index';

describe('TorrentManager Component', () => {
  beforeEach(() => {
    cy.mount(<TorrentManager />);
  });

  it('renders the Torrent Manager header', () => {
    cy.get('[data-testid="download-icon"]').should('exist');
    cy.contains('h2', 'Torrent Manager').should('be.visible');
  });

  it('displays magnet link input field', () => {
    cy.contains('label', 'Magnet Link').should('be.visible');
    cy.get('input[placeholder*="magnet:"]').should('be.visible');
  });

  it('displays output path input field', () => {
    cy.contains('label', 'Output Path').should('be.visible');
    cy.get('input').last().should('have.value', '/downloads');
  });

  it('displays add torrent button', () => {
    cy.contains('button', 'Add Torrent').should('be.visible');
  });

  it('allows entering magnet link', () => {
    const magnetLink = 'magnet:?xt=urn:btih:test123';
    cy.get('input[placeholder*="magnet:"]').type(magnetLink);
    cy.get('input[placeholder*="magnet:"]').should('have.value', magnetLink);
  });

  it('allows changing output path', () => {
    cy.get('input').last().clear().type('/custom/path');
    cy.get('input').last().should('have.value', '/custom/path');
  });

  it('shows error when adding torrent without magnet link', () => {
    cy.contains('button', 'Add Torrent').click();
    cy.contains('Please enter a magnet link').should('be.visible');
  });

  it('shows loading state when adding torrent', () => {
    cy.intercept('**/api/add_torrent', { delay: 1000 }).as('addTorrent');
    
    const magnetLink = 'magnet:?xt=urn:btih:test123';
    cy.get('input[placeholder*="magnet:"]').type(magnetLink);
    cy.contains('button', 'Add Torrent').click();
    
    cy.contains('button', 'Adding...').should('be.visible');
  });

  it('displays error on failed torrent addition', () => {
    cy.intercept('**/api/add_torrent', {
      statusCode: 500,
      body: { error: 'Failed to add' },
    }).as('addTorrentError');

    const magnetLink = 'magnet:?xt=urn:btih:test123';
    cy.get('input[placeholder*="magnet:"]').type(magnetLink);
    cy.contains('button', 'Add Torrent').click();
    
    cy.contains('Failed to add torrent').should('be.visible');
  });

  it('adds torrent successfully', () => {
    cy.intercept('**/api/add_torrent', {
      statusCode: 200,
      body: { hash: 'test_hash_123', success: true },
    }).as('addTorrent');

    const magnetLink = 'magnet:?xt=urn:btih:test123';
    cy.get('input[placeholder*="magnet:"]').type(magnetLink);
    cy.contains('button', 'Add Torrent').click();
    cy.wait('@addTorrent');
    
    // Clear the magnet link after successful add
    cy.get('input[placeholder*="magnet:"]').should('have.value', '');
  });

  it('displays active downloads section after adding torrent', () => {
    cy.intercept('**/api/add_torrent', {
      statusCode: 200,
      body: { hash: 'test_hash_123', success: true },
    }).as('addTorrent');

    const magnetLink = 'magnet:?xt=urn:btih:test123';
    cy.get('input[placeholder*="magnet:"]').type(magnetLink);
    cy.contains('button', 'Add Torrent').click();
    cy.wait('@addTorrent');
    
    cy.contains('Active Downloads').should('be.visible');
    cy.contains('Active Downloads (1)').should('be.visible');
  });

  it('displays download progress information', () => {
    cy.intercept('**/api/add_torrent', {
      statusCode: 200,
      body: { hash: 'test_hash_123', success: true },
    }).as('addTorrent');

    const magnetLink = 'magnet:?xt=urn:btih:test123';
    cy.get('input[placeholder*="magnet:"]').type(magnetLink);
    cy.contains('button', 'Add Torrent').click();
    cy.wait('@addTorrent');
    
    cy.contains('test_hash_12').should('be.visible');
    cy.contains('0.0%').should('be.visible');
    cy.contains('Peers:').should('be.visible');
    cy.contains('Speed:').should('be.visible');
  });

  it('hides downloads section when no downloads', () => {
    cy.contains('Active Downloads').should('not.exist');
  });

  it('updates download progress', () => {
    cy.intercept('**/api/add_torrent', {
      statusCode: 200,
      body: { hash: 'test_hash_123', success: true },
    }).as('addTorrent');

    cy.intercept('**/api/get_torrent_progress', {
      statusCode: 200,
      body: {
        hash: 'test_hash_123',
        progress: 0.5,
        status: 'Downloading',
        peers: 10,
        download_speed: 1024,
      },
    }).as('getProgress');

    const magnetLink = 'magnet:?xt=urn:btih:test123';
    cy.get('input[placeholder*="magnet:"]').type(magnetLink);
    cy.contains('button', 'Add Torrent').click();
    cy.wait('@addTorrent');
    
    // Wait for progress update interval
    cy.wait('@getProgress', { timeout: 2000 });
    cy.contains('50.0%').should('be.visible');
  });

  it('displays multiple downloads', () => {
    cy.intercept('**/api/add_torrent', {
      statusCode: 200,
      body: { hash: 'hash1', success: true },
    }).as('addTorrent1');

    const magnetLink1 = 'magnet:?xt=urn:btih:test123';
    cy.get('input[placeholder*="magnet:"]').type(magnetLink1);
    cy.contains('button', 'Add Torrent').click();
    cy.wait('@addTorrent1');

    // Intercept second torrent add with different hash
    cy.intercept('**/api/add_torrent', {
      statusCode: 200,
      body: { hash: 'hash2', success: true },
    }).as('addTorrent2');

    const magnetLink2 = 'magnet:?xt=urn:btih:test456';
    cy.get('input[placeholder*="magnet:"]').type(magnetLink2);
    cy.contains('button', 'Add Torrent').click();
    cy.wait('@addTorrent2');

    cy.contains('Active Downloads (2)').should('be.visible');
  });
});
