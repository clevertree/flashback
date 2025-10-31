/**
 * RemoteHouse Insert Endpoint
 * 
 * Executes insert.js script to add validated records
 * to the repository.
 * 
 * POST /api/remotehouse/[repo]/insert
 * Request: { payload: {primary_index, ...}, rules? }
 * Response: { success, id, path, size, _meta }
 */

import { NextRequest, NextResponse } from 'next/server';
import * as path from 'path';
import { executeScript, executeScriptWithInput } from '@/lib/scriptExecutor';
import {
  validateRepositoryName,
  validatePayload,
  validateRequiredFields,
} from '@/lib/validators';

interface InsertRequest {
  payload: {
    primary_index: string;
    [key: string]: any;
  };
  rules?: {
    required_fields?: string[];
    max_payload_size?: number;
    allowed_characters?: string;
  };
}

interface InsertResponse {
  success: boolean;
  id?: string;
  path?: string;
  size?: number;
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
): Promise<NextResponse<InsertResponse>> {
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
    let body: InsertRequest;
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

    // Validate payload
    if (!validatePayload(body.payload)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid payload',
        },
        { status: 400 }
      );
    }

    // Check required fields if specified
    if (body.rules?.required_fields) {
      if (!validateRequiredFields(body.payload, body.rules.required_fields)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing required fields in payload',
          },
          { status: 400 }
        );
      }
    }

    // Build script path
    const reposDir = process.env.REPOSITORIES_ROOT_DIR || './repos';
    const repoPath = path.join(process.cwd(), reposDir, repoName);
    const scriptPath = path.join(repoPath, 'scripts', 'insert.js');

    // Execute insert script with payload
    const startTime = Date.now();
    const result = await executeScriptWithInput(
      scriptPath,
      {
        payload: body.payload,
        rules: body.rules,
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
          error: result.error || 'Insert failed',
        },
        { status: 500 }
      );
    }

    // Parse script output
    let recordId = '';
    let recordPath = '';
    let recordSize = 0;

    try {
      const output = result.output ? JSON.parse(result.output) : {};
      recordId = output.id || '';
      recordPath = output.path || '';
      recordSize = output.size || 0;

      if (!recordId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Insert script did not return record ID',
          },
          { status: 500 }
        );
      }
    } catch (err) {
      console.error('Failed to parse insert results:', err);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to parse insert results',
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        id: recordId,
        path: recordPath,
        size: recordSize,
        _meta: {
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          repoName,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Insert endpoint error:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
