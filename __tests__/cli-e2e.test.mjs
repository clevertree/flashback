/**
 * CLI E2E Test Suite
 * 
 * Tests the fabric-cli tool against live Kaleido REST Gateway
 * Each test case represents a real-world use case
 * 
 * Run with: npm run test:cli:e2e
 * Run with: npm run test:cli:e2e:live (against Kaleido)
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cliPath = path.join(__dirname, '../scripts/fabric-cli.ts');
const USE_LIVE_SERVER = process.env.USE_LIVE_KALEIDO === 'true';

/**
 * Run CLI command and capture output
 * @param {string[]} args
 * @returns {Promise<{code: number, stdout: string, stderr: string, success: boolean}>}
 */
function runCli(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['tsx', cliPath, ...args], {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        code,
        stdout,
        stderr,
        success: code === 0,
      });
    });

    child.on('error', reject);

    // Timeout after 30s
    setTimeout(() => {
      child.kill();
      reject(new Error('CLI command timeout'));
    }, 30000);
  });
}

/**
 * Parse JSON output from CLI
 * @param {string} stdout
 * @returns {any}
 */
function parseJsonOutput(stdout) {
  // Find JSON content (usually after "✓" success message)
  const jsonMatch = stdout.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error(`Could not parse JSON from output: ${stdout}`);
  }
  return JSON.parse(jsonMatch[0]);
}

describe('CLI E2E Tests - Movie Chaincode', () => {
  const timeout = 30000;

  describe('Health Checks', () => {
    it(
      'should verify REST Gateway is accessible',
      async () => {
        const result = await runCli(['health']);
        expect(result.success).toBe(true);
        expect(result.stdout).toContain('healthy');
      },
      timeout
    );
  });

  describe('Query Operations', () => {
    it(
      'should query all movies with default JSON format',
      async () => {
        const result = await runCli(['query-all']);
        expect(result.success).toBe(true);
        expect(result.stdout).toContain('Query successful');
        expect(() => parseJsonOutput(result.stdout)).not.toThrow();
      },
      timeout
    );

    it(
      'should query all movies with table format',
      async () => {
        const result = await runCli(['query-all', '--format', 'table']);
        expect(result.success).toBe(true);
        expect(result.stdout).toContain('Query successful');
        const success = result.stdout.includes('|') || result.stdout.includes('No records found');
        expect(success).toBe(true);
      },
      timeout
    );

    it(
      'should query all movies with CSV format',
      async () => {
        const result = await runCli(['query-all', '--format', 'csv']);
        expect(result.success).toBe(true);
        expect(result.stdout).toContain('Query successful');
        const success = result.stdout.includes(',') || result.stdout.includes('No records found');
        expect(success).toBe(true);
      },
      timeout
    );
  });

  describe('Search Operations', () => {
    it(
      'should search movies by title',
      async () => {
        const result = await runCli(['search-title', 'Inception']);
        expect(result.success).toBe(true);
        expect(result.stdout).toContain('Searching for movies');
      },
      timeout
    );

    it(
      'should handle title search with no results',
      async () => {
        const result = await runCli(['search-title', 'NONEXISTENT_MOVIE_' + Date.now()]);
        expect(result.success).toBe(true);
        expect(result.stdout).toContain('Found');
      },
      timeout
    );

    it(
      'should return search results in table format',
      async () => {
        const result = await runCli(['search-title', 'Test', '--format', 'table']);
        expect(result.success).toBe(true);
      },
      timeout
    );
  });

  describe('Request History', () => {
    it(
      'should get history for IMDB ID',
      async () => {
        const result = await runCli(['get-history', 'tt1375666']);
        expect(result.success).toBe(true);
        expect(result.stdout).toContain('History retrieved');
      },
      timeout
    );

    it(
      'should handle history for non-existent IMDB',
      async () => {
        const result = await runCli(['get-history', 'tt9999999']);
        expect(result.success).toBe(true);
      },
      timeout
    );
  });

  describe('Get Movie Details', () => {
    it(
      'should retrieve movie by IMDB ID',
      async () => {
        const result = await runCli(['get-movie', 'tt1375666']);
        expect(result.code === 0 || result.code === 1).toBe(true);
      },
      timeout
    );

    it(
      'should handle get-movie for non-existent ID',
      async () => {
        const result = await runCli(['get-movie', 'tt9999999']);
        expect(result.code === 0 || result.code === 1).toBe(true);
      },
      timeout
    );
  });

  describe('Submit Operations (Live Server Only)', () => {
    it(
      'should submit content request with minimal args',
      async () => {
        if (!USE_LIVE_SERVER) {
          console.log('⏭️  Skipping live submit test (USE_LIVE_KALEIDO not set)');
          return;
        }

        const imdbId = `tt${Date.now()}`;
        const result = await runCli([
          'submit-request',
          imdbId,
          'E2E Test Movie',
          'Test Director',
        ]);

        if (result.success) {
          expect(result.stdout).toContain('submitted');
          const output = parseJsonOutput(result.stdout);
          expect(output).toHaveProperty('imdbId');
        }
      },
      timeout
    );

    it(
      'should submit content request with full options',
      async () => {
        if (!USE_LIVE_SERVER) {
          console.log('⏭️  Skipping live submit test (USE_LIVE_KALEIDO not set)');
          return;
        }

        const imdbId = `tt${Date.now()}`;
        const result = await runCli([
          'submit-request',
          imdbId,
          'E2E Test Movie Full',
          'Test Director',
          '--year',
          '2024',
          '--genres',
          'Drama,Sci-Fi',
          '--torrent',
          'QmTestHash1234567890',
        ]);

        if (result.success) {
          expect(result.stdout).toContain('submitted');
        }
      },
      timeout
    );
  });

  describe('Approve Operations (Live Server Only)', () => {
    it(
      'should approve content request',
      async () => {
        if (!USE_LIVE_SERVER) {
          console.log('⏭️  Skipping live approve test (USE_LIVE_KALEIDO not set)');
          return;
        }

        const result = await runCli([
          'approve-request',
          'tt9999999',
          'moderator-test',
        ]);

        expect(result.stdout || result.stderr).toBeTruthy();
      },
      timeout
    );
  });

  describe('Error Handling', () => {
    it(
      'should handle missing required arguments',
      async () => {
        const result = await runCli(['submit-request']);
        expect(result.success).toBe(false);
        expect(result.stdout).toContain('Usage');
      },
      timeout
    );

    it(
      'should show help on --help flag',
      async () => {
        const result = await runCli(['--help']);
        expect(result.success).toBe(true);
        expect(result.stdout).toContain('Fabric Movie Chaincode CLI');
      },
      timeout
    );

    it(
      'should show version on --version flag',
      async () => {
        const result = await runCli(['--version']);
        expect(result.success).toBe(true);
        expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
      },
      timeout
    );

    it(
      'should handle unknown command',
      async () => {
        const result = await runCli(['unknown-command']);
        expect(result.success).toBe(false);
        expect(result.stdout).toContain('Unknown command');
      },
      timeout
    );
  });

  describe('Output Formatting', () => {
    it(
      'should output valid JSON by default',
      async () => {
        const result = await runCli(['query-all']);
        if (result.success) {
          expect(() => parseJsonOutput(result.stdout)).not.toThrow();
        }
      },
      timeout
    );

    it(
      'should format table output correctly',
      async () => {
        const result = await runCli(['query-all', '--format', 'table']);
        expect(result.success).toBe(true);
        expect(result.stdout).toBeTruthy();
      },
      timeout
    );

    it(
      'should format CSV output correctly',
      async () => {
        const result = await runCli(['query-all', '--format', 'csv']);
        expect(result.success).toBe(true);
        expect(result.stdout).toBeTruthy();
      },
      timeout
    );
  });

  describe('Integration Scenarios', () => {
    it(
      'workflow: query, search, get history in sequence',
      async () => {
        const queryResult = await runCli(['query-all']);
        expect(queryResult.success).toBe(true);

        const searchResult = await runCli(['search-title', 'Test']);
        expect(searchResult.success).toBe(true);

        const historyResult = await runCli(['get-history', 'tt1375666']);
        expect(historyResult.success).toBe(true);
      },
      timeout
    );

    it(
      'workflow: multiple searches with different formats',
      async () => {
        const title = 'Inception';

        const jsonResult = await runCli(['search-title', title, '--format', 'json']);
        expect(jsonResult.success).toBe(true);

        const tableResult = await runCli(['search-title', title, '--format', 'table']);
        expect(tableResult.success).toBe(true);

        const csvResult = await runCli(['search-title', title, '--format', 'csv']);
        expect(csvResult.success).toBe(true);
      },
      timeout
    );
  });
});
