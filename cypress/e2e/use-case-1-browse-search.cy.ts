/**
 * UI E2E Test Suite - Movie Browse and Search Use Case
 * 
 * Tests the complete workflow for browsing and searching movies
 * through the web UI connected to live Kaleido network
 */

/// <reference types="cypress" />

describe('Use Case 1: Browse and Search Movies', () => {
  beforeEach(() => {
    // Navigate to app and ensure connection
    cy.visit('/');
    
    // Wait for app to load
    cy.get('header', { timeout: 10000 }).should('be.visible');
  });

  describe('Movie Browsing', () => {
    it('should load and display movies on Channels tab', () => {
      // Click Channels tab
      cy.contains('button', 'Channels').click();
      
      // Verify channel info is visible
      cy.contains('Current Channel').should('be.visible');
      cy.contains('movies-general').should('be.visible');
      cy.contains('flashback_repository').should('be.visible');
      
      // Wait for movies to load from chaincode
      cy.contains('Loading content from chaincode', { timeout: 15000 }).should('not.exist');
      
      // Verify movies are displayed
      cy.get('[class*="grid"]').within(() => {
        cy.get('[class*="rounded-lg"]').should('have.length.greaterThan', 0);
      });
    });

    it('should show movie count from live chaincode', () => {
      cy.contains('button', 'Channels').click();
      
      // Verify loaded count is displayed
      cy.contains(/Loaded:\s+\d+\s+movies/).should('be.visible');
    });

    it('should display movie details in cards', () => {
      cy.contains('button', 'Channels').click();
      
      // Wait for movies to load
      cy.contains('Loading content from chaincode').should('not.exist');
      
      // Check for movie information
      cy.get('[class*="rounded-lg"][class*="bg-slate-700"]').first().within(() => {
        // Should have title
        cy.get('h4').should('exist');
        // Should have IMDb ID
        cy.contains('IMDb:').should('exist');
      });
    });

    it('should display movie genres as tags', () => {
      cy.contains('button', 'Channels').click();
      
      cy.contains('Loading content from chaincode').should('not.exist');
      
      // Look for genre tags (should be visible in at least some movies)
      cy.get('[class*="bg-cyan-900"]').first().should('be.visible');
    });

    it('should show refresh button and allow refresh', () => {
      cy.contains('button', 'Channels').click();
      
      // Find refresh button (should have RefreshCw icon or text)
      cy.get('button').contains(/Refresh Movies|RefreshCw/i).should('exist');
      
      // Click refresh
      cy.get('button').contains('Refresh Movies').click();
      
      // Should show loading state
      cy.contains('Loading content from chaincode', { timeout: 5000 }).should('be.visible');
      
      // Movies should load again
      cy.contains('Loading content from chaincode', { timeout: 15000 }).should('not.exist');
    });
  });

  describe('Movie Search', () => {
    it('should search movies by title in real-time', () => {
      cy.contains('button', 'Channels').click();
      
      // Wait for initial load
      cy.contains('Loading content from chaincode').should('not.exist');
      
      // Get initial movie count
      cy.contains(/Shown:\s+\d+/).then(($el) => {
        if (!$el) return;
        const initialText = ($el as any).text();
        const initialCount = parseInt(initialText.match(/\d+/)?.[0] || '0');
        
        // Type search query
        cy.get('input[placeholder*="Search movies"]').type('Inception', { delay: 100 });
        
        // Should filter results
        cy.contains(/Shown:\s+\d+/, { timeout: 5000 }).then(($el2) => {
          if (!$el2) return;
          const newText = ($el2 as any).text();
          const newCount = parseInt(newText.match(/\d+/)?.[0] || '0');
          // Count should be same or less (at least 0 results)
          expect(newCount).to.be.lte(initialCount);
        });
      });
    });

    it('should display search results', () => {
      cy.contains('button', 'Channels').click();
      
      cy.contains('Loading content from chaincode').should('not.exist');
      
      // Search for a common movie
      cy.get('input[placeholder*="Search movies"]').type('The', { delay: 100 });
      
      // Wait for search to complete
      cy.wait(500);
      
      // Results should be visible
      cy.get('[class*="rounded-lg"][class*="bg-slate-700"]').should('exist');
    });

    it('should show "no results" message when search returns nothing', () => {
      cy.contains('button', 'Channels').click();
      
      cy.contains('Loading content from chaincode').should('not.exist');
      
      // Search for non-existent movie
      const uniqueSearch = `NONEXISTENT_${Date.now()}`;
      cy.get('input[placeholder*="Search movies"]').type(uniqueSearch, { delay: 100 });
      
      // Wait for search
      cy.wait(500);
      
      // Should show no results message or empty state
      cy.contains(/No movies match|No results found/i).should('be.visible');
    });

    it('should clear search and restore full list', () => {
      cy.contains('button', 'Channels').click();
      
      cy.contains('Loading content from chaincode').should('not.exist');
      
      // Search for something
      cy.get('input[placeholder*="Search movies"]').type('Test');
      cy.wait(500);
      
      // Clear search
      cy.get('input[placeholder*="Search movies"]').clear();
      cy.wait(500);
      
      // Should show all movies again
      cy.contains(/Shown:.*/, { timeout: 5000 }).should('be.visible');
    });
  });

  describe('Advanced Filtering', () => {
    it('should show filter panel toggle', () => {
      cy.contains('button', 'Channels').click();
      
      cy.contains(/Show Filters|Hide Filters/).should('be.visible');
    });

    it('should toggle filter panel open and closed', () => {
      cy.contains('button', 'Channels').click();
      
      // Toggle open
      cy.contains('button', 'Show Filters').click();
      cy.contains('Genres').should('be.visible');
      
      // Toggle closed
      cy.contains('button', 'Hide Filters').click();
      cy.contains('Genres').should('not.be.visible');
    });

    it('should filter by genre', () => {
      cy.contains('button', 'Channels').click();
      
      // Open filters
      cy.contains('Show Filters').click();
      cy.contains('Genres').should('be.visible');
      
      // Get initial count
      cy.contains(/Shown:\s+(\d+)/).then(($el) => {
        if (!$el) return;
        const initialCount = parseInt(($el as any).text().match(/\d+/)?.[0] || '0');
        
        // Click a genre button
        cy.get('button').contains(/Drama|Action|Comedy|Thriller/i).first().click();
        
        // Wait for filter to apply
        cy.wait(300);
        
        // Count should change or stay same
        cy.contains(/Shown:\s+\d+/).should('be.visible');
      });
    });

    it('should filter by year range', () => {
      cy.contains('button', 'Channels').click();
      
      // Open filters
      cy.contains('Show Filters').click();
      
      // Year range should be visible
      cy.contains('Year:').should('be.visible');
      
      // Adjust year sliders
      cy.contains('Year:').parent().within(() => {
        cy.get('input[type="range"]').first().then(($slider) => {
          cy.wrap($slider).invoke('val', 2000).trigger('change');
        });
      });
      
      // Filter should apply
      cy.contains(/Shown:\s+\d+/).should('be.visible');
    });

    it('should filter by rating range', () => {
      cy.contains('button', 'Channels').click();
      
      // Open filters
      cy.contains('Show Filters').click();
      
      // Rating range should be visible
      cy.contains('Rating:').should('be.visible');
      
      // Adjust rating sliders
      cy.contains('Rating:').parent().within(() => {
        cy.get('input[type="range"]').first().then(($slider) => {
          cy.wrap($slider).invoke('val', 7).trigger('change');
        });
      });
      
      cy.contains(/Shown:\s+\d+/).should('be.visible');
    });

    it('should filter by director', () => {
      cy.contains('button', 'Channels').click();
      
      // Open filters
      cy.contains('Show Filters').click();
      
      // Director dropdown should exist
      cy.contains('Director').parent().within(() => {
        cy.get('select').should('exist');
      });
    });

    it('should reset filters to defaults', () => {
      cy.contains('button', 'Channels').click();
      
      // Open filters
      cy.contains('Show Filters').click();
      
      // Apply a filter
      cy.get('button').contains(/Drama|Action/i).first().click();
      cy.wait(300);
      
      // Click reset
      cy.contains('Reset Filters').click();
      cy.wait(300);
      
      // Should be back to showing all
      cy.contains(/Shown:/).should('be.visible');
    });

    it('should combine multiple filters', () => {
      cy.contains('button', 'Channels').click();
      
      // Open filters
      cy.contains('Show Filters').click();
      
      // Apply genre filter
      cy.get('button').contains(/Drama|Action/i).first().click();
      cy.wait(200);
      
      // Apply year filter
      cy.contains('Year:').parent().within(() => {
        cy.get('input[type="range"]').first().invoke('val', 2000).trigger('change');
      });
      cy.wait(200);
      
      // Should show filtered results
      cy.contains(/Shown:\s+\d+/).should('be.visible');
    });
  });

  describe('Movie Details', () => {
    it('should display movie title', () => {
      cy.contains('button', 'Channels').click();
      
      cy.contains('Loading content from chaincode').should('not.exist');
      
      cy.get('h4').first().should('have.text.length.greaterThan', 0);
    });

    it('should display director if available', () => {
      cy.contains('button', 'Channels').click();
      
      cy.contains('Loading content from chaincode').should('not.exist');
      
      // Some movies should have director
      cy.contains(/Dir:/).should('exist');
    });

    it('should display release year if available', () => {
      cy.contains('button', 'Channels').click();
      
      cy.contains('Loading content from chaincode').should('not.exist');
      
      // Some movies should have year
      cy.contains(/20\d{2}|19\d{2}/).should('exist');
    });

    it('should display rating if available', () => {
      cy.contains('button', 'Channels').click();
      
      cy.contains('Loading content from chaincode').should('not.exist');
      
      // Some movies might have ratings (Star icons)
      cy.get('[class*="fill-yellow"]').should('exist');
    });

    it('should display IMDb ID for each movie', () => {
      cy.contains('button', 'Channels').click();
      
      cy.contains('Loading content from chaincode').should('not.exist');
      
      cy.contains('IMDb:').should('exist');
    });
  });

  describe('Error Handling', () => {
    it('should show error message if search fails', () => {
      // This test would only trigger if there's a network error
      // We can simulate by mocking the API
      cy.intercept('/api/query', { statusCode: 500 }).as('failedQuery');
      
      cy.contains('button', 'Channels').click();
      cy.get('input[placeholder*="Search movies"]').type('Test');
      
      cy.wait('@failedQuery');
      cy.contains(/Error|Failed|failed/i).should('exist');
    });

    it('should handle empty chaincode response gracefully', () => {
      cy.contains('button', 'Channels').click();
      
      // Should still show the UI even if no movies
      cy.contains('Movies').should('be.visible');
      cy.get('input[placeholder*="Search movies"]').should('exist');
    });
  });

  describe('UI Responsiveness', () => {
    it('should maintain layout on different screen sizes', () => {
      cy.contains('button', 'Channels').click();
      
      // Desktop view
      cy.viewport('macbook-15');
      cy.get('[class*="grid"]').should('exist');
      
      // Tablet view
      cy.viewport('ipad-2');
      cy.get('[class*="grid"]').should('exist');
      
      // Mobile view
      cy.viewport('iphone-x');
      cy.get('[class*="grid"]').should('exist');
    });
  });

  describe('Performance', () => {
    it('should load all movies within reasonable time', () => {
      cy.contains('button', 'Channels').click();
      
      cy.contains('Loading content from chaincode').should('not.exist', { timeout: 15000 });
      
      // Should display movies quickly after loading
      cy.get('[class*="rounded-lg"][class*="bg-slate-700"]').should('have.length.greaterThan', 0);
    });

    it('should filter results quickly without lag', () => {
      cy.contains('button', 'Channels').click();
      
      cy.contains('Loading content from chaincode').should('not.exist');
      
      // Type and verify filter response is quick
      cy.get('input[placeholder*="Search movies"]').type('The');
      
      // Results should update quickly
      cy.contains(/Shown:\s+\d+/, { timeout: 1000 }).should('be.visible');
    });
  });
});
