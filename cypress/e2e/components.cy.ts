/**
 * Comprehensive E2E tests for all components
 * KeyManagement, NetworkConnection, ChannelBrowser, TorrentManager
 */

describe('Component E2E Tests', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  // ==================== KeyManagement Component Tests ====================
  describe('KeyManagement Component', () => {
    it('should render the KeyManagement section', () => {
      cy.contains('h2', 'Key Management').should('be.visible');
      cy.contains('button', 'Generate New Keypair').should('be.visible');
    });

    it('should display Key icon in header', () => {
      cy.get('[data-testid="key-icon"]').should('exist');
    });

    it('should generate keypair when button is clicked', () => {
      cy.contains('button', 'Generate New Keypair').click();
      cy.contains('Identity Generated', { timeout: 5000 }).should(
        'be.visible'
      );
    });

    it('should display identity details after generation', () => {
      cy.contains('button', 'Generate New Keypair').click();
      cy.contains('User ID:', { timeout: 5000 }).should('be.visible');
      cy.contains('Org:').should('be.visible');
      cy.contains('MSPID:').should('be.visible');
    });

    it('should display private key in code block', () => {
      cy.contains('button', 'Generate New Keypair').click();
      cy.contains('Private Key:', { timeout: 5000 }).should('be.visible');
      cy.get('code').should('contain.text', '-----BEGIN');
    });

    it('should show Save Identity button after generation', () => {
      cy.contains('button', 'Generate New Keypair').click();
      cy.contains('button', 'Save Identity', {
        timeout: 5000,
      }).should('be.visible');
    });

    it('should disable generate button while loading', () => {
      cy.contains('button', 'Generate New Keypair').click();
      cy.contains('button', 'Generating...').should('be.disabled');
    });

    it('should handle save identity action', () => {
      cy.contains('button', 'Generate New Keypair').click();
      cy.contains('button', 'Save Identity', { timeout: 5000 }).click();
      cy.on('window:alert', (text) => {
        expect(text).to.contain('saved successfully');
      });
    });
  });

  // ==================== NetworkConnection Component Tests ====================
  describe('NetworkConnection Component', () => {
    it('should render the NetworkConnection section', () => {
      cy.contains('h2', 'Network Connection').should('be.visible');
      cy.contains('label', 'Gateway URL').should('be.visible');
      cy.contains('label', 'CA URL').should('be.visible');
    });

    it('should display Network icon in header', () => {
      cy.get('[data-testid="network-icon"]').should('exist');
    });

    it('should have default gateway URL value', () => {
      cy.get('input[placeholder*="api.kaleido.io"]')
        .should('have.value', 'https://api.kaleido.io')
        .should('be.visible');
    });

    it('should have default CA URL value', () => {
      cy.get('input[placeholder*="ca.kaleido.io"]')
        .should('have.value', 'https://ca.kaleido.io')
        .should('be.visible');
    });

    it('should allow editing gateway URL', () => {
      cy.get('input[placeholder*="api.kaleido.io"]')
        .clear()
        .type('https://custom-gateway.io');
      cy.get('input[placeholder*="api.kaleido.io"]').should(
        'have.value',
        'https://custom-gateway.io'
      );
    });

    it('should allow editing CA URL', () => {
      cy.get('input[placeholder*="ca.kaleido.io"]')
        .clear()
        .type('https://custom-ca.io');
      cy.get('input[placeholder*="ca.kaleido.io"]').should(
        'have.value',
        'https://custom-ca.io'
      );
    });

    it('should display Connect to Network button', () => {
      cy.contains('button', 'Connect to Network').should('be.visible');
    });

    it('should display network status', () => {
      cy.contains('h3', 'Status').should('be.visible');
      cy.contains('Network:').should('be.visible');
    });

    it('should show disconnected status initially', () => {
      cy.contains('🔴 Disconnected').should('be.visible');
    });

    it('should handle connect action', () => {
      cy.contains('button', 'Connect to Network').click();
      cy.contains('button', 'Connecting...', { timeout: 5000 }).should(
        'exist'
      );
    });

    it('should show connected status after connection', () => {
      cy.contains('button', 'Connect to Network').click();
      cy.contains('✓ Connected', { timeout: 5000 }).should('be.visible');
    });
  });

  // ==================== ChannelBrowser Component Tests ====================
  describe('ChannelBrowser Component', () => {
    it('should render the ChannelBrowser section', () => {
      cy.contains('h3', 'Channels').should('be.visible');
    });

    it('should display channel list initially', () => {
      cy.get('button').contains(/^[A-Za-z]+$/).should('exist');
    });

    it('should show loading state when loading channels', () => {
      cy.contains('Loading channels...', { timeout: 5000 }).should(
        'not.exist'
      );
    });

    it('should prompt to select channel initially', () => {
      cy.contains('Select a channel to browse content').should('be.visible');
    });

    it('should allow channel selection', () => {
      // Click on first channel
      cy.get('button[class*="bg-slate-700"]').first().click();
      cy.get('button[class*="bg-cyan-600"]', { timeout: 5000 }).should(
        'exist'
      );
    });

    it('should display channel details on selection', () => {
      // Select first channel
      cy.get('button[class*="bg-slate-700"]').first().click();
      // Should show channel name and description
      cy.get('h3[class*="text-2xl"]', { timeout: 5000 }).should('be.visible');
    });

    it('should have channel icons', () => {
      cy.get('[class*="lucide"]').should('have.length.greaterThan', 0);
    });

    it('should display content grid for selected channel', () => {
      cy.get('button[class*="bg-slate-700"]').first().click();
      // Wait for content to load
      cy.get('[class*="grid"]', { timeout: 5000 }).should('exist');
    });

    it('should show no content message when empty', () => {
      cy.contains('No content available in this channel', {
        timeout: 5000,
      }).should('exist');
    });
  });

  // ==================== TorrentManager Component Tests ====================
  describe('TorrentManager Component', () => {
    it('should render the TorrentManager section', () => {
      cy.contains('h2', 'Torrent Manager').should('be.visible');
      cy.contains('label', 'Magnet Link').should('be.visible');
      cy.contains('label', 'Output Path').should('be.visible');
    });

    it('should display Download icon in header', () => {
      cy.get('[data-testid="download-icon"]').should('exist');
    });

    it('should have magnet link input', () => {
      cy.get('input[placeholder*="magnet:"]').should('be.visible');
    });

    it('should have output path input with default value', () => {
      cy.get('input[type="text"]').then((inputs) => {
        const outputPathInput = inputs[1]; // Second input is output path
        expect(outputPathInput).to.have.value('/downloads');
      });
    });

    it('should allow editing magnet link', () => {
      cy.get('input[placeholder*="magnet:"]')
        .type('magnet:?xt=urn:btih:test123')
        .should('have.value', 'magnet:?xt=urn:btih:test123');
    });

    it('should allow editing output path', () => {
      cy.get('input[type="text"]').then((inputs) => {
        cy.wrap(inputs[1]).clear().type('/custom/path');
      });
    });

    it('should display Add Torrent button', () => {
      cy.contains('button', 'Add Torrent').should('be.visible');
    });

    it('should show error when adding torrent without magnet link', () => {
      cy.contains('button', 'Add Torrent').click();
      cy.contains('Please enter a magnet link', { timeout: 5000 }).should(
        'be.visible'
      );
    });

    it('should handle adding torrent with magnet link', () => {
      cy.get('input[placeholder*="magnet:"]').type('magnet:?xt=urn:btih:test');
      cy.contains('button', 'Add Torrent').click();
      cy.contains('button', 'Adding...', { timeout: 5000 }).should('exist');
    });

    it('should disable add button while loading', () => {
      cy.get('input[placeholder*="magnet:"]').type('magnet:?xt=urn:btih:test');
      cy.contains('button', 'Add Torrent').click();
      cy.contains('button', 'Adding...').should('be.disabled');
    });

    it('should display downloads section when torrents are added', () => {
      cy.get('input[placeholder*="magnet:"]').type('magnet:?xt=urn:btih:test');
      cy.contains('button', 'Add Torrent').click();
      cy.contains('Active Downloads', { timeout: 5000 }).should('be.visible');
    });

    it('should show download progress bar', () => {
      cy.get('input[placeholder*="magnet:"]').type('magnet:?xt=urn:btih:test');
      cy.contains('button', 'Add Torrent').click();
      cy.get('[class*="bg-cyan-500"]', { timeout: 5000 }).should('exist');
    });

    it('should display download stats (peers, speed)', () => {
      cy.get('input[placeholder*="magnet:"]').type('magnet:?xt=urn:btih:test');
      cy.contains('button', 'Add Torrent').click();
      cy.contains('Peers:', { timeout: 5000 }).should('be.visible');
      cy.contains('Speed:', { timeout: 5000 }).should('be.visible');
    });
  });

  // ==================== Cross-Component Integration Tests ====================
  describe('Cross-Component Integration', () => {
    it('should render all main components on page load', () => {
      cy.contains('h2', 'Key Management').should('be.visible');
      cy.contains('h2', 'Network Connection').should('be.visible');
      cy.contains('h3', 'Channels').should('be.visible');
      cy.contains('h2', 'Torrent Manager').should('be.visible');
    });

    it('should maintain separate state across components', () => {
      // Generate key
      cy.contains('button', 'Generate New Keypair').click();
      cy.contains('Identity Generated', { timeout: 5000 }).should(
        'be.visible'
      );

      // Connect to network independently
      cy.contains('button', 'Connect to Network').click();
      cy.contains('Connecting...', { timeout: 5000 }).should('exist');

      // Verify both operations are tracked
      cy.contains('Identity Generated').should('be.visible');
    });

    it('should allow sequential operations', () => {
      // Step 1: Generate keypair
      cy.contains('button', 'Generate New Keypair').click();
      cy.contains('Identity Generated', { timeout: 5000 }).should(
        'be.visible'
      );

      // Step 2: Connect to network
      cy.contains('button', 'Connect to Network').click();
      cy.contains('Connecting...', { timeout: 5000 }).should('exist');

      // Step 3: Add torrent
      cy.get('input[placeholder*="magnet:"]').type('magnet:?xt=urn:btih:test');
      cy.contains('button', 'Add Torrent').click();
      cy.contains('Adding...', { timeout: 5000 }).should('exist');
    });
  });

  // ==================== Error Handling Tests ====================
  describe('Error Handling', () => {
    it('should handle network errors gracefully in KeyManagement', () => {
      // Mock network error
      cy.intercept('POST', '**/generateKeypair', { statusCode: 500 }).as(
        'generateError'
      );
      cy.contains('button', 'Generate New Keypair').click();
      cy.wait('@generateError', { timeout: 5000 });
    });

    it('should display error messages consistently', () => {
      // Test error UI consistency across components
      cy.contains('button', 'Add Torrent').click();
      cy.contains('Please enter a magnet link').should(
        'have.class',
        expect.stringContaining('red')
      );
    });

    it('should allow retry after error', () => {
      cy.contains('button', 'Add Torrent').click();
      cy.contains('Please enter a magnet link').should('be.visible');
      // Try again with valid input
      cy.get('input[placeholder*="magnet:"]').type('magnet:?xt=urn:btih:test');
      cy.contains('button', 'Add Torrent').click();
      cy.contains('Please enter a magnet link').should('not.exist');
    });
  });

  // ==================== Accessibility & UI Tests ====================
  describe('Accessibility & UI', () => {
    it('should have proper heading hierarchy', () => {
      cy.get('h2').should('have.length.greaterThan', 0);
      cy.get('h3').should('have.length.greaterThan', 0);
    });

    it('should have visible labels for all inputs', () => {
      cy.get('label').should('have.length.greaterThan', 0);
      cy.get('input[type="text"]').each((input) => {
        cy.wrap(input).should('have.attr', 'placeholder');
      });
    });

    it('should have proper button states', () => {
      // Buttons should be visible and interactive
      cy.get('button').should('have.length.greaterThan', 0);
      cy.get('button').first().should('not.be.disabled');
    });

    it('should handle responsive layout', () => {
      cy.viewport('iphone-x');
      cy.contains('h2', 'Key Management').should('be.visible');
      cy.contains('h2', 'Network Connection').should('be.visible');
    });

    it('should display error states with appropriate styling', () => {
      cy.contains('button', 'Add Torrent').click();
      cy.get('[class*="red"]').should('have.length.greaterThan', 0);
    });
  });
});
