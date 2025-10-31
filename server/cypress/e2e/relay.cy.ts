/// <reference types="cypress" />

// E2E/API tests for Relay Tracker endpoints under /api/relay/*
// These simulate mutual TLS by forwarding the client certificate PEM
// in the x-ssl-cert header (as would be done by a proxy in production).

describe('Relay Tracker API E2E', () => {
  let keys: { certPem: string; certPem2: string };

  const base = () => Cypress.config('baseUrl') as string;

  before(() => {
    // Ensure server is up
    cy.request({ method: 'GET', url: `${base()}/api/health`, failOnStatusCode: true });
    // Load generated cert fixtures
    cy.fixture('keys.json').then((fx) => {
      keys = fx as any;
    });
  });

  beforeEach(() => {
    // Reset DB between tests to isolate state
    cy.request({ method: 'POST', url: `${base()}/api/test/reset-db`, failOnStatusCode: false })
      .its('status').should('be.oneOf', [200, 403]); // allow locally if not in TEST_MODE
  });

  it('POST /api/relay/register registers once and 409 on duplicate', () => {
    // First register should succeed (200)
    cy.request({
      method: 'POST',
      url: `${base()}/api/relay/register`,
      failOnStatusCode: false,
      body: { certificate: keys.certPem },
    }).then((resp) => {
      expect(resp.status).to.eq(200);
      expect(resp.body).to.have.property('email');
    });

    // Duplicate should be 409
    cy.request({
      method: 'POST',
      url: `${base()}/api/relay/register`,
      failOnStatusCode: false,
      body: { certificate: keys.certPem },
    }).then((resp) => {
      expect(resp.status).to.eq(409);
    });

    // Invalid cert should be 400
    cy.request({
      method: 'POST',
      url: `${base()}/api/relay/register`,
      failOnStatusCode: false,
      body: { certificate: '-----BEGIN CERTIFICATE-----\ninvalid\n-----END CERTIFICATE-----' },
    }).then((resp) => {
      expect(resp.status).to.eq(400);
    });
  });

  it('POST /api/relay/broadcast/ready enforces mutual TLS and validates payload', () => {
    // Unauthorized without header
    cy.request({
      method: 'POST',
      url: `${base()}/api/relay/broadcast/ready`,
      failOnStatusCode: false,
      body: { port: 12345, addresses: ['127.0.0.1'] },
    }).its('status').should('eq', 401);

    // Unauthorized with non-registered cert
    cy.request({
      method: 'POST',
      url: `${base()}/api/relay/broadcast/ready`,
      headers: { 'x-ssl-cert': keys.certPem },
      failOnStatusCode: false,
      body: { port: 12345, addresses: ['127.0.0.1'] },
    }).its('status').should('eq', 401);

    // Register user, then invalid payloads
    cy.request('POST', `${base()}/api/relay/register`, { certificate: keys.certPem }).its('status').should('eq', 200);

    // Bad port
    cy.request({
      method: 'POST',
      url: `${base()}/api/relay/broadcast/ready`,
      headers: { 'x-ssl-cert': keys.certPem },
      failOnStatusCode: false,
      body: { port: 0, addresses: ['127.0.0.1'] },
    }).its('status').should('eq', 400);

    // Bad addresses
    cy.request({
      method: 'POST',
      url: `${base()}/api/relay/broadcast/ready`,
      headers: { 'x-ssl-cert': keys.certPem },
      failOnStatusCode: false,
      body: { port: 12345, addresses: [] },
    }).its('status').should('eq', 400);

    // Success
    cy.request({
      method: 'POST',
      url: `${base()}/api/relay/broadcast/ready`,
      headers: { 'x-ssl-cert': keys.certPem },
      failOnStatusCode: false,
      body: { port: 22222, addresses: ['127.0.0.1', '::1'], capabilities: { streams: 2 } },
    }).then((resp) => {
      expect(resp.status).to.eq(200);
      expect(resp.body).to.have.property('broadcast_id');
      expect(resp.body).to.have.property('expires_in', 3600);
    });
  });

  it('GET /api/relay/broadcast/lookup validates auth and returns peer details', () => {
    // Missing header
    cy.request({ method: 'GET', url: `${base()}/api/relay/broadcast/lookup?email=x@y.com`, failOnStatusCode: false })
      .its('status').should('eq', 401);

    // Register two users and set broadcasts
    cy.request('POST', `${base()}/api/relay/register`, { certificate: keys.certPem }).its('status').should('eq', 200);
    cy.request('POST', `${base()}/api/relay/register`, { certificate: keys.certPem2 }).its('status').should('eq', 200);

    cy.request({
      method: 'POST',
      url: `${base()}/api/relay/broadcast/ready`,
      headers: { 'x-ssl-cert': keys.certPem },
      body: { port: 30001, addresses: ['10.0.0.1'] },
    }).its('status').should('eq', 200);

    cy.request({
      method: 'POST',
      url: `${base()}/api/relay/broadcast/ready`,
      headers: { 'x-ssl-cert': keys.certPem2 },
      body: { port: 30002, addresses: ['10.0.0.2'] },
    }).its('status').should('eq', 200);

    // Missing email validation
    cy.request({ method: 'GET', url: `${base()}/api/relay/broadcast/lookup`, headers: { 'x-ssl-cert': keys.certPem }, failOnStatusCode: false })
      .its('status').should('eq', 400);

    // Find peer2 from peer1
    // Extract emails from certs: the register response returns email, but we didn't save. Simplify by calling list and using the returned email.
    cy.request({ method: 'GET', url: `${base()}/api/relay/broadcast/list`, headers: { 'x-ssl-cert': keys.certPem } }).then((listResp) => {
      expect(listResp.status).to.eq(200);
      const items = listResp.body as Array<{email: string}>;
      expect(items.length).to.be.greaterThan(0);
      const peerEmail = items[0].email;

      cy.request({ method: 'GET', url: `${base()}/api/relay/broadcast/lookup?email=${encodeURIComponent(peerEmail)}`, headers: { 'x-ssl-cert': keys.certPem } })
        .then((resp) => {
          expect(resp.status).to.eq(200);
          expect(resp.body).to.have.keys(['email', 'port', 'addresses', 'last_seen']);
        });
    });
  });

  it('GET /api/relay/broadcast/list excludes caller and sorts results', () => {
    // Register three users and broadcast two of them; call list as one
    cy.request('POST', `${base()}/api/relay/register`, { certificate: keys.certPem }).its('status').should('eq', 200);
    cy.request('POST', `${base()}/api/relay/register`, { certificate: keys.certPem2 }).its('status').should('eq', 200);

    cy.request({ method: 'POST', url: `${base()}/api/relay/broadcast/ready`, headers: { 'x-ssl-cert': keys.certPem }, body: { port: 11111, addresses: ['192.168.1.10'] } }).its('status').should('eq', 200);
    cy.request({ method: 'POST', url: `${base()}/api/relay/broadcast/ready`, headers: { 'x-ssl-cert': keys.certPem2 }, body: { port: 11112, addresses: ['192.168.1.11'] } }).its('status').should('eq', 200);

    cy.request({ method: 'GET', url: `${base()}/api/relay/broadcast/list`, headers: { 'x-ssl-cert': keys.certPem } }).then((resp) => {
      expect(resp.status).to.eq(200);
      const list = resp.body as Array<{email: string; port: number; addresses: string[]}>;
      // Should not include self
      const hasSelf = list.some((i) => !!i.email && typeof i.email === 'string' && i.email.includes('@') && i.port === 11111);
      expect(hasSelf).to.eq(false);
      // Should include at least one peer
      expect(list.length).to.be.greaterThan(0);
      // Sorted ascending by email
      const emails = list.map((i) => i.email);
      const sorted = [...emails].sort((a, b) => a.localeCompare(b));
      expect(emails).to.deep.eq(sorted);
    });
  });

  it('Expired broadcasts are excluded from lookup and list', () => {
    // Register and broadcast
    cy.request('POST', `${base()}/api/relay/register`, { certificate: keys.certPem }).its('status').should('eq', 200);
    cy.request('POST', `${base()}/api/relay/register`, { certificate: keys.certPem2 }).its('status').should('eq', 200);

    cy.request({ method: 'POST', url: `${base()}/api/relay/broadcast/ready`, headers: { 'x-ssl-cert': keys.certPem2 }, body: { port: 22000, addresses: ['172.16.0.2'] } }).its('status').should('eq', 200);

    // Determine peer2 email via list
    cy.request({ method: 'GET', url: `${base()}/api/relay/broadcast/list`, headers: { 'x-ssl-cert': keys.certPem } }).then((listResp) => {
      expect(listResp.status).to.eq(200);
      const items = listResp.body as Array<{email: string}>;
      const peerEmail = items[0].email;

      // Expire peer2 broadcast
      cy.request('POST', `${base()}/api/test/expire-broadcast`, { email: peerEmail }).its('status').should('eq', 200);

      // Now lookup should be 404
      cy.request({ method: 'GET', url: `${base()}/api/relay/broadcast/lookup?email=${encodeURIComponent(peerEmail)}`, headers: { 'x-ssl-cert': keys.certPem }, failOnStatusCode: false })
        .its('status').should('eq', 404);

      // And list should exclude it
      cy.request({ method: 'GET', url: `${base()}/api/relay/broadcast/list`, headers: { 'x-ssl-cert': keys.certPem } }).then((resp) => {
        expect(resp.status).to.eq(200);
        const list = resp.body as Array<{email: string}>;
        const found = list.some((i) => i.email === peerEmail);
        expect(found).to.eq(false);
      });
    });
  });
});
