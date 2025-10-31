# Frontend Usage Guide: Phase 1 Tauri Commands

**Target Audience:** Frontend developers (TypeScript/React)  
**Date:** November 1, 2024  
**Status:** Ready to implement

---

## Quick Start

All 12 Fabric commands are now available to React components via Tauri's `invoke` function.

### Import and Usage

```typescript
import { invoke } from '@tauri-apps/api/core';

// Query entries from a Fabric channel
const entries = await invoke<BlockchainEntry[]>('fabric_query_entries', {
  channel: 'movies',
  query: 'avatar',
  tags: ['sci-fi'],
  limit: 50,
  offset: 0,
});
```

---

## TypeScript Types

Add these types to your project:

```typescript
// Type definitions for Fabric commands

interface BlockchainEntry {
  id: string;
  title: string;
  description?: string;
  creator?: string;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
  commentCount?: number;
  torrentHash?: string;
}

interface BlockchainComment {
  id: string;
  entryId: string;
  content: string;
  rating?: number;
  commentedBy: string;
  createdAt: string;
  updatedAt?: string;
  deletedBy?: string;
  status: 'active' | 'deleted' | 'flagged';
  editCount?: number;
}

interface TransactionResult {
  id: string;
  transactionId: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  message: string;
  error?: string;
}
```

---

## Command Reference

### Channel Management

#### Get Available Channels
```typescript
const channels = await invoke<string[]>('fabric_get_channels');
// Returns: ['movies', 'tv-shows', 'documentaries', 'anime', 'tutorials']
```

#### Subscribe to Channel
```typescript
const result = await invoke<string>('fabric_subscribe_channel', {
  channel: 'movies',
});
// Returns: 'SUBSCRIBED OK movies'
```

#### Unsubscribe from Channel
```typescript
const result = await invoke<string>('fabric_unsubscribe_channel', {
  channel: 'movies',
});
// Returns: 'UNSUBSCRIBED OK movies'
```

---

### Query Commands

#### Query Entries (Full-Text Search)
```typescript
const entries = await invoke<BlockchainEntry[]>('fabric_query_entries', {
  channel: 'movies',
  query: 'avatar',           // Optional: search string
  tags: ['sci-fi'],          // Optional: tag filter
  limit: 50,                 // Optional: max results (default 50, max 1000)
  offset: 0,                 // Optional: pagination (default 0)
});

// Example response:
[
  {
    id: 'entry:001',
    title: 'Avatar (2009)',
    description: 'Epic sci-fi film',
    creator: 'user@example.com',
    createdAt: '2025-10-31T10:00:00Z',
    tags: ['sci-fi', 'james-cameron'],
    commentCount: 42,
    torrentHash: 'abc123def456',
  },
]
```

#### Get Single Entry
```typescript
const entry = await invoke<BlockchainEntry>('fabric_get_entry', {
  channel: 'movies',
  entry_id: 'entry:001',
});
```

#### Query Comments on Entry
```typescript
const comments = await invoke<BlockchainComment[]>('fabric_query_comments', {
  channel: 'movies',
  entry_id: 'entry:001',
  include_deleted: false,  // Optional: show deleted in audit trail
});

// Example response:
[
  {
    id: 'comment:001',
    entryId: 'entry:001',
    content: 'Amazing movie!',
    rating: 5,
    commentedBy: 'alice@example.com',
    createdAt: '2025-10-31T11:00:00Z',
    status: 'active',
  },
]
```

---

### Entry Mutations

#### Add New Entry
```typescript
const result = await invoke<TransactionResult>('fabric_add_entry', {
  channel: 'movies',
  title: 'Dune (2021)',              // Required: 1-255 chars
  description: 'Sci-fi epic',        // Optional: max 2000 chars
  tags: ['sci-fi', 'denis-villeneuve'], // Optional: max 10 tags
});

// Example response:
{
  id: 'entry:new',
  transactionId: 'tx:abc123',
  status: 'SUCCESS',
  message: 'Entry created successfully',
}
```

#### Update Entry
```typescript
const result = await invoke<TransactionResult>('fabric_update_entry', {
  channel: 'movies',
  entry_id: 'entry:001',
  title: 'Avatar (2009) - Updated',  // Optional: new title
  description: 'Updated description', // Optional: new description
  tags: ['sci-fi', 'remaster'],       // Optional: new tags
});
```

#### Delete Entry (Mark as Deleted)
```typescript
const result = await invoke<TransactionResult>('fabric_delete_entry', {
  channel: 'movies',
  entry_id: 'entry:001',
  reason: 'Duplicate entry',  // Optional: reason for deletion
});

// Note: Entry is marked deleted, not erased. Audit trail preserved.
```

---

### Comment Mutations

#### Add Comment to Entry
```typescript
const result = await invoke<TransactionResult>('fabric_add_comment', {
  channel: 'movies',
  entry_id: 'entry:001',
  content: 'Amazing film, must watch!',  // Required: 1-2000 chars
  rating: 5,                             // Optional: 1-5 rating
});

// Returns: new comment ID in result.id
```

#### Update Comment
```typescript
const result = await invoke<TransactionResult>('fabric_update_comment', {
  channel: 'movies',
  entry_id: 'entry:001',
  comment_id: 'comment:001',
  content: 'Updated review text',  // Optional: new content
  rating: 4,                        // Optional: new rating
});

// Note: Only comment owner or admin can update
// Edit count is incremented, updatedAt is recorded
```

#### Delete Comment (Mark as Deleted)
```typescript
const result = await invoke<TransactionResult>('fabric_delete_comment', {
  channel: 'movies',
  entry_id: 'entry:001',
  comment_id: 'comment:001',
  reason: 'Inappropriate content',  // Optional: reason
});

// Note: Comment is marked deleted, not erased
```

---

## React Component Examples

### RepoBrowser Component Integration

```typescript
// src/components/RepoBrowser.tsx
import { invoke } from '@tauri-apps/api/core';
import { useState, useEffect } from 'react';

interface Props {
  channel: string;
  searchQuery?: string;
  tags?: string[];
}

export function RepoBrowser({ channel, searchQuery, tags }: Props) {
  const [entries, setEntries] = useState<BlockchainEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEntries() {
      setLoading(true);
      setError(null);
      try {
        const result = await invoke<BlockchainEntry[]>(
          'fabric_query_entries',
          {
            channel,
            query: searchQuery || undefined,
            tags: tags && tags.length > 0 ? tags : undefined,
            limit: 50,
            offset: 0,
          }
        );
        setEntries(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        // Fall back to local cache on error
        console.warn('Failed to load entries, using cache', err);
      } finally {
        setLoading(false);
      }
    }

    loadEntries();
  }, [channel, searchQuery, tags]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="repo-browser">
      {entries.map((entry) => (
        <EntryCard key={entry.id} entry={entry} />
      ))}
      {entries.length === 0 && <div>No entries found</div>}
    </div>
  );
}

function EntryCard({ entry }: { entry: BlockchainEntry }) {
  return (
    <div className="entry-card">
      <h3>{entry.title}</h3>
      <p>{entry.description}</p>
      {entry.tags && <div className="tags">{entry.tags.join(', ')}</div>}
      <div className="meta">
        {entry.commentCount && <span>💬 {entry.commentCount} comments</span>}
        {entry.creator && <span>by {entry.creator}</span>}
      </div>
    </div>
  );
}
```

### BroadcastSection Component Integration

```typescript
// src/components/BroadcastSection.tsx
import { invoke } from '@tauri-apps/api/core';
import { useState, useEffect } from 'react';

export function BroadcastSection() {
  const [channels, setChannels] = useState<string[]>([]);
  const [subscribed, setSubscribed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadChannels() {
      try {
        const channelList = await invoke<string[]>('fabric_get_channels');
        setChannels(channelList);
      } catch (err) {
        console.error('Failed to load channels:', err);
      }
    }

    loadChannels();
  }, []);

  const handleSubscribe = async (channel: string) => {
    setLoading(true);
    try {
      await invoke<string>('fabric_subscribe_channel', { channel });
      setSubscribed((prev) => new Set([...prev, channel]));
    } catch (err) {
      console.error('Failed to subscribe:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async (channel: string) => {
    setLoading(true);
    try {
      await invoke<string>('fabric_unsubscribe_channel', { channel });
      setSubscribed((prev) => {
        const next = new Set(prev);
        next.delete(channel);
        return next;
      });
    } catch (err) {
      console.error('Failed to unsubscribe:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="broadcast-section">
      <h3>Channel Subscriptions</h3>
      <div className="channels">
        {channels.map((channel) => (
          <div key={channel} className="channel-item">
            <span>{channel}</span>
            {subscribed.has(channel) ? (
              <button
                onClick={() => handleUnsubscribe(channel)}
                disabled={loading}
              >
                Unsubscribe
              </button>
            ) : (
              <button onClick={() => handleSubscribe(channel)} disabled={loading}>
                Subscribe
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Comments Component with Ownership

```typescript
// src/components/EntryComments.tsx
import { invoke } from '@tauri-apps/api/core';
import { useState, useEffect } from 'react';

interface Props {
  channel: string;
  entryId: string;
  currentUserEmail: string; // From X.509 certificate
}

export function EntryComments({
  channel,
  entryId,
  currentUserEmail,
}: Props) {
  const [comments, setComments] = useState<BlockchainComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadComments() {
      try {
        const result = await invoke<BlockchainComment[]>(
          'fabric_query_comments',
          {
            channel,
            entry_id: entryId,
            include_deleted: false,
          }
        );
        setComments(result);
      } catch (err) {
        console.error('Failed to load comments:', err);
      }
    }

    loadComments();
  }, [channel, entryId]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setLoading(true);
    try {
      await invoke<TransactionResult>('fabric_add_comment', {
        channel,
        entry_id: entryId,
        content: newComment,
      });
      setNewComment('');
      // Reload comments
      const result = await invoke<BlockchainComment[]>(
        'fabric_query_comments',
        {
          channel,
          entry_id: entryId,
          include_deleted: false,
        }
      );
      setComments(result);
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setLoading(false);
    }
  };

  const canEditComment = (comment: BlockchainComment) => {
    // Only owner can edit
    return comment.commentedBy === currentUserEmail;
  };

  const handleDeleteComment = async (comment: BlockchainComment) => {
    if (!canEditComment(comment)) {
      alert('You can only delete your own comments');
      return;
    }

    setLoading(true);
    try {
      await invoke<TransactionResult>('fabric_delete_comment', {
        channel,
        entry_id: entryId,
        comment_id: comment.id,
        reason: 'User requested deletion',
      });
      // Reload
      const result = await invoke<BlockchainComment[]>(
        'fabric_query_comments',
        {
          channel,
          entry_id: entryId,
          include_deleted: false,
        }
      );
      setComments(result);
    } catch (err) {
      console.error('Failed to delete comment:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="entry-comments">
      <h4>Comments ({comments.length})</h4>

      {comments.map((comment) => (
        <div key={comment.id} className="comment">
          <div className="comment-header">
            <strong>{comment.commentedBy}</strong>
            <span className="date">
              {new Date(comment.createdAt).toLocaleDateString()}
            </span>
            {comment.rating && <span className="rating">⭐ {comment.rating}</span>}
          </div>
          <p className="content">{comment.content}</p>
          {canEditComment(comment) && (
            <button onClick={() => handleDeleteComment(comment)} disabled={loading}>
              Delete
            </button>
          )}
        </div>
      ))}

      <div className="add-comment">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          maxLength={2000}
        />
        <button onClick={handleAddComment} disabled={loading || !newComment.trim()}>
          Post Comment
        </button>
      </div>
    </div>
  );
}
```

---

## Error Handling

All commands return `Result<T, String>`. Handle errors gracefully:

```typescript
try {
  const entries = await invoke<BlockchainEntry[]>('fabric_query_entries', {
    channel: 'movies',
  });
} catch (error) {
  if (typeof error === 'string') {
    // Tauri command error
    console.error('Command error:', error);
    if (error.includes('Channel name required')) {
      // Handle missing channel
    } else if (error.includes('Permission denied')) {
      // Handle permission error
    }
  } else {
    // Other error
    console.error('Unexpected error:', error);
  }
}
```

---

## Caching Strategy

**Recommended:** Implement local caching to handle offline scenarios:

```typescript
// src/hooks/useEntries.ts
import { invoke } from '@tauri-apps/api/core';
import { useState, useEffect } from 'react';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();

export function useEntries(channel: string, query?: string) {
  const [entries, setEntries] = useState<BlockchainEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEntries() {
      const cacheKey = `${channel}:${query || ''}`;
      const cached = cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setEntries(cached.data);
        return;
      }

      setLoading(true);
      try {
        const result = await invoke<BlockchainEntry[]>(
          'fabric_query_entries',
          { channel, query }
        );
        cache.set(cacheKey, { data: result, timestamp: Date.now() });
        setEntries(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        // Use stale cache on error
        if (cached) {
          setEntries(cached.data);
        }
      } finally {
        setLoading(false);
      }
    }

    loadEntries();
  }, [channel, query]);

  return { entries, loading, error };
}
```

---

## Status Codes & Responses

**Current (Phase 1 - Scaffolding):**
- All commands return mock success responses
- No real blockchain calls yet

**After Phase 1.5 (SDK Integration):**
- Real Fabric network responses
- Actual blockchain transaction results
- Proper error propagation from orderers

---

## Next Steps for Frontend

1. ✅ Tauri commands are ready (Phase 1)
2. Add TypeScript type definitions to your project
3. Implement caching layer for offline support
4. Create custom React hooks for common patterns
5. Test against mock responses (currently available)
6. After Phase 3, test against local Fabric network

---

## Troubleshooting

### "Command not found" error
- Make sure you're running latest version with Phase 1 scaffolding
- Check that Tauri app is rebuilt: `cargo tauri build`

### Mock data returned instead of real Fabric responses
- Expected during Phase 1 (scaffolding)
- Real Fabric SDK integration happens in Phase 1.5
- Feel free to implement features assuming real data will work

### Input validation errors
- Check field lengths and formats
- Review error message - it will tell you what's wrong
- See "Type definitions" section above for valid ranges

---

## References

📖 **Complete API Spec:** `docs/FABRIC_TAURI_API_BRIDGE.md`  
📖 **Implementation Guide:** `docs/PHASE_1_IMPLEMENTATION.md`  
📖 **Data Models:** `docs/REPOSITORY_DATA_MODEL.md`

---

**Status:** ✅ Ready for frontend development!
