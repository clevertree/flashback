/**
 * Repository Browse Script
 * 
 * This script provides a hierarchical browseable view of the repository data.
 * Returns a tree structure organized by primary_index directories.
 * 
 * Input: { path?: string, depth?: number }
 * Output: { tree: Object, count: number }
 * 
 * Security: This script runs in a sandboxed environment. It can only read from
 * the repository data directory and cannot access parent directories.
 */

const fs = require('fs');
const path = require('path');

/**
 * Build a browseable tree of repository data
 * @param {Object} input - Browse parameters
 * @param {string} [input.path] - Subdirectory to browse (defaults to root)
 * @param {number} [input.depth] - Maximum depth to traverse (defaults to 3)
 * @param {string} [input.dataDir] - Repository data directory (provided by runtime)
 * @returns {Object} Directory tree structure
 */
async function browse(input) {
  const { 
    path: browsePath = '', 
    depth = 3, 
    dataDir 
  } = input;

  if (!dataDir || !fs.existsSync(dataDir)) {
    return {
      error: 'Data directory not found',
      tree: {},
      count: 0
    };
  }

  const targetDir = browsePath 
    ? path.join(dataDir, browsePath) 
    : dataDir;

  // Security: Prevent directory traversal
  if (!path.relative(dataDir, targetDir).startsWith('..') === false) {
    return {
      error: 'Invalid path',
      tree: {},
      count: 0
    };
  }

  if (!fs.existsSync(targetDir)) {
    return {
      error: 'Path not found',
      tree: {},
      count: 0
    };
  }

  let fileCount = 0;

  function buildTree(dir, currentDepth) {
    if (currentDepth <= 0) {
      return { truncated: true };
    }

    const tree = {
      files: [],
      directories: {}
    };

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(dataDir, fullPath);

        if (entry.isDirectory()) {
          tree.directories[entry.name] = buildTree(fullPath, currentDepth - 1);
        } else if (entry.name.endsWith('.json')) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const data = JSON.parse(content);
            fileCount++;

            tree.files.push({
              name: entry.name,
              title: data.title || entry.name,
              id: data.id || relativePath,
              size: fs.statSync(fullPath).size,
              modified: fs.statSync(fullPath).mtime
            });
          } catch (err) {
            tree.files.push({
              name: entry.name,
              error: 'Invalid JSON'
            });
          }
        } else {
          tree.files.push({
            name: entry.name,
            type: 'other'
          });
        }
      }
    } catch (err) {
      return { error: err.message };
    }

    return tree;
  }

  try {
    const tree = buildTree(targetDir, depth);
    return {
      tree,
      count: fileCount,
      path: browsePath || '/',
      depth
    };
  } catch (err) {
    return {
      error: err.message,
      tree: {},
      count: 0
    };
  }
}

module.exports = { browse };
