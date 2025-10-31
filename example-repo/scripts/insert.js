/**
 * Repository Insert Script
 * 
 * This script validates and inserts data into the repository. Each item must have
 * a `primary_index` field that determines the directory structure.
 * 
 * Input: { payload: Object, ... }
 * Payload must include:
 *   - primary_index: string (directory where files will be stored)
 *   - other fields: will be stored in payload JSON file
 * 
 * Output: { success: boolean, id: string, path: string }
 * 
 * Security: This script validates all inputs and only writes to subdirectories
 * within the data directory, preventing directory traversal attacks.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Validation rules for repository data
 * These rules are enforced on all incoming payloads
 */
const DEFAULT_RULES = {
  required_fields: ['primary_index'],
  max_payload_size: 1024 * 1024, // 1MB
  allowed_characters: /^[a-zA-Z0-9_\-\.]+$/
};

/**
 * Insert a new record into the repository
 * @param {Object} input - Insert parameters
 * @param {Object} input.payload - Data to insert (must include primary_index)
 * @param {Object} [input.rules] - Validation rules
 * @param {string} [input.dataDir] - Repository data directory
 * @returns {Object} Result with id and path of inserted record
 */
async function insert(input) {
  const { payload, rules = DEFAULT_RULES, dataDir } = input;

  if (!dataDir || !fs.existsSync(dataDir)) {
    return {
      success: false,
      error: 'Data directory not found'
    };
  }

  // Validate payload exists
  if (!payload || typeof payload !== 'object') {
    return {
      success: false,
      error: 'Invalid payload: must be an object'
    };
  }

  // Check payload size
  const payloadSize = JSON.stringify(payload).length;
  if (payloadSize > rules.max_payload_size) {
    return {
      success: false,
      error: `Payload too large: ${payloadSize} bytes (max: ${rules.max_payload_size})`
    };
  }

  // Validate required fields
  for (const field of rules.required_fields || []) {
    if (!payload[field]) {
      return {
        success: false,
        error: `Missing required field: ${field}`
      };
    }
  }

  const primaryIndex = String(payload.primary_index).trim();

  // Validate primary_index format (prevent directory traversal)
  if (!rules.allowed_characters.test(primaryIndex)) {
    return {
      success: false,
      error: 'Invalid primary_index: contains invalid characters'
    };
  }

  try {
    // Create directory structure
    const indexDir = path.join(dataDir, primaryIndex);
    
    // Security: Ensure we're not trying to write outside dataDir
    const relative = path.relative(dataDir, indexDir);
    if (relative.startsWith('..')) {
      return {
        success: false,
        error: 'Invalid path: directory traversal attempt'
      };
    }

    fs.mkdirSync(indexDir, { recursive: true });

    // Generate unique ID for the record
    const id = `${primaryIndex}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const filename = `${id}.json`;
    const filepath = path.join(indexDir, filename);

    // Write payload to file
    const data = {
      id,
      created_at: new Date().toISOString(),
      ...payload
    };

    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

    return {
      success: true,
      id,
      path: path.relative(dataDir, filepath),
      size: JSON.stringify(data).length
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

module.exports = { insert };
