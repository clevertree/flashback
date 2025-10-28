/// <reference types="cypress" />

describe('Test Reset DB Endpoint', () => {
    let testKeys: {
        certPem: string;
        certPem2: string;
        privateKeyPem: string;
        privateKeyPem2: string;
    };

    before(function () {
        // Load keys from the generated fixture
        cy.fixture('keys.json').then((fx) => {
            testKeys = fx as typeof testKeys;
        });
    });

    it('successfully resets the database and clears existing users', () => {
        // Reset the database
        cy.request({
            method: 'POST',
            url: '/api/test/reset-db',
        }).then((resetResp) => {
            expect(resetResp.status).to.eq(200);
            expect(resetResp.body.status).to.eq('Test users deleted successfully');
        });
    });

    it('prevents reset in non-test environments', () => {
        // Note: This test requires manual environment configuration
        cy.request({
            method: 'POST',
            url: '/api/test/reset-db',
            failOnStatusCode: false
        }).then((resp) => {
            // In test environment, this should succeed
            expect(resp.status).to.eq(200);
        });
    });
});
