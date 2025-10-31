/**
 * Tests for RemoteHouse Input Validators
 */

import { describe, it, expect } from 'vitest';
import {
  validateRepositoryName,
  validateSearchQuery,
  validatePrimaryIndex,
  validateRecordId,
  validateEmail,
  validateCommentContent,
  validatePayload,
  validatePagination,
  validateDepth,
  sanitizePath,
  validateRequiredFields,
  validateRating,
  validateTags,
} from '../validators';

describe('Validators', () => {
  describe('validateRepositoryName', () => {
    it('should accept valid repository names', () => {
      expect(validateRepositoryName('my-repo')).toBe(true);
      expect(validateRepositoryName('repo_123')).toBe(true);
      expect(validateRepositoryName('MyRepo')).toBe(true);
    });

    it('should reject path traversal attempts', () => {
      expect(validateRepositoryName('repo/../escape')).toBe(false);
      expect(validateRepositoryName('repo/subdir')).toBe(false);
      expect(validateRepositoryName('repo\\windows')).toBe(false);
    });

    it('should reject special characters', () => {
      expect(validateRepositoryName('repo@test')).toBe(false);
      expect(validateRepositoryName('repo!name')).toBe(false);
      expect(validateRepositoryName('repo<script>')).toBe(false);
    });

    it('should reject empty or too long names', () => {
      expect(validateRepositoryName('')).toBe(false);
      expect(validateRepositoryName('a'.repeat(300))).toBe(false);
    });

    it('should reject non-string input', () => {
      expect(validateRepositoryName(null as any)).toBe(false);
      expect(validateRepositoryName(undefined as any)).toBe(false);
      expect(validateRepositoryName(123 as any)).toBe(false);
    });
  });

  describe('validateSearchQuery', () => {
    it('should accept valid search queries', () => {
      expect(validateSearchQuery('avatar')).toBe(true);
      expect(validateSearchQuery('avatar 2009')).toBe(true);
      expect(validateSearchQuery('test query')).toBe(true);
    });

    it('should reject queries with shell metacharacters', () => {
      expect(validateSearchQuery('test; rm -rf')).toBe(false);
      expect(validateSearchQuery('test`whoami`')).toBe(false);
      expect(validateSearchQuery('test$(date)')).toBe(false);
      expect(validateSearchQuery('test | cat /etc/passwd')).toBe(false);
    });

    it('should enforce length limits', () => {
      expect(validateSearchQuery('a'.repeat(501))).toBe(false);
      expect(validateSearchQuery('')).toBe(false);
    });
  });

  describe('validatePrimaryIndex', () => {
    it('should accept valid paths', () => {
      expect(validatePrimaryIndex('movies')).toBe(true);
      expect(validatePrimaryIndex('movies/action')).toBe(true);
      expect(validatePrimaryIndex('movies/action/2024')).toBe(true);
    });

    it('should reject path traversal', () => {
      expect(validatePrimaryIndex('../escape')).toBe(false);
      expect(validatePrimaryIndex('movies/../escape')).toBe(false);
    });

    it('should reject absolute paths', () => {
      expect(validatePrimaryIndex('/etc/passwd')).toBe(false);
      expect(validatePrimaryIndex('/root')).toBe(false);
    });

    it('should reject empty components', () => {
      expect(validatePrimaryIndex('movies//')).toBe(false);
      expect(validatePrimaryIndex('')).toBe(false);
    });
  });

  describe('validateRecordId', () => {
    it('should accept valid record IDs', () => {
      expect(validateRecordId('record:123')).toBe(true);
      expect(validateRecordId('record-abc-def')).toBe(true);
      expect(validateRecordId('rec_123_abc')).toBe(true);
    });

    it('should reject special characters', () => {
      expect(validateRecordId('record@123')).toBe(false);
      expect(validateRecordId('record<123>')).toBe(false);
    });

    it('should enforce length limits', () => {
      expect(validateRecordId('a'.repeat(300))).toBe(false);
      expect(validateRecordId('')).toBe(false);
    });
  });

  describe('validateEmail', () => {
    it('should accept valid emails', () => {
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('test.user+tag@sub.example.co.uk')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(validateEmail('notanemail')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
    });

    it('should enforce length limits', () => {
      expect(validateEmail('a'.repeat(300) + '@example.com')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });
  });

  describe('validateCommentContent', () => {
    it('should accept valid comments', () => {
      expect(validateCommentContent('Great movie!')).toBe(true);
      expect(validateCommentContent('A'.repeat(1000))).toBe(true);
    });

    it('should reject empty comments', () => {
      expect(validateCommentContent('')).toBe(false);
    });

    it('should reject comments exceeding max length', () => {
      expect(validateCommentContent('a'.repeat(5001))).toBe(false);
    });

    it('should reject null characters', () => {
      expect(validateCommentContent('comment\0injection')).toBe(false);
    });
  });

  describe('validatePayload', () => {
    it('should accept valid payloads', () => {
      expect(validatePayload({ primary_index: 'movies' })).toBe(true);
      expect(validatePayload({ primary_index: 'movies', title: 'Avatar' })).toBe(true);
    });

    it('should reject missing primary_index', () => {
      expect(validatePayload({ title: 'Avatar' })).toBe(false);
      expect(validatePayload({ primary_index: '' })).toBe(false);
    });

    it('should reject oversized payloads', () => {
      const largePayload = {
        primary_index: 'movies',
        data: 'a'.repeat(2000000),
      };
      expect(validatePayload(largePayload)).toBe(false);
    });
  });

  describe('validatePagination', () => {
    it('should accept valid pagination', () => {
      expect(validatePagination(50, 0)).toBe(true);
      expect(validatePagination(100, 50)).toBe(true);
      expect(validatePagination(1, 100)).toBe(true);
    });

    it('should reject negative values', () => {
      expect(validatePagination(-1, 0)).toBe(false);
      expect(validatePagination(50, -1)).toBe(false);
    });

    it('should reject values exceeding limits', () => {
      expect(validatePagination(1001, 0)).toBe(false);
    });

    it('should accept undefined values', () => {
      expect(validatePagination(undefined, 0)).toBe(true);
      expect(validatePagination(50, undefined)).toBe(true);
    });
  });

  describe('validateDepth', () => {
    it('should accept valid depth values', () => {
      expect(validateDepth(1)).toBe(true);
      expect(validateDepth(5)).toBe(true);
      expect(validateDepth(10)).toBe(true);
    });

    it('should reject negative depth', () => {
      expect(validateDepth(-1)).toBe(false);
    });

    it('should reject depth exceeding max', () => {
      expect(validateDepth(11)).toBe(false);
    });

    it('should accept undefined', () => {
      expect(validateDepth(undefined)).toBe(true);
    });
  });

  describe('sanitizePath', () => {
    it('should remove path traversal attempts', () => {
      expect(sanitizePath('../escape')).toBe('escape');
      expect(sanitizePath('path/../../escape')).toBe('path/escape');
    });

    it('should remove null characters', () => {
      expect(sanitizePath('path\0injection')).toBe('pathinjection');
    });

    it('should preserve valid characters', () => {
      expect(sanitizePath('valid-path_123')).toBe('valid-path_123');
      expect(sanitizePath('path/to/file')).toBe('path/to/file');
    });

    it('should return empty string for invalid input', () => {
      expect(sanitizePath('')).toBe('');
      expect(sanitizePath(null as any)).toBe('');
    });
  });

  describe('validateRequiredFields', () => {
    it('should accept payload with all required fields', () => {
      const payload = { name: 'test', email: 'test@example.com' };
      expect(validateRequiredFields(payload, ['name', 'email'])).toBe(true);
    });

    it('should reject missing required fields', () => {
      const payload = { name: 'test' };
      expect(validateRequiredFields(payload, ['name', 'email'])).toBe(false);
    });

    it('should reject empty string fields', () => {
      const payload = { name: '', email: 'test@example.com' };
      expect(validateRequiredFields(payload, ['name', 'email'])).toBe(false);
    });

    it('should reject null or undefined fields', () => {
      expect(validateRequiredFields({ name: null }, ['name'])).toBe(false);
      expect(validateRequiredFields({ name: undefined }, ['name'])).toBe(false);
    });
  });

  describe('validateRating', () => {
    it('should accept valid ratings', () => {
      expect(validateRating(1)).toBe(true);
      expect(validateRating(3)).toBe(true);
      expect(validateRating(5)).toBe(true);
    });

    it('should reject ratings outside range', () => {
      expect(validateRating(0)).toBe(false);
      expect(validateRating(6)).toBe(false);
    });

    it('should accept undefined (optional field)', () => {
      expect(validateRating(undefined)).toBe(true);
    });
  });

  describe('validateTags', () => {
    it('should accept valid tag arrays', () => {
      expect(validateTags(['sci-fi', 'action'])).toBe(true);
      expect(validateTags(['tag1', 'tag2', 'tag3'])).toBe(true);
      expect(validateTags([])).toBe(true);
    });

    it('should reject too many tags', () => {
      const manyTags = Array(11).fill('tag');
      expect(validateTags(manyTags)).toBe(false);
    });

    it('should reject tags that are too long', () => {
      expect(validateTags(['a'.repeat(51)])).toBe(false);
    });

    it('should reject empty tag strings', () => {
      expect(validateTags(['', 'valid-tag'])).toBe(false);
    });

    it('should reject invalid characters in tags', () => {
      expect(validateTags(['tag@invalid', 'tag<script>'])).toBe(false);
    });

    it('should accept undefined (optional field)', () => {
      expect(validateTags(undefined)).toBe(true);
    });
  });
});
