#!/usr/bin/env node

/**
 * Fabric Movie Chaincode CLI
 * 
 * Command-line interface to interact with movie chaincode on Kaleido
 * 
 * Usage:
 *   fabric-cli query-all [--format json|table|csv]
 *   fabric-cli submit-request <imdb_id> <title> <director> [--year <year>] [--genres <g1,g2>] [--torrent <hash>]
 *   fabric-cli approve-request <imdb_id> <moderator_id>
 *   fabric-cli search-title <title>
 *   fabric-cli get-history <imdb_id>
 *   fabric-cli get-movie <imdb_id>
 *   fabric-cli health
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  queryAllMovies,
  submitContentRequest,
  approveContentRequest,
  searchMoviesByTitle,
  getRequestHistory,
  getMovieByImdbId,
  healthCheck,
} from '../src/lib/kaleido-api';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Color output helpers
type ColorKey = keyof typeof colors;
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
} as const;

function log(msg: string, color: ColorKey = 'reset'): void {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function error(msg: string): void {
  console.error(`${colors.red}Error: ${msg}${colors.reset}`);
}

function success(msg: string): void {
  log(`✓ ${msg}`, 'green');
}

function info(msg: string): void {
  log(`ℹ ${msg}`, 'cyan');
}

function formatJson(data: any): string {
  return JSON.stringify(data, null, 2);
}

function formatTable(data: any): string {
  if (Array.isArray(data) && data.length === 0) {
    return 'No records found';
  }

  if (Array.isArray(data)) {
    const headers = Object.keys(data[0]);
    const widths = headers.map(h => Math.max(h.length, 20));

    let result = headers.map((h, i) => h.padEnd(widths[i])).join(' | ') + '\n';
    result += Array(result.length - 1).fill('-').join('') + '\n';

    result += data.map(row =>
      headers.map((h, i) => String(row[h] || '').substring(0, widths[i]).padEnd(widths[i])).join(' | ')
    ).join('\n');

    return result;
  }

  return formatJson(data);
}

function formatCsv(data: any): string {
  if (Array.isArray(data) && data.length === 0) {
    return 'No records found';
  }

  if (Array.isArray(data)) {
    const headers = Object.keys(data[0]);
    let result = headers.join(',') + '\n';
    result += data.map(row =>
      headers.map(h => {
        const val = row[h];
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      }).join(',')
    ).join('\n');
    return result;
  }

  return formatJson(data);
}

function formatOutput(data: any, format: string = 'json'): string {
  switch (format) {
    case 'table':
      return formatTable(data);
    case 'csv':
      return formatCsv(data);
    case 'json':
    default:
      return formatJson(data);
  }
}

// Commands
async function cmdQueryAll(args: string[]): Promise<void> {
  const format = args.includes('--format')
    ? args[args.indexOf('--format') + 1]
    : 'json';

  info('Querying all movies...');
  const response = await queryAllMovies();

  if (response.error) {
    error(response.error);
    process.exit(1);
  }

  success('Query successful');
  console.log(formatOutput(response.result, format));
}

async function cmdSubmitRequest(args: string[]): Promise<void> {
  if (args.length < 3) {
    error('Usage: submit-request <imdb_id> <title> <director> [options]');
    process.exit(1);
  }

  const imdbId = args[0];
  const title = args[1];
  const director = args[2];
  const year = parseInt(args[args.indexOf('--year') + 1] || '2024', 10);
  const genresStr = args[args.indexOf('--genres') + 1] || 'Drama';
  const genres = genresStr.split(',');
  const torrentHash = args[args.indexOf('--torrent') + 1] || `Qm${Date.now()}`;

  const request = {
    imdbId,
    title,
    director,
    releaseYear: year,
    genres: genres.map((g: string) => g.trim()),
    description: `Test submission for ${title}`,
    torrentHashes: { default: torrentHash },
    submitterId: 'cli-test-' + Date.now(),
    notes: 'Submitted via CLI',
  };

  info(`Submitting content request for ${title} (${imdbId})...`);
  const response = await submitContentRequest(JSON.stringify(request));

  if (response.error) {
    error(response.error);
    process.exit(1);
  }

  success('Content request submitted');
  console.log(formatOutput(response.result || { imdbId, status: 'pending_review' }, 'json'));
}

async function cmdApproveRequest(args: string[]): Promise<void> {
  if (args.length < 2) {
    error('Usage: approve-request <imdb_id> <moderator_id>');
    process.exit(1);
  }

  const imdbId = args[0];
  const moderatorId = args[1];

  info(`Approving content request for IMDB ID: ${imdbId}...`);
  const response = await approveContentRequest(imdbId, moderatorId);

  if (response.error) {
    error(response.error);
    process.exit(1);
  }

  success('Content request approved');
  console.log(formatOutput(response.result || { imdbId, status: 'approved' }, 'json'));
}

async function cmdSearchTitle(args: string[]): Promise<void> {
  if (args.length < 1) {
    error('Usage: search-title <title> [--format json|table|csv]');
    process.exit(1);
  }

  const title = args[0];
  const format = args.includes('--format') ? args[args.indexOf('--format') + 1] : 'json';

  info(`Searching for movies with title containing: "${title}"...`);
  const response = await searchMoviesByTitle(title);

  if (response.error) {
    error(response.error);
    process.exit(1);
  }

  success(`Found ${Array.isArray(response.result) ? response.result.length : '1'} result(s)`);
  console.log(formatOutput(response.result, format));
}

async function cmdGetHistory(args: string[]): Promise<void> {
  if (args.length < 1) {
    error('Usage: get-history <imdb_id> [--format json|table|csv]');
    process.exit(1);
  }

  const imdbId = args[0];
  const format = args.includes('--format') ? args[args.indexOf('--format') + 1] : 'json';

  info(`Retrieving history for IMDB ID: ${imdbId}...`);
  const response = await getRequestHistory(imdbId);

  if (response.error) {
    error(response.error);
    process.exit(1);
  }

  success('History retrieved');
  console.log(formatOutput(response.result, format));
}

async function cmdGetMovie(args: string[]): Promise<void> {
  if (args.length < 1) {
    error('Usage: get-movie <imdb_id>');
    process.exit(1);
  }

  const imdbId = args[0];

  info(`Retrieving movie: ${imdbId}...`);
  const response = await getMovieByImdbId(imdbId);

  if (response.error) {
    error(response.error);
    process.exit(1);
  }

  success('Movie retrieved');
  console.log(formatOutput(response.result, 'json'));
}

async function cmdHealth(): Promise<void> {
  info('Checking Kaleido REST Gateway health...');
  const isHealthy = await healthCheck();

  if (isHealthy) {
    success('REST Gateway is healthy and accessible');
    console.log(formatOutput({ status: 'healthy', timestamp: new Date().toISOString() }, 'json'));
  } else {
    error('REST Gateway is not responding or not accessible');
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
Fabric Movie Chaincode CLI

Usage:
  fabric-cli <command> [options]

Commands:
  query-all                           Query all movies from ledger
  submit-request <imdb> <title> <dir> Submit content request for review
  approve-request <imdb> <moderator>  Approve pending content request
  search-title <title>                Search movies by title
  get-history <imdb>                  Get submission history for IMDB
  get-movie <imdb>                    Get specific movie details
  health                              Check REST Gateway connectivity

Options:
  --format json|table|csv             Output format (default: json)
  --year <year>                       Release year (for submit-request)
  --genres <g1,g2,g3>                 Genres comma-separated (for submit-request)
  --torrent <hash>                    Torrent hash (for submit-request)
  --help                              Show this help message
  --version                           Show version

Examples:
  fabric-cli query-all
  fabric-cli query-all --format table
  fabric-cli submit-request tt1234567 "Test Movie" "Test Director" --year 2024
  fabric-cli approve-request tt1234567 moderator-123
  fabric-cli search-title "Inception"
  fabric-cli get-history tt1234567
  fabric-cli health

Environment:
  KALEIDO_REST_GATEWAY               REST Gateway URL (default: from .env.local)
  KALEIDO_APP_ID                      App ID (default: from .env.local)
  KALEIDO_APP_PASSWORD                App password (default: from .env.local)
  `);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    process.exit(0);
  }

  if (args[0] === '--version' || args[0] === '-v') {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));
    console.log(pkg.version);
    process.exit(0);
  }

  const command = args[0];
  const cmdArgs = args.slice(1);

  try {
    switch (command) {
      case 'query-all':
        await cmdQueryAll(cmdArgs);
        break;
      case 'submit-request':
        await cmdSubmitRequest(cmdArgs);
        break;
      case 'approve-request':
        await cmdApproveRequest(cmdArgs);
        break;
      case 'search-title':
        await cmdSearchTitle(cmdArgs);
        break;
      case 'get-history':
        await cmdGetHistory(cmdArgs);
        break;
      case 'get-movie':
        await cmdGetMovie(cmdArgs);
        break;
      case 'health':
        await cmdHealth();
        break;
      default:
        error(`Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    error(errorMsg);
    process.exit(1);
  }
}

main();
