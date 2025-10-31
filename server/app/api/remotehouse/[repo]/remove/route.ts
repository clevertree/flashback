/**
 * RemoteHouse Remove Endpoint
 * 
 * Executes remove.js script to delete records
 * from the repository.
 * 
 * POST /api/remotehouse/[repo]/remove
 * Request: { primary_index, id? }
 * Response: { success, removed, message, _meta }
 */

import { NextRequest, NextResponse } from 'next/server';
import * as path from 'path';
import { executeScriptWithInput } from '@/lib/scriptExecutor';
import {
  validateRepositoryName,
  validatePrimaryIndex,
  validateRecordId,
} from '@/lib/validators';

interface RemoveRequest {
  primary_index: string;
  id?: string;
}

interface RemoveResponse {
  success: boolean;
  removed?: number;
  message?: string;
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
): Promise<NextResponse<RemoveResponse>> {
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
    let body: RemoveRequest;
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

    // Validate primary_index
    if (!validatePrimaryIndex(body.primary_index)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid primary_index',
        },
        { status: 400 }
      );
    }

    // Validate id if provided
    if (body.id && !validateRecordId(body.id)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid record ID',
        },
        { status: 400 }
      );
    }

    // Build script path
    const reposDir = process.env.REPOSITORIES_ROOT_DIR || './repos';
    const repoPath = path.join(process.cwd(), reposDir, repoName);
    const scriptPath = path.join(repoPath, 'scripts', 'remove.js');

    // Execute remove script
    const startTime = Date.now();
    const result = await executeScriptWithInput(
      scriptPath,
      {
        primary_index: body.primary_index,
        id: body.id,
      },
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
          error: result.error || 'Remove failed',
        },
        { status: 500 }
      );
    }

    // Parse script output
    let removed = 0;
    let message = '';

    try {
      const output = result.output ? JSON.parse(result.output) : {};
      removed = output.removed || 0;
      message = output.message || `Removed ${removed} record(s)`;
    } catch (err) {
      console.error('Failed to parse remove results:', err);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to parse remove results',
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        removed,
        message,
        _meta: {
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          repoName,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('Remove endpoint error:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
