/**
 * Repository Search Script
 * 
 * This script searches through the repository data directory for items matching
 * the given search query. It supports searching by title, description, and other fields.
 * 
 * Input: { query: string, field?: string }
 * Output: { results: Array<{id: string, title: string, ...}>, count: number }
 * 
 * Security: This script runs in a sandboxed environment. It can only read from
 * the repository data directory and cannot access parent directories or execute
 * arbitrary code.
 */

const fs = require('fs');
const path = require('path');

/**
 * Search through repository data files
 * @param {Object} input - Search parameters
 * @param {string} input.query - Search query string
 * @param {string} [input.field] - Optional field to search (defaults to 'title')
 * @param {string} [input.dataDir] - Repository data directory (provided by runtime)
 * @returns {Object} Search results
 */
async function search(input) {
  const { query, field = 'title', dataDir } = input;
  
  if (!query || typeof query !== 'string') {
    return {
      error: 'Invalid query parameter',
      results: [],
      count: 0
    };
  }

  if (!dataDir || !fs.existsSync(dataDir)) {
    return {
      error: 'Data directory not found',
      results: [],
      count: 0
    };
  }

  const results = [];
  const searchLower = query.toLowerCase();

  try {
    // Recursively search through data directory
    function searchDir(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          searchDir(fullPath);
        } else if (entry.name.endsWith('.json')) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const data = JSON.parse(content);
            
            // Check if field exists and matches query
            if (data[field] && String(data[field]).toLowerCase().includes(searchLower)) {
              results.push({
                id: data.id || path.relative(dataDir, fullPath),
                title: data.title || 'Untitled',
                description: data.description || '',
                path: path.relative(dataDir, fullPath),
                ...data
              });
            }
          } catch (err) {
            // Skip files that can't be parsed as JSON
          }
        }
      }
    }

    searchDir(dataDir);

    return {
      results,
      count: results.length,
      query,
      field
    };
  } catch (err) {
    return {
      error: err.message,
      results: [],
      count: 0
    };
  }
}

module.exports = { search };
