/// <reference types="cypress" />
import {RegisterRequestBody} from "../../app/api/register/route";

// Ensure we wait for server connection
before(() => {
    cy.request({
        method: 'GET',
        url: `/api/health`,  // Add a health check endpoint in your route
        failOnStatusCode: true
    });
});

describe('Server API E2E', () => {
    let testKeys: {
        certPem: string;
        certPem2: string;
        privateKeyPem: string;
        privateKeyPem2: string;
    };

    before(function () {
        // Load keys from the generated fixture. Ensure the fixture generator spec runs first.
        cy.fixture('keys.json').then((fx) => {
            testKeys = fx as typeof testKeys;
        });
    });

    beforeEach(() => {
        // Optional: Reset database or clear test data before each test
        // Implement a test-only endpoint for this purpose if needed
        cy.request({
            method: 'POST',
            url: '/api/test/reset-db',
            failOnStatusCode: true
        });
    });

    // it('GET /api/repository/list returns at least one repo (seeds default)', () => {
    //     cy.request({method: 'GET', url: `${base}/api/repository/list`})
    //         .its('status')
    //         .should('be.oneOf', [200])
    //     cy.request('GET', `${base}/api/repository/list`).then((resp) => {
    //         expect(resp.status).to.eq(200)
    //         expect(resp.body).to.have.property('items')
    //         expect(resp.body.items).to.be.an('array')
    //         // Seed creates "FlashBack Movies" on first run
    //         expect(resp.body.items.length).to.be.greaterThan(0)
    //     })
    // })

    it('POST /api/register can create and idempotently validate a user', () => {
        const {certPem, certPem2} = testKeys;
        const base = Cypress.config('baseUrl');

        cy.request({
            method: 'POST',
            url: `${base}/api/register`,
            failOnStatusCode: false,
            body: {
                certificate: certPem,
            } as RegisterRequestBody,
        }).then((resp) => {
            expect([201, 409]).to.include(resp.status)
            // expect(resp.body).to.have.property('id')
        })

        // Second call should be 200 OK if values match
        cy.request({
            method: 'POST',
            url: `${base}/api/register`,
            failOnStatusCode: false,
            body: {
                certificate: certPem,
            } as RegisterRequestBody,
        }).then((resp) => {
            expect(resp.status).to.eq(409)
            // expect(resp.body).to.have.property('id')
        })

        // Mismatch should return 409
        cy.request({
            method: 'POST',
            url: `${base}/api/register`,
            failOnStatusCode: false,
            body: {
                certificate: certPem2,
            } as RegisterRequestBody,
        }).then((resp) => {
            expect(resp.status).to.eq(409)
        })
    })
    //
    // it('POST /api/broadcast/ready then GET /api/broadcast/lookup finds recent source', () => {
    //     const {publicKeyHash} = testKeys;
    //     const socket_address = `127.0.0.1:${Math.floor(Math.random() * 50000) + 10000}`
    //
    //     // Ensure user exists
    //     cy.request({
    //         method: 'POST',
    //         url: `${base}/api/register`,
    //         failOnStatusCode: false,
    //         body: testKeys,
    //     })
    //
    //     cy.request({
    //         method: 'POST',
    //         url: `${base}/api/broadcast/ready`,
    //         failOnStatusCode: false,
    //         body: {publicKeyHash, socket_address},
    //     }).then((resp) => {
    //         expect([200, 201]).to.include(resp.status)
    //         expect(resp.body).to.have.property('socket_address', socket_address)
    //     })
    //
    //     cy.request({
    //         method: 'GET',
    //         url: `${base}/api/broadcast/lookup`,
    //         qs: {publicKeyHash, minutes: 15},
    //     }).then((resp) => {
    //         expect(resp.status).to.eq(200)
    //         const items = resp.body.items || []
    //         expect(items).to.be.an('array')
    //         const match = items.find((i: any) => i.socket_address === socket_address)
    //         expect(!!match).to.eq(true)
    //     })
    // })
})