/**
 * RemoteHouse Browse Endpoint
 * 
 * Executes browse.js script to provide hierarchical view
 * of repository data structure.
 * 
 * POST /api/remotehouse/[repo]/browse
 * Request: { path?, depth?, limit?, offset? }
 * Response: { tree, count, path, depth, _meta }
 */

import { NextRequest, NextResponse } from 'next/server';
import * as path from 'path';
import { executeScript } from '@/lib/scriptExecutor';
import {
  validateRepositoryName,
  validateDepth,
  validatePagination,
  validatePrimaryIndex,
} from '@/lib/validators';

interface BrowseRequest {
  path?: string;
  depth?: number;
  limit?: number;
  offset?: number;
}

interface BrowseNode {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
  id?: string;
  title?: string;
  children?: BrowseNode[];
}

interface BrowseResponse {
  success: boolean;
  tree?: BrowseNode;
  count?: number;
  path?: string;
  depth?: number;
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
): Promise<NextResponse<BrowseResponse>> {
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
    let body: BrowseRequest;
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

    // Validate path if provided
    if (body.path && !validatePrimaryIndex(body.path)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid path',
        },
        { status: 400 }
      );
    }

    // Validate depth
    if (!validateDepth(body.depth)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid depth parameter',
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
    const scriptPath = path.join(repoPath, 'scripts', 'browse.js');

    // Execute browse script
    const startTime = Date.now();
    const result = await executeScript(
      scriptPath,
      [
        ...(body.path ? ['--path', body.path] : []),
        '--depth',
        String(body.depth || 3),
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
          error: result.error || 'Browse failed',
        },
        { status: 500 }
      );
    }

    // Parse script output
    let browseTree: BrowseNode | undefined;
    let count = 0;

    try {
      const output = result.output ? JSON.parse(result.output) : {};
      browseTree = output.tree;
      count = output.count || 0;
    } catch (err) {
      console.error('Failed to parse browse results:', err);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to parse browse results',
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        tree: browseTree,
        count,
        path: body.path || '/',
        depth: body.depth || 3,
        _meta: {
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          repoName,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('Browse endpoint error:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
