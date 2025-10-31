/**
 * RemoteHouse Comment Endpoint
 * 
 * Executes comment.js script to add comments
 * to records in the repository.
 * 
 * POST /api/remotehouse/[repo]/comment
 * Request: { primary_index, id, email, comment }
 * Response: { success, comment_id, path, created_at, _meta }
 */

import { NextRequest, NextResponse } from 'next/server';
import * as path from 'path';
import { executeScriptWithInput } from '@/lib/scriptExecutor';
import {
  validateRepositoryName,
  validatePrimaryIndex,
  validateRecordId,
  validateEmail,
  validateCommentContent,
} from '@/lib/validators';

interface CommentRequest {
  primary_index: string;
  id: string;
  email: string;
  comment: string;
}

interface CommentResponse {
  success: boolean;
  comment_id?: string;
  path?: string;
  created_at?: string;
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
): Promise<NextResponse<CommentResponse>> {
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
    let body: CommentRequest;
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

    // Validate required fields
    if (!body.primary_index || !body.id || !body.email || !body.comment) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: primary_index, id, email, comment',
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

    // Validate record id
    if (!validateRecordId(body.id)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid record ID',
        },
        { status: 400 }
      );
    }

    // Validate email
    if (!validateEmail(body.email)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid email address',
        },
        { status: 400 }
      );
    }

    // Validate comment content
    if (!validateCommentContent(body.comment)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid comment content',
        },
        { status: 400 }
      );
    }

    // Build script path
    const reposDir = process.env.REPOSITORIES_ROOT_DIR || './repos';
    const repoPath = path.join(process.cwd(), reposDir, repoName);
    const scriptPath = path.join(repoPath, 'scripts', 'comment.js');

    // Execute comment script
    const startTime = Date.now();
    const result = await executeScriptWithInput(
      scriptPath,
      {
        primary_index: body.primary_index,
        id: body.id,
        email: body.email,
        comment: body.comment,
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
          error: result.error || 'Comment creation failed',
        },
        { status: 500 }
      );
    }

    // Parse script output
    let commentId = '';
    let commentPath = '';
    let createdAt = '';

    try {
      const output = result.output ? JSON.parse(result.output) : {};
      commentId = output.comment_id || output.id || '';
      commentPath = output.path || '';
      createdAt = output.created_at || new Date().toISOString();

      if (!commentId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Comment script did not return comment ID',
          },
          { status: 500 }
        );
      }
    } catch (err) {
      console.error('Failed to parse comment results:', err);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to parse comment results',
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        comment_id: commentId,
        path: commentPath,
        created_at: createdAt,
        _meta: {
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          repoName,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Comment endpoint error:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
