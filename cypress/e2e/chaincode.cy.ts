/**
 * Chaincode Integration E2E Tests
 * 
 * Tests for Movie Chaincode integration via Kaleido:
 * - QueryAll: Retrieve all approved movies from ledger
 * - SubmitContentRequest: Submit new movie content for review
 * - ApproveContentRequest: Admin approves pending requests
 * - SearchByTitle: Find movies by title
 * - GetRequestHistory: View audit trail of submissions
 */

describe('Chaincode Integration - Movie Channel', () => {
  const NETWORK_TIMEOUT = 10000;
  const CHANNEL_ID = 'movies';
  const CHAINCODE_ID = 'movie-chaincode';

  // Mock responses for testing without live Kaleido
  const mockMovies = [
    {
      imdb_id: 'tt1375666',
      title: 'Inception',
      director: 'Christopher Nolan',
      release_year: 2010,
      genres: ['Science Fiction', 'Thriller'],
      description: 'A skilled thief who steals corporate secrets through dream-sharing technology',
      torrent_hash: 'Qm1234567890',
      views: 1250,
      average_rating: 8.8,
      doc_type: 'Movie'
    },
    {
      imdb_id: 'tt0468569',
      title: 'The Dark Knight',
      director: 'Christopher Nolan',
      release_year: 2008,
      genres: ['Crime', 'Drama', 'Action'],
      description: 'When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest tests',
      torrent_hash: 'Qm0987654321',
      views: 2100,
      average_rating: 9.0,
      doc_type: 'Movie'
    }
  ];

  const mockContentRequest = {
    imdb_id: 'tt0111161',
    request_id: '12345678-1234-1234-1234-123456789012',
    title: 'The Shawshank Redemption',
    director: 'Frank Darabont',
    release_year: 1994,
    genres: ['Drama'],
    description: 'Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency',
    submitter_id: 'user1',
    notes: 'Classic film that deserves to be in the catalog',
    torrent_hash: 'QmShawshank123',
    status: 'pending_review',
    submitted_at: new Date().toISOString(),
    doc_type: 'ContentRequest',
    version: 1
  };

  beforeEach(() => {
    // Reset and visit the app
    cy.visit('http://localhost:3000');
    
    // Mock localStorage for app state
    cy.window().then((win) => {
      win.localStorage.setItem('app-store', JSON.stringify({
        connected: true,
        setConnected: () => {},
      }));
    });
  });

  describe('QueryAll - Retrieve All Movies', () => {
    it('should load and display all movies from chaincode', () => {
      // Intercept the chaincode query request
      cy.intercept('POST', '**/channels/movies/**', {
        statusCode: 200,
        body: {
          success: true,
          data: mockMovies,
          message: 'Operation successful'
        }
      }).as('queryAll');

      // Navigate to channel browser
      cy.get('button').contains('ChannelBrowser').click({ force: true }).then(() => {
        // Select movies channel
        cy.contains('button', 'movies', { timeout: NETWORK_TIMEOUT }).click();
        
        // Wait for query
        cy.wait('@queryAll', { timeout: NETWORK_TIMEOUT });

        // Verify movies are displayed
        cy.contains('Inception').should('be.visible');
        cy.contains('The Dark Knight').should('be.visible');
        
        // Verify movie details
        cy.contains('Christopher Nolan').should('be.visible');
        cy.contains('2010').should('be.visible');
        cy.contains('Science Fiction').should('be.visible');
      });
    });

    it('should display loading state while fetching movies', () => {
      cy.intercept('POST', '**/channels/movies/**', (req) => {
        req.reply((res) => {
          // Delay response to see loading state
          setTimeout(() => {
            res.send({
              statusCode: 200,
              body: { success: true, data: mockMovies }
            });
          }, 500);
        });
      }).as('queryAllDelayed');

      cy.get('button').contains('ChannelBrowser').click({ force: true }).then(() => {
        cy.contains('button', 'movies').click();
        
        // Check for loading message
        cy.contains('Loading content from chaincode...', { timeout: NETWORK_TIMEOUT })
          .should('be.visible');
        
        // Wait and verify movies appear
        cy.wait('@queryAllDelayed', { timeout: NETWORK_TIMEOUT });
        cy.contains('Inception', { timeout: NETWORK_TIMEOUT }).should('be.visible');
      });
    });

    it('should handle empty movie list gracefully', () => {
      cy.intercept('POST', '**/channels/movies/**', {
        statusCode: 200,
        body: { success: true, data: [] }
      }).as('queryAllEmpty');

      cy.get('button').contains('ChannelBrowser').click({ force: true }).then(() => {
        cy.contains('button', 'movies').click();
        cy.wait('@queryAllEmpty', { timeout: NETWORK_TIMEOUT });

        cy.contains('No content available in this channel')
          .should('be.visible');
      });
    });

    it('should handle chaincode query errors', () => {
      cy.intercept('POST', '**/channels/movies/**', {
        statusCode: 500,
        body: { error: 'Chaincode query failed' }
      }).as('queryAllError');

      cy.get('button').contains('ChannelBrowser').click({ force: true }).then(() => {
        cy.contains('button', 'movies').click();
        cy.wait('@queryAllError', { timeout: NETWORK_TIMEOUT });

        // Should show error message
        cy.contains(/failed|error/i, { timeout: NETWORK_TIMEOUT })
          .should('be.visible');
      });
    });
  });

  describe('SearchByTitle - Find Movies by Title', () => {
    beforeEach(() => {
      // Set up initial movies query
      cy.intercept('POST', '**/channels/movies/**', (req) => {
        if (req.body.function === 'SearchByTitle') {
          const results = mockMovies.filter(m => 
            m.title.toLowerCase().includes('dark')
          );
          req.reply({
            statusCode: 200,
            body: { success: true, data: results }
          });
        } else {
          req.reply({
            statusCode: 200,
            body: { success: true, data: mockMovies }
          });
        }
      }).as('chaincodeQuery');
    });

    it('should search and filter movies by title', () => {
      cy.get('button').contains('ChannelBrowser').click({ force: true }).then(() => {
        cy.contains('button', 'movies').click();
        cy.wait('@chaincodeQuery');

        // Type in search box
        cy.get('input[placeholder*="Search"]').type('Dark');
        cy.wait('@chaincodeQuery', { timeout: NETWORK_TIMEOUT });

        // Verify search results
        cy.contains('The Dark Knight').should('be.visible');
        cy.contains('Inception').should('not.be.visible');
      });
    });

    it('should display "no results" for non-matching search', () => {
      cy.get('button').contains('ChannelBrowser').click({ force: true }).then(() => {
        cy.contains('button', 'movies').click();
        cy.wait('@chaincodeQuery');

        cy.get('input[placeholder*="Search"]').type('NonexistentMovie');
        
        cy.contains(/no results found/i, { timeout: NETWORK_TIMEOUT })
          .should('be.visible');
      });
    });

    it('should show searching state while query is in flight', () => {
      cy.intercept('POST', '**/channels/movies/**', (req) => {
        if (req.body.function === 'SearchByTitle') {
          req.reply((res) => {
            setTimeout(() => {
              res.send({
                statusCode: 200,
                body: { success: true, data: [] }
              });
            }, 800);
          });
        } else {
          req.reply({ statusCode: 200, body: { success: true, data: mockMovies } });
        }
      }).as('searchDelayed');

      cy.get('button').contains('ChannelBrowser').click({ force: true }).then(() => {
        cy.contains('button', 'movies').click();
        cy.wait('@searchDelayed');

        cy.get('input[placeholder*="Search"]').type('Test');
        cy.contains('Searching...', { timeout: NETWORK_TIMEOUT })
          .should('be.visible');
      });
    });

    it('should clear search and refresh on refresh button click', () => {
      cy.get('button').contains('ChannelBrowser').click({ force: true }).then(() => {
        cy.contains('button', 'movies').click();
        cy.wait('@chaincodeQuery');

        // Search for something
        cy.get('input[placeholder*="Search"]').type('Dark');
        cy.wait('@chaincodeQuery');

        // Click refresh button
        cy.get('button[title="Refresh content"]').click();
        cy.wait('@chaincodeQuery', { timeout: NETWORK_TIMEOUT });

        // Search should be cleared
        cy.get('input[placeholder*="Search"]').should('have.value', '');
        
        // All movies should be shown again
        cy.contains('Inception', { timeout: NETWORK_TIMEOUT })
          .should('be.visible');
      });
    });
  });

  describe('SubmitContentRequest - Submit Movie for Review', () => {
    it('should submit a content request with all required fields', () => {
      cy.intercept('POST', '**/channels/movies/**', (req) => {
        if (req.body.function === 'SubmitContentRequest') {
          req.reply({
            statusCode: 200,
            body: {
              success: true,
              data: mockContentRequest,
              message: 'Content request submitted successfully'
            }
          });
        } else {
          req.reply({ statusCode: 200, body: { success: true, data: mockMovies } });
        }
      }).as('submitRequest');

      // Navigate to submission form (assuming there's a component for this)
      cy.visit('http://localhost:3000');
      
      // Intercept the submission
      cy.get('button').contains('Submit').click({ force: true }).then(() => {
        // Fill in form fields
        cy.get('input[name="imdb_id"]').type('tt0111161');
        cy.get('input[name="title"]').type('The Shawshank Redemption');
        cy.get('input[name="director"]').type('Frank Darabont');
        cy.get('input[name="year"]').type('1994');
        cy.get('textarea[name="description"]').type('Two imprisoned men bond over years');
        cy.get('input[name="torrent_hash"]').type('QmShawshank123');

        // Submit
        cy.get('button').contains('Submit Request').click();
        
        cy.wait('@submitRequest', { timeout: NETWORK_TIMEOUT });
        
        // Verify success message
        cy.contains(/submitted|success/i, { timeout: NETWORK_TIMEOUT })
          .should('be.visible');
      });
    });

    it('should validate IMDb ID format', () => {
      cy.visit('http://localhost:3000');
      
      cy.get('button').contains('Submit').click({ force: true }).then(() => {
        // Enter invalid IMDb ID
        cy.get('input[name="imdb_id"]').type('invalid-id');
        cy.get('button').contains('Submit Request').click();

        // Should show validation error
        cy.contains(/invalid.*imdb|format/i, { timeout: NETWORK_TIMEOUT })
          .should('be.visible');
      });
    });

    it('should require title field', () => {
      cy.visit('http://localhost:3000');
      
      cy.get('button').contains('Submit').click({ force: true }).then(() => {
        cy.get('input[name="imdb_id"]').type('tt0111161');
        // Skip title
        cy.get('button').contains('Submit Request').click();

        cy.contains(/title.*required/i, { timeout: NETWORK_TIMEOUT })
          .should('be.visible');
      });
    });

    it('should allow optional torrent_hash field', () => {
      cy.intercept('POST', '**/channels/movies/**', (req) => {
        if (req.body.function === 'SubmitContentRequest') {
          req.reply({
            statusCode: 200,
            body: {
              success: true,
              data: { ...mockContentRequest, torrent_hash: '' }
            }
          });
        } else {
          req.reply({ statusCode: 200, body: { success: true, data: mockMovies } });
        }
      }).as('submitRequestNoHash');

      cy.visit('http://localhost:3000');
      
      cy.get('button').contains('Submit').click({ force: true }).then(() => {
        cy.get('input[name="imdb_id"]').type('tt0111161');
        cy.get('input[name="title"]').type('The Shawshank Redemption');
        // Leave torrent_hash empty
        cy.get('button').contains('Submit Request').click();

        cy.wait('@submitRequestNoHash', { timeout: NETWORK_TIMEOUT });
        cy.contains(/success|submitted/i, { timeout: NETWORK_TIMEOUT })
          .should('be.visible');
      });
    });
  });

  describe('ApproveContentRequest - Admin Approval Workflow', () => {
    it('should approve a pending content request', () => {
      cy.intercept('POST', '**/channels/movies/**', (req) => {
        if (req.body.function === 'ApproveContentRequest') {
          req.reply({
            statusCode: 200,
            body: {
              success: true,
              data: {
                ...mockContentRequest,
                status: 'approved'
              },
              message: 'Content approved and added to catalog'
            }
          });
        } else {
          req.reply({ statusCode: 200, body: { success: true, data: [] } });
        }
      }).as('approveRequest');

      cy.visit('http://localhost:3000');
      
      // Navigate to admin panel (assuming there's one)
      cy.get('button').contains('Admin Panel').click({ force: true }).then(() => {
        cy.get('button').contains('Approve').first().click();

        cy.wait('@approveRequest', { timeout: NETWORK_TIMEOUT });
        
        cy.contains(/approved|success/i, { timeout: NETWORK_TIMEOUT })
          .should('be.visible');
      });
    });

    it('should prevent duplicate IMDb ID submissions', () => {
      cy.intercept('POST', '**/channels/movies/**', (req) => {
        if (req.body.function === 'SubmitContentRequest') {
          // Simulate duplicate error
          req.reply({
            statusCode: 400,
            body: {
              success: false,
              error: 'Movie with IMDb ID tt1375666 has already been submitted or approved',
              code: 'duplicate'
            }
          });
        }
      }).as('duplicateError');

      cy.visit('http://localhost:3000');
      
      cy.get('button').contains('Submit').click({ force: true }).then(() => {
        // Try to submit an already-existing movie
        cy.get('input[name="imdb_id"]').type('tt1375666');
        cy.get('input[name="title"]').type('Inception');
        cy.get('button').contains('Submit Request').click();

        cy.wait('@duplicateError', { timeout: NETWORK_TIMEOUT });
        
        cy.contains(/already.*submitted|duplicate/i, { timeout: NETWORK_TIMEOUT })
          .should('be.visible');
      });
    });
  });

  describe('GetRequestHistory - Audit Trail', () => {
    it('should display request history for a movie', () => {
      const history = [
        {
          txid: 'txn-001',
          timestamp: new Date().toISOString(),
          action: 'SUBMIT',
          actor: 'user1',
          details: mockContentRequest
        },
        {
          txid: 'txn-002',
          timestamp: new Date().toISOString(),
          action: 'REVIEW',
          actor: 'admin1',
          details: { status: 'pending_review' }
        }
      ];

      cy.intercept('POST', '**/channels/movies/**', (req) => {
        if (req.body.function === 'GetRequestHistory') {
          req.reply({
            statusCode: 200,
            body: { success: true, data: history }
          });
        }
      }).as('getHistory');

      cy.visit('http://localhost:3000');
      
      cy.get('button').contains('History').click({ force: true }).then(() => {
        cy.wait('@getHistory', { timeout: NETWORK_TIMEOUT });

        // Verify history items
        cy.contains('SUBMIT').should('be.visible');
        cy.contains('REVIEW').should('be.visible');
        cy.contains('user1').should('be.visible');
        cy.contains('admin1').should('be.visible');
      });
    });
  });

  describe('Network Error Handling', () => {
    it('should handle connection timeouts gracefully', () => {
      cy.intercept('POST', '**/channels/movies/**', {
        statusCode: 408,
        body: { error: 'Request timeout' }
      }).as('timeout');

      cy.get('button').contains('ChannelBrowser').click({ force: true }).then(() => {
        cy.contains('button', 'movies').click();
        cy.wait('@timeout', { timeout: NETWORK_TIMEOUT });
        
        cy.contains(/timeout|connection.*failed/i, { timeout: NETWORK_TIMEOUT })
          .should('be.visible');
      });
    });

    it('should display friendly error messages for chaincode failures', () => {
      cy.intercept('POST', '**/channels/movies/**', {
        statusCode: 500,
        body: {
          success: false,
          error: 'Chaincode execution failed: invalid argument'
        }
      }).as('chaincodeError');

      cy.get('button').contains('ChannelBrowser').click({ force: true }).then(() => {
        cy.contains('button', 'movies').click();
        cy.wait('@chaincodeError', { timeout: NETWORK_TIMEOUT });

        cy.contains(/chaincode.*failed|execution.*error/i, { timeout: NETWORK_TIMEOUT })
          .should('be.visible');
      });
    });
  });

  describe('Movie Metadata Display', () => {
    it('should display all movie metadata fields', () => {
      cy.intercept('POST', '**/channels/movies/**', {
        statusCode: 200,
        body: { success: true, data: mockMovies }
      }).as('queryAll');

      cy.get('button').contains('ChannelBrowser').click({ force: true }).then(() => {
        cy.contains('button', 'movies').click();
        cy.wait('@queryAll', { timeout: NETWORK_TIMEOUT });

        // Verify metadata display
        cy.contains('Inception').should('be.visible');
        cy.contains('Christopher Nolan').should('be.visible');
        cy.contains('2010').should('be.visible');
        cy.contains('Science Fiction').should('be.visible');
        cy.contains('8.8').should('be.visible'); // Rating
        cy.contains('1250').should('be.visible'); // Views
      });
    });

    it('should display torrent hash information', () => {
      cy.intercept('POST', '**/channels/movies/**', {
        statusCode: 200,
        body: { success: true, data: mockMovies }
      }).as('queryAll');

      cy.get('button').contains('ChannelBrowser').click({ force: true }).then(() => {
        cy.contains('button', 'movies').click();
        cy.wait('@queryAll', { timeout: NETWORK_TIMEOUT });

        // Verify torrent hash display
        cy.contains('Qm1234567890').should('be.visible');
      });
    });
  });
});
