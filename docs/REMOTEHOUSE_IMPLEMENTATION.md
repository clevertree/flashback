# RemoteHouse Implementation Guide

## Overview

RemoteHouse provides REST API endpoints for executing repository scripts on the relay tracker. This guide details how to implement each endpoint.

## Directory Structure

```
server/
  app/
    api/
      remotehouse/
        [repo_name]/
          search/
            route.ts          # Search endpoint
          browse/
            route.ts          # Browse endpoint
          insert/
            route.ts          # Insert endpoint
          remove/
            route.ts          # Remove endpoint
          comment/
            route.ts          # Comment endpoint
        utils/
          scriptExecutor.ts   # Script execution utility
          validators.ts       # Input validators
```

## Implementation Steps

### Step 1: Create Script Executor Utility

**File:** `server/app/api/remotehouse/utils/scriptExecutor.ts`

```typescript
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);

interface ScriptExecutorOptions {
  timeout?: number;
  maxOutputSize?: number;
}

interface ScriptExecutorResult {
  success: boolean;
  output?: any;
  error?: string;
  executionTime: number;
}

export async function executeScript(
  scriptPath: string,
  inputData: any,
  options: ScriptExecutorOptions = {}
): Promise<ScriptExecutorResult> {
  const { timeout = 30000, maxOutputSize = 10 * 1024 * 1024 } = options;

  const startTime = Date.now();

  try {
    // Verify script exists
    if (!fs.existsSync(scriptPath)) {
      return {
        success: false,
        error: `Script not found: ${scriptPath}`,
        executionTime: Date.now() - startTime
      };
    }

    // Prepare input
    const input = JSON.stringify(inputData);

    // Execute script with timeout
    try {
      const { stdout, stderr } = await execFileAsync(
        'node',
        [scriptPath],
        {
          timeout,
          maxBuffer: maxOutputSize,
          stdio: ['pipe', 'pipe', 'pipe'],
          // Limit memory to 256MB
          env: {
            ...process.env,
            NODE_OPTIONS: '--max-old-space-size=256'
          }
        }
      );

      if (stderr) {
        console.error(`Script stderr: ${stderr}`);
      }

      // Parse output
      const output = JSON.parse(stdout);

      return {
        success: true,
        output,
        executionTime: Date.now() - startTime
      };
    } catch (err: any) {
      if (err.killed) {
        return {
          success: false,
          error: 'Script execution timeout (30s)',
          executionTime: Date.now() - startTime
        };
      }

      return {
        success: false,
        error: err.message || 'Script execution failed',
        executionTime: Date.now() - startTime
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
      executionTime: Date.now() - startTime
    };
  }
}

export async function executeScriptWithStdin(
  scriptPath: string,
  inputData: any,
  options: ScriptExecutorOptions = {}
): Promise<ScriptExecutorResult> {
  const { timeout = 30000, maxOutputSize = 10 * 1024 * 1024 } = options;

  return new Promise((resolve) => {
    const startTime = Date.now();

    try {
      const child = execFile('node', [scriptPath], {
        timeout,
        maxBuffer: maxOutputSize,
        env: {
          ...process.env,
          NODE_OPTIONS: '--max-old-space-size=256'
        }
      }, (error, stdout, stderr) => {
        if (error) {
          if (error.killed) {
            resolve({
              success: false,
              error: 'Script execution timeout (30s)',
              executionTime: Date.now() - startTime
            });
          } else {
            resolve({
              success: false,
              error: error.message,
              executionTime: Date.now() - startTime
            });
          }
        } else {
          try {
            const output = JSON.parse(stdout);
            resolve({
              success: true,
              output,
              executionTime: Date.now() - startTime
            });
          } catch (parseErr: any) {
            resolve({
              success: false,
              error: `Failed to parse script output: ${parseErr.message}`,
              executionTime: Date.now() - startTime
            });
          }
        }
      });

      // Send input via stdin
      child.stdin?.write(JSON.stringify(inputData));
      child.stdin?.end();
    } catch (err: any) {
      resolve({
        success: false,
        error: err.message,
        executionTime: Date.now() - startTime
      });
    }
  });
}
```

### Step 2: Create Input Validators

**File:** `server/app/api/remotehouse/utils/validators.ts`

```typescript
export function validateRepoName(name: string): string {
  if (!name || typeof name !== 'string') {
    throw new Error('Repository name is required');
  }

  if (!/^[a-zA-Z0-9_\-]+$/.test(name)) {
    throw new Error('Invalid repository name format');
  }

  if (name.length > 256) {
    throw new Error('Repository name too long');
  }

  return name;
}

export function validateSearchQuery(query: string): string {
  if (!query || typeof query !== 'string') {
    throw new Error('Query is required');
  }

  if (query.length > 1000) {
    throw new Error('Query too long');
  }

  // Allow alphanumeric, spaces, and basic punctuation
  if (!/^[a-zA-Z0-9\s_\-\.]+$/.test(query)) {
    throw new Error('Query contains invalid characters');
  }

  return query;
}

export function validatePrimaryIndex(index: string): string {
  if (!index || typeof index !== 'string') {
    throw new Error('Primary index is required');
  }

  if (!/^[a-zA-Z0-9_\-\.]+$/.test(index)) {
    throw new Error('Invalid primary index format');
  }

  if (index.length > 256) {
    throw new Error('Primary index too long');
  }

  return index;
}

export function validateRecordId(id: string): string {
  if (!id || typeof id !== 'string') {
    throw new Error('Record ID is required');
  }

  if (!/^[a-zA-Z0-9_\-\.]+$/.test(id)) {
    throw new Error('Invalid record ID format');
  }

  return id;
}

export function validateEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    throw new Error('Email is required');
  }

  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Invalid email format');
  }

  return email.toLowerCase();
}

export function validateComment(text: string): string {
  if (!text || typeof text !== 'string') {
    throw new Error('Comment text is required');
  }

  if (text.length > 10000) {
    throw new Error('Comment too long');
  }

  return text;
}

export function validatePath(path: string, maxLength: number = 256): string {
  if (typeof path !== 'string') {
    throw new Error('Path must be a string');
  }

  if (path.length > maxLength) {
    throw new Error('Path too long');
  }

  // Prevent path traversal
  if (path.includes('..')) {
    throw new Error('Invalid path');
  }

  return path;
}
```

### Step 3: Implement Search Endpoint

**File:** `server/app/api/remotehouse/[repo_name]/search/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { executeScript } from '../../utils/scriptExecutor';
import {
  validateRepoName,
  validateSearchQuery,
  validatePath
} from '../../utils/validators';

const REPOSITORIES_ROOT_DIR = process.env.REPOSITORIES_ROOT_DIR || './repos';

export async function POST(
  req: NextRequest,
  { params }: { params: { repo_name: string } }
) {
  try {
    const repoName = validateRepoName(params.repo_name);
    const body = await req.json();

    const query = validateSearchQuery(body.query);
    const field = body.field || 'title';
    const browsePath = body.path ? validatePath(body.path) : '';

    // Construct repo path with security checks
    const repoPath = path.join(REPOSITORIES_ROOT_DIR, repoName);
    const normalizedPath = path.normalize(repoPath);

    // Verify repo exists
    if (!fs.existsSync(normalizedPath)) {
      return NextResponse.json(
        { error: 'Repository not found' },
        { status: 404 }
      );
    }

    // Verify script exists
    const scriptPath = path.join(normalizedPath, 'scripts', 'search.js');
    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json(
        { error: 'Search script not found in repository' },
        { status: 400 }
      );
    }

    // Prepare data directory path
    const dataDir = path.join(normalizedPath, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Execute script
    const result = await executeScript(scriptPath, {
      query,
      field,
      dataDir,
      path: browsePath
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    // Add metadata
    const response = {
      ...result.output,
      _meta: {
        repo: repoName,
        executionTimeMs: result.executionTime
      }
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err: any) {
    console.error('Search endpoint error', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { repo_name: string } }
) {
  // Support GET with query parameters
  const query = req.nextUrl.searchParams.get('q');
  const field = req.nextUrl.searchParams.get('field') || 'title';

  if (!query) {
    return NextResponse.json(
      { error: 'Missing query parameter' },
      { status: 400 }
    );
  }

  // Reuse POST logic
  return POST(
    new NextRequest(req, {
      method: 'POST',
      body: JSON.stringify({ query, field })
    }),
    { params }
  );
}
```

### Step 4: Implement Browse Endpoint

**File:** `server/app/api/remotehouse/[repo_name]/browse/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { executeScript } from '../../utils/scriptExecutor';
import { validateRepoName, validatePath } from '../../utils/validators';

const REPOSITORIES_ROOT_DIR = process.env.REPOSITORIES_ROOT_DIR || './repos';

export async function POST(
  req: NextRequest,
  { params }: { params: { repo_name: string } }
) {
  try {
    const repoName = validateRepoName(params.repo_name);
    const body = await req.json();

    const browsePath = body.path ? validatePath(body.path) : '';
    const depth = Math.min(body.depth || 3, 10); // Max depth 10

    // Construct repo path
    const repoPath = path.join(REPOSITORIES_ROOT_DIR, repoName);
    const normalizedPath = path.normalize(repoPath);

    // Verify repo exists
    if (!fs.existsSync(normalizedPath)) {
      return NextResponse.json(
        { error: 'Repository not found' },
        { status: 404 }
      );
    }

    // Verify script exists
    const scriptPath = path.join(normalizedPath, 'scripts', 'browse.js');
    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json(
        { error: 'Browse script not found in repository' },
        { status: 400 }
      );
    }

    // Prepare data directory
    const dataDir = path.join(normalizedPath, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Execute script
    const result = await executeScript(scriptPath, {
      path: browsePath,
      depth,
      dataDir
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    const response = {
      ...result.output,
      _meta: {
        repo: repoName,
        executionTimeMs: result.executionTime
      }
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err: any) {
    console.error('Browse endpoint error', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Step 5: Implement Insert Endpoint

**File:** `server/app/api/remotehouse/[repo_name]/insert/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { executeScript } from '../../utils/scriptExecutor';
import { validateRepoName } from '../../utils/validators';

const REPOSITORIES_ROOT_DIR = process.env.REPOSITORIES_ROOT_DIR || './repos';

export async function POST(
  req: NextRequest,
  { params }: { params: { repo_name: string } }
) {
  try {
    const repoName = validateRepoName(params.repo_name);
    const body = await req.json();

    if (!body.payload || typeof body.payload !== 'object') {
      return NextResponse.json(
        { error: 'Payload is required' },
        { status: 400 }
      );
    }

    // Construct repo path
    const repoPath = path.join(REPOSITORIES_ROOT_DIR, repoName);
    const normalizedPath = path.normalize(repoPath);

    // Verify repo exists
    if (!fs.existsSync(normalizedPath)) {
      return NextResponse.json(
        { error: 'Repository not found' },
        { status: 404 }
      );
    }

    // Verify script exists
    const scriptPath = path.join(normalizedPath, 'scripts', 'insert.js');
    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json(
        { error: 'Insert script not found in repository' },
        { status: 400 }
      );
    }

    // Prepare data directory
    const dataDir = path.join(normalizedPath, 'data');
    fs.mkdirSync(dataDir, { recursive: true });

    // Execute script
    const result = await executeScript(scriptPath, {
      payload: body.payload,
      rules: body.rules,
      dataDir
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    const response = {
      ...result.output,
      _meta: {
        repo: repoName,
        executionTimeMs: result.executionTime
      }
    };

    return NextResponse.json(response, { status: 201 });
  } catch (err: any) {
    console.error('Insert endpoint error', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Step 6: Implement Remove Endpoint

**File:** `server/app/api/remotehouse/[repo_name]/remove/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { executeScript } from '../../utils/scriptExecutor';
import { validateRepoName, validatePrimaryIndex } from '../../utils/validators';

const REPOSITORIES_ROOT_DIR = process.env.REPOSITORIES_ROOT_DIR || './repos';

export async function POST(
  req: NextRequest,
  { params }: { params: { repo_name: string } }
) {
  try {
    const repoName = validateRepoName(params.repo_name);
    const body = await req.json();

    const primaryIndex = validatePrimaryIndex(body.primary_index);
    const id = body.id; // Optional

    // Construct repo path
    const repoPath = path.join(REPOSITORIES_ROOT_DIR, repoName);
    const normalizedPath = path.normalize(repoPath);

    // Verify repo exists
    if (!fs.existsSync(normalizedPath)) {
      return NextResponse.json(
        { error: 'Repository not found' },
        { status: 404 }
      );
    }

    // Verify script exists
    const scriptPath = path.join(normalizedPath, 'scripts', 'remove.js');
    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json(
        { error: 'Remove script not found in repository' },
        { status: 400 }
      );
    }

    // Prepare data directory
    const dataDir = path.join(normalizedPath, 'data');

    // Execute script
    const result = await executeScript(scriptPath, {
      primary_index: primaryIndex,
      id,
      dataDir
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    const response = {
      ...result.output,
      _meta: {
        repo: repoName,
        executionTimeMs: result.executionTime
      }
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err: any) {
    console.error('Remove endpoint error', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { repo_name: string } }
) {
  return POST(req, { params });
}
```

### Step 7: Implement Comment Endpoint

**File:** `server/app/api/remotehouse/[repo_name]/comment/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { executeScript } from '../../utils/scriptExecutor';
import {
  validateRepoName,
  validatePrimaryIndex,
  validateRecordId,
  validateEmail,
  validateComment
} from '../../utils/validators';

const REPOSITORIES_ROOT_DIR = process.env.REPOSITORIES_ROOT_DIR || './repos';

// Extract email from user certificate
function extractEmailFromCertificate(cert: string): string | null {
  // TODO: Implement certificate parsing
  // For now, assume email is in request context
  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { repo_name: string } }
) {
  try {
    const repoName = validateRepoName(params.repo_name);
    const body = await req.json();

    const primaryIndex = validatePrimaryIndex(body.primary_index);
    const recordId = validateRecordId(body.id);
    const email = validateEmail(body.email);
    const comment = validateComment(body.comment);

    // Construct repo path
    const repoPath = path.join(REPOSITORIES_ROOT_DIR, repoName);
    const normalizedPath = path.normalize(repoPath);

    // Verify repo exists
    if (!fs.existsSync(normalizedPath)) {
      return NextResponse.json(
        { error: 'Repository not found' },
        { status: 404 }
      );
    }

    // Verify script exists
    const scriptPath = path.join(normalizedPath, 'scripts', 'comment.js');
    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json(
        { error: 'Comment script not found in repository' },
        { status: 400 }
      );
    }

    // Prepare data directory
    const dataDir = path.join(normalizedPath, 'data');
    fs.mkdirSync(dataDir, { recursive: true });

    // Execute script
    const result = await executeScript(scriptPath, {
      primary_index: primaryIndex,
      id: recordId,
      email,
      comment,
      dataDir
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    const response = {
      ...result.output,
      _meta: {
        repo: repoName,
        executionTimeMs: result.executionTime
      }
    };

    return NextResponse.json(response, { status: 201 });
  } catch (err: any) {
    console.error('Comment endpoint error', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Testing

### Unit Tests for Validators

```typescript
// validators.test.ts
describe('validateRepoName', () => {
  it('accepts valid names', () => {
    expect(validateRepoName('my-repo')).toBe('my-repo');
    expect(validateRepoName('repo_123')).toBe('repo_123');
  });

  it('rejects path traversal', () => {
    expect(() => validateRepoName('../etc')).toThrow();
  });

  it('rejects long names', () => {
    const longName = 'a'.repeat(257);
    expect(() => validateRepoName(longName)).toThrow();
  });
});
```

### Integration Tests

```bash
# Test search endpoint
curl -X POST http://localhost:8080/api/remotehouse/example-repo/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "field": "title"}'

# Test browse endpoint
curl -X POST http://localhost:8080/api/remotehouse/example-repo/browse \
  -H "Content-Type: application/json" \
  -d '{"path": "", "depth": 2}'

# Test insert endpoint
curl -X POST http://localhost:8080/api/remotehouse/example-repo/insert \
  -H "Content-Type: application/json" \
  -d '{"payload": {"primary_index": "movies", "title": "Test Movie"}}'
```

## Configuration

Add to `.env`:

```bash
REPOSITORIES_ROOT_DIR=./repos
SCRIPT_EXECUTION_TIMEOUT=30000
SCRIPT_MAX_MEMORY=256
```

## Next Steps

1. Create the directory structure in server
2. Implement each endpoint following the patterns above
3. Add comprehensive test coverage
4. Deploy and monitor performance
5. Add rate limiting and caching as needed
