/**
 * RemoteHouse Search Endpoint
 * 
 * Executes search.js script in repository to find records
 * by title, description, or other fields.
 * 
 * POST /api/remotehouse/[repo]/search
 * Request: { query, field?, path?, limit?, offset? }
 * Response: { results, count, query, field, _meta }
 */

import { NextRequest, NextResponse } from 'next/server';
import * as path from 'path';
import { executeScript } from '@/lib/scriptExecutor';
import {
  validateRepositoryName,
  validateSearchQuery,
  validatePagination,
} from '@/lib/validators';

interface SearchRequest {
  query: string;
  field?: string;
  path?: string;
  limit?: number;
  offset?: number;
}

interface SearchResult {
  id: string;
  title?: string;
  description?: string;
  [key: string]: any;
}

interface SearchResponse {
  success: boolean;
  results?: SearchResult[];
  count?: number;
  query?: string;
  field?: string;
  path?: string;
  _meta?: {
    duration: number;
    timestamp: string;
    repoName: string;
  };
  error?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { repo: string } }
): Promise<NextResponse<SearchResponse>> {
  try {
    const repoName = params.repo;

    // Validate repository name
    if (!validateRepositoryName(repoName)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid repository name',
        },
        { status: 400 }
      );
    }

    // Parse request body
    let body: SearchRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON request body',
        },
        { status: 400 }
      );
    }

    // Validate query
    if (!validateSearchQuery(body.query)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid search query',
        },
        { status: 400 }
      );
    }

    // Validate pagination
    if (!validatePagination(body.limit, body.offset)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid pagination parameters',
        },
        { status: 400 }
      );
    }

    // Build script path
    const reposDir = process.env.REPOSITORIES_ROOT_DIR || './repos';
    const repoPath = path.join(process.cwd(), reposDir, repoName);
    const scriptPath = path.join(repoPath, 'scripts', 'search.js');

    // Execute search script
    const startTime = Date.now();
    const result = await executeScript(
      scriptPath,
      [
        '--query',
        body.query,
        ...(body.field ? ['--field', body.field] : []),
        ...(body.path ? ['--path', body.path] : []),
        '--limit',
        String(body.limit || 100),
        '--offset',
        String(body.offset || 0),
      ],
      {
        timeout: 30000,
        maxMemory: 256,
        workingDir: repoPath,
      }
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Search failed',
        },
        { status: 500 }
      );
    }

    // Parse script output
    let searchResults: SearchResult[] = [];
    let count = 0;

    try {
      const output = result.output ? JSON.parse(result.output) : {};
      searchResults = output.results || [];
      count = output.count || searchResults.length;
    } catch (err) {
      console.error('Failed to parse search results:', err);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to parse search results',
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        results: searchResults,
        count,
        query: body.query,
        field: body.field,
        path: body.path,
        _meta: {
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          repoName,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('Search endpoint error:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
