import React from 'react';
import ChannelBrowser from '../index';

describe('ChannelBrowser Component - Isolated Unit Tests', () => {
  it('renders the channels heading', () => {
    cy.mount(<ChannelBrowser />);
    
    cy.contains('h3', 'Channels').should('be.visible');
  });

  it('displays loading state initially', () => {
    cy.mount(<ChannelBrowser />);
    
    cy.contains('Loading channels...').should('be.visible');
  });

  it('displays channel selection prompt initially', () => {
    cy.mount(<ChannelBrowser />);
    
    cy.contains('Select a channel to browse content').should('be.visible');
  });

  it('renders with proper dark theme styling', () => {
    cy.mount(<ChannelBrowser />);
    
    cy.get('.bg-slate-800').should('exist');
    cy.get('.text-cyan-400').should('exist');
  });

  it('has grid layout for channels', () => {
    cy.mount(<ChannelBrowser />);
    
    cy.get('.grid').should('exist');
  });

  it('renders channel list section', () => {
    cy.mount(<ChannelBrowser />);
    
    cy.get('.rounded-lg.bg-slate-800.p-6').should('have.length.greaterThan', 0);
  });

  it('renders component without errors', () => {
    cy.mount(<ChannelBrowser />);
    
    // Check that main container renders
    cy.get('div').should('have.length.greaterThan', 0);
  });

  it('displays content browser area', () => {
    cy.mount(<ChannelBrowser />);
    
    // Check for content display area (col-span-2)
    cy.get('.col-span-2').should('exist');
  });
});
