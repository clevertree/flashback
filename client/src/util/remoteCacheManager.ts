/**
 * Remote File Cache Manager
 *
 * Manages caching of remote files from other clients with:
 * - Local file system storage
 * - Smart HTTP cache validation (ETag, Last-Modified)
 * - Automatic cache expiration
 * - HTTP server integration
 */

import { useState, useEffect } from 'react';

export interface CacheEntry {
  etag?: string;
  lastModified?: string;
  filePath: string;
  size: number;
  contentType: string;
  cachedAt: Date;
  expiresAt: Date;
}

export interface CacheMetadata {
  cacheVersion: number;
  clientEmail: string;
  lastSync: Date;
  files: Record<string, CacheEntry>;
}

export interface CacheOptions {
  maxAge?: number; // Max age in seconds (default: 3600)
  forceRefresh?: boolean; // Ignore cache and fetch fresh
  cacheBuster?: string; // Custom cache buster
}

export interface CachedFileInfo {
  url: string;
  cached: boolean;
  size: number;
  cachedAt: Date;
  expiresAt: Date;
  cacheHit: boolean;
}

/**
 * Remote Cache Manager
 *
 * Manages caching of remote files with HTTP cache validation
 */
export class RemoteCacheManager {
  private httpServerPort: number;
  private clientEmail: string;
  private cacheMetadata: Map<string, CacheEntry> = new Map();

  constructor(httpServerPort: number = 8888, clientEmail: string = '') {
    this.httpServerPort = httpServerPort;
    this.clientEmail = clientEmail;
  }

  /**
   * Set the HTTP server port (call this once on app startup)
   */
  setHttpServerPort(port: number): void {
    this.httpServerPort = port;
  }

  /**
   * Set the current client email
   */
  setClientEmail(email: string): void {
    this.clientEmail = email;
  }

  /**
   * Get the full URL for a remote file
   * URLs can be used directly in <img>, <video>, etc. tags
   */
  getFileUrl(filePath: string): string {
    return `http://localhost:${this.httpServerPort}/remote/${encodeURIComponent(
      this.clientEmail
    )}/${encodeURIComponent(filePath)}`;
  }

  /**
   * Get compact URL using client and file hashes
   * Useful for shorter URLs in some contexts
   */
  getFileUrlCompact(clientHash: string, fileHash: string): string {
    return `http://localhost:${this.httpServerPort}/r/${clientHash}/${fileHash}`;
  }

  /**
   * Get both full and compact URLs
   */
  getFileUrls(filePath: string): { full: string; compact: string } {
    const fullUrl = this.getFileUrl(filePath);
    const clientHash = this.hashString(this.clientEmail).substring(0, 8);
    const fileHash = this.hashString(filePath).substring(0, 8);
    const compactUrl = this.getFileUrlCompact(clientHash, fileHash);

    return { full: fullUrl, compact: compactUrl };
  }

  /**
   * Request a file to be cached
   * Returns URLs that can be used immediately
   */
  async cacheRemoteFile(
    filePath: string,
    options: CacheOptions = {}
  ): Promise<CachedFileInfo> {
    const url = this.getFileUrl(filePath);
    const cacheKey = `${this.clientEmail}::${filePath}`;
    const cachedEntry = this.cacheMetadata.get(cacheKey);

    try {
      const headers: Record<string, string> = {
        'Cache-Control': options.forceRefresh
          ? 'no-cache'
          : `max-age=${options.maxAge || 3600}`,
      };

      // Add conditional headers for cache validation
      if (cachedEntry?.etag && !options.forceRefresh) {
        headers['If-None-Match'] = cachedEntry.etag;
      }
      if (cachedEntry?.lastModified && !options.forceRefresh) {
        headers['If-Modified-Since'] = cachedEntry.lastModified;
      }

      const response = await fetch(url, { headers });

      // 304 Not Modified - cache is still valid
      if (response.status === 304) {
        return {
          url,
          cached: true,
          size: cachedEntry?.size || 0,
          cachedAt: cachedEntry?.cachedAt || new Date(),
          expiresAt: cachedEntry?.expiresAt || new Date(),
          cacheHit: true,
        };
      }

      // 200 OK - file was fetched
      if (response.ok) {
        const size = parseInt(response.headers.get('content-length') || '0');
        const etag = response.headers.get('etag') || undefined;
        const lastModified = response.headers.get('last-modified') || undefined;
        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        const maxAge = options.maxAge || 3600;

        const entry: CacheEntry = {
          etag,
          lastModified,
          filePath,
          size,
          contentType,
          cachedAt: new Date(),
          expiresAt: new Date(Date.now() + maxAge * 1000),
        };

        // Store in cache metadata
        this.cacheMetadata.set(cacheKey, entry);

        // Try to store in Tauri command for persistence
        await this.persistCacheEntry(entry);

        return {
          url,
          cached: false,
          size,
          cachedAt: entry.cachedAt,
          expiresAt: entry.expiresAt,
          cacheHit: false,
        };
      }

      throw new Error(`Unexpected response: ${response.status}`);
    } catch (error) {
      console.error('Error caching remote file:', error);
      // Return URL anyway - let the HTTP server handle the fetch
      return {
        url,
        cached: false,
        size: 0,
        cachedAt: new Date(),
        expiresAt: new Date(),
        cacheHit: false,
      };
    }
  }

  /**
   * Validate if a cached entry is still fresh
   */
  isCacheFresh(filePath: string): boolean {
    const cacheKey = `${this.clientEmail}::${filePath}`;
    const entry = this.cacheMetadata.get(cacheKey);

    if (!entry) {
      return false;
    }

    return entry.expiresAt > new Date();
  }

  /**
   * Get cache status for a file
   */
  getCacheStatus(filePath: string): CachedFileInfo | null {
    const cacheKey = `${this.clientEmail}::${filePath}`;
    const entry = this.cacheMetadata.get(cacheKey);

    if (!entry) {
      return null;
    }

    return {
      url: this.getFileUrl(filePath),
      cached: true,
      size: entry.size,
      cachedAt: entry.cachedAt,
      expiresAt: entry.expiresAt,
      cacheHit: this.isCacheFresh(filePath),
    };
  }

  /**
   * Load cache metadata from server
   */
  async loadCacheMetadata(): Promise<CacheMetadata | null> {
    try {
      const response = await fetch(
        `http://localhost:${this.httpServerPort}/api/cache/metadata`
      );

      if (!response.ok) {
        return null;
      }

      const metadata: CacheMetadata = await response.json();

      // Populate cache
      Object.entries(metadata.files).forEach(([key, entry]) => {
        entry.cachedAt = new Date(entry.cachedAt);
        entry.expiresAt = new Date(entry.expiresAt);
        this.cacheMetadata.set(key, entry);
      });

      return metadata;
    } catch (error) {
      console.error('Error loading cache metadata:', error);
      return null;
    }
  }

  /**
   * Get cache status from server
   */
  async getCacheStatusFromServer(): Promise<any> {
    try {
      const response = await fetch(
        `http://localhost:${this.httpServerPort}/api/cache/status`
      );

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting cache status from server:', error);
      return null;
    }
  }

  /**
   * Clear all cache
   */
  async clearCache(): Promise<boolean> {
    try {
      const response = await fetch(
        `http://localhost:${this.httpServerPort}/api/cache/clear`,
        { method: 'POST' }
      );

      if (response.ok) {
        this.cacheMetadata.clear();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error clearing cache:', error);
      return false;
    }
  }

  /**
   * Clear cache for a specific client
   */
  async clearClientCache(clientEmail: string): Promise<boolean> {
    try {
      const response = await fetch(
        `http://localhost:${this.httpServerPort}/api/cache/clear/${encodeURIComponent(
          clientEmail
        )}`,
        { method: 'POST' }
      );

      if (response.ok) {
        // Remove entries for this client
        Array.from(this.cacheMetadata.entries()).forEach(([key]) => {
          if (key.startsWith(`${clientEmail}::`)) {
            this.cacheMetadata.delete(key);
          }
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error clearing client cache:', error);
      return false;
    }
  }

  /**
   * Persist cache entry to server
   */
  private async persistCacheEntry(entry: CacheEntry): Promise<void> {
    try {
      const api: any = window.flashbackApi;
      if (api?.cachePutEntry) {
        await api.cachePutEntry({
          client_email: this.clientEmail,
          file_path: entry.filePath,
          etag: entry.etag,
          last_modified: entry.lastModified,
          size: entry.size,
          content_type: entry.contentType,
          expires_at: entry.expiresAt.toISOString(),
        });
      }
    } catch (error) {
      console.error('Error persisting cache entry:', error);
    }
  }

  /**
   * Simple hash function for generating short IDs
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }
}

/**
 * React Hook for using the remote cache manager
 */
export function useRemoteCache(clientEmail: string, httpServerPort: number = 8888) {
  const [manager] = useState(() => {
    const m = new RemoteCacheManager(httpServerPort, clientEmail);
    m.loadCacheMetadata(); // Load async
    return m;
  });

  useEffect(() => {
    manager.setClientEmail(clientEmail);
  }, [clientEmail, manager]);

  return {
    getFileUrl: (filePath: string) => manager.getFileUrl(filePath),
    getFileUrls: (filePath: string) => manager.getFileUrls(filePath),
    cacheFile: (filePath: string, options?: CacheOptions) =>
      manager.cacheRemoteFile(filePath, options),
    isCacheFresh: (filePath: string) => manager.isCacheFresh(filePath),
    getCacheStatus: (filePath: string) => manager.getCacheStatus(filePath),
    getCacheStatusFromServer: () => manager.getCacheStatusFromServer(),
    clearCache: () => manager.clearCache(),
    clearClientCache: (email: string) => manager.clearClientCache(email),
  };
}

export default RemoteCacheManager;
