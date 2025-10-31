/**
 * Repository Remove Script
 * 
 * This script removes files associated with a specific primary_index.
 * It safely deletes records without affecting other data.
 * 
 * Input: { primary_index: string, id?: string }
 * - If id provided: removes specific record
 * - If only primary_index: removes all records in that index directory
 * 
 * Output: { success: boolean, removed: number, message: string }
 * 
 * Security: This script validates all inputs and only removes files within
 * the data directory, preventing unauthorized deletions.
 */

const fs = require('fs');
const path = require('path');

/**
 * Remove records from the repository
 * @param {Object} input - Remove parameters
 * @param {string} input.primary_index - Index directory containing files to remove
 * @param {string} [input.id] - Specific record ID to remove (optional)
 * @param {string} [input.dataDir] - Repository data directory
 * @returns {Object} Result with count of removed files
 */
async function remove(input) {
  const { primary_index, id, dataDir } = input;

  if (!dataDir || !fs.existsSync(dataDir)) {
    return {
      success: false,
      error: 'Data directory not found'
    };
  }

  if (!primary_index || typeof primary_index !== 'string') {
    return {
      success: false,
      error: 'Missing required parameter: primary_index'
    };
  }

  const primaryIndex = String(primary_index).trim();

  // Validate primary_index format (prevent directory traversal)
  if (!/^[a-zA-Z0-9_\-\.]+$/.test(primaryIndex)) {
    return {
      success: false,
      error: 'Invalid primary_index: contains invalid characters'
    };
  }

  try {
    const indexDir = path.join(dataDir, primaryIndex);

    // Security: Ensure we're not trying to access outside dataDir
    const relative = path.relative(dataDir, indexDir);
    if (relative.startsWith('..')) {
      return {
        success: false,
        error: 'Invalid path: directory traversal attempt'
      };
    }

    if (!fs.existsSync(indexDir)) {
      return {
        success: false,
        error: 'Index directory not found'
      };
    }

    let removed = 0;

    if (id) {
      // Remove specific record
      const filename = `${id}.json`;
      const filepath = path.join(indexDir, filename);

      const fileRelative = path.relative(dataDir, filepath);
      if (fileRelative.startsWith('..')) {
        return {
          success: false,
          error: 'Invalid path: directory traversal attempt'
        };
      }

      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        removed = 1;
      } else {
        return {
          success: false,
          error: `Record not found: ${id}`
        };
      }
    } else {
      // Remove all records in the index directory
      const entries = fs.readdirSync(indexDir);
      
      for (const entry of entries) {
        if (entry.endsWith('.json')) {
          const filepath = path.join(indexDir, entry);
          
          // Double-check we're removing only .json files in the index
          const fileRelative = path.relative(indexDir, filepath);
          if (!fileRelative.startsWith('..')) {
            fs.unlinkSync(filepath);
            removed++;
          }
        }
      }

      // Remove empty directory if it's now empty
      const remaining = fs.readdirSync(indexDir);
      if (remaining.length === 0) {
        fs.rmdirSync(indexDir);
      }
    }

    return {
      success: true,
      removed,
      message: `Successfully removed ${removed} file(s)`
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

module.exports = { remove };
