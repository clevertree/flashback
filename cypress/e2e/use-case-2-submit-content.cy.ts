/**
 * UI E2E Test Suite - Content Submission Use Case
 * 
 * Tests the complete workflow for submitting missing movies
 * through the web UI to the live Kaleido network
 */

/// <reference types="cypress" />

describe('Use Case 2: Submit Missing Content', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.get('header', { timeout: 10000 }).should('be.visible');
  });

  describe('Submission Modal', () => {
    it('should open submission modal when Submit button is clicked', () => {
      cy.contains('button', 'Channels').click();
      
      cy.contains('Loading content from chaincode').should('not.exist');
      
      // Click Submit button
      cy.get('button').contains('Submit').click();
      
      // Modal should appear
      cy.contains('Submit Missing Movie').should('be.visible');
      cy.contains('IMDb ID').should('be.visible');
      cy.contains('Movie Title').should('be.visible');
    });

    it('should close modal when X button is clicked', () => {
      cy.contains('button', 'Channels').click();
      cy.get('button').contains('Submit').click();
      
      cy.contains('Submit Missing Movie').should('be.visible');
      
      // Click close button (X)
      cy.get('button').within(() => {
        cy.get('svg').click();
      });
      
      cy.contains('Submit Missing Movie').should('not.exist');
    });

    it('should close modal when Cancel button is clicked', () => {
      cy.contains('button', 'Channels').click();
      cy.get('button').contains('Submit').click();
      
      cy.contains('Submit Missing Movie').should('be.visible');
      
      // Click Cancel
      cy.contains('button', 'Cancel').click();
      
      cy.contains('Submit Missing Movie').should('not.exist');
    });
  });

  describe('Form Validation', () => {
    beforeEach(() => {
      cy.contains('button', 'Channels').click();
      cy.contains('Loading content from chaincode').should('not.exist');
      cy.get('button').contains('Submit').click();
      cy.contains('Submit Missing Movie').should('be.visible');
    });

    it('should require IMDb ID', () => {
      // Try to submit without IMDb ID
      cy.contains('button', 'Submit Movie').click();
      
      // Should show error
      cy.contains(/IMDb ID is required|Invalid IMDb ID/i).should('be.visible');
    });

    it('should validate IMDb ID format', () => {
      cy.get('input[placeholder*="tt0111161"]').type('invalid-id');
      
      cy.contains('button', 'Submit Movie').click();
      
      // Should show format error
      cy.contains(/Invalid IMDb ID format|tt followed by/i).should('be.visible');
    });

    it('should require movie title', () => {
      // Enter IMDb ID but not title
      cy.get('input[placeholder*="tt0111161"]').type('tt1234567');
      
      cy.contains('button', 'Submit Movie').click();
      
      // Should show error
      cy.contains(/Movie Title is required|title is required/i).should('be.visible');
    });

    it('should validate year format if provided', () => {
      cy.get('input[placeholder*="tt0111161"]').type('tt1234567');
      cy.get('input[placeholder*="The Shawshank"]').type('Test Movie');
      cy.get('input[placeholder*="1994"]').type('20XX');
      
      cy.contains('button', 'Submit Movie').click();
      
      // Should show year error
      cy.contains(/Release year must be|4-digit number/i).should('be.visible');
    });

    it('should accept valid form data', () => {
      const imdbId = `tt${Math.floor(Math.random() * 10000000)}`;
      
      cy.get('input[placeholder*="tt0111161"]').type(imdbId);
      cy.get('input[placeholder*="The Shawshank"]').type('Test Movie E2E');
      cy.get('input[placeholder*="Frank Darabont"]').type('Test Director');
      cy.get('input[placeholder*="1994"]').type('2024');
      
      // Form should be valid (no errors shown)
      cy.contains(/IMDb ID is required|Movie Title is required/).should('not.exist');
    });
  });

  describe('Form Submission', () => {
    beforeEach(() => {
      cy.contains('button', 'Channels').click();
      cy.contains('Loading content from chaincode').should('not.exist');
      cy.get('button').contains('Submit').click();
      cy.contains('Submit Missing Movie').should('be.visible');
    });

    it('should submit minimal movie data', () => {
      const imdbId = `tt${Date.now() % 10000000}`;
      
      cy.get('input[placeholder*="tt0111161"]').type(imdbId);
      cy.get('input[placeholder*="The Shawshank"]').type('Test Movie Minimal');
      
      cy.contains('button', 'Submit Movie').click();
      
      // Should show success message or close modal
      cy.contains(/successful|submitted|Thank you/, { timeout: 10000 }).should('exist');
    });

    it('should submit complete movie data', () => {
      const imdbId = `tt${Date.now() % 10000000}`;
      
      cy.get('input[placeholder*="tt0111161"]').type(imdbId);
      cy.get('input[placeholder*="The Shawshank"]').type('Test Movie Complete');
      cy.get('input[placeholder*="Frank Darabont"]').type('Complete Director');
      cy.get('input[placeholder*="1994"]').type('2023');
      cy.get('input[placeholder*="Drama,Crime"]').type('Drama,Thriller,Crime');
      cy.get('textarea[placeholder*="Brief description"]').type('This is a test movie description for E2E testing');
      cy.get('input[placeholder*="Why should"]').type('This is a great movie');
      
      cy.contains('button', 'Submit Movie').click();
      
      // Should show success
      cy.contains(/successful|submitted|Thank you/, { timeout: 10000 }).should('exist');
    });

    it('should show loading state while submitting', () => {
      const imdbId = `tt${Date.now() % 10000000}`;
      
      cy.get('input[placeholder*="tt0111161"]').type(imdbId);
      cy.get('input[placeholder*="The Shawshank"]').type('Test Movie Loading');
      
      cy.contains('button', 'Submit Movie').click();
      
      // Should show submitting state
      cy.contains('Submitting...', { timeout: 5000 }).should('exist');
    });

    it('should show success message after submission', () => {
      const imdbId = `tt${Date.now() % 10000000}`;
      
      cy.get('input[placeholder*="tt0111161"]').type(imdbId);
      cy.get('input[placeholder*="The Shawshank"]').type('Test Movie Success');
      
      cy.contains('button', 'Submit Movie').click();
      
      // Should show success
      cy.contains(/successful|submitted|Thank you/, { timeout: 10000 }).should('exist');
      cy.get('[class*="bg-green"]').should('be.visible');
    });

    it('should auto-close modal after successful submission', () => {
      const imdbId = `tt${Date.now() % 10000000}`;
      
      cy.get('input[placeholder*="tt0111161"]').type(imdbId);
      cy.get('input[placeholder*="The Shawshank"]').type('Test Movie AutoClose');
      
      cy.contains('button', 'Submit Movie').click();
      
      // Modal should close after success
      cy.contains('Submit Missing Movie', { timeout: 5000 }).should('not.exist');
    });
  });

  describe('Optional Fields', () => {
    beforeEach(() => {
      cy.contains('button', 'Channels').click();
      cy.contains('Loading content from chaincode').should('not.exist');
      cy.get('button').contains('Submit').click();
    });

    it('should accept director field', () => {
      const imdbId = `tt${Date.now() % 10000000}`;
      
      cy.get('input[placeholder*="tt0111161"]').type(imdbId);
      cy.get('input[placeholder*="The Shawshank"]').type('Test Movie');
      cy.get('input[placeholder*="Frank Darabont"]').type('Frank Darabont');
      
      // Should accept and allow submission
      cy.contains('button', 'Submit Movie').should('not.be.disabled');
    });

    it('should accept release year field', () => {
      const imdbId = `tt${Date.now() % 10000000}`;
      
      cy.get('input[placeholder*="tt0111161"]').type(imdbId);
      cy.get('input[placeholder*="The Shawshank"]').type('Test Movie');
      cy.get('input[placeholder*="1994"]').type('2024');
      
      cy.contains('button', 'Submit Movie').should('not.be.disabled');
    });

    it('should accept genres field (comma-separated)', () => {
      const imdbId = `tt${Date.now() % 10000000}`;
      
      cy.get('input[placeholder*="tt0111161"]').type(imdbId);
      cy.get('input[placeholder*="The Shawshank"]').type('Test Movie');
      cy.get('input[placeholder*="Drama,Crime"]').type('Drama,Thriller,Action');
      
      cy.contains('button', 'Submit Movie').should('not.be.disabled');
    });

    it('should accept description field', () => {
      const imdbId = `tt${Date.now() % 10000000}`;
      
      cy.get('input[placeholder*="tt0111161"]').type(imdbId);
      cy.get('input[placeholder*="The Shawshank"]').type('Test Movie');
      cy.get('textarea[placeholder*="Brief description"]').type('A long description of the movie');
      
      cy.contains('button', 'Submit Movie').should('not.be.disabled');
    });

    it('should accept reason field', () => {
      const imdbId = `tt${Date.now() % 10000000}`;
      
      cy.get('input[placeholder*="tt0111161"]').type(imdbId);
      cy.get('input[placeholder*="The Shawshank"]').type('Test Movie');
      cy.get('input[placeholder*="Why should"]').type('This movie is important');
      
      cy.contains('button', 'Submit Movie').should('not.be.disabled');
    });
  });

  describe('Form State', () => {
    beforeEach(() => {
      cy.contains('button', 'Channels').click();
      cy.get('button').contains('Submit').click();
      cy.contains('Submit Missing Movie').should('be.visible');
    });

    it('should clear form after successful submission', () => {
      const imdbId = `tt${Date.now() % 10000000}`;
      
      cy.get('input[placeholder*="tt0111161"]').type(imdbId);
      cy.get('input[placeholder*="The Shawshank"]').type('Test Movie Clear');
      
      cy.contains('button', 'Submit Movie').click();
      
      // Wait for success and modal to close
      cy.contains('Submit Missing Movie', { timeout: 5000 }).should('not.exist');
    });

    it('should disable submit button while submitting', () => {
      const imdbId = `tt${Date.now() % 10000000}`;
      
      cy.get('input[placeholder*="tt0111161"]').type(imdbId);
      cy.get('input[placeholder*="The Shawshank"]').type('Test Movie Disable');
      
      cy.contains('button', 'Submit Movie').click();
      
      // Button should be disabled during submission
      cy.contains('button', 'Submitting...').should('be.disabled');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      cy.contains('button', 'Channels').click();
      cy.get('button').contains('Submit').click();
    });

    it('should handle network errors gracefully', () => {
      // Mock failed API call
      cy.intercept('/api/**', { statusCode: 500 }).as('failedRequest');
      
      const imdbId = `tt${Date.now() % 10000000}`;
      
      cy.get('input[placeholder*="tt0111161"]').type(imdbId);
      cy.get('input[placeholder*="The Shawshank"]').type('Test Movie Error');
      
      cy.contains('button', 'Submit Movie').click();
      
      cy.wait('@failedRequest');
      cy.contains(/Error|Failed|failed/i).should('exist');
    });

    it('should show validation error for empty required fields', () => {
      cy.contains('button', 'Submit Movie').click();
      
      cy.contains(/required/i).should('exist');
    });
  });
});
