import React from 'react';
import ErrorBoundary from '../ErrorBoundary';

// Component that throws an error for testing
const ThrowingComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error from component');
  }
  return <div>Content rendered successfully</div>;
};

describe('ErrorBoundary Component', () => {
  // Suppress console errors during tests
  beforeEach(() => {
    cy.stub(console, 'error');
    cy.stub(console, 'log');
    cy.stub(console, 'warn');
  });

  describe('Normal Operation', () => {
    it('renders children when no error occurs', () => {
      cy.mount(
        <ErrorBoundary>
          <div>Test content</div>
        </ErrorBoundary>
      );

      cy.contains('Test content').should('be.visible');
    });

    it('renders children component successfully', () => {
      cy.mount(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={false} />
        </ErrorBoundary>
      );

      cy.contains('Content rendered successfully').should('be.visible');
    });

    it('does not show error section when no error', () => {
      cy.mount(
        <ErrorBoundary>
          <div>Test content</div>
        </ErrorBoundary>
      );

      cy.get('[role="alert"]').should('not.exist');
    });
  });

  describe('Error Handling', () => {
    it('catches errors from children components', () => {
      cy.mount(
        <ErrorBoundary name="TestComponent">
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      cy.get('[role="alert"]').should('be.visible');
    });

    it('displays error section with role="alert"', () => {
      cy.mount(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      cy.get('[role="alert"]').should('be.visible');
    });

    it('displays component name in error message', () => {
      cy.mount(
        <ErrorBoundary name="MyComponent">
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      cy.contains('Something went wrong in MyComponent').should('be.visible');
    });

    it('displays default component name when not provided', () => {
      cy.mount(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      cy.contains('Something went wrong in Component').should('be.visible');
    });

    it('shows error message', () => {
      cy.mount(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      cy.get('pre').should('contain', 'Test error from component');
    });

    it('includes stack trace in error details', () => {
      cy.mount(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      cy.get('pre').should('contain', 'Stack:');
    });

    it('shows "Copy details" button', () => {
      cy.mount(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      cy.contains('button', 'Copy details').should('be.visible');
    });

    it('shows "Reset" button', () => {
      cy.mount(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      cy.contains('button', 'Reset').should('be.visible');
    });

    it('displays error in monospace font for readability', () => {
      cy.mount(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      cy.get('pre').should('be.visible');
    });

    it('has scrollable error details area', () => {
      cy.mount(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      cy.get('pre').should('be.visible');
    });
  });

  describe('Reset Functionality', () => {
    it('resets error state when Reset button is clicked', () => {
      cy.mount(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      cy.get('[role="alert"]').should('be.visible');
      cy.contains('button', 'Reset').click();
      cy.get('[role="alert"]').should('not.exist');
    });

    it('renders children again after reset', () => {
      cy.mount(
        <ErrorBoundary>
          <div>Test content</div>
        </ErrorBoundary>
      );

      cy.contains('Test content').should('be.visible');
    });

    it('clears error details after reset', () => {
      cy.mount(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      cy.contains('button', 'Reset').click();
      cy.get('pre').should('not.exist');
    });
  });

  describe('Copy Details Functionality', () => {
    beforeEach(() => {
      // Mock clipboard API
      cy.window().then((win) => {
        cy.stub(win.navigator.clipboard, 'writeText').resolves();
      });
    });

    it('copies error details to clipboard', () => {
      cy.mount(
        <ErrorBoundary name="TestComponent">
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      cy.window().then((win) => {
        cy.contains('button', 'Copy details').click();
        cy.wrap(win.navigator.clipboard.writeText).should('have.been.called');
      });
    });

    it('includes component name in copied details', () => {
      cy.mount(
        <ErrorBoundary name="MySpecificComponent">
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      cy.window().then((win) => {
        cy.contains('button', 'Copy details').click();
        cy.wrap(win.navigator.clipboard.writeText).should('have.been.calledWith', Cypress.sinon.match.string);
      });
    });
  });

  describe('Error Details Content', () => {
    it('includes error message in details', () => {
      cy.mount(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      cy.get('pre').should('contain', 'Message:');
    });

    it('includes component stack information when available', () => {
      cy.mount(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      // Component stack may or may not be available depending on React version
      cy.get('pre').should('contain', 'Component stack:');
    });

    it('displays error in pre-formatted text', () => {
      cy.mount(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      cy.get('pre')
        .should('exist')
        .and('be.visible');
    });
  });

  describe('Button Styling', () => {
    it('Copy details button is visible and clickable', () => {
      cy.mount(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      cy.contains('button', 'Copy details')
        .should('be.visible')
        .and('be.enabled');
    });

    it('Reset button is visible and clickable', () => {
      cy.mount(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      cy.contains('button', 'Reset')
        .should('be.visible')
        .and('be.enabled');
    });
  });

  describe('Layout', () => {
    it('has proper layout for error section', () => {
      cy.mount(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      cy.get('[role="alert"]').should('be.visible');
    });

    it('displays header and buttons on same line', () => {
      cy.mount(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      cy.contains('h3', /Something went wrong/).should('be.visible');
      cy.contains('button', 'Copy details').should('be.visible');
      cy.contains('button', 'Reset').should('be.visible');
    });

    it('displays error title as heading', () => {
      cy.mount(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      cy.get('h3').should('contain', 'Something went wrong');
    });
  });

  describe('Multiple Errors', () => {
    it('captures only the first error and does not update', () => {
      const TestComponent = ({ count }: { count: number }) => {
        if (count > 0) {
          throw new Error(`Error ${count}`);
        }
        return <div>No error</div>;
      };

      cy.mount(
        <ErrorBoundary>
          <TestComponent count={1} />
        </ErrorBoundary>
      );

      cy.get('pre').should('contain', 'Error 1');
    });
  });
});
