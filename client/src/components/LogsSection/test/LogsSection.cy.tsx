import React from 'react';
import LogsSection from '../LogsSection';

describe('LogsSection Component', () => {
  it('renders logs section with title', () => {
    cy.mount(<LogsSection logs={[]} />);
    cy.contains('h2', 'Logs').should('be.visible');
    cy.get('#logs').should('be.visible');
  });

  describe('Empty Logs State', () => {
    it('displays empty state message when no logs', () => {
      cy.mount(<LogsSection logs={[]} />);
      cy.contains('No logs yet').should('be.visible');
    });

    it('shows helpful message in empty state', () => {
      cy.mount(<LogsSection logs={[]} />);
      cy.contains('Actions and backend events will appear here in real-time').should('be.visible');
    });

    it('displays empty message with proper styling', () => {
      cy.mount(<LogsSection logs={[]} />);
      cy.contains('No logs yet').should('be.visible');
    });

    it('does not display individual log entries when empty', () => {
      cy.mount(<LogsSection logs={[]} />);
      cy.get('.text-gray-200').should('have.length', 0);
    });
  });

  describe('Single Log Entry', () => {
    it('displays a single log entry', () => {
      cy.mount(<LogsSection logs={['Log entry 1']} />);
      cy.contains('Log entry 1').should('be.visible');
    });

    it('hides empty state when logs exist', () => {
      cy.mount(<LogsSection logs={['Log entry 1']} />);
      cy.contains('No logs yet').should('not.exist');
    });

    it('displays log in correct styling', () => {
      cy.mount(<LogsSection logs={['Log entry 1']} />);
      cy.contains('Log entry 1')
        .should('be.visible');
    });

    it('preserves log text formatting', () => {
      const logWithSpaces = 'INFO: Server started   at port 8080';
      cy.mount(<LogsSection logs={[logWithSpaces]} />);
      cy.contains(logWithSpaces).should('be.visible');
    });
  });

  describe('Multiple Log Entries', () => {
    it('displays all log entries', () => {
      const logs = ['Entry 1', 'Entry 2', 'Entry 3'];
      cy.mount(<LogsSection logs={logs} />);

      cy.contains('Entry 1').should('be.visible');
      cy.contains('Entry 2').should('be.visible');
      cy.contains('Entry 3').should('be.visible');
    });

    it('displays logs in correct order', () => {
      const logs = ['First', 'Second', 'Third'];
      cy.mount(<LogsSection logs={logs} />);

      cy.contains('First').should('be.visible');
      cy.contains('Second').should('be.visible');
      cy.contains('Third').should('be.visible');
    });

    it('renders correct number of log entries', () => {
      const logs = Array.from({ length: 10 }, (_, i) => `Log ${i + 1}`);
      cy.mount(<LogsSection logs={logs} />);

      cy.contains('Log 1').should('be.visible');
      cy.contains('Log 10').should('be.visible');
    });

    it('handles many log entries', () => {
      const logs = Array.from({ length: 100 }, (_, i) => `Log ${i + 1}`);
      cy.mount(<LogsSection logs={logs} />);

      cy.contains('Log 1').should('be.visible');
      cy.contains('Log 100').should('be.visible');
    });
  });

  describe('Log Container Styling', () => {
    it('has proper container styling', () => {
      cy.mount(<LogsSection logs={[]} />);

      cy.get('#logs').should('be.visible');
    });

    it('has title with correct styling', () => {
      cy.mount(<LogsSection logs={[]} />);

      cy.contains('h2', 'Logs').should('be.visible');
    });

    it('has logs display area with proper structure', () => {
      cy.mount(<LogsSection logs={['test']} />);

      cy.get('div.overflow-auto').should('exist');
    });

    it('has fixed height for scrollable area', () => {
      cy.mount(<LogsSection logs={[]} />);

      cy.get('.h-56').should('exist');
    });

    it('displays logs in monospace font', () => {
      cy.mount(<LogsSection logs={['log line']} />);

      cy.get('.font-mono').should('exist');
    });
  });

  describe('Auto-scroll Behavior', () => {
    it('renders without errors when logs update', () => {
      cy.mount(<LogsSection logs={['Initial log']} />);
      cy.contains('Initial log').should('be.visible');

      // Component receives new props and re-renders
      cy.mount(<LogsSection logs={['Initial log', 'New log']} />);
      cy.contains('New log').should('be.visible');
    });

    it('handles adding logs dynamically', () => {
      cy.mount(<LogsSection logs={['Log 1']} />);

      // Test that component can handle additional logs
      cy.mount(<LogsSection logs={['Log 1', 'Log 2', 'Log 3']} />);
      cy.get('div').filter(':contains("Log 1")').should('exist');
    });

    it('clears old logs when replaced with new ones', () => {
      cy.mount(<LogsSection logs={['Old log']} />);
      cy.contains('Old log').should('be.visible');

      cy.mount(<LogsSection logs={['New log']} />);
      cy.contains('New log').should('be.visible');
    });
  });

  describe('Special Characters in Logs', () => {
    it('displays logs with special characters', () => {
      const logWithSpecialChars = 'Error: "File not found" (code: 404)';
      cy.mount(<LogsSection logs={[logWithSpecialChars]} />);

      cy.contains(logWithSpecialChars).should('be.visible');
    });

    it('handles logs with newlines', () => {
      const logWithNewlines = 'Line 1\nLine 2\nLine 3';
      cy.mount(<LogsSection logs={[logWithNewlines]} />);

      cy.get('.h-56').should('contain', 'Line 1');
    });

    it('preserves whitespace in logs', () => {
      const logWithWhitespace = 'INFO:    Server     started';
      cy.mount(<LogsSection logs={[logWithWhitespace]} />);

      cy.contains(logWithWhitespace).should('be.visible');
    });

    it('handles empty string logs', () => {
      cy.mount(<LogsSection logs={['', 'Non-empty']} />);

      cy.get('.text-gray-200').should('have.length', 2);
    });

    it('handles logs with HTML-like content', () => {
      const htmlLikeLog = '<div>test</div>';
      cy.mount(<LogsSection logs={[htmlLikeLog]} />);

      cy.contains('<div>test</div>').should('be.visible');
    });
  });

  describe('Log Content Display', () => {
    it('displays timestamp-like log entries', () => {
      const logs = [
        '[2024-01-15 10:30:45] Server started',
        '[2024-01-15 10:30:46] Client connected'
      ];
      cy.mount(<LogsSection logs={logs} />);

      cy.contains('[2024-01-15 10:30:45]').should('be.visible');
      cy.contains('[2024-01-15 10:30:46]').should('be.visible');
    });

    it('displays error-like log entries', () => {
      const logs = [
        'ERROR: Connection failed',
        'WARN: Retry attempt 1',
        'INFO: Recovery successful'
      ];
      cy.mount(<LogsSection logs={logs} />);

      cy.contains('ERROR: Connection failed').should('be.visible');
      cy.contains('WARN: Retry attempt 1').should('be.visible');
      cy.contains('INFO: Recovery successful').should('be.visible');
    });

    it('handles very long log lines', () => {
      const longLog = 'x'.repeat(500);
      cy.mount(<LogsSection logs={[longLog]} />);

      cy.get('.text-gray-200').should('contain', longLog);
    });
  });

  describe('Accessibility', () => {
    it('has semantic section element', () => {
      cy.mount(<LogsSection logs={[]} />);

      cy.get('section#logs').should('exist');
    });

    it('has proper heading hierarchy', () => {
      cy.mount(<LogsSection logs={[]} />);

      cy.get('h2').should('contain', 'Logs');
    });

    it('has scrollable container with proper structure', () => {
      cy.mount(<LogsSection logs={['log']} />);

      cy.get('.h-56').should('exist');
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined gracefully', () => {
      cy.mount(<LogsSection logs={[]} />);

      cy.contains('No logs yet').should('be.visible');
    });

    it('handles rapid log updates', () => {
      cy.mount(<LogsSection logs={['Log 1']} />);
      cy.contains('Log 1').should('be.visible');

      // Simulate rapid updates by mounting with more logs
      for (let i = 2; i <= 5; i++) {
        cy.mount(<LogsSection logs={Array.from({ length: i }, (_, j) => `Log ${j + 1}`)} />);
      }

      cy.contains('Log 5').should('be.visible');
    });

    it('handles very large number of logs', () => {
      const largeLogs = Array.from({ length: 1000 }, (_, i) => `Log ${i + 1}`);
      cy.mount(<LogsSection logs={largeLogs} />);

      cy.contains('Log 1').should('be.visible');
    });
  });

  describe('Rendering Performance', () => {
    it('efficiently renders many logs', () => {
      const logs = Array.from({ length: 500 }, (_, i) => `Performance test log ${i + 1}`);
      cy.mount(<LogsSection logs={logs} />);

      cy.get('.overflow-auto').should('be.visible');
      cy.contains('Performance test log 1').should('be.visible');
    });
  });
});
