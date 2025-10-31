/**
 * Script Executor Utility
 * 
 * Safely executes JavaScript scripts in isolated Node.js processes
 * with timeout, memory, and resource limits.
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Configuration for script execution
 */
export interface ExecutionConfig {
  timeout?: number;           // milliseconds (default: 30000)
  maxMemory?: number;         // MB (default: 256)
  maxOutputSize?: number;     // bytes (default: 10MB)
  workingDir?: string;        // working directory for execution
}

/**
 * Result of script execution
 */
export interface ExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  duration: number;           // milliseconds
  memoryUsed?: number;        // MB
  exitCode?: number;
}

/**
 * Execute a JavaScript script safely
 * 
 * @param scriptPath - Absolute path to JavaScript file
 * @param args - Command line arguments to pass to script
 * @param config - Execution configuration
 * @returns Execution result with output or error
 */
export async function executeScript(
  scriptPath: string,
  args: string[] = [],
  config: ExecutionConfig = {}
): Promise<ExecutionResult> {
  const {
    timeout = 30000,
    maxMemory = 256,
    maxOutputSize = 10 * 1024 * 1024,
    workingDir = path.dirname(scriptPath),
  } = config;

  return new Promise((resolve) => {
    const startTime = Date.now();
    let output = '';
    let error = '';

    // Verify script exists
    if (!fs.existsSync(scriptPath)) {
      return resolve({
        success: false,
        error: `Script not found: ${scriptPath}`,
        duration: Date.now() - startTime,
      });
    }

    try {
      // Spawn Node.js process with memory limit
      const nodeProcess: ChildProcess = spawn('node', [
        `--max-old-space-size=${maxMemory}`,
        scriptPath,
        ...args,
      ], {
        cwd: workingDir,
        timeout,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_ENV: 'production',
          SCRIPT_EXECUTION: 'true',
        },
      });

      // Set timeout to kill process if it runs too long
      const timeoutHandle = setTimeout(() => {
        nodeProcess.kill('SIGTERM');
      }, timeout);

      // Collect stdout
      nodeProcess.stdout?.on('data', (chunk: Buffer) => {
        if (output.length < maxOutputSize) {
          output += chunk.toString();
        }
      });

      // Collect stderr
      nodeProcess.stderr?.on('data', (chunk: Buffer) => {
        if (error.length < maxOutputSize) {
          error += chunk.toString();
        }
      });

      // Handle process exit
      nodeProcess.on('close', (code: number | null) => {
        clearTimeout(timeoutHandle);
        const duration = Date.now() - startTime;

        if (code === 0) {
          try {
            // Try to parse output as JSON
            const result = JSON.parse(output);
            resolve({
              success: true,
              output: JSON.stringify(result),
              duration,
              exitCode: code ?? undefined,
            });
          } catch {
            // Output is not JSON, return as-is
            resolve({
              success: true,
              output,
              duration,
              exitCode: code ?? undefined,
            });
          }
        } else {
          resolve({
            success: false,
            error: error || `Process exited with code ${code}`,
            duration,
            exitCode: code ?? undefined,
          });
        }
      });

      // Handle process error
      nodeProcess.on('error', (err: Error) => {
        clearTimeout(timeoutHandle);
        resolve({
          success: false,
          error: `Failed to execute script: ${err.message}`,
          duration: Date.now() - startTime,
        });
      });
    } catch (err) {
      resolve({
        success: false,
        error: `Execution error: ${err instanceof Error ? err.message : String(err)}`,
        duration: Date.now() - startTime,
      });
    }
  });
}

/**
 * Execute a script with JSON input
 * 
 * @param scriptPath - Absolute path to JavaScript file
 * @param input - Input data to pass to script
 * @param config - Execution configuration
 * @returns Execution result with parsed output
 */
export async function executeScriptWithInput<T>(
  scriptPath: string,
  input: any,
  config: ExecutionConfig = {}
): Promise<ExecutionResult> {
  const inputJson = JSON.stringify(input);
  
  return executeScript(scriptPath, ['--input', inputJson], config);
}

/**
 * Test if a script is valid and executable
 * 
 * @param scriptPath - Absolute path to JavaScript file
 * @returns true if script can be executed, false otherwise
 */
export async function validateScript(scriptPath: string): Promise<boolean> {
  // Check if file exists
  if (!fs.existsSync(scriptPath)) {
    return false;
  }

  // Check if file is readable
  try {
    fs.accessSync(scriptPath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get size of directory
 * 
 * @param dirPath - Directory path
 * @returns Total size in bytes
 */
export function getDirectorySize(dirPath: string): number {
  if (!fs.existsSync(dirPath)) {
    return 0;
  }

  let totalSize = 0;

  function walkDir(dir: string): void {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        walkDir(filePath);
      } else {
        totalSize += stat.size;
      }
    }
  }

  walkDir(dirPath);
  return totalSize;
}

/**
 * Count files in directory
 * 
 * @param dirPath - Directory path
 * @returns Total file count
 */
export function countFiles(dirPath: string): number {
  if (!fs.existsSync(dirPath)) {
    return 0;
  }

  let totalFiles = 0;

  function walkDir(dir: string): void {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        walkDir(filePath);
      } else {
        totalFiles++;
      }
    }
  }

  walkDir(dirPath);
  return totalFiles;
}
