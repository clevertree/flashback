/**
 * Input Validators for RemoteHouse API
 * 
 * Comprehensive validation to prevent injection attacks,
 * path traversal, and other security issues.
 */

/**
 * Validate repository name (no path traversal, no special chars)
 * 
 * @param repoName - Repository name to validate
 * @returns true if valid, false otherwise
 */
export function validateRepositoryName(repoName: string): boolean {
  if (!repoName || typeof repoName !== 'string') {
    return false;
  }

  // Check length
  if (repoName.length < 1 || repoName.length > 255) {
    return false;
  }

  // Reject path traversal attempts
  if (repoName.includes('..') || repoName.includes('/') || repoName.includes('\\')) {
    return false;
  }

  // Only allow alphanumeric, dash, underscore
  if (!/^[a-zA-Z0-9\-_]+$/.test(repoName)) {
    return false;
  }

  return true;
}

/**
 * Validate search query string
 * 
 * @param query - Query string to validate
 * @param maxLength - Maximum query length (default: 500)
 * @returns true if valid, false otherwise
 */
export function validateSearchQuery(query: string, maxLength: number = 500): boolean {
  if (!query || typeof query !== 'string') {
    return false;
  }

  if (query.length < 1 || query.length > maxLength) {
    return false;
  }

  // Check for dangerous patterns (basic protection)
  // Block command injection attempts
  if (/[;`$(){}[\]|&<>\\]/.test(query)) {
    return false;
  }

  return true;
}

/**
 * Validate primary index (data type)
 * 
 * @param primaryIndex - Primary index path
 * @param maxLength - Maximum path length (default: 255)
 * @returns true if valid, false otherwise
 */
export function validatePrimaryIndex(primaryIndex: string, maxLength: number = 255): boolean {
  if (!primaryIndex || typeof primaryIndex !== 'string') {
    return false;
  }

  if (primaryIndex.length < 1 || primaryIndex.length > maxLength) {
    return false;
  }

  // Reject path traversal
  if (primaryIndex.includes('..')) {
    return false;
  }

  // Allow relative paths but not absolute
  if (primaryIndex.startsWith('/')) {
    return false;
  }

  // Allow alphanumeric, dash, underscore, forward slash for paths
  if (!/^[a-zA-Z0-9\-_\/]+$/.test(primaryIndex)) {
    return false;
  }

  // Split path and validate each component
  const parts = primaryIndex.split('/');
  for (const part of parts) {
    if (part === '' || part === '.' || part === '..') {
      return false;
    }
  }

  return true;
}

/**
 * Validate record ID
 * 
 * @param id - Record ID to validate
 * @returns true if valid, false otherwise
 */
export function validateRecordId(id: string): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }

  if (id.length < 1 || id.length > 255) {
    return false;
  }

  // Only allow safe characters
  if (!/^[a-zA-Z0-9\-_:]+$/.test(id)) {
    return false;
  }

  return true;
}

/**
 * Validate email address
 * 
 * @param email - Email to validate
 * @returns true if valid, false otherwise
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  if (email.length < 3 || email.length > 255) {
    return false;
  }

  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate comment content
 * 
 * @param content - Comment content to validate
 * @param minLength - Minimum length (default: 1)
 * @param maxLength - Maximum length (default: 5000)
 * @returns true if valid, false otherwise
 */
export function validateCommentContent(
  content: string,
  minLength: number = 1,
  maxLength: number = 5000
): boolean {
  if (!content || typeof content !== 'string') {
    return false;
  }

  if (content.length < minLength || content.length > maxLength) {
    return false;
  }

  // Don't allow null characters
  if (content.includes('\0')) {
    return false;
  }

  return true;
}

/**
 * Validate payload object for insert operation
 * 
 * @param payload - Payload to validate
 * @param maxSize - Maximum payload size in bytes (default: 1MB)
 * @returns true if valid, false otherwise
 */
export function validatePayload(payload: any, maxSize: number = 1048576): boolean {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  // Check if payload has required primary_index
  if (!payload.primary_index || !validatePrimaryIndex(payload.primary_index)) {
    return false;
  }

  // Check payload size
  const payloadJson = JSON.stringify(payload);
  if (payloadJson.length > maxSize) {
    return false;
  }

  return true;
}

/**
 * Validate pagination parameters
 * 
 * @param limit - Result limit
 * @param offset - Result offset
 * @param maxLimit - Maximum allowed limit (default: 1000)
 * @returns true if valid, false otherwise
 */
export function validatePagination(
  limit?: number,
  offset?: number,
  maxLimit: number = 1000
): boolean {
  if (limit !== undefined) {
    if (!Number.isInteger(limit) || limit < 0 || limit > maxLimit) {
      return false;
    }
  }

  if (offset !== undefined) {
    if (!Number.isInteger(offset) || offset < 0) {
      return false;
    }
  }

  return true;
}

/**
 * Validate depth parameter for browsing
 * 
 * @param depth - Browse depth
 * @param maxDepth - Maximum allowed depth (default: 10)
 * @returns true if valid, false otherwise
 */
export function validateDepth(depth?: number, maxDepth: number = 10): boolean {
  if (depth !== undefined) {
    if (!Number.isInteger(depth) || depth < 0 || depth > maxDepth) {
      return false;
    }
  }

  return true;
}

/**
 * Sanitize path component to prevent traversal
 * 
 * @param pathComponent - Path component to sanitize
 * @returns Sanitized path or empty string if invalid
 */
export function sanitizePath(pathComponent: string): string {
  if (!pathComponent || typeof pathComponent !== 'string') {
    return '';
  }

  // Remove path traversal attempts
  let sanitized = pathComponent
    .replace(/\.\./g, '')
    .replace(/\0/g, '')
    .trim();

  // Only allow safe characters
  if (!/^[a-zA-Z0-9\-_./]*$/.test(sanitized)) {
    return '';
  }

  return sanitized;
}

/**
 * Validate all required fields for insert operation
 * 
 * @param payload - Payload object
 * @param requiredFields - List of required fields
 * @returns true if all required fields present, false otherwise
 */
export function validateRequiredFields(payload: any, requiredFields: string[]): boolean {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  for (const field of requiredFields) {
    if (!(field in payload) || payload[field] === undefined || payload[field] === null) {
      return false;
    }

    // Check if field is empty string
    if (typeof payload[field] === 'string' && payload[field].trim() === '') {
      return false;
    }
  }

  return true;
}

/**
 * Validate rating value
 * 
 * @param rating - Rating to validate
 * @param min - Minimum value (default: 1)
 * @param max - Maximum value (default: 5)
 * @returns true if valid, false otherwise
 */
export function validateRating(rating?: number, min: number = 1, max: number = 5): boolean {
  if (rating === undefined || rating === null) {
    return true; // Optional field
  }

  if (!Number.isInteger(rating) || rating < min || rating > max) {
    return false;
  }

  return true;
}

/**
 * Validate array of tags
 * 
 * @param tags - Tags array to validate
 * @param maxTags - Maximum number of tags (default: 10)
 * @param maxTagLength - Maximum tag length (default: 50)
 * @returns true if valid, false otherwise
 */
export function validateTags(
  tags?: string[],
  maxTags: number = 10,
  maxTagLength: number = 50
): boolean {
  if (tags === undefined || tags === null) {
    return true; // Optional field
  }

  if (!Array.isArray(tags)) {
    return false;
  }

  if (tags.length > maxTags) {
    return false;
  }

  for (const tag of tags) {
    if (typeof tag !== 'string' || tag.length === 0 || tag.length > maxTagLength) {
      return false;
    }

    // Tag should only contain safe characters
    if (!/^[a-zA-Z0-9\-_]+$/.test(tag)) {
      return false;
    }
  }

  return true;
}
