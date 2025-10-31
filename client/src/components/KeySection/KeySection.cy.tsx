import React from 'react';
import KeySection from './KeySection';
import { flashbackCrypto, isCryptoAvailable } from '../../util/cryptoBridge';

describe('KeySection Component', () => {
  const mockOnKeyVerified = cy.stub().as('onKeyVerified');
  const defaultConfigPath = '/default/config/path';

  beforeEach(() => {
    mockOnKeyVerified.reset();
  });

  describe('Initial Render', () => {
    it('should render the key section with title', () => {
      cy.mount(<KeySection defaultConfigPath={defaultConfigPath} onKeyVerified={mockOnKeyVerified} />);
      cy.contains('1. Generate or Locate Private Key').should('be.visible');
    });

    it('should display all form fields in initial state', () => {
      cy.mount(<KeySection defaultConfigPath={defaultConfigPath} onKeyVerified={mockOnKeyVerified} />);
      
      cy.contains('Config Path').should('be.visible');
      cy.contains('Email').should('be.visible');
      cy.contains('Password (optional)').should('be.visible');
      cy.contains('Bit length').should('be.visible');
      cy.contains('Algorithm').should('be.visible');
      cy.contains('Friendly Name').should('be.visible');
    });

    it('should populate default config path', () => {
      cy.mount(<KeySection defaultConfigPath={defaultConfigPath} onKeyVerified={mockOnKeyVerified} />);
      cy.get('input[placeholder="/default/config/path"]').should('have.value', defaultConfigPath);
    });

    it('should display generate and locate buttons', () => {
      cy.mount(<KeySection defaultConfigPath={defaultConfigPath} onKeyVerified={mockOnKeyVerified} />);
      cy.contains('Generate New Private Key').should('be.visible');
      cy.contains('Locate Existing *.key').should('be.visible');
    });

    it('should have default values for all fields', () => {
      cy.mount(<KeySection defaultConfigPath={defaultConfigPath} onKeyVerified={mockOnKeyVerified} />);
      
      cy.get('input[type="number"]').should('have.value', '2048');
      cy.get('select').should('have.value', 'ecdsa');
      cy.get('input[value="FlashBack"]').should('exist');
    });
  });

  describe('Crypto Availability', () => {
    it('should show error when crypto is not available', () => {
      cy.window().then((win) => {
        delete win.flashbackCrypto;
      });
      
      cy.mount(<KeySection defaultConfigPath={defaultConfigPath} onKeyVerified={mockOnKeyVerified} />);
      
      cy.contains('Crypto features are not available').should('be.visible');
      cy.contains('Generate New Private Key').should('be.disabled');
    });

    it('should enable generate button when crypto becomes available', () => {
      cy.window().then((win) => {
        win.flashbackCrypto = {
          checkKeyExists: cy.stub().resolves({ status: 'missing', privateKeyPath: '', certPemPath: '' }),
          generateUserKeysAndCert: cy.stub().resolves({
            status: 'valid',
            privateKeyPath: '/path/to/private.key',
            certPemPath: '/path/to/certificate.pem',
          }),
        };
      });

      cy.mount(<KeySection defaultConfigPath={defaultConfigPath} onKeyVerified={mockOnKeyVerified} />);
      
      cy.window().trigger('flashbackCryptoReady');
      cy.contains('Generate New Private Key').should('not.be.disabled');
    });
  });

  describe('Form Validation', () => {
    beforeEach(() => {
      cy.window().then((win) => {
        win.flashbackCrypto = {
          checkKeyExists: cy.stub().resolves({ status: 'missing', privateKeyPath: '', certPemPath: '' }),
          generateUserKeysAndCert: cy.stub().resolves({
            status: 'valid',
            privateKeyPath: '/path/to/private.key',
            certPemPath: '/path/to/certificate.pem',
          }),
        };
      });
    });

    it('should show error when generating without email', () => {
      cy.mount(<KeySection defaultConfigPath={defaultConfigPath} onKeyVerified={mockOnKeyVerified} />);
      
      cy.window().trigger('flashbackCryptoReady');
      cy.contains('Generate New Private Key').click();
      
      cy.contains('Email is required').should('be.visible');
    });

    it('should allow updating form fields', () => {
      cy.mount(<KeySection defaultConfigPath={defaultConfigPath} onKeyVerified={mockOnKeyVerified} />);
      
      cy.get('input[placeholder="you@example.com"]').type('test@example.com');
      cy.get('input[placeholder="you@example.com"]').should('have.value', 'test@example.com');
      
      cy.get('input[placeholder="Optional password"]').type('testpass');
      cy.get('input[placeholder="Optional password"]').should('have.value', 'testpass');
      
      cy.get('input[type="number"]').clear().type('4096');
      cy.get('input[type="number"]').should('have.value', '4096');
      
      cy.get('select').select('ed25519');
      cy.get('select').should('have.value', 'ed25519');
    });
  });

  describe('Key Generation', () => {
    beforeEach(() => {
      cy.window().then((win) => {
        win.flashbackCrypto = {
          checkKeyExists: cy.stub().resolves({ status: 'missing', privateKeyPath: '', certPemPath: '' }),
          generateUserKeysAndCert: cy.stub().resolves({
            status: 'valid',
            privateKeyPath: '/path/to/private.key',
            certPemPath: '/path/to/certificate.pem',
          }),
        };
      });
    });

    it('should generate new key successfully', () => {
      cy.mount(<KeySection defaultConfigPath={defaultConfigPath} onKeyVerified={mockOnKeyVerified} />);
      
      cy.window().trigger('flashbackCryptoReady');
      cy.get('input[placeholder="you@example.com"]').type('test@example.com');
      cy.contains('Generate New Private Key').click();
      
      cy.contains('Private Key:').should('be.visible');
      cy.contains('/path/to/private.key').should('be.visible');
      cy.contains('Certificate:').should('be.visible');
      cy.contains('/path/to/certificate.pem').should('be.visible');
    });

    it('should show busy state during generation', () => {
      cy.window().then((win) => {
        win.flashbackCrypto = {
          checkKeyExists: cy.stub().resolves({ status: 'missing', privateKeyPath: '', certPemPath: '' }),
          generateUserKeysAndCert: cy.stub().callsFake(() => 
            new Promise((resolve) => setTimeout(() => resolve({
              status: 'valid',
              privateKeyPath: '/path/to/private.key',
              certPemPath: '/path/to/certificate.pem',
            }), 100))
          ),
        };
      });

      cy.mount(<KeySection defaultConfigPath={defaultConfigPath} onKeyVerified={mockOnKeyVerified} />);
      
      cy.window().trigger('flashbackCryptoReady');
      cy.get('input[placeholder="you@example.com"]').type('test@example.com');
      cy.contains('Generate New Private Key').click();
      
      cy.contains('Working...').should('be.visible');
      cy.contains('Please wait, processing your request').should('be.visible');
    });

    it('should confirm overwrite when key exists', () => {
      cy.window().then((win) => {
        win.flashbackCrypto = {
          checkKeyExists: cy.stub().resolves({ status: 'valid', privateKeyPath: '/existing/key.pem', certPemPath: '/existing/cert.pem' }),
          generateUserKeysAndCert: cy.stub().resolves({
            status: 'valid',
            privateKeyPath: '/new/private.key',
            certPemPath: '/new/certificate.pem',
          }),
        };
        cy.stub(win, 'confirm').returns(true);
      });

      cy.mount(<KeySection defaultConfigPath={defaultConfigPath} onKeyVerified={mockOnKeyVerified} />);
      
      cy.window().trigger('flashbackCryptoReady');
      cy.get('input[placeholder="you@example.com"]').type('test@example.com');
      
      // Switch to edit mode first
      cy.contains('Select or Generate a New Key').click();
      cy.get('input[placeholder="you@example.com"]').clear().type('test@example.com');
      cy.contains('Generate New Private Key').click();
      
      cy.window().its('confirm').should('have.been.called');
    });

    it('should handle generation errors', () => {
      cy.window().then((win) => {
        win.flashbackCrypto = {
          checkKeyExists: cy.stub().resolves({ status: 'missing', privateKeyPath: '', certPemPath: '' }),
          generateUserKeysAndCert: cy.stub().rejects(new Error('Generation failed')),
        };
      });

      cy.mount(<KeySection defaultConfigPath={defaultConfigPath} onKeyVerified={mockOnKeyVerified} />);
      
      cy.window().trigger('flashbackCryptoReady');
      cy.get('input[placeholder="you@example.com"]').type('test@example.com');
      cy.contains('Generate New Private Key').click();
      
      cy.contains('Generation failed').should('be.visible');
    });
  });

  describe('Key Location', () => {
    it('should trigger file input when locate button clicked', () => {
      cy.mount(<KeySection defaultConfigPath={defaultConfigPath} onKeyVerified={mockOnKeyVerified} />);
      
      cy.contains('Locate Existing *.key').click();
      cy.get('input[type="file"]').should('exist');
    });

    it('should validate PEM format when file selected', () => {
      cy.mount(<KeySection defaultConfigPath={defaultConfigPath} onKeyVerified={mockOnKeyVerified} />);
      
      const invalidContent = 'not a valid PEM file';
      cy.get('input[type="file"]').selectFile({
        contents: Cypress.Buffer.from(invalidContent),
        fileName: 'invalid.key',
      }, { force: true });
      
      cy.contains('does not appear to be a PEM private key').should('be.visible');
    });

    it('should accept valid PEM file', () => {
      cy.mount(<KeySection defaultConfigPath={defaultConfigPath} onKeyVerified={mockOnKeyVerified} />);
      
      const validPem = '-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----';
      cy.get('input[type="file"]').selectFile({
        contents: Cypress.Buffer.from(validPem),
        fileName: 'valid.key',
      }, { force: true });
      
      cy.contains('Private Key:').should('be.visible');
      cy.contains('valid.key').should('be.visible');
    });
  });

  describe('Success State', () => {
    beforeEach(() => {
      cy.window().then((win) => {
        win.flashbackCrypto = {
          checkKeyExists: cy.stub().resolves({
            status: 'valid',
            privateKeyPath: '/existing/private.key',
            certPemPath: '/existing/certificate.pem',
          }),
          generateUserKeysAndCert: cy.stub().resolves({
            status: 'valid',
            privateKeyPath: '/path/to/private.key',
            certPemPath: '/path/to/certificate.pem',
          }),
        };
      });
    });

    it('should show success state when key exists on mount', () => {
      cy.mount(<KeySection defaultConfigPath={defaultConfigPath} onKeyVerified={mockOnKeyVerified} />);
      
      cy.window().trigger('flashbackCryptoReady');
      cy.contains('Private Key:').should('be.visible');
      cy.contains('/existing/private.key').should('be.visible');
    });

    it('should call onKeyVerified when valid key detected', () => {
      cy.mount(<KeySection defaultConfigPath={defaultConfigPath} onKeyVerified={mockOnKeyVerified} />);
      
      cy.window().trigger('flashbackCryptoReady');
      cy.get('@onKeyVerified').should('have.been.called');
    });

    it('should allow resetting to edit mode', () => {
      cy.mount(<KeySection defaultConfigPath={defaultConfigPath} onKeyVerified={mockOnKeyVerified} />);
      
      cy.window().trigger('flashbackCryptoReady');
      cy.contains('Select or Generate a New Key').click();
      
      cy.contains('Config Path').should('be.visible');
      cy.contains('Email').should('be.visible');
    });

    it('should hide form fields in success state', () => {
      cy.mount(<KeySection defaultConfigPath={defaultConfigPath} onKeyVerified={mockOnKeyVerified} />);
      
      cy.window().trigger('flashbackCryptoReady');
      cy.contains('Config Path').should('not.exist');
      cy.contains('Email').should('not.exist');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty config path', () => {
      cy.mount(<KeySection defaultConfigPath="" onKeyVerified={mockOnKeyVerified} />);
      cy.get('input[placeholder=""]').should('have.value', '');
    });

    it('should disable buttons during busy state', () => {
      cy.window().then((win) => {
        win.flashbackCrypto = {
          checkKeyExists: cy.stub().resolves({ status: 'missing', privateKeyPath: '', certPemPath: '' }),
          generateUserKeysAndCert: cy.stub().callsFake(() => 
            new Promise((resolve) => setTimeout(() => resolve({
              status: 'valid',
              privateKeyPath: '/path/to/private.key',
              certPemPath: '/path/to/certificate.pem',
            }), 200))
          ),
        };
      });

      cy.mount(<KeySection defaultConfigPath={defaultConfigPath} onKeyVerified={mockOnKeyVerified} />);
      
      cy.window().trigger('flashbackCryptoReady');
      cy.get('input[placeholder="you@example.com"]').type('test@example.com');
      cy.contains('Generate New Private Key').click();
      
      cy.contains('Locate Existing *.key').should('be.disabled');
    });

    it('should clear error when crypto becomes available', () => {
      cy.mount(<KeySection defaultConfigPath={defaultConfigPath} onKeyVerified={mockOnKeyVerified} />);
      
      cy.contains('Crypto features are not available').should('be.visible');
      
      cy.window().then((win) => {
        win.flashbackCrypto = {
          checkKeyExists: cy.stub().resolves({ status: 'missing', privateKeyPath: '', certPemPath: '' }),
          generateUserKeysAndCert: cy.stub().resolves({
            status: 'valid',
            privateKeyPath: '/path/to/private.key',
            certPemPath: '/path/to/certificate.pem',
          }),
        };
      });
      
      cy.window().trigger('flashbackCryptoReady');
      cy.contains('Crypto features are not available').should('not.exist');
    });
  });
});
