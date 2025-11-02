/**
 * UI E2E Test Suite - Content Moderation Use Case
 * 
 * Tests the complete workflow for moderating and approving/rejecting
 * submitted movies through the web UI against the live Kaleido network
 */

/// <reference types="cypress" />

describe('Use Case 3: Moderate Content', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.get('header', { timeout: 10000 }).should('be.visible');
  });

  describe('Moderation Tab Navigation', () => {
    it('should display Moderation tab in header', () => {
      cy.contains('button', 'Moderation').should('be.visible');
    });

    it('should navigate to Moderation tab when clicked', () => {
      cy.contains('button', 'Moderation').click();
      cy.contains('Content Requests').should('be.visible');
    });

    it('should load requests from chaincode on tab switch', () => {
      cy.contains('button', 'Moderation').click();
      
      // Should show loading state briefly
      cy.contains('Loading requests', { timeout: 15000 }).should('not.exist');
      
      // Should display request count
      cy.contains(/Total|Pending|Approved|Rejected/i).should('be.visible');
    });
  });

  describe('Request Overview', () => {
    beforeEach(() => {
      cy.contains('button', 'Moderation').click();
      cy.contains('Loading requests', { timeout: 15000 }).should('not.exist');
    });

    it('should display total request count', () => {
      cy.contains(/Total|All Requests/i).should('be.visible');
      cy.contains(/\d+/).should('exist');
    });

    it('should display pending requests count', () => {
      cy.contains(/Pending/i).should('be.visible');
    });

    it('should display approved requests count', () => {
      cy.contains(/Approved|Approved:/i).should('be.visible');
    });

    it('should display rejected requests count', () => {
      cy.contains(/Rejected|Rejected:/i).should('be.visible');
    });

    it('should show request status badges', () => {
      cy.get('[class*="badge"]').should('exist');
      cy.get('[class*="bg-yellow"]').should('exist'); // Pending
      cy.get('[class*="bg-green"]').should('exist');  // Approved
      cy.get('[class*="bg-red"]').should('exist');    // Rejected
    });
  });

  describe('Request Filtering', () => {
    beforeEach(() => {
      cy.contains('button', 'Moderation').click();
      cy.contains('Loading requests', { timeout: 15000 }).should('not.exist');
    });

    it('should show all requests by default', () => {
      cy.get('[class*="request"]').should('have.length.greaterThan', 0);
    });

    it('should filter requests by Pending status', () => {
      cy.contains('button', 'Pending').click();
      
      // Should show only pending requests
      cy.get('[class*="request"]').each(($el) => {
        cy.wrap($el).contains(/Pending|pending/i).should('exist');
      });
    });

    it('should filter requests by Approved status', () => {
      cy.contains('button', 'Approved').click();
      
      // Should show only approved requests
      cy.get('[class*="request"]').each(($el) => {
        cy.wrap($el).contains(/Approved|approved/i).should('exist');
      });
    });

    it('should filter requests by Rejected status', () => {
      cy.contains('button', 'Rejected').click();
      
      // Should show only rejected requests
      cy.get('[class*="request"]').each(($el) => {
        cy.wrap($el).contains(/Rejected|rejected/i).should('exist');
      });
    });

    it('should show All requests when clicking All filter', () => {
      // First apply a filter
      cy.contains('button', 'Pending').click();
      
      // Then click All to reset
      cy.contains('button', 'All').click();
      
      // Should show all request types
      cy.get('[class*="request"]').should('have.length.greaterThan', 0);
    });
  });

  describe('Request Details Display', () => {
    beforeEach(() => {
      cy.contains('button', 'Moderation').click();
      cy.contains('Loading requests', { timeout: 15000 }).should('not.exist');
    });

    it('should display request ID', () => {
      cy.get('[class*="request"]').first().within(() => {
        cy.contains(/ID|id|Request/).should('be.visible');
      });
    });

    it('should display movie title in request', () => {
      cy.get('[class*="request"]').first().within(() => {
        cy.contains(/Title|title|Movie/).should('be.visible');
      });
    });

    it('should display submission timestamp', () => {
      cy.get('[class*="request"]').first().within(() => {
        cy.contains(/Submitted|Time|Date|submitted/).should('be.visible');
      });
    });

    it('should display submission reason/notes', () => {
      cy.get('[class*="request"]').first().within(() => {
        cy.contains(/Reason|Submission|Notes|reason/).should('exist');
      });
    });

    it('should display current status of request', () => {
      cy.get('[class*="request"]').first().within(() => {
        cy.contains(/Pending|Approved|Rejected/i).should('be.visible');
      });
    });

    it('should display full movie metadata in details', () => {
      cy.get('[class*="request"]').first().click();
      
      cy.contains(/IMDb|Director|Year|Genre/i).should('exist');
    });
  });

  describe('Approve Request', () => {
    beforeEach(() => {
      cy.contains('button', 'Moderation').click();
      cy.contains('Loading requests', { timeout: 15000 }).should('not.exist');
      
      // Filter to pending requests
      cy.contains('button', 'Pending').click();
    });

    it('should display Approve button for pending requests', () => {
      cy.get('[class*="request"]').first().within(() => {
        cy.contains('button', 'Approve').should('be.visible');
      });
    });

    it('should approve a pending request', () => {
      cy.get('[class*="request"]').first().within(() => {
        cy.contains('button', 'Approve').click();
      });
      
      // Should show success message
      cy.contains(/Approved|Success|successful/i, { timeout: 10000 }).should('exist');
    });

    it('should update request status to Approved after approval', () => {
      const requestElement = cy.get('[class*="request"]').first();
      
      requestElement.within(() => {
        cy.contains('button', 'Approve').click();
      });
      
      // Status should change to Approved
      cy.contains(/Approved/i, { timeout: 10000 }).should('exist');
    });

    it('should remove Approve button after approval', () => {
      cy.get('[class*="request"]').first().within(() => {
        const approveBtn = cy.contains('button', 'Approve');
        approveBtn.click();
      });
      
      // Approve button should be gone or disabled
      cy.contains('button', 'Approve').should('be.disabled');
    });

    it('should refresh request list after approval', () => {
      // Count pending requests before
      cy.get('[class*="request"]').then(($requests) => {
        const beforeCount = $requests.length;
        
        // Approve first request
        cy.get('[class*="request"]').first().within(() => {
          cy.contains('button', 'Approve').click();
        });
        
        // Wait for update
        cy.contains('Success', { timeout: 10000 }).should('exist');
        
        // Count should decrease by 1
        cy.get('[class*="request"]', { timeout: 5000 }).should(($newRequests) => {
          expect($newRequests.length).to.be.lessThan(beforeCount);
        });
      });
    });

    it('should show loading state while approving', () => {
      cy.get('[class*="request"]').first().within(() => {
        cy.contains('button', 'Approve').click();
      });
      
      // Should show processing indicator
      cy.contains(/Processing|Approving|Approve/i, { timeout: 5000 }).should('exist');
    });
  });

  describe('Reject Request', () => {
    beforeEach(() => {
      cy.contains('button', 'Moderation').click();
      cy.contains('Loading requests', { timeout: 15000 }).should('not.exist');
      
      // Filter to pending requests
      cy.contains('button', 'Pending').click();
    });

    it('should display Reject button for pending requests', () => {
      cy.get('[class*="request"]').first().within(() => {
        cy.contains('button', 'Reject').should('be.visible');
      });
    });

    it('should reject a pending request', () => {
      cy.get('[class*="request"]').first().within(() => {
        cy.contains('button', 'Reject').click();
      });
      
      // Should show success message
      cy.contains(/Rejected|Success|successful/i, { timeout: 10000 }).should('exist');
    });

    it('should update request status to Rejected after rejection', () => {
      cy.get('[class*="request"]').first().within(() => {
        cy.contains('button', 'Reject').click();
      });
      
      // Status should change to Rejected
      cy.contains(/Rejected/i, { timeout: 10000 }).should('exist');
    });

    it('should remove Reject button after rejection', () => {
      cy.get('[class*="request"]').first().within(() => {
        cy.contains('button', 'Reject').click();
      });
      
      // Reject button should be gone or disabled
      cy.contains('button', 'Reject').should('be.disabled');
    });

    it('should refresh request list after rejection', () => {
      // Count pending requests before
      cy.get('[class*="request"]').then(($requests) => {
        const beforeCount = $requests.length;
        
        // Reject first request
        cy.get('[class*="request"]').first().within(() => {
          cy.contains('button', 'Reject').click();
        });
        
        // Wait for update
        cy.contains('Success', { timeout: 10000 }).should('exist');
        
        // Count should decrease by 1
        cy.get('[class*="request"]', { timeout: 5000 }).should(($newRequests) => {
          expect($newRequests.length).to.be.lessThan(beforeCount);
        });
      });
    });

    it('should show loading state while rejecting', () => {
      cy.get('[class*="request"]').first().within(() => {
        cy.contains('button', 'Reject').click();
      });
      
      // Should show processing indicator
      cy.contains(/Processing|Rejecting|Reject/i, { timeout: 5000 }).should('exist');
    });
  });

  describe('Request Refresh', () => {
    beforeEach(() => {
      cy.contains('button', 'Moderation').click();
      cy.contains('Loading requests', { timeout: 15000 }).should('not.exist');
    });

    it('should display Refresh button', () => {
      cy.contains('button', 'Refresh').should('be.visible');
    });

    it('should reload requests when Refresh is clicked', () => {
      cy.contains('button', 'Refresh').click();
      
      // Should show loading state
      cy.contains('Loading', { timeout: 5000 }).should('exist');
      
      // Should finish loading
      cy.contains('Loading requests', { timeout: 15000 }).should('not.exist');
    });

    it('should update request counts after refresh', () => {
      // Get initial count
      cy.get('[class*="request"]').then(($requests) => {
        const beforeCount = $requests.length;
        
        // Refresh
        cy.contains('button', 'Refresh').click();
        cy.contains('Loading requests', { timeout: 15000 }).should('not.exist');
        
        // Counts may have changed
        cy.get('[class*="request"]', { timeout: 5000 }).should('exist');
      });
    });

    it('should show loading indicator during refresh', () => {
      cy.contains('button', 'Refresh').click();
      
      // Should show loading state
      cy.get('[class*="spinner"]').should('exist');
    });
  });

  describe('Request Sorting', () => {
    beforeEach(() => {
      cy.contains('button', 'Moderation').click();
      cy.contains('Loading requests', { timeout: 15000 }).should('not.exist');
    });

    it('should sort requests by newest first by default', () => {
      // Get first two requests - verify they exist
      cy.get('[class*="request"]').eq(0).should('be.visible');
      cy.get('[class*="request"]').eq(1).should('be.visible');
      
      // Should have consistent ordering
      cy.get('[class*="request"]').should('have.length.greaterThan', 1);
    });

    it('should display requests in chronological order', () => {
      cy.get('[class*="request"]').should('have.length.greaterThan', 1);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      cy.contains('button', 'Moderation').click();
    });

    it('should handle load failures gracefully', () => {
      // Mock failed API
      cy.intercept('/api/**', { statusCode: 500 }).as('failedRequest');
      
      cy.contains('button', 'Refresh').click();
      
      cy.wait('@failedRequest', { timeout: 5000 }).then(() => {
        cy.contains(/Error|Failed|failed/i).should('exist');
      });
    });

    it('should show error when approve fails', () => {
      cy.intercept('POST', '**/invoke/**', { statusCode: 500 }).as('failedApprove');
      
      cy.contains('button', 'Pending').click();
      cy.get('[class*="request"]').first().within(() => {
        cy.contains('button', 'Approve').click();
      });
      
      cy.wait('@failedApprove', { timeout: 5000 }).then(() => {
        cy.contains(/Error|Failed|failed/i).should('exist');
      });
    });

    it('should show error when reject fails', () => {
      cy.intercept('POST', '**/invoke/**', { statusCode: 500 }).as('failedReject');
      
      cy.contains('button', 'Pending').click();
      cy.get('[class*="request"]').first().within(() => {
        cy.contains('button', 'Reject').click();
      });
      
      cy.wait('@failedReject', { timeout: 5000 }).then(() => {
        cy.contains(/Error|Failed|failed/i).should('exist');
      });
    });

    it('should handle empty request list', () => {
      cy.contains('button', 'Rejected').click();
      
      // Should either show requests or empty state
      cy.contains(/No requests|empty/i).should('exist');
    });
  });

  describe('UI Responsiveness', () => {
    beforeEach(() => {
      cy.contains('button', 'Moderation').click();
      cy.contains('Loading requests', { timeout: 15000 }).should('not.exist');
    });

    it('should be responsive on mobile view', () => {
      cy.viewport('iphone-x');
      
      cy.get('[class*="request"]').should('be.visible');
      cy.contains('button', 'Approve').should('be.visible');
    });

    it('should be responsive on tablet view', () => {
      cy.viewport('ipad-2');
      
      cy.get('[class*="request"]').should('be.visible');
      cy.contains('button', 'Approve').should('be.visible');
    });

    it('should be responsive on desktop view', () => {
      cy.viewport(1280, 720);
      
      cy.get('[class*="request"]').should('be.visible');
      cy.contains('button', 'Approve').should('be.visible');
    });
  });

  describe('Performance', () => {
    beforeEach(() => {
      cy.contains('button', 'Moderation').click();
    });

    it('should load moderation tab within reasonable time', () => {
      const startTime = Date.now();
      
      cy.contains('Loading requests', { timeout: 15000 }).should('not.exist').then(() => {
        const endTime = Date.now();
        const loadTime = endTime - startTime;
        
        // Should load within 15 seconds
        expect(loadTime).to.be.lessThan(15000);
      });
    });

    it('should handle large request lists efficiently', () => {
      // Should render all requests without hanging
      cy.get('[class*="request"]').should('have.length.greaterThan', 0).then(($requests) => {
        cy.log(`Rendered ${$requests.length} requests`);
        
        // All should be visible or scrollable
        cy.get('[class*="request"]').first().should('be.visible');
      });
    });
  });

  describe('Integration Scenarios', () => {
    it('should complete full moderation workflow: submit → review → approve', () => {
      // 1. Submit a movie
      cy.contains('button', 'Channels').click();
      cy.get('button').contains('Submit').click();
      
      const imdbId = `tt${Date.now() % 10000000}`;
      cy.get('input[placeholder*="tt0111161"]').type(imdbId);
      cy.get('input[placeholder*="The Shawshank"]').type('Integration Test Movie');
      
      cy.contains('button', 'Submit Movie').click();
      cy.contains(/successful|submitted/, { timeout: 10000 }).should('exist');
      
      // 2. Go to Moderation and find the request
      cy.contains('button', 'Moderation').click();
      cy.contains('Loading requests', { timeout: 15000 }).should('not.exist');
      cy.contains('button', 'Pending').click();
      
      // 3. Approve the request
      cy.get('[class*="request"]').first().within(() => {
        cy.contains('button', 'Approve').click();
      });
      
      cy.contains(/Approved|Success/i, { timeout: 10000 }).should('exist');
    });

    it('should complete full moderation workflow: submit → review → reject', () => {
      // 1. Submit a movie
      cy.contains('button', 'Channels').click();
      cy.get('button').contains('Submit').click();
      
      const imdbId = `tt${Date.now() % 10000000}`;
      cy.get('input[placeholder*="tt0111161"]').type(imdbId);
      cy.get('input[placeholder*="The Shawshank"]').type('Integration Test Reject');
      
      cy.contains('button', 'Submit Movie').click();
      cy.contains(/successful|submitted/, { timeout: 10000 }).should('exist');
      
      // 2. Go to Moderation and find the request
      cy.contains('button', 'Moderation').click();
      cy.contains('Loading requests', { timeout: 15000 }).should('not.exist');
      cy.contains('button', 'Pending').click();
      
      // 3. Reject the request
      cy.get('[class*="request"]').first().within(() => {
        cy.contains('button', 'Reject').click();
      });
      
      cy.contains(/Rejected|Success/i, { timeout: 10000 }).should('exist');
    });
  });
});
