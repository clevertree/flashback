import React from 'react';
import ChannelBrowser from '../index';

describe('ChannelBrowser Component', () => {
  beforeEach(() => {
    cy.intercept('**/api/get_channels', {
      statusCode: 200,
      body: {
        channels: [
          {
            id: 'movies',
            name: 'Movies',
            description: 'Browse movies',
            chaincode_id: 'movie-cc',
          },
          {
            id: 'tv-shows',
            name: 'TV Shows',
            description: 'Browse TV shows',
            chaincode_id: 'tv-cc',
          },
          {
            id: 'games',
            name: 'Games',
            description: 'Browse games',
            chaincode_id: 'game-cc',
          },
        ],
      },
    }).as('getChannels');

    cy.mount(<ChannelBrowser />);
  });

  it('renders channel browser heading', () => {
    cy.contains('h3', 'Channels').should('be.visible');
  });

  it('loads and displays channels', () => {
    cy.wait('@getChannels');
    cy.contains('Movies').should('be.visible');
    cy.contains('TV Shows').should('be.visible');
    cy.contains('Games').should('be.visible');
  });

  it('displays channel descriptions', () => {
    cy.wait('@getChannels');
    cy.contains('Browse movies').should('be.visible');
    cy.contains('Browse TV shows').should('be.visible');
    cy.contains('Browse games').should('be.visible');
  });

  it('shows loading state initially', () => {
    cy.contains('Loading channels...').should('be.visible');
  });

  it('displays correct channel icons', () => {
    cy.wait('@getChannels');
    // Icons should be displayed (lucide-react icons)
    cy.get('svg').should('have.length.greaterThan', 0);
  });

  it('selects channel on click', () => {
    cy.wait('@getChannels');
    cy.contains('Movies').click();
    cy.contains('Movies').parent().should('have.class', 'bg-cyan-600');
  });

  it('loads content when channel is selected', () => {
    cy.intercept('**/api/query_chaincode', {
      statusCode: 200,
      body: {
        results: [
          { title: 'Movie 1', description: 'A great movie' },
          { title: 'Movie 2', description: 'Another great movie' },
        ],
      },
    }).as('queryContent');

    cy.wait('@getChannels');
    cy.contains('Movies').click();
    cy.wait('@queryContent');
    
    cy.contains('Movie 1').should('be.visible');
    cy.contains('Movie 2').should('be.visible');
  });

  it('displays no content message when empty', () => {
    cy.intercept('**/api/query_chaincode', {
      statusCode: 200,
      body: { results: [] },
    }).as('queryEmpty');

    cy.wait('@getChannels');
    cy.contains('Movies').click();
    cy.wait('@queryEmpty');
    
    cy.contains('No content available in this channel').should('be.visible');
  });

  it('displays channel selection prompt initially', () => {
    cy.wait('@getChannels');
    cy.contains('Select a channel to browse content').should('be.visible');
  });

  it('displays error message on failed channel load', () => {
    cy.intercept('**/api/get_channels', {
      statusCode: 500,
      body: { error: 'Failed to load' },
    }).as('getChannelsError');

    // Remount to trigger error
    cy.mount(<ChannelBrowser />);
    cy.wait('@getChannelsError');
    
    cy.contains('Failed to load channels').should('be.visible');
  });

  it('displays error message on failed content query', () => {
    cy.intercept('**/api/query_chaincode', {
      statusCode: 500,
      body: { error: 'Query failed' },
    }).as('queryError');

    cy.wait('@getChannels');
    cy.contains('Movies').click();
    cy.wait('@queryError');
    
    cy.contains('Failed to load content').should('be.visible');
  });

  it('updates selected channel styling', () => {
    cy.intercept('**/api/query_chaincode', {
      statusCode: 200,
      body: { results: [] },
    }).as('queryContent');

    cy.wait('@getChannels');
    cy.contains('Movies').click();
    cy.wait('@queryContent');

    cy.contains('Movies').parent().should('have.class', 'bg-cyan-600');
    cy.contains('TV Shows').parent().should('not.have.class', 'bg-cyan-600');
  });
});
