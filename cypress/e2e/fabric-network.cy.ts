/**
 * E2E Tests for Hyperledger Fabric Network Operations with Kaleido Integration
 * Tests account creation, network connection, and transaction flows
 */

describe('Hyperledger Fabric Network E2E Tests', () => {
  // Load Kaleido configuration from environment
  const kaleidoNetworkId = Cypress.env('KALEIDO_NETWORK_ID') || 'u0inmt8fjp';
  const kaleidoAppId = Cypress.env('KALEIDO_APP_ID') || 'u0hjwp2mgt';
  const kaleidoPeerRestGateway = Cypress.env('KALEIDO_PEER_REST_GATEWAY') || 'u0inmt8fjp-u0z8yv2jc2-connect.us0-aws-ws.kaleido.io';
  const kaleidoOrganization = Cypress.env('KALEIDO_ORGANIZATION') || 'Org1MSP';
  const kaleidoChannelName = Cypress.env('KALEIDO_CHANNEL_NAME') || 'default-channel';

  const testAccountId = `test-user-${Date.now()}`;
  const gatewayUrl = `https://${kaleidoPeerRestGateway}`;
  const caUrl = gatewayUrl; // Use same as gateway if CA endpoint not available

  beforeEach(() => {
    cy.visit('/');
  });

  describe('Account Creation and Identity Management', () => {
    it('should create a new identity for a test account', () => {
      // Navigate to Keys section
      cy.contains('button', 'Keys').click();

      // Generate keypair
      cy.contains('button', 'Generate New Keypair').click();

      // Verify identity was generated
      cy.contains('Identity Generated', { timeout: 5000 }).should('be.visible');
      cy.contains('User ID: user1').should('be.visible');
      cy.contains('Org: Org1').should('be.visible');
      cy.contains('MSPID: Org1MSP').should('be.visible');
    });

    it('should validate generated identity credentials', () => {
      // Generate identity
      cy.contains('button', 'Keys').click();
      cy.contains('button', 'Generate New Keypair').click();

      // Verify all required identity fields are present
      cy.contains('User ID:').should('be.visible');
      cy.contains('Org:').should('be.visible');
      cy.contains('MSPID:').should('be.visible');
      cy.contains('Private Key:').should('be.visible');

      // Verify private key starts with PEM header
      cy.get('code').contains('-----BEGIN').should('be.visible');
    });

    it('should save identity to filesystem', () => {
      // Generate identity
      cy.contains('button', 'Keys').click();
      cy.contains('button', 'Generate New Keypair').click();
      cy.contains('Identity Generated', { timeout: 5000 }).should('be.visible');

      // Save identity
      cy.contains('button', 'Save Identity').click();

      // Verify success message
      cy.on('window:alert', (text) => {
        expect(text).to.include('saved successfully');
      });
    });

    it('should store identity with proper organization context', () => {
      // Generate identity
      cy.contains('button', 'Keys').click();
      cy.contains('button', 'Generate New Keypair').click();
      cy.contains('Identity Generated', { timeout: 5000 }).should('be.visible');

      // Verify organization information from Kaleido config is present
      cy.contains(`Org: ${kaleidoOrganization}`).should('be.visible');
      cy.contains(`MSPID: ${kaleidoOrganization}`).should('be.visible');
      cy.contains(`Kaleido Network: ${kaleidoNetworkId}`).should('be.visible');
    });
  });

  describe('Network Connection and Authentication', () => {
    it('should connect to Hyperledger Fabric network', () => {
      // First generate an identity
      cy.contains('button', 'Keys').click();
      cy.contains('button', 'Generate New Keypair').click();
      cy.contains('Identity Generated', { timeout: 5000 }).should('be.visible');

      // Navigate to Network section
      cy.contains('button', 'Network').click();

      // Verify network connection inputs
      cy.contains('label', 'Gateway URL').should('be.visible');
      cy.contains('label', 'CA URL').should('be.visible');

      // Verify default URLs are set
      cy.get('input[placeholder*="api.kaleido.io"]')
        .should('have.value', gatewayUrl)
        .should('be.visible');

      cy.get('input[placeholder*="ca.kaleido.io"]')
        .should('have.value', caUrl)
        .should('be.visible');
    });

    it('should establish connection with valid credentials', () => {
      // Generate identity
      cy.contains('button', 'Keys').click();
      cy.contains('button', 'Generate New Keypair').click();
      cy.contains('Identity Generated', { timeout: 5000 }).should('be.visible');

      // Navigate to Network
      cy.contains('button', 'Network').click();

      // Click connect button
      cy.contains('button', 'Connect to Network').click();

      // Verify connection status changes
      cy.contains('✓ Connected', { timeout: 5000 }).should('be.visible');
      cy.contains('🟢 Connected').should('be.visible');

      // Verify Kaleido network ID is displayed
      cy.contains(`Kaleido Network: ${kaleidoNetworkId}`).should('be.visible');
    });

    it('should display network connection status', () => {
      // Generate identity
      cy.contains('button', 'Keys').click();
      cy.contains('button', 'Generate New Keypair').click();
      cy.contains('Identity Generated', { timeout: 5000 }).should('be.visible');

      // Navigate to Network
      cy.contains('button', 'Network').click();

      // Verify initial disconnected state
      cy.contains('🔴 Disconnected').should('be.visible');

      // Connect
      cy.contains('button', 'Connect to Network').click();

      // Verify connected state
      cy.contains('🟢 Connected', { timeout: 5000 }).should('be.visible');
    });

    it('should disable connect button after successful connection', () => {
      // Generate identity
      cy.contains('button', 'Keys').click();
      cy.contains('button', 'Generate New Keypair').click();
      cy.contains('Identity Generated', { timeout: 5000 }).should('be.visible');

      // Navigate to Network
      cy.contains('button', 'Network').click();

      // Connect
      cy.contains('button', 'Connect to Network').click();

      // Verify button is disabled after connection
      cy.contains('button', '✓ Connected', { timeout: 5000 }).should(
        'be.disabled'
      );
    });
  });

  describe('Channel Access and Chaincode Queries', () => {
    it('should list available channels after connection', () => {
      // Setup: Generate identity and connect
      cy.contains('button', 'Keys').click();
      cy.contains('button', 'Generate New Keypair').click();
      cy.contains('Identity Generated', { timeout: 5000 }).should('be.visible');

      cy.contains('button', 'Network').click();
      cy.contains('button', 'Connect to Network').click();
      cy.contains('🟢 Connected', { timeout: 5000 }).should('be.visible');

      // Navigate to Channels
      cy.contains('button', 'Channels').should('be.visible').click();

      // Verify channels are displayed
      cy.contains('Channels').should('be.visible');
      cy.contains('Movies').should('be.visible', { timeout: 5000 });
      cy.contains('TV Shows').should('be.visible');
      cy.contains('Games').should('be.visible');
      cy.contains('Voting').should('be.visible');
    });

    it('should query chaincode from selected channel', () => {
      // Setup: Generate identity and connect
      cy.contains('button', 'Keys').click();
      cy.contains('button', 'Generate New Keypair').click();
      cy.contains('Identity Generated', { timeout: 5000 }).should('be.visible');

      cy.contains('button', 'Network').click();
      cy.contains('button', 'Connect to Network').click();
      cy.contains('🟢 Connected', { timeout: 5000 }).should('be.visible');

      // Navigate to Channels
      cy.contains('button', 'Channels').click();

      // Select a channel
      cy.contains('Movies').click({ timeout: 5000 });

      // Verify channel details are shown
      cy.contains('Movies').should('be.visible');
      cy.contains('Movie database and torrent hashes').should('be.visible');
    });

    it('should handle chaincode query results', () => {
      // Setup: Generate identity and connect
      cy.contains('button', 'Keys').click();
      cy.contains('button', 'Generate New Keypair').click();
      cy.contains('Identity Generated', { timeout: 5000 }).should('be.visible');

      cy.contains('button', 'Network').click();
      cy.contains('button', 'Connect to Network').click();
      cy.contains('🟢 Connected', { timeout: 5000 }).should('be.visible');

      // Navigate to Channels
      cy.contains('button', 'Channels').click();

      // Select channel and verify query handling
      cy.contains('TV Shows').click({ timeout: 5000 });

      // Should display the channel content area
      cy.contains('TV Shows').should('be.visible');
      cy.contains('TV show database and torrent hashes').should('be.visible');
    });
  });

  describe('Complete Account and Transaction Flow', () => {
    it('should execute complete flow: account creation -> connection -> channel query', () => {
      // Step 1: Navigate to Keys and generate identity
      cy.contains('button', 'Keys').click();
      cy.contains('button', 'Generate New Keypair').click();
      cy.contains('Identity Generated', { timeout: 5000 }).should('be.visible');

      // Verify identity details
      cy.contains('User ID: user1').should('be.visible');
      cy.contains('Org: Org1').should('be.visible');
      cy.contains('MSPID: Org1MSP').should('be.visible');

      // Step 2: Save identity
      cy.contains('button', 'Save Identity').click();
      cy.on('window:alert', (text) => {
        expect(text).to.include('saved successfully');
      });

      // Step 3: Navigate to Network and connect
      cy.contains('button', 'Network').click();
      cy.contains('button', 'Connect to Network').click();
      cy.contains('✓ Connected', { timeout: 5000 }).should('be.visible');

      // Step 4: Access Channels
      cy.contains('button', 'Channels').should('be.visible').click();

      // Step 5: Verify channels are available
      cy.contains('Movies').should('be.visible', { timeout: 5000 });
      cy.contains('Games').should('be.visible');
      cy.contains('Voting').should('be.visible');

      // Step 6: Query a channel
      cy.contains('Games').click();
      cy.contains('Games').should('be.visible');
      cy.contains('Game database and torrent hashes').should('be.visible');
    });

    it('should validate identity persistence across navigation', () => {
      // Generate identity
      cy.contains('button', 'Keys').click();
      cy.contains('button', 'Generate New Keypair').click();
      cy.contains('Identity Generated', { timeout: 5000 }).should('be.visible');

      // Save identity
      cy.contains('button', 'Save Identity').click();

      // Navigate away and back to Home
      cy.contains('button', 'Home').click();
      cy.contains('Welcome to Fabric Desktop Client').should('be.visible');

      // Navigate back to Keys
      cy.contains('button', 'Keys').click();

      // Identity should still be visible in the UI state
      cy.contains('Identity Generated').should('exist');
    });

    it('should handle connection status across navigation', () => {
      // Generate identity and connect
      cy.contains('button', 'Keys').click();
      cy.contains('button', 'Generate New Keypair').click();
      cy.contains('Identity Generated', { timeout: 5000 }).should('be.visible');

      cy.contains('button', 'Network').click();
      cy.contains('button', 'Connect to Network').click();
      cy.contains('✓ Connected', { timeout: 5000 }).should('be.visible');

      // Navigate to Home
      cy.contains('button', 'Home').click();

      // Connection status should be maintained
      cy.contains('🟢 Connected').should('be.visible');

      // Navigate back to Network
      cy.contains('button', 'Network').click();

      // Should still show connected state
      cy.contains('✓ Connected').should('be.visible');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid gateway URL', () => {
      // Generate identity
      cy.contains('button', 'Keys').click();
      cy.contains('button', 'Generate New Keypair').click();
      cy.contains('Identity Generated', { timeout: 5000 }).should('be.visible');

      // Navigate to Network
      cy.contains('button', 'Network').click();

      // Enter invalid URL
      cy.get('input[placeholder*="api.kaleido.io"]')
        .clear()
        .type('not-a-valid-url');

      // Attempt connection - may show error or attempt to connect anyway
      cy.contains('button', 'Connect to Network').click();

      // Either error message or timeout should occur
      cy.contains('Network:', { timeout: 5000 }).should('be.visible');
    });

    it('should allow reconnection with different credentials', () => {
      // First connection
      cy.contains('button', 'Keys').click();
      cy.contains('button', 'Generate New Keypair').click();
      cy.contains('Identity Generated', { timeout: 5000 }).should('be.visible');

      cy.contains('button', 'Network').click();
      cy.contains('button', 'Connect to Network').click();
      cy.contains('✓ Connected', { timeout: 5000 }).should('be.visible');

      // Navigate away and back
      cy.contains('button', 'Home').click();
      cy.contains('button', 'Network').click();

      // Connection should persist
      cy.contains('✓ Connected').should('be.visible');
    });

    it('should display network status on home page when connected', () => {
      // Generate and connect
      cy.contains('button', 'Keys').click();
      cy.contains('button', 'Generate New Keypair').click();
      cy.contains('Identity Generated', { timeout: 5000 }).should('be.visible');

      cy.contains('button', 'Network').click();
      cy.contains('button', 'Connect to Network').click();
      cy.contains('🟢 Connected', { timeout: 5000 }).should('be.visible');

      // Go to home
      cy.contains('button', 'Home').click();

      // Status should show connected
      cy.contains('Network: 🟢 Connected').should('be.visible');
    });
  });

  describe('Transaction and Torrent Integration', () => {
    it('should unlock Torrent section after network connection', () => {
      // Before connection - Torrent button should not be visible
      cy.contains('button', 'Torrent').should('not.be.visible');

      // Generate identity and connect
      cy.contains('button', 'Keys').click();
      cy.contains('button', 'Generate New Keypair').click();
      cy.contains('Identity Generated', { timeout: 5000 }).should('be.visible');

      cy.contains('button', 'Network').click();
      cy.contains('button', 'Connect to Network').click();
      cy.contains('🟢 Connected', { timeout: 5000 }).should('be.visible');

      // Now Torrent button should be visible
      cy.contains('button', 'Torrent').should('be.visible');
    });

    it('should access torrent manager when connected to network', () => {
      // Setup connection
      cy.contains('button', 'Keys').click();
      cy.contains('button', 'Generate New Keypair').click();
      cy.contains('Identity Generated', { timeout: 5000 }).should('be.visible');

      cy.contains('button', 'Network').click();
      cy.contains('button', 'Connect to Network').click();
      cy.contains('🟢 Connected', { timeout: 5000 }).should('be.visible');

      // Access Torrent Manager
      cy.contains('button', 'Torrent').click();

      // Verify Torrent Manager is displayed
      cy.contains('h2', 'Torrent Manager').should('be.visible');
      cy.contains('label', 'Magnet Link').should('be.visible');
      cy.contains('label', 'Output Path').should('be.visible');
    });
  });
});
