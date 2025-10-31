import React from 'react';
import ServerSection from './ServerSection';
import { RegisterResultData } from '../../apiTypes';

describe('ServerSection Component', () => {
  const mockOnRegistered = cy.stub().as('onRegistered');

  beforeEach(() => {
    mockOnRegistered.reset();
  });

  describe('Initial Render - Not Visible', () => {
    it('should not render when keyVerified is false', () => {
      cy.mount(<ServerSection onRegistered={mockOnRegistered} keyVerified={false} />);
      cy.contains('2. Server Registration').should('not.exist');
    });
  });

  describe('Visibility Based on Key Verification', () => {
    beforeEach(() => {
      cy.window().then((win) => {
        win.flashbackCrypto = {
          checkKeyExists: cy.stub().resolves({
            status: 'valid',
            privateKeyPath: '/path/to/key',
            certPemPath: '/path/to/cert',
          }),
          generateUserKeysAndCert: cy.stub().resolves({
            status: 'valid',
            privateKeyPath: '/path/to/key',
            certPemPath: '/path/to/cert',
          }),
        };
      });
    });

    it('should render when keyVerified is true', () => {
      cy.mount(<ServerSection onRegistered={mockOnRegistered} keyVerified={true} />);
      cy.contains('2. Server Registration').should('be.visible');
    });

    it('should display server URL from config', () => {
      cy.mount(<ServerSection onRegistered={mockOnRegistered} keyVerified={true} />);
      cy.contains('Server URL:').should('be.visible');
    });

    it('should display register button in initial state', () => {
      cy.mount(<ServerSection onRegistered={mockOnRegistered} keyVerified={true} />);
      cy.contains('Register with Server').should('be.visible');
    });

    it('should show help text about registration', () => {
      cy.mount(<ServerSection onRegistered={mockOnRegistered} keyVerified={true} />);
      cy.contains('send your certificate to the server').should('be.visible');
    });
  });

  describe('Registration Flow', () => {
    beforeEach(() => {
      cy.window().then((win) => {
        win.flashbackCrypto = {
          checkKeyExists: cy.stub().resolves({
            status: 'valid',
            privateKeyPath: '/path/to/key',
            certPemPath: '/path/to/cert',
          }),
          generateUserKeysAndCert: cy.stub().resolves({
            status: 'valid',
            privateKeyPath: '/path/to/key',
            certPemPath: '/path/to/cert',
          }),
        };
        win.flashbackApi = {
          apiRegisterJson: cy.stub().resolves({
            status: 200,
            data: {
              clientIP: '192.168.1.100',
              email: 'test@example.com',
              serverVersion: '1.0.0',
              serverTitle: 'Test Server',
            } as RegisterResultData,
          }),
          apiGetClients: cy.stub().resolves({ status: 200, clients: [] }),
          apiReady: cy.stub().resolves('ready'),
          apiLookup: cy.stub().resolves('lookup'),
        };
      });
    });

    it('should successfully register with server', () => {
      cy.mount(<ServerSection onRegistered={mockOnRegistered} keyVerified={true} />);
      
      cy.contains('Register with Server').click();
      cy.contains('Registered successfully').should('be.visible');
    });

    it('should show busy state during registration', () => {
      cy.window().then((win) => {
        win.flashbackApi = {
          apiRegisterJson: cy.stub().callsFake(() =>
            new Promise((resolve) => setTimeout(() => resolve({
              status: 200,
              data: {
                clientIP: '192.168.1.100',
              },
            }), 100))
          ),
          apiGetClients: cy.stub().resolves({ status: 200, clients: [] }),
          apiReady: cy.stub().resolves('ready'),
          apiLookup: cy.stub().resolves('lookup'),
        };
      });

      cy.mount(<ServerSection onRegistered={mockOnRegistered} keyVerified={true} />);
      
      cy.contains('Register with Server').click();
      cy.contains('Registering...').should('be.visible');
    });

    it('should disable button during registration', () => {
      cy.window().then((win) => {
        win.flashbackApi = {
          apiRegisterJson: cy.stub().callsFake(() =>
            new Promise((resolve) => setTimeout(() => resolve({
              status: 200,
              data: { clientIP: '192.168.1.100' },
            }), 100))
          ),
          apiGetClients: cy.stub().resolves({ status: 200, clients: [] }),
          apiReady: cy.stub().resolves('ready'),
          apiLookup: cy.stub().resolves('lookup'),
        };
      });

      cy.mount(<ServerSection onRegistered={mockOnRegistered} keyVerified={true} />);
      
      cy.contains('Register with Server').click();
      cy.contains('Registering...').should('be.disabled');
    });

    it('should call onRegistered callback on success', () => {
      cy.mount(<ServerSection onRegistered={mockOnRegistered} keyVerified={true} />);
      
      cy.contains('Register with Server').click();
      cy.get('@onRegistered').should('have.been.calledOnce');
    });

    it('should display server metadata after registration', () => {
      cy.mount(<ServerSection onRegistered={mockOnRegistered} keyVerified={true} />);
      
      cy.contains('Register with Server').click();
      cy.contains('Server Version:').should('be.visible');
      cy.contains('1.0.0').should('be.visible');
      cy.contains('Server Title:').should('be.visible');
      cy.contains('Test Server').should('be.visible');
    });

    it('should hide registration form after successful registration', () => {
      cy.mount(<ServerSection onRegistered={mockOnRegistered} keyVerified={true} />);
      
      cy.contains('Register with Server').click();
      cy.contains('Register with Server').should('not.exist');
      cy.contains('send your certificate').should('not.exist');
    });
  });

  describe('Registration Errors', () => {
    beforeEach(() => {
      cy.window().then((win) => {
        win.flashbackCrypto = {
          checkKeyExists: cy.stub().resolves({
            status: 'valid',
            privateKeyPath: '/path/to/key',
            certPemPath: '/path/to/cert',
          }),
          generateUserKeysAndCert: cy.stub().resolves({
            status: 'valid',
            privateKeyPath: '/path/to/key',
            certPemPath: '/path/to/cert',
          }),
        };
      });
    });

    it('should show error when API bridge is unavailable', () => {
      cy.window().then((win) => {
        delete win.flashbackApi;
      });

      cy.mount(<ServerSection onRegistered={mockOnRegistered} keyVerified={true} />);
      
      cy.contains('Register with Server').click();
      cy.contains('API bridge unavailable').should('be.visible');
    });

    it('should show error when registration fails with non-200 status', () => {
      cy.window().then((win) => {
        win.flashbackApi = {
          apiRegisterJson: cy.stub().resolves({
            status: 500,
            data: {},
          }),
          apiGetClients: cy.stub().resolves({ status: 200, clients: [] }),
          apiReady: cy.stub().resolves('ready'),
          apiLookup: cy.stub().resolves('lookup'),
        };
      });

      cy.mount(<ServerSection onRegistered={mockOnRegistered} keyVerified={true} />);
      
      cy.contains('Register with Server').click();
      cy.contains('Registration failed (500)').should('be.visible');
    });

    it('should show error when API throws exception', () => {
      cy.window().then((win) => {
        win.flashbackApi = {
          apiRegisterJson: cy.stub().rejects(new Error('Network error')),
          apiGetClients: cy.stub().resolves({ status: 200, clients: [] }),
          apiReady: cy.stub().resolves('ready'),
          apiLookup: cy.stub().resolves('lookup'),
        };
      });

      cy.mount(<ServerSection onRegistered={mockOnRegistered} keyVerified={true} />);
      
      cy.contains('Register with Server').click();
      cy.contains('Network error').should('be.visible');
    });

    it('should clear previous errors on new registration attempt', () => {
      cy.window().then((win) => {
        let callCount = 0;
        win.flashbackApi = {
          apiRegisterJson: cy.stub().callsFake(() => {
            callCount++;
            if (callCount === 1) {
              return Promise.reject(new Error('First error'));
            }
            return Promise.resolve({
              status: 200,
              data: { clientIP: '192.168.1.100' },
            });
          }),
          apiGetClients: cy.stub().resolves({ status: 200, clients: [] }),
          apiReady: cy.stub().resolves('ready'),
          apiLookup: cy.stub().resolves('lookup'),
        };
      });

      cy.mount(<ServerSection onRegistered={mockOnRegistered} keyVerified={true} />);
      
      cy.contains('Register with Server').click();
      cy.contains('First error').should('be.visible');
      
      cy.contains('Register with Server').click();
      cy.contains('First error').should('not.exist');
    });
  });

  describe('Success State', () => {
    beforeEach(() => {
      cy.window().then((win) => {
        win.flashbackCrypto = {
          checkKeyExists: cy.stub().resolves({
            status: 'valid',
            privateKeyPath: '/path/to/key',
            certPemPath: '/path/to/cert',
          }),
          generateUserKeysAndCert: cy.stub().resolves({
            status: 'valid',
            privateKeyPath: '/path/to/key',
            certPemPath: '/path/to/cert',
          }),
        };
        win.flashbackApi = {
          apiRegisterJson: cy.stub().resolves({
            status: 200,
            data: {
              clientIP: '192.168.1.100',
              email: 'test@example.com',
              serverVersion: '2.0.0',
              serverTitle: 'Production Server',
            },
          }),
          apiGetClients: cy.stub().resolves({ status: 200, clients: [] }),
          apiReady: cy.stub().resolves('ready'),
          apiLookup: cy.stub().resolves('lookup'),
        };
      });
    });

    it('should display success message in registered state', () => {
      cy.mount(<ServerSection onRegistered={mockOnRegistered} keyVerified={true} />);
      
      cy.contains('Register with Server').click();
      cy.contains('Registered successfully').should('be.visible');
      cy.contains('Registered successfully').should('have.class', 'text-green-700');
    });

    it('should show server metadata in success box', () => {
      cy.mount(<ServerSection onRegistered={mockOnRegistered} keyVerified={true} />);
      
      cy.contains('Register with Server').click();
      cy.contains('Server Version:').parent().should('have.class', 'bg-gray-50');
    });

    it('should handle missing optional metadata gracefully', () => {
      cy.window().then((win) => {
        win.flashbackApi = {
          apiRegisterJson: cy.stub().resolves({
            status: 200,
            data: {
              clientIP: '192.168.1.100',
            },
          }),
          apiGetClients: cy.stub().resolves({ status: 200, clients: [] }),
          apiReady: cy.stub().resolves('ready'),
          apiLookup: cy.stub().resolves('lookup'),
        };
      });

      cy.mount(<ServerSection onRegistered={mockOnRegistered} keyVerified={true} />);
      
      cy.contains('Register with Server').click();
      cy.contains('Registered successfully').should('be.visible');
      cy.contains('Server Version:').should('not.exist');
      cy.contains('Server Title:').should('not.exist');
    });
  });

  describe('Edge Cases', () => {
    it('should handle transition from keyVerified false to true', () => {
      cy.window().then((win) => {
        win.flashbackCrypto = {
          checkKeyExists: cy.stub().resolves({
            status: 'valid',
            privateKeyPath: '/path/to/key',
            certPemPath: '/path/to/cert',
          }),
          generateUserKeysAndCert: cy.stub().resolves({
            status: 'valid',
            privateKeyPath: '/path/to/key',
            certPemPath: '/path/to/cert',
          }),
        };
      });

      cy.mount(<ServerSection onRegistered={mockOnRegistered} keyVerified={false} />);
      cy.contains('2. Server Registration').should('not.exist');

      // Remount with keyVerified true
      cy.mount(<ServerSection onRegistered={mockOnRegistered} keyVerified={true} />);
      cy.contains('2. Server Registration').should('be.visible');
    });

    it('should handle missing data in response', () => {
      cy.window().then((win) => {
        win.flashbackCrypto = {
          checkKeyExists: cy.stub().resolves({
            status: 'valid',
            privateKeyPath: '/path/to/key',
            certPemPath: '/path/to/cert',
          }),
          generateUserKeysAndCert: cy.stub().resolves({
            status: 'valid',
            privateKeyPath: '/path/to/key',
            certPemPath: '/path/to/cert',
          }),
        };
        win.flashbackApi = {
          apiRegisterJson: cy.stub().resolves({
            status: 200,
            data: null,
          }),
          apiGetClients: cy.stub().resolves({ status: 200, clients: [] }),
          apiReady: cy.stub().resolves('ready'),
          apiLookup: cy.stub().resolves('lookup'),
        };
      });

      cy.mount(<ServerSection onRegistered={mockOnRegistered} keyVerified={true} />);
      
      cy.contains('Register with Server').click();
      cy.contains('Registered successfully').should('be.visible');
    });
  });
});
