# Comment Ownership & Permissions Model

**Status:** Design Decision  
**Date:** October 31, 2025  
**Version:** 1.0  
**Type:** Permission & Data Model Specification

---

## Executive Summary

### Rule: Comment Ownership & Editing

1. **Comments store the email of the signing client**
2. **Default permission: Users can only edit/delete their own comments**
3. **Admin capability: Can edit/delete any comment**
4. **Immutability: Comments cannot be deleted, only marked as deleted**

---

## Comment Data Model (Updated)

### Comment Schema with Ownership

**Key:** `comment:<entryId>:<commentId>` (on the same channel as the entry)

```javascript
{
  // Identifiers
  id: "review-789",
  entryId: "movie-001",
  
  // Content
  content: "Great movie! Loved the plot.",
  type: "review",                          // "review", "rating", "annotation"
  rating: 5,                               // 1-5 stars (optional)
  
  // Ownership & Tracking
  commentedBy: "alice@example.com",        // ← OWNER (from X.509 cert)
  commentedAt: "2025-10-31T11:00:00Z",   // Creation timestamp
  
  // Edit History
  updatedBy: "alice@example.com",          // Last editor (must be same as commentedBy unless admin)
  updatedAt: "2025-10-31T11:30:00Z",     // Last edit timestamp
  editCount: 1,                            // Number of edits
  
  // Status
  status: "active",                        // "active", "flagged", "deleted"
  deletedBy: "alice@example.com",          // Who marked as deleted (if applicable)
  deletedAt: "2025-10-31T12:00:00Z",     // When marked deleted (if applicable)
  
  // Statistics
  likes: 23                                // Like count (cached)
}
```

### Key Points

1. **`commentedBy` is the owner** - Stored from X.509 certificate of signing client
2. **`updatedBy` must match `commentedBy` by default** - Only owner can edit
3. **Comments are never truly deleted** - Only marked as `status: "deleted"`
4. **Edit history is tracked** - `editCount` and `updatedAt` show modification history
5. **Admins can override** - If user has `admin` capability, can edit any comment

---

## Permissions Model

### Default Permissions (No Admin)

```
User: alice@example.com
Capabilities: ["add-entry", "comment"]

Can:
✅ Add new comments
✅ Edit OWN comments (where commentedBy == alice@example.com)
✅ Mark OWN comments as deleted
✅ View all comments (read-only)

Cannot:
❌ Edit other users' comments
❌ Delete other users' comments
❌ Change commentedBy field
❌ Modify creation/deletion timestamps
```

### Admin Permissions

```
User: moderator@example.com
Capabilities: ["add-entry", "comment", "admin"]

Can:
✅ Everything users can do
✅ Edit ANY comment (including updating commentedBy if needed)
✅ Delete ANY comment (mark as deleted with reason)
✅ Manage comment flags (spam, offensive, etc.)
✅ Restore deleted comments
```

### Chaincode Implementation

**Function: updateComment**

```javascript
async updateComment(ctx, entryId, commentId, updates) {
  // Get invoker's certificate
  const invokerEmail = ctx.clientIdentity.getID();
  
  // Get existing comment
  const commentKey = `comment:${entryId}:${commentId}`;
  const commentJson = await ctx.stub.getState(commentKey);
  const comment = JSON.parse(commentJson);
  
  // Check permissions
  const isOwner = comment.commentedBy === invokerEmail;
  const isAdmin = ctx.clientIdentity.hasAttr("admin");
  
  if (!isOwner && !isAdmin) {
    throw new Error(`Not authorized to edit comment ${commentId}`);
  }
  
  // Apply updates
  if (updates.content) {
    comment.content = updates.content;
  }
  if (updates.rating && updates.rating >= 1 && updates.rating <= 5) {
    comment.rating = updates.rating;
  }
  
  // Update tracking
  comment.updatedBy = invokerEmail;
  comment.updatedAt = new Date().toISOString();
  comment.editCount = (comment.editCount || 0) + 1;
  
  // Emit event
  ctx.stub.setEvent("comment-updated", JSON.stringify({
    entryId,
    commentId,
    updatedBy: invokerEmail,
    updatedAt: comment.updatedAt
  }));
  
  // Persist
  await ctx.stub.putState(commentKey, JSON.stringify(comment));
  
  return comment;
}
```

**Function: deleteComment**

```javascript
async deleteComment(ctx, entryId, commentId, reason = null) {
  const invokerEmail = ctx.clientIdentity.getID();
  
  const commentKey = `comment:${entryId}:${commentId}`;
  const commentJson = await ctx.stub.getState(commentKey);
  const comment = JSON.parse(commentJson);
  
  // Check permissions
  const isOwner = comment.commentedBy === invokerEmail;
  const isAdmin = ctx.clientIdentity.hasAttr("admin");
  
  if (!isOwner && !isAdmin) {
    throw new Error(`Not authorized to delete comment ${commentId}`);
  }
  
  // Mark as deleted (don't remove from ledger!)
  comment.status = "deleted";
  comment.deletedBy = invokerEmail;
  comment.deletedAt = new Date().toISOString();
  comment.deletionReason = reason;
  
  // Emit event
  ctx.stub.setEvent("comment-deleted", JSON.stringify({
    entryId,
    commentId,
    deletedBy: invokerEmail,
    deletedAt: comment.deletedAt,
    reason
  }));
  
  // Persist
  await ctx.stub.putState(commentKey, JSON.stringify(comment));
  
  return { success: true, comment };
}
```

---

## Comment Key Structure

### Key Composition

```
comment:<entryId>:<commentId>

Where:
- entryId: "movie-001" (the movie being commented on)
- commentId: "review-789" (unique ID for this specific comment)

Example keys:
comment:movie-001:review-789          ← Alice's review
comment:movie-001:rating-234          ← Bob's rating
comment:movie-001:annotation-567      ← Charlie's annotation
```

### Query Pattern: All Comments for Entry

```javascript
// Get all comments for movie-001 (including deleted)
const iterator = await ctx.stub.getStateByRange(
  `comment:movie-001:`,
  `comment:movie-001:zzz`
);

// Get only active comments for movie-001
const allComments = [];
while (true) {
  const result = await iterator.next();
  if (result.done) break;
  const comment = JSON.parse(result.value.value.toString());
  if (comment.status === "active") {
    allComments.push(comment);
  }
}
```

### Query Pattern: Comments by Author

```javascript
// Get all comments by alice@example.com (across all entries in channel)
const iterator = await ctx.stub.getStateByRange("comment:", "comment:zzz");

const aliceComments = [];
while (true) {
  const result = await iterator.next();
  if (result.done) break;
  const comment = JSON.parse(result.value.value.toString());
  if (comment.commentedBy === "alice@example.com" && comment.status === "active") {
    aliceComments.push(comment);
  }
}
```

---

## Ledger Immutability & Audit Trail

### Why Comments Aren't Deleted

```
Blockchain Design Principle: Immutability

Option 1: Delete comments from ledger ❌
- Breaks immutability
- Cannot prove what was deleted or why
- Corrupts audit trail
- Other peers might have different view

Option 2: Mark as deleted (status: "deleted") ✅
- Preserves immutability
- Creates audit trail (who, when, why)
- All peers agree on deletion
- Can restore if needed
- Transparent to auditors
```

### Audit Trail Example

```
Movie-001 Comment Timeline:

Block 100:
  comment:movie-001:review-789 created
  commentedBy: alice@example.com
  content: "Great movie!"
  commentedAt: 2025-10-31T11:00:00Z

Block 105:
  comment:movie-001:review-789 updated
  updatedBy: alice@example.com
  content: "Great movie! Best ending ever!"
  updatedAt: 2025-10-31T11:30:00Z
  editCount: 1

Block 120:
  comment:movie-001:review-789 marked deleted
  deletedBy: alice@example.com
  status: "deleted"
  deletionReason: "Changed my mind"
  deletedAt: 2025-10-31T12:00:00Z

Full History Preserved:
✅ Original comment visible
✅ All edits visible
✅ Deletion timestamp visible
✅ Chain of ownership visible
❌ Nothing truly "erased"
```

---

## Client API & UI

### Tauri API

```typescript
// Create comment (client signs with X.509 certificate)
async function addComment(
  channel: string,
  entryId: string,
  comment: {
    content: string;
    rating?: number;
    type: "review" | "rating" | "annotation";
  }
): Promise<string> {
  // Client SDK automatically:
  // 1. Extracts email from user's X.509 cert
  // 2. Sets commentedBy = email
  // 3. Signs transaction with private key
  
  return await invoke("add_comment", {
    channel,
    entryId,
    content: comment.content,
    rating: comment.rating,
    type: comment.type
  });
}

// Update comment (client verifies ownership)
async function updateComment(
  channel: string,
  entryId: string,
  commentId: string,
  updates: {
    content?: string;
    rating?: number;
  }
): Promise<void> {
  // Client SDK checks:
  // 1. User's email from cert
  // 2. Submits updateComment transaction (signed)
  // 3. Chaincode verifies ownership
  
  return await invoke("update_comment", {
    channel,
    entryId,
    commentId,
    content: updates.content,
    rating: updates.rating
  });
}

// Delete comment (mark as deleted)
async function deleteComment(
  channel: string,
  entryId: string,
  commentId: string,
  reason?: string
): Promise<void> {
  return await invoke("delete_comment", {
    channel,
    entryId,
    commentId,
    reason
  });
}

// Get comments (with ownership info visible)
async function getComments(
  channel: string,
  entryId: string,
  includeDeleted: boolean = false
): Promise<Comment[]> {
  return await invoke("get_comments", {
    channel,
    entryId,
    includeDeleted
  });
}
```

### UI: Comment Display

```typescript
interface CommentDisplay {
  id: string;
  author: string;
  content: string;
  rating?: number;
  type: string;
  createdAt: Date;
  lastEditedAt?: Date;
  editCount: number;
  isOwner: boolean;           // Current user owns this comment
  isDeleted: boolean;
  canEdit: boolean;            // isOwner || isAdmin
  canDelete: boolean;          // isOwner || isAdmin
  auditTrail?: {
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
    deletionReason?: string;
  };
}
```

### UI Components

**Comment Display (Active):**
```
┌─────────────────────────────────────┐
│ Alice (alice@example.com)            │
│ ★★★★★ (5 stars)                    │
│ Great movie! Best ending ever!      │
│                                     │
│ Posted: Oct 31, 2025 11:00 AM      │
│ Edited: Oct 31, 2025 11:30 AM      │
│ [Edit] [Delete]  ← Only if owner   │
│                                     │
└─────────────────────────────────────┘
```

**Comment Display (Deleted):**
```
┌─────────────────────────────────────┐
│ Alice (alice@example.com)            │
│ [Comment deleted]                   │
│ Reason: "Changed my mind"           │
│                                     │
│ Deleted: Oct 31, 2025 12:00 PM     │
│ [Show history] [Restore]*           │
│                                     │
│ *Only visible to admins              │
└─────────────────────────────────────┘
```

**Edit Modal (Owner Only):**
```
┌─────────────────────────────────────┐
│ Edit Your Comment                    │
├─────────────────────────────────────┤
│                                     │
│ Content:                             │
│ [Great movie! Best ending ever!   ] │
│                                     │
│ Rating:                              │
│ ☑ ☑ ☑ ☑ ☑ (5 stars)               │
│                                     │
│        [Save] [Cancel]              │
│                                     │
└─────────────────────────────────────┘
```

---

## Permissions Verification

### Client-Side (Pre-submission)

```javascript
// Check if current user can edit comment
function canEditComment(comment, currentUser, capabilities) {
  // Only owner or admin
  const isOwner = comment.commentedBy === currentUser.email;
  const isAdmin = capabilities.includes("admin");
  return isOwner || isAdmin;
}

// Check if current user can delete comment
function canDeleteComment(comment, currentUser, capabilities) {
  // Only owner or admin
  const isOwner = comment.commentedBy === currentUser.email;
  const isAdmin = capabilities.includes("admin");
  return isOwner || isAdmin;
}

// Disable edit/delete buttons if not authorized
const canEdit = canEditComment(comment, user, userCapabilities);
const canDelete = canDeleteComment(comment, user, userCapabilities);

// UI reflects permissions
<button disabled={!canEdit}>Edit</button>
<button disabled={!canDelete}>Delete</button>
```

### Chaincode-Side (Enforcement)

```javascript
// Chaincode ALWAYS verifies ownership
async updateComment(ctx, entryId, commentId, updates) {
  const invokerEmail = ctx.clientIdentity.getID();
  const comment = await this.getComment(ctx, entryId, commentId);
  
  // Verify ownership
  if (comment.commentedBy !== invokerEmail) {
    // Check admin capability as fallback
    if (!ctx.clientIdentity.hasAttr("admin")) {
      throw new Error("Unauthorized: Not comment owner");
    }
  }
  
  // ... proceed with update
}
```

**Why both client and chaincode?**
- Client: Better UX (disable buttons before submission)
- Chaincode: Security enforcement (cannot be bypassed)
- Client can be spoofed, chaincode cannot be

---

## Audit & Compliance

### Immutable Audit Log

```
Every comment change is recorded:

CREATE:
{
  action: "comment-created",
  entryId: "movie-001",
  commentId: "review-789",
  author: "alice@example.com",
  timestamp: "2025-10-31T11:00:00Z",
  blockNumber: 100
}

UPDATE:
{
  action: "comment-updated",
  entryId: "movie-001",
  commentId: "review-789",
  updatedBy: "alice@example.com",
  previousContent: "Great movie!",
  newContent: "Great movie! Best ending ever!",
  timestamp: "2025-10-31T11:30:00Z",
  blockNumber: 105
}

DELETE:
{
  action: "comment-deleted",
  entryId: "movie-001",
  commentId: "review-789",
  deletedBy: "alice@example.com",
  reason: "Changed my mind",
  timestamp: "2025-10-31T12:00:00Z",
  blockNumber: 120
}

Compliance Features:
✅ Who created/edited/deleted
✅ When exactly
✅ What changed
✅ Original content preserved
✅ Cannot be changed retroactively
✅ GDPR-friendly (content marked deleted, not erased)
```

---

## Special Cases

### Case 1: User Deleted, Then Admins Want to Remove Comment

```
Scenario: alice@example.com deleted, but her comments still visible

Option 1: Mark as spam/removed by admin
{
  status: "removed",
  removedBy: "admin@example.com",
  removalReason: "Author deleted account",
  originalAuthor: "alice@example.com"  // Preserved for audit
}

Option 2: Restore (if deleted accidentally)
{
  status: "active",
  restoredBy: "admin@example.com",
  restoredAt: "2025-11-15T10:00:00Z"
}
```

### Case 2: Spam or Offensive Comments

```
Admin marks comment as spam:
{
  status: "flagged",
  flaggedBy: "moderator@example.com",
  flagReason: "spam",
  flaggedAt: "2025-10-31T14:00:00Z",
  actionTaken: "hidden"  // Hidden from normal view, visible to admins
}

Comment timeline preserved, but hidden from users.
```

### Case 3: Dispute Resolution

```
Alice claims Bob modified her comment.
Admin checks blockchain:

Block 100: comment:movie-001:review-123
  commentedBy: alice@example.com
  content: "Great movie"
  
Block 105: comment:movie-001:review-123 UPDATED
  updatedBy: bob@example.com  // ❌ Bob didn't sign it!
  content: "Terrible movie"

Result: IMPOSSIBLE!
- Only alice can update because chaincode verifies
- X.509 signature proves alice authorized update
- Blockchain proves who made each change
- Dispute resolved with certainty
```

---

## Summary

### Comment Ownership Model

| Aspect | Requirement |
|--------|------------|
| **Storage** | `commentedBy` stores email from X.509 cert |
| **Default Permission** | Only owner can edit/delete own comments |
| **Admin Override** | Admins can edit/delete any comment |
| **Immutability** | Comments marked deleted, not erased |
| **Audit Trail** | Full history preserved on blockchain |
| **Verification** | Chaincode enforces permissions |

### Key Benefits

✅ **Accountability:** Every comment has a verified owner  
✅ **User Control:** Owners can manage their comments  
✅ **Moderation:** Admins can manage policy violations  
✅ **Compliance:** Immutable audit trail for disputes  
✅ **Privacy:** Content deleted but history preserved  
✅ **Fraud Prevention:** X.509 signatures prevent spoofing

### Implementation Checklist

- [ ] Update comment schema to store `commentedBy` from cert
- [ ] Update chaincode to verify ownership in updateComment
- [ ] Update chaincode to verify ownership in deleteComment
- [ ] Add "mark as deleted" instead of true deletion
- [ ] Add edit tracking (`updatedBy`, `editCount`)
- [ ] Update Tauri API for comment operations
- [ ] Update UI to show edit/delete buttons conditionally
- [ ] Add audit trail logging
- [ ] Test permission enforcement
- [ ] Document in user guide
