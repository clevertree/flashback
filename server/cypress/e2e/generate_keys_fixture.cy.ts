/// <reference types="cypress" />
import {generateUserKeysAndCert} from "../../db/keyUtils";

// This spec generates a stable keys fixture for other Cypress tests.
// It writes cypress/fixtures/keys.json containing two certs and two private keys.
// Run this spec once before specs that depend on the fixture, or include it in the test run.

describe('Generate keys fixture', () => {
    it('creates cypress/fixtures/keys.json with test certs/keys', () => {
        const password = 'test-password-123';

        const kp1 = generateUserKeysAndCert(
            'test@test.com', password, 2048, 'FlashBack Test'
        );
        const kp2 = generateUserKeysAndCert(
            'test@test.com', password, 2048, 'FlashBack Test'
        );

        const data = {
            certPem: kp1.getCertPemString(),
            certPem2: kp2.getCertPemString(),
            privateKeyPem: kp1.getPrivateKeyPemString(),
            privateKeyPem2: kp2.getPrivateKeyPemString(),
        };

        // Write the fixture file for use in other tests
        cy.writeFile('cypress/fixtures/keys.json', data, {log: true});

        // Verify it was written and is readable as a fixture
        cy.fixture('keys.json').then((fx) => {
            expect(fx).to.have.keys(['certPem', 'certPem2', 'privateKeyPem', 'privateKeyPem2']);
        });
    });
});
