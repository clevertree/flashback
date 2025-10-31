/**
 * Repository Comment Script
 * 
 * This script adds comments to records as markdown files organized
 * in a hierarchical comment structure.
 * 
 * Input: {
 *   primary_index: string,
 *   id: string,
 *   email: string,
 *   comment: string
 * }
 * 
 * Creates: data/${primary_index}/comments/${email}/${comment_id}.md
 * 
 * Output: { success: boolean, comment_id: string, path: string }
 * 
 * Security: Validates all inputs and uses email from the user certificate
 * to identify who created the comment.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Add a comment to a record in the repository
 * @param {Object} input - Comment parameters
 * @param {string} input.primary_index - Index directory containing the record
 * @param {string} input.id - Record ID to comment on
 * @param {string} input.email - Email of commenter (from certificate)
 * @param {string} input.comment - Comment text (markdown)
 * @param {string} [input.dataDir] - Repository data directory
 * @returns {Object} Result with comment_id and path
 */
async function comment(input) {
  const { primary_index, id, email, comment, dataDir } = input;

  if (!dataDir || !fs.existsSync(dataDir)) {
    return {
      success: false,
      error: 'Data directory not found'
    };
  }

  // Validate required parameters
  if (!primary_index || typeof primary_index !== 'string') {
    return {
      success: false,
      error: 'Missing required parameter: primary_index'
    };
  }

  if (!id || typeof id !== 'string') {
    return {
      success: false,
      error: 'Missing required parameter: id'
    };
  }

  if (!email || typeof email !== 'string') {
    return {
      success: false,
      error: 'Missing required parameter: email'
    };
  }

  if (!comment || typeof comment !== 'string') {
    return {
      success: false,
      error: 'Missing required parameter: comment'
    };
  }

  const primaryIndex = String(primary_index).trim();
  const recordId = String(id).trim();
  const userEmail = String(email).trim().toLowerCase();
  const commentText = String(comment).trim();

  // Validate format (prevent directory traversal)
  if (!/^[a-zA-Z0-9_\-\.]+$/.test(primaryIndex)) {
    return {
      success: false,
      error: 'Invalid primary_index: contains invalid characters'
    };
  }

  if (!recordId.match(/^[a-zA-Z0-9_\-\.]+$/)) {
    return {
      success: false,
      error: 'Invalid id: contains invalid characters'
    };
  }

  // Sanitize email for use as directory name
  const sanitizedEmail = userEmail.replace(/[^a-z0-9\._\-]/g, '_');

  try {
    // Create comments directory structure
    // data/${primary_index}/comments/${email}/
    const commentsDir = path.join(dataDir, primaryIndex, 'comments', sanitizedEmail);

    // Security: Verify paths are within dataDir
    const indexDirCheck = path.relative(dataDir, path.join(dataDir, primaryIndex));
    const commentsDirCheck = path.relative(dataDir, commentsDir);

    if (indexDirCheck.startsWith('..') || commentsDirCheck.startsWith('..')) {
      return {
        success: false,
        error: 'Invalid path: directory traversal attempt'
      };
    }

    fs.mkdirSync(commentsDir, { recursive: true });

    // Generate unique comment ID
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    const commentId = `${timestamp}_${random}`;
    const filename = `${commentId}.md`;
    const filepath = path.join(commentsDir, filename);

    // Create markdown content with metadata
    const markdown = `# Comment on ${recordId}
Author: ${userEmail}
Created: ${new Date().toISOString()}
Record ID: ${recordId}

---

${commentText}
`;

    fs.writeFileSync(filepath, markdown);

    return {
      success: true,
      comment_id: commentId,
      path: path.relative(dataDir, filepath),
      created_at: new Date().toISOString()
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

module.exports = { comment };
