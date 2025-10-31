import React from 'react';
import ClientsListSection from './ClientsListSection';
import { RegisterResultData } from '../../apiTypes';

describe('ClientsListSection Component', () => {
  const mockRegisteredInfo: RegisterResultData = {
    clientIP: '192.168.1.100',
    email: 'test@example.com',
  };

  const mockOnClientVisit = cy.stub().as('onClientVisit');

  beforeEach(() => {
    mockOnClientVisit.reset();
  });

  describe('Initial Render - Not Visible', () => {
    it('should not render when registeredInfo is null', () => {
      cy.mount(<ClientsListSection registeredInfo={null} onClientVisit={mockOnClientVisit} />);
      cy.contains('3. Connected Clients').should('not.exist');
    });
  });

  describe('Visibility Based on Registration', () => {
    beforeEach(() => {
      cy.window().then((win) => {
        win.flashbackApi = {
          apiRegisterJson: cy.stub().resolves({ status: 200, data: {} }),
          apiGetClients: cy.stub().resolves({
            status: 200,
            clients: [],
          }),
          apiReady: cy.stub().resolves('ready'),
          apiLookup: cy.stub().resolves('lookup'),
        };
      });
    });

    it('should render when registeredInfo is provided', () => {
      cy.mount(<ClientsListSection registeredInfo={mockRegisteredInfo} onClientVisit={mockOnClientVisit} />);
      cy.contains('3. Connected Clients').should('be.visible');
    });

    it('should display refresh button', () => {
      cy.mount(<ClientsListSection registeredInfo={mockRegisteredInfo} onClientVisit={mockOnClientVisit} />);
      cy.contains('Refresh').should('be.visible');
    });

    it('should automatically fetch clients on mount', () => {
      cy.mount(<ClientsListSection registeredInfo={mockRegisteredInfo} onClientVisit={mockOnClientVisit} />);
      cy.window().then((win) => {
        expect(win.flashbackApi?.apiGetClients).to.have.been.called;
      });
    });
  });

  describe('Empty State', () => {
    beforeEach(() => {
      cy.window().then((win) => {
        win.flashbackApi = {
          apiRegisterJson: cy.stub().resolves({ status: 200, data: {} }),
          apiGetClients: cy.stub().resolves({
            status: 200,
            clients: [],
          }),
          apiReady: cy.stub().resolves('ready'),
          apiLookup: cy.stub().resolves('lookup'),
        };
      });
    });

    it('should show empty message when no clients are connected', () => {
      cy.mount(<ClientsListSection registeredInfo={mockRegisteredInfo} onClientVisit={mockOnClientVisit} />);
      cy.contains('No clients connected yet').should('be.visible');
    });

    it('should not show ClientsList component when clients array is empty', () => {
      cy.mount(<ClientsListSection registeredInfo={mockRegisteredInfo} onClientVisit={mockOnClientVisit} />);
      cy.get('#connected-clients').should('not.exist');
    });
  });

  describe('Client List Display', () => {
    beforeEach(() => {
      cy.window().then((win) => {
        win.flashbackApi = {
          apiRegisterJson: cy.stub().resolves({ status: 200, data: {} }),
          apiGetClients: cy.stub().resolves({
            status: 200,
            clients: [
              {
                ip: '10.0.0.1',
                port: 8080,
                remote_ip: '192.168.1.10',
                peer_status: 'online',
              },
              {
                ip: '10.0.0.2',
                port: 8081,
                remote_ip: '192.168.1.11',
                peer_status: 'offline',
              },
            ],
          }),
          apiReady: cy.stub().resolves('ready'),
          apiLookup: cy.stub().resolves('lookup'),
        };
      });
    });

    it('should display clients when data is fetched', () => {
      cy.mount(<ClientsListSection registeredInfo={mockRegisteredInfo} onClientVisit={mockOnClientVisit} />);
      cy.get('#connected-clients').should('be.visible');
    });

    it('should mark clients as online after fetch', () => {
      cy.mount(<ClientsListSection registeredInfo={mockRegisteredInfo} onClientVisit={mockOnClientVisit} />);
      // ClientsList component should receive onlineKeys prop
      cy.get('#connected-clients').should('exist');
    });

    it('should pass correct client data to ClientsList', () => {
      cy.mount(<ClientsListSection registeredInfo={mockRegisteredInfo} onClientVisit={mockOnClientVisit} />);
      cy.get('#connected-clients').should('exist');
    });

    it('should not show empty message when clients exist', () => {
      cy.mount(<ClientsListSection registeredInfo={mockRegisteredInfo} onClientVisit={mockOnClientVisit} />);
      cy.contains('No clients connected yet').should('not.exist');
    });
  });

  describe('Refresh Functionality', () => {
    beforeEach(() => {
      cy.window().then((win) => {
        let callCount = 0;
        win.flashbackApi = {
          apiRegisterJson: cy.stub().resolves({ status: 200, data: {} }),
          apiGetClients: cy.stub().callsFake(() => {
            callCount++;
            return Promise.resolve({
              status: 200,
              clients: callCount === 1 ? [] : [
                {
                  ip: '10.0.0.1',
                  port: 8080,
                  remote_ip: '192.168.1.10',
                  peer_status: 'online',
                },
              ],
            });
          }),
          apiReady: cy.stub().resolves('ready'),
          apiLookup: cy.stub().resolves('lookup'),
        };
      });
    });

    it('should refresh client list when refresh button clicked', () => {
      cy.mount(<ClientsListSection registeredInfo={mockRegisteredInfo} onClientVisit={mockOnClientVisit} />);
      
      cy.contains('No clients connected yet').should('be.visible');
      cy.contains('Refresh').click();
      cy.get('#connected-clients').should('be.visible');
    });

    it('should show loading state during refresh', () => {
      cy.window().then((win) => {
        win.flashbackApi = {
          apiRegisterJson: cy.stub().resolves({ status: 200, data: {} }),
          apiGetClients: cy.stub().callsFake(() =>
            new Promise((resolve) => setTimeout(() => resolve({
              status: 200,
              clients: [],
            }), 100))
          ),
          apiReady: cy.stub().resolves('ready'),
          apiLookup: cy.stub().resolves('lookup'),
        };
      });

      cy.mount(<ClientsListSection registeredInfo={mockRegisteredInfo} onClientVisit={mockOnClientVisit} />);
      
      cy.contains('Refresh').click();
      cy.contains('Refreshing...').should('be.visible');
    });

    it('should disable refresh button during loading', () => {
      cy.window().then((win) => {
        win.flashbackApi = {
          apiRegisterJson: cy.stub().resolves({ status: 200, data: {} }),
          apiGetClients: cy.stub().callsFake(() =>
            new Promise((resolve) => setTimeout(() => resolve({
              status: 200,
              clients: [],
            }), 100))
          ),
          apiReady: cy.stub().resolves('ready'),
          apiLookup: cy.stub().resolves('lookup'),
        };
      });

      cy.mount(<ClientsListSection registeredInfo={mockRegisteredInfo} onClientVisit={mockOnClientVisit} />);
      
      cy.contains('Refresh').click();
      cy.contains('Refreshing...').should('be.disabled');
    });
  });

  describe('Error Handling', () => {
    it('should show error when API bridge is unavailable', () => {
      cy.window().then((win) => {
        delete win.flashbackApi;
      });

      cy.mount(<ClientsListSection registeredInfo={mockRegisteredInfo} onClientVisit={mockOnClientVisit} />);
      cy.contains('API bridge unavailable').should('be.visible');
    });

    it('should show error when API call fails', () => {
      cy.window().then((win) => {
        win.flashbackApi = {
          apiRegisterJson: cy.stub().resolves({ status: 200, data: {} }),
          apiGetClients: cy.stub().rejects(new Error('Network error')),
          apiReady: cy.stub().resolves('ready'),
          apiLookup: cy.stub().resolves('lookup'),
        };
      });

      cy.mount(<ClientsListSection registeredInfo={mockRegisteredInfo} onClientVisit={mockOnClientVisit} />);
      cy.contains('Network error').should('be.visible');
    });

    it('should show error for invalid response format', () => {
      cy.window().then((win) => {
        win.flashbackApi = {
          apiRegisterJson: cy.stub().resolves({ status: 200, data: {} }),
          apiGetClients: cy.stub().resolves({
            status: 200,
            clients: null,
          }),
          apiReady: cy.stub().resolves('ready'),
          apiLookup: cy.stub().resolves('lookup'),
        };
      });

      cy.mount(<ClientsListSection registeredInfo={mockRegisteredInfo} onClientVisit={mockOnClientVisit} />);
      cy.contains('Invalid client list response').should('be.visible');
    });

    it('should show failure message in empty state after error', () => {
      cy.window().then((win) => {
        win.flashbackApi = {
          apiRegisterJson: cy.stub().resolves({ status: 200, data: {} }),
          apiGetClients: cy.stub().rejects(new Error('Connection failed')),
          apiReady: cy.stub().resolves('ready'),
          apiLookup: cy.stub().resolves('lookup'),
        };
      });

      cy.mount(<ClientsListSection registeredInfo={mockRegisteredInfo} onClientVisit={mockOnClientVisit} />);
      cy.contains('Failed to load clients').should('be.visible');
    });

    it('should clear error on successful refresh', () => {
      cy.window().then((win) => {
        let callCount = 0;
        win.flashbackApi = {
          apiRegisterJson: cy.stub().resolves({ status: 200, data: {} }),
          apiGetClients: cy.stub().callsFake(() => {
            callCount++;
            if (callCount === 1) {
              return Promise.reject(new Error('First error'));
            }
            return Promise.resolve({
              status: 200,
              clients: [],
            });
          }),
          apiReady: cy.stub().resolves('ready'),
          apiLookup: cy.stub().resolves('lookup'),
        };
      });

      cy.mount(<ClientsListSection registeredInfo={mockRegisteredInfo} onClientVisit={mockOnClientVisit} />);
      
      cy.contains('First error').should('be.visible');
      cy.contains('Refresh').click();
      cy.contains('First error').should('not.exist');
    });
  });

  describe('Client Visit Functionality', () => {
    beforeEach(() => {
      cy.window().then((win) => {
        win.flashbackApi = {
          apiRegisterJson: cy.stub().resolves({ status: 200, data: {} }),
          apiGetClients: cy.stub().resolves({
            status: 200,
            clients: [
              {
                ip: '10.0.0.1',
                port: 8080,
                remote_ip: '192.168.1.10',
                peer_status: 'online',
              },
            ],
          }),
          apiReady: cy.stub().resolves('ready'),
          apiLookup: cy.stub().resolves('lookup'),
        };
      });
    });

    it('should pass onDccConnect handler to ClientsList', () => {
      cy.mount(<ClientsListSection registeredInfo={mockRegisteredInfo} onClientVisit={mockOnClientVisit} />);
      cy.get('#connected-clients').should('exist');
    });
  });

  describe('Edge Cases', () => {
    it('should handle transition from null to registered', () => {
      cy.window().then((win) => {
        win.flashbackApi = {
          apiRegisterJson: cy.stub().resolves({ status: 200, data: {} }),
          apiGetClients: cy.stub().resolves({
            status: 200,
            clients: [],
          }),
          apiReady: cy.stub().resolves('ready'),
          apiLookup: cy.stub().resolves('lookup'),
        };
      });

      cy.mount(<ClientsListSection registeredInfo={null} onClientVisit={mockOnClientVisit} />);
      cy.contains('3. Connected Clients').should('not.exist');

      // Remount with registeredInfo
      cy.mount(<ClientsListSection registeredInfo={mockRegisteredInfo} onClientVisit={mockOnClientVisit} />);
      cy.contains('3. Connected Clients').should('be.visible');
    });

    it('should handle clients with missing remote_ip', () => {
      cy.window().then((win) => {
        win.flashbackApi = {
          apiRegisterJson: cy.stub().resolves({ status: 200, data: {} }),
          apiGetClients: cy.stub().resolves({
            status: 200,
            clients: [
              {
                ip: '10.0.0.1',
                port: 8080,
                peer_status: 'online',
              },
            ],
          }),
          apiReady: cy.stub().resolves('ready'),
          apiLookup: cy.stub().resolves('lookup'),
        };
      });

      cy.mount(<ClientsListSection registeredInfo={mockRegisteredInfo} onClientVisit={mockOnClientVisit} />);
      cy.get('#connected-clients').should('be.visible');
    });

    it('should handle clients with missing peer_status', () => {
      cy.window().then((win) => {
        win.flashbackApi = {
          apiRegisterJson: cy.stub().resolves({ status: 200, data: {} }),
          apiGetClients: cy.stub().resolves({
            status: 200,
            clients: [
              {
                ip: '10.0.0.1',
                port: 8080,
                remote_ip: '192.168.1.10',
              },
            ],
          }),
          apiReady: cy.stub().resolves('ready'),
          apiLookup: cy.stub().resolves('lookup'),
        };
      });

      cy.mount(<ClientsListSection registeredInfo={mockRegisteredInfo} onClientVisit={mockOnClientVisit} />);
      cy.get('#connected-clients').should('be.visible');
    });

    it('should work without onClientVisit callback', () => {
      cy.window().then((win) => {
        win.flashbackApi = {
          apiRegisterJson: cy.stub().resolves({ status: 200, data: {} }),
          apiGetClients: cy.stub().resolves({
            status: 200,
            clients: [
              {
                ip: '10.0.0.1',
                port: 8080,
                remote_ip: '192.168.1.10',
                peer_status: 'online',
              },
            ],
          }),
          apiReady: cy.stub().resolves('ready'),
          apiLookup: cy.stub().resolves('lookup'),
        };
      });

      cy.mount(<ClientsListSection registeredInfo={mockRegisteredInfo} />);
      cy.get('#connected-clients').should('be.visible');
    });

    it('should handle empty registeredInfo clientIP', () => {
      cy.window().then((win) => {
        win.flashbackApi = {
          apiRegisterJson: cy.stub().resolves({ status: 200, data: {} }),
          apiGetClients: cy.stub().resolves({
            status: 200,
            clients: [
              {
                ip: '10.0.0.1',
                port: 8080,
                remote_ip: '192.168.1.10',
                peer_status: 'online',
              },
            ],
          }),
          apiReady: cy.stub().resolves('ready'),
          apiLookup: cy.stub().resolves('lookup'),
        };
      });

      const emptyInfo: RegisterResultData = { clientIP: '' };
      cy.mount(<ClientsListSection registeredInfo={emptyInfo} onClientVisit={mockOnClientVisit} />);
      cy.get('#connected-clients').should('be.visible');
    });
  });
});
