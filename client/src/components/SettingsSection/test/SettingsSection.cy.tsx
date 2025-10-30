import React from 'react';
import SettingsSection from '../SettingsSection';

describe('SettingsSection Component', () => {
  const mockProps = {
    navSide: 'left' as const,
    autoPlayMedia: false,
    connectOnStartup: false,
    autoReconnectPeers: false,
    onChangeNavSide: cy.stub().as('onChangeNavSide'),
    onToggleAutoPlay: cy.stub().as('onToggleAutoPlay'),
    onToggleConnectOnStartup: cy.stub().as('onToggleConnectOnStartup'),
    onToggleAutoReconnectPeers: cy.stub().as('onToggleAutoReconnectPeers'),
  };

  it('renders settings section with title', () => {
    cy.mount(<SettingsSection {...mockProps} />);
    cy.contains('h2', 'Settings').should('be.visible');
    cy.get('#settings').should('be.visible');
  });

  it('displays all section headings', () => {
    cy.mount(<SettingsSection {...mockProps} />);
    
    cy.contains('h3', 'Navigation').should('be.visible');
    cy.contains('h3', 'Media').should('be.visible');
    cy.contains('h3', 'Connectivity').should('be.visible');
  });

  describe('Navigation Section', () => {
    it('displays left and right navigation buttons', () => {
      cy.mount(<SettingsSection {...mockProps} />);
      
      cy.contains('button', 'LEFT').should('be.visible');
      cy.contains('button', 'RIGHT').should('be.visible');
    });

    it('highlights current nav side button', () => {
      cy.mount(<SettingsSection {...mockProps} />);
      
      cy.contains('button', 'LEFT').should('be.visible');
    });

    it('does not highlight inactive nav side button', () => {
      cy.mount(<SettingsSection {...mockProps} />);
      
      cy.contains('button', 'RIGHT').should('be.visible');
    });

    it('calls onChangeNavSide when LEFT button is clicked', () => {
      const rightSideProps = { ...mockProps, navSide: 'right' as const };
      cy.mount(<SettingsSection {...rightSideProps} />);
      
      cy.contains('button', 'LEFT').click();
      
      cy.get('@onChangeNavSide').should('have.been.calledWith', 'left');
    });

    it('calls onChangeNavSide when RIGHT button is clicked', () => {
      cy.mount(<SettingsSection {...mockProps} />);
      
      cy.contains('button', 'RIGHT').click();
      
      cy.get('@onChangeNavSide').should('have.been.calledWith', 'right');
    });
  });

  describe('Media Section', () => {
    it('displays auto-play media checkbox', () => {
      cy.mount(<SettingsSection {...mockProps} />);
      
      cy.contains('label', 'Auto-play media streams').should('be.visible');
    });

    it('shows unchecked auto-play checkbox when false', () => {
      cy.mount(<SettingsSection {...mockProps} />);
      
      cy.get('input[type="checkbox"]').eq(0).should('not.be.checked');
    });

    it('shows checked auto-play checkbox when true', () => {
      const checkedProps = { ...mockProps, autoPlayMedia: true };
      cy.mount(<SettingsSection {...checkedProps} />);
      
      cy.get('input[type="checkbox"]').eq(0).should('be.checked');
    });

    it('calls onToggleAutoPlay when auto-play checkbox is toggled', () => {
      cy.mount(<SettingsSection {...mockProps} />);
      
      cy.get('input[type="checkbox"]').eq(0).check();
      
      cy.get('@onToggleAutoPlay').should('have.been.calledWith', true);
    });

    it('calls onToggleAutoPlay when auto-play is unchecked', () => {
      const checkedProps = { ...mockProps, autoPlayMedia: true };
      cy.mount(<SettingsSection {...checkedProps} />);
      
      cy.get('input[type="checkbox"]').eq(0).uncheck();
      
      cy.get('@onToggleAutoPlay').should('have.been.calledWith', false);
    });
  });

  describe('Connectivity Section', () => {
    it('displays connect on startup checkbox', () => {
      cy.mount(<SettingsSection {...mockProps} />);
      
      cy.contains('label', 'Connect to server on startup').should('be.visible');
    });

    it('displays auto re-connect checkbox', () => {
      cy.mount(<SettingsSection {...mockProps} />);
      
      cy.contains('label', 'Auto re-connect to known peers').should('be.visible');
    });

    it('shows unchecked connect on startup checkbox when false', () => {
      cy.mount(<SettingsSection {...mockProps} />);
      
      cy.get('input[type="checkbox"]').eq(1).should('not.be.checked');
    });

    it('shows checked connect on startup checkbox when true', () => {
      const checkedProps = { ...mockProps, connectOnStartup: true };
      cy.mount(<SettingsSection {...checkedProps} />);
      
      cy.get('input[type="checkbox"]').eq(1).should('be.checked');
    });

    it('shows unchecked auto re-connect checkbox when false', () => {
      cy.mount(<SettingsSection {...mockProps} />);
      
      cy.get('input[type="checkbox"]').eq(2).should('not.be.checked');
    });

    it('shows checked auto re-connect checkbox when true', () => {
      const checkedProps = { ...mockProps, autoReconnectPeers: true };
      cy.mount(<SettingsSection {...checkedProps} />);
      
      cy.get('input[type="checkbox"]').eq(2).should('be.checked');
    });

    it('calls onToggleConnectOnStartup when checkbox is toggled', () => {
      cy.mount(<SettingsSection {...mockProps} />);
      
      cy.get('input[type="checkbox"]').eq(1).check();
      
      cy.get('@onToggleConnectOnStartup').should('have.been.calledWith', true);
    });

    it('calls onToggleAutoReconnectPeers when checkbox is toggled', () => {
      cy.mount(<SettingsSection {...mockProps} />);
      
      cy.get('input[type="checkbox"]').eq(2).check();
      
      cy.get('@onToggleAutoReconnectPeers').should('have.been.calledWith', true);
    });
  });

  describe('Multiple Settings Interactions', () => {
    it('allows changing multiple settings', () => {
      cy.mount(<SettingsSection {...mockProps} />);
      
      cy.contains('button', 'RIGHT').click();
      cy.get('@onChangeNavSide').should('have.been.calledWith', 'right');
      
      cy.get('input[type="checkbox"]').eq(0).check();
      cy.get('@onToggleAutoPlay').should('have.been.calledWith', true);
      
      cy.get('input[type="checkbox"]').eq(1).check();
      cy.get('@onToggleConnectOnStartup').should('have.been.calledWith', true);
    });

    it('displays all settings in correct state', () => {
      const allEnabledProps = {
        navSide: 'right' as const,
        autoPlayMedia: true,
        connectOnStartup: true,
        autoReconnectPeers: true,
        onChangeNavSide: cy.stub(),
        onToggleAutoPlay: cy.stub(),
        onToggleConnectOnStartup: cy.stub(),
        onToggleAutoReconnectPeers: cy.stub(),
      };
      cy.mount(<SettingsSection {...allEnabledProps} />);
      
      // Navigation
      cy.contains('button', 'RIGHT').should('be.visible');
      
      // All checkboxes checked
      cy.get('input[type="checkbox"]').eq(0).should('be.checked');
      cy.get('input[type="checkbox"]').eq(1).should('be.checked');
      cy.get('input[type="checkbox"]').eq(2).should('be.checked');
    });
  });

  it('has proper spacing and layout', () => {
    cy.mount(<SettingsSection {...mockProps} />);
    
    cy.get('#settings').should('be.visible');
  });

  it('has accessible role for navigation buttons', () => {
    cy.mount(<SettingsSection {...mockProps} />);
    
    cy.get('[role="group"][aria-label="Nav side"]').should('exist');
  });
});
