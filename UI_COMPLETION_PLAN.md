# 🎬 UI Completion Plan - Focus on Live Movie Chaincode

**Status**: Focus Mode Activated  
**Target**: Complete all use cases with live movie chaincode  
**Ignore**: Other channels (tvshow, games, voting)  
**Priority**: Movie channel integration + Use Cases 1-3

---

## 📋 Current Status

### ✅ Completed
- Movie chaincode deployed and LIVE on movies-general channel
- Basic UI framework in place
- Components structure ready:
  - KeyManagement ✅
  - NetworkConnection ✅
  - ChannelBrowser (partial - needs movie integration)
  - TorrentManager ✅
  - Settings ✅

### ⏳ In Progress
- Connect ChannelBrowser to live movie chaincode
- Implement search functionality
- Implement content submission (Use Case 2)

### ❌ Not Started
- Content moderation UI (Use Case 3)
- Advanced features (voting, etc.)

---

## 🎯 Use Cases to Complete

### Use Case 1: User Registers and Browses Movie Channel
**Status**: ✅ 90% Complete
**What's Working**:
- User can generate/import keys ✅
- User can connect to network ✅
- UI can display channels ✅

**What Needs Fixing**:
- ChannelBrowser needs to query live movie chaincode
- Need to change hardcoded channel references to use 'movies-general'
- Need to use correct chaincode name 'flashback_repository'

### Use Case 2: User Searches for Movie and Submits Missing Movie Request
**Status**: ⏳ 20% Complete
**What's Needed**:
- [ ] Search UI in ChannelBrowser
- [ ] "Submit Missing Content" button
- [ ] Content submission form modal
- [ ] Invoke `submitContentRequest` on chaincode
- [ ] Handle IMDb ID validation
- [ ] Display success/error messages

### Use Case 3: Moderator Reviews and Approves/Rejects Request
**Status**: ⏳ 10% Complete
**What's Needed**:
- [ ] Moderator dashboard view
- [ ] List pending requests
- [ ] Approve/Reject buttons
- [ ] Invoke `approveContentRequest` or `rejectContentRequest`
- [ ] Show approval status updates

---

## 🔧 Implementation Tasks

### Phase 1: Connect to Live Movie Chaincode (TODAY)
**Goal**: Get movies displaying from live chaincode

```typescript
// Update ChannelBrowser to use live chaincode
const MOVIE_CHANNEL = 'movies-general';
const MOVIE_CHAINCODE = 'flashback_repository';

// When user clicks Movies channel:
const result = await queryChaincodeAsync(
  MOVIE_CHANNEL,
  MOVIE_CHAINCODE,
  'QueryAll',
  []
);

// Display movies in UI
```

**Files to modify**:
- `src/components/ChannelBrowser/index.tsx`
- `src/lib/api.ts` (maybe add helper functions)

**Expected Result**: 
- Users see live movies from Kaleido
- Search works with live data
- No 404 errors from REST Gateway

---

### Phase 2: Implement Movie Search (TODAY)
**Goal**: User can search for movies

```typescript
// Search functionality
const handleSearch = async (title: string) => {
  const result = await queryChaincodeAsync(
    MOVIE_CHANNEL,
    MOVIE_CHAINCODE,
    'SearchByTitle',
    [title]
  );
  
  return result;
};
```

**Files to modify**:
- `src/components/ChannelBrowser/index.tsx`

**Expected Result**:
- Users can type in search box
- Results update in real-time
- "No results found" message when search returns empty

---

### Phase 3: Implement Content Submission Form (TODAY/TOMORROW)
**Goal**: User can submit missing movie requests

**Form Fields**:
- IMDb ID (required) ✔
- Title (required) ✔
- Director (optional) ✔
- Release Year (optional) ✔
- Genres (optional) ✔
- Description (optional) ✔
- Reason/Notes (optional) ✔

**New Component**: `ContentSubmissionModal.tsx`

```typescript
const handleSubmit = async (formData) => {
  const result = await invokeChaincodeAsync(
    MOVIE_CHANNEL,
    MOVIE_CHAINCODE,
    'SubmitContentRequest',
    [
      formData.imdbId,
      formData.title,
      formData.director,
      formData.releaseYear,
      JSON.stringify(formData.genres),
      formData.description,
    ]
  );
};
```

**Files to create**:
- `src/components/ContentSubmissionModal/index.tsx`
- `src/components/ContentSubmissionModal/styles.module.css` (if needed)

**Expected Result**:
- Modal appears when user clicks "Submit Missing Movie"
- Form validates IMDb ID
- Success message shown after submission
- Request recorded on blockchain

---

### Phase 4: Implement Moderation Dashboard (TOMORROW)
**Goal**: Moderators can approve/reject requests

**New Component**: `ModerationDashboard.tsx`

```typescript
// Get pending requests
const pending = await queryChaincodeAsync(
  MOVIE_CHANNEL,
  MOVIE_CHAINCODE,
  'GetRequestHistory',
  ['pending'] // or similar
);

// Approve request
const approve = await invokeChaincodeAsync(
  MOVIE_CHANNEL,
  MOVIE_CHAINCODE,
  'ApproveContentRequest',
  [imdbId, moderatorId]
);

// Reject request
const reject = await invokeChaincodeAsync(
  MOVIE_CHANNEL,
  MOVIE_CHAINCODE,
  'RejectContentRequest',
  [imdbId, moderatorId, reason]
);
```

**Files to modify**:
- `src/app/page.tsx` (add Moderation view)
- Create `src/components/ModerationDashboard/index.tsx`

**Expected Result**:
- Moderator dashboard shows pending requests
- Can approve/reject with one click
- Status updates reflected in UI

---

## 📊 Implementation Checklist

### Phase 1: Connect to Live Chaincode
- [ ] Update `ChannelBrowser` to use 'movies-general' channel
- [ ] Update `ChannelBrowser` to use 'flashback_repository' chaincode
- [ ] Call `QueryAll` on component mount
- [ ] Display live movies in grid
- [ ] Test with Kaleido live data

### Phase 2: Movie Search
- [ ] Add search input field to ChannelBrowser
- [ ] Implement `SearchByTitle` function
- [ ] Update results as user types
- [ ] Show "No results" message
- [ ] Test with Kaleido live data

### Phase 3: Content Submission
- [ ] Create `ContentSubmissionModal` component
- [ ] Add "Submit Missing Content" button
- [ ] Create form with all required fields
- [ ] Validate IMDb ID format
- [ ] Call `SubmitContentRequest` chaincode function
- [ ] Show success/error messages
- [ ] Test submission to live chaincode

### Phase 4: Moderation Dashboard
- [ ] Create `ModerationDashboard` component
- [ ] Add "Moderation" nav button (when connected)
- [ ] Query pending requests
- [ ] Display approval interface
- [ ] Call approval/rejection functions
- [ ] Update status in real-time
- [ ] Test moderator workflow

---

## 🎬 Movie Chaincode Functions (from deployment)

Based on the movie-chaincode, here are the available functions:

```go
// Query functions (read-only)
QueryAll()                           // Get all movies
SearchByTitle(title string)           // Find movies by title
GetMovieByIMDBID(imdbID string)       // Get specific movie

// Transaction functions (write)
SubmitContentRequest(
  imdbID string,
  title string,
  director string,
  releaseYear int,
  genres []string,
  description string
)

ApproveContentRequest(
  imdbID string,
  moderatorID string
)

RejectContentRequest(
  imdbID string,
  moderatorID string,
  reason string
)

GetRequestHistory(
  status string  // "pending", "approved", "rejected"
)
```

---

## 🔌 API Integration Points

### Current API Functions (working)
```typescript
queryChaincodeAsync(channel, chaincode, function, args)
invokeChaincodeAsync(channel, chaincode, function, args)
```

### How to use:
```typescript
// Query all movies
const movies = await queryChaincodeAsync(
  'movies-general',
  'flashback_repository',
  'QueryAll',
  []
);

// Search by title
const results = await queryChaincodeAsync(
  'movies-general',
  'flashback_repository',
  'SearchByTitle',
  ['Inception']
);

// Submit request (write transaction)
const response = await invokeChaincodeAsync(
  'movies-general',
  'flashback_repository',
  'SubmitContentRequest',
  [
    'tt1375666',  // imdbId
    'Inception',  // title
    'Christopher Nolan', // director
    '2010', // releaseYear
    '["Science Fiction", "Thriller"]', // genres as JSON
    'A skilled thief...' // description
  ]
);
```

---

## 📁 Files to Modify/Create

### Modify Existing
1. `src/components/ChannelBrowser/index.tsx` - Connect to live chaincode
2. `src/app/page.tsx` - Add moderation view option
3. `src/lib/store.ts` - Add movie/request state if needed

### Create New
1. `src/components/ContentSubmissionModal/index.tsx` - Submission form
2. `src/components/ModerationDashboard/index.tsx` - Moderator view
3. `src/components/MovieGrid/index.tsx` - Optional: Extract movie display logic

---

## 🎯 Success Criteria

### Use Case 1: Complete ✅
- [ ] User generates keys
- [ ] User connects to network
- [ ] User sees movies from live chaincode
- [ ] Movies display correctly in grid

### Use Case 2: Complete ✅
- [ ] User searches for movies
- [ ] User can submit missing content
- [ ] Form validates input
- [ ] Request submitted to blockchain
- [ ] Success message displayed

### Use Case 3: Complete ✅
- [ ] Moderator sees dashboard
- [ ] Shows pending requests
- [ ] Can approve requests
- [ ] Can reject requests with reason
- [ ] Status updates reflected

---

## ⏱️ Estimated Timeline

| Phase | Task | Time |
|-------|------|------|
| 1 | Connect to live chaincode | 30 min |
| 2 | Implement search | 30 min |
| 3 | Content submission form | 1-2 hours |
| 4 | Moderation dashboard | 1-2 hours |
| | **Testing** | 1 hour |
| | **Total** | **~5-6 hours** |

---

## 🚀 Start with Phase 1

**Next Action**: Update `ChannelBrowser` to connect to live movie chaincode

**File to edit**: `src/components/ChannelBrowser/index.tsx`

**Key changes**:
1. Add constants for movie channel and chaincode
2. Update channel loading to only show movies
3. Update QueryAll call to use correct chaincode names
4. Test with live Kaleido data

**Expected**: Users see movies from live blockchain ✨

---

**Focus**: Movie channel only  
**Goal**: Complete all 3 use cases with live network  
**Status**: Ready to begin implementation
