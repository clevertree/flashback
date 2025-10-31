import React from 'react';
import BroadcastSection from './BroadcastSection';
import { RegisterResultData } from '../../apiTypes';

describe('BroadcastSection', () => {
  const mockRegisteredInfo: RegisterResultData = {
    clientIP: '192.168.1.100',
    email: 'test@example.com',
  };

  beforeEach(() => {
    // Mock localStorage
    cy.window().then((win) => {
      win.localStorage.clear();
      win.localStorage.setItem('flashback.config', JSON.stringify({
        serverUrl: 'http://127.0.0.1:8080',
        fileRootDirectory: '/test/path',
      }));
    });

    // Mock flashbackApi
    cy.window().then((win) => {
      (win as any).flashbackApi = {
        apiReady: cy.stub().resolves('READY OK broadcast-id-123'),
      };
    });
  });

  describe('Visibility', () => {
    it('should not render when registeredInfo is null', () => {
      cy.mount(<BroadcastSection registeredInfo={null} />);
      cy.get('section').should('not.exist');
    });

    it('should render when registeredInfo is provided', () => {
      cy.mount(<BroadcastSection registeredInfo={mockRegisteredInfo} />);
      cy.contains('3. Broadcast Presence').should('be.visible');
    });
  });

  describe('Form Fields', () => {
    beforeEach(() => {
      cy.mount(<BroadcastSection registeredInfo={mockRegisteredInfo} />);
    });

    it('should display all input fields', () => {
      cy.contains('Local Socket').should('be.visible');
      cy.contains('Remote Socket').should('be.visible');
      cy.contains('Broadcast Port').should('be.visible');
      cy.contains('File Root Directory').should('be.visible');
    });

    it('should pre-fill remote IP from registeredInfo', () => {
      cy.get('input[placeholder="<remote-ip>"]').should('have.value', '192.168.1.100:0');
    });

    it('should load fileRootDirectory from config', () => {
      cy.get('input[placeholder="/path/to/shared/files"]').should('have.value', '/test/path');
    });

    it('should allow editing local socket', () => {
      cy.get('input[placeholder="127.0.0.1"]')
        .clear()
        .type('192.168.1.10');
      cy.get('input[placeholder="127.0.0.1"]').should('have.value', '192.168.1.10');
    });

    it('should allow editing broadcast port', () => {
      cy.get('input[value="13337"]')
        .clear()
        .type('8080');
      cy.get('input[value="8080"]').should('exist');
    });

    it('should update config when fileRootDirectory changes', () => {
      cy.get('input[placeholder="/path/to/shared/files"]')
        .clear()
        .type('/new/test/path');
      
      cy.window().then((win) => {
        const config = JSON.parse(win.localStorage.getItem('flashback.config') || '{}');
        expect(config.fileRootDirectory).to.equal('/new/test/path');
      });
    });
  });

  describe('Ready Button', () => {
    beforeEach(() => {
      cy.mount(<BroadcastSection registeredInfo={mockRegisteredInfo} />);
    });

    it('should be enabled when localIP is provided', () => {
      cy.contains('button', 'Ready!').should('not.be.disabled');
    });

    it('should be disabled when busy', () => {
      cy.get('input[placeholder="127.0.0.1"]').clear();
      cy.contains('button', 'Ready!').should('be.disabled');
    });

    it('should call apiReady when clicked', () => {
      cy.window().then((win) => {
        const apiReadyStub = (win as any).flashbackApi.apiReady;
        
        cy.contains('button', 'Ready!').click();
        
        cy.wrap(apiReadyStub).should('have.been.called');
      });
    });

    it('should show working state while processing', () => {
      cy.window().then((win) => {
        (win as any).flashbackApi.apiReady = cy.stub().callsFake(() => {
          return new Promise(resolve => setTimeout(() => resolve('READY OK'), 1000));
        });
      });

      cy.contains('button', 'Ready!').click();
      cy.contains('Working...').should('be.visible');
    });

    it('should transition to online state on success', () => {
      cy.contains('button', 'Ready!').click();
      cy.contains('Online. Your ready socket is registered.').should('be.visible');
    });

    it('should display error on failure', () => {
      cy.window().then((win) => {
        (win as any).flashbackApi.apiReady = cy.stub().resolves('ERROR: Something went wrong');
      });

      cy.contains('button', 'Ready!').click();
      cy.contains('ERROR: Something went wrong').should('be.visible');
    });

    it('should handle API exceptions', () => {
      cy.window().then((win) => {
        (win as any).flashbackApi.apiReady = cy.stub().rejects(new Error('Network error'));
      });

      cy.contains('button', 'Ready!').click();
      cy.contains('Network error').should('be.visible');
    });
  });

  describe('Online State', () => {
    beforeEach(() => {
      cy.mount(<BroadcastSection registeredInfo={mockRegisteredInfo} />);
      cy.contains('button', 'Ready!').click();
      cy.contains('Online').should('be.visible');
    });

    it('should display online status', () => {
      cy.contains('Online. Your ready socket is registered.').should('be.visible');
    });

    it('should show local socket', () => {
      cy.contains('Local Socket:').should('be.visible');
      cy.contains('code', '127.0.0.1').should('be.visible');
    });

    it('should show remote socket if provided', () => {
      cy.contains('Remote Socket:').should('be.visible');
      cy.contains('code', '192.168.1.100:0').should('be.visible');
    });

    it('should have "Go offline" button', () => {
      cy.contains('button', 'Go offline').should('be.visible');
    });

    it('should return to form when "Go offline" is clicked', () => {
      cy.contains('button', 'Go offline').click();
      cy.contains('button', 'Ready!').should('be.visible');
      cy.contains('Online').should('not.exist');
    });
  });

  describe('API Bridge Missing', () => {
    it('should handle missing flashbackApi', () => {
      cy.window().then((win) => {
        delete (win as any).flashbackApi;
      });

      cy.mount(<BroadcastSection registeredInfo={mockRegisteredInfo} />);
      cy.contains('button', 'Ready!').click();
      cy.contains('API bridge unavailable').should('be.visible');
    });

    it('should handle apiReady not being a function', () => {
      cy.window().then((win) => {
        (win as any).flashbackApi = {};
      });

      cy.mount(<BroadcastSection registeredInfo={mockRegisteredInfo} />);
      cy.contains('button', 'Ready!').click();
      cy.contains('API bridge unavailable').should('be.visible');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty fileRootDirectory', () => {
      cy.window().then((win) => {
        win.localStorage.setItem('flashback.config', JSON.stringify({}));
      });

      cy.mount(<BroadcastSection registeredInfo={mockRegisteredInfo} />);
      cy.get('input[placeholder="/path/to/shared/files"]').should('have.value', '');
    });

    it('should handle non-numeric port input', () => {
      cy.mount(<BroadcastSection registeredInfo={mockRegisteredInfo} />);
      
      cy.get('input[value="13337"]')
        .clear()
        .type('invalid');
      
      // Should default back to 13337
      cy.get('input[value="13337"]').should('exist');
    });

      it('should update when registeredInfo changes', () => {
    const mockRegisteredInfo: RegisterResultData = {
      clientIP: '192.168.1.100',
    };

    cy.mount(<BroadcastSection registeredInfo={null} />);
    cy.contains('Not registered').should('be.visible');

    // Remount with updated props
    cy.mount(<BroadcastSection registeredInfo={mockRegisteredInfo} />);
    cy.get('[data-testid="broadcast-section"]').should('not.contain', 'Not registered');
  });
  });
});
