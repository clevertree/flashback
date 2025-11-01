# End-to-End Testing Guide for Chaincode Integration

This guide provides a comprehensive manual testing procedure to validate the complete chaincode integration workflow across all components.

## Prerequisites

- ✅ Pre-commit hook passes all 5 verification steps
- ✅ Go chaincode builds successfully
- ✅ React components integrated with chaincode functions
- ✅ Cypress E2E tests created (536 lines)
- ✅ Network connection to Kaleido configured
- ✅ All npm dependencies installed (`npm install`)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Verify pre-commit hook (5 steps)
cd /path/to/project && git status

# 3. Build everything
npm run build
cargo build

# 4. Start development server
npm run dev

# 5. Run E2E tests
npm run test:e2e
```

## Testing Phases

### Phase 1: Setup & Identity Management
**Objective**: Establish user identity and verify key management

#### Step 1.1: Generate New Identity
- [ ] Open **KeyManagement** component
- [ ] Click "Generate New Identity"
- [ ] Verify keypair is created with public and private keys
- [ ] Check that keys are displayed in the component
- [ ] Verify "Download Identity" button is available

**Expected Results**:
```
Generated Keys:
- Public Key: [64+ character hex string]
- Private Key: [64+ character hex string]
- Status: Identity Ready
```

#### Step 1.2: Save and Load Identity
- [ ] Click "Download Identity" to export identity file
- [ ] Verify file is saved as `fabric-identity.json`
- [ ] Inspect file contents (should contain encrypted keys)
- [ ] Close the application
- [ ] Reopen and verify identity persists in localStorage
- [ ] Check KeyManagement displays the same keys

**Expected Results**:
```
Identity File Structure:
{
  "type": "fabric-identity",
  "public": "...",
  "private": "...",
  "timestamp": "2024-11-01T..."
}
```

#### Step 1.3: Verify Identity Display
- [ ] Confirm public key is displayed (first 16 chars visible)
- [ ] Confirm "Identity Ready" status indicator is green
- [ ] Check that identity info is persistent across page reloads
- [ ] Verify error handling if identity file is corrupted

**Expected Results**:
- Public key shown: `[abc123def456...]`
- Status: 🟢 Identity Ready
- Component shows: "Ready to connect to network"

---

### Phase 2: Network Connection
**Objective**: Establish connection to Kaleido network and verify chaincode availability

#### Step 2.1: Configure Network Connection
- [ ] Open **NetworkConnection** component
- [ ] Enter Kaleido Gateway URL:
  ```
  https://api.u0inmt8fjp.ent-2-prod01-ent.kaleido.io/gateways/fabric
  ```
- [ ] Enter Channel Name: `movies`
- [ ] Enter Organization: `Org1MSP`
- [ ] Verify all input fields accept text

**Expected Results**:
- Input fields populated with configuration values
- "Connect" button is enabled
- No validation errors shown

#### Step 2.2: Connect to Network
- [ ] Click "Connect to Network" button
- [ ] Observe loading spinner
- [ ] Wait for connection confirmation (2-5 seconds)
- [ ] Verify connection status shows "Connected" with green indicator

**Expected Results**:
```
Network Status:
- Status: 🟢 Connected
- Gateway: https://api.u0inmt8fjp.ent-2-prod01-ent.kaleido.io/...
- Channel: movies
- Organization: Org1MSP
```

#### Step 2.3: Verify Chaincode Status
- [ ] Scroll down to "Chaincode Status" section
- [ ] Verify "movie-chaincode" appears in the list
- [ ] Check version shows as "v1.0"
- [ ] Confirm status indicator is green (ready)
- [ ] Verify status message: "Ready to invoke"

**Expected Results**:
```
Chaincode Status:
├─ movie-chaincode v1.0
│  ├─ Status: 🟢 Ready
│  ├─ Functions: QueryAll, SubmitContentRequest, ...
│  └─ Last Updated: 2024-11-01 16:22:00
```

#### Step 2.4: Test Network Error Handling
- [ ] Change Gateway URL to invalid address
- [ ] Click "Connect"
- [ ] Verify error message appears: "Failed to connect to network"
- [ ] Check that component shows error state (red indicator)
- [ ] Verify "Retry" option is available
- [ ] Change URL back and reconnect successfully

**Expected Results**:
- Error message: "Network error: Connection refused"
- Status indicator: 🔴 Disconnected
- "Retry" button available
- Successful reconnection with valid URL

---

### Phase 3: Query Movies (QueryAll)
**Objective**: Retrieve and display all movies from the blockchain ledger

#### Step 3.1: Load Movies
- [ ] Navigate to **ChannelBrowser** component
- [ ] Ensure you are connected to network (from Phase 2)
- [ ] Verify "Load Movies" or "Refresh" button is available
- [ ] Click button to load all movies

**Expected Results**:
- Loading spinner appears briefly
- Movie list loads within 2-3 seconds
- No error messages displayed

#### Step 3.2: Verify Movie Metadata Display
- [ ] Check that each movie card displays:
  - [ ] Title (e.g., "Inception")
  - [ ] Director (e.g., "Christopher Nolan")
  - [ ] Release Year (e.g., "2010")
  - [ ] Genres (as clickable tags: "Sci-Fi", "Thriller", etc.)
  - [ ] Description (first 100 characters)
  - [ ] Average Rating (⭐ 8.8/10)
  - [ ] View Count (👁 1,234 views)
  - [ ] IMDb ID (as link to IMDb)
  - [ ] Torrent Hash (truncated, e.g., "Qm...xyz")

**Expected Results**:
```
Movie Card Example:
┌─ Inception ─────────────────────────┐
│ Director: Christopher Nolan         │
│ Year: 2010                          │
│ Genres: [Sci-Fi] [Thriller] [Action]│
│ Description: A skilled thief who... │
│ ⭐ 8.8/10 | 👁 1,234 views         │
│ IMDb: tt1375666                     │
│ Hash: QmXrPEP7gHvE...               │
└─────────────────────────────────────┘
```

#### Step 3.3: Verify Empty State
- [ ] If no movies in ledger, verify message: "No movies found"
- [ ] Check "Submit Content" button is still available
- [ ] Verify UI doesn't break with empty state

**Expected Results**:
- Empty state message displayed clearly
- Component remains functional
- User can proceed to submit new content

---

### Phase 4: Search Functionality (SearchByTitle)
**Objective**: Verify live search filtering by movie title

#### Step 4.1: Live Search Filtering
- [ ] In ChannelBrowser, click on search input field
- [ ] Type partial movie title: "In" (from "Inception")
- [ ] Verify results filter in real-time
- [ ] Check that only matching movies appear

**Expected Results**:
```
Search: "In" → Results:
├─ Inception (2010)
└─ [Other movies starting with "In"...]
```

#### Step 4.2: Search with No Results
- [ ] Clear search box
- [ ] Type non-existent title: "XYZ123Nonexistent"
- [ ] Verify message appears: "No movies found matching your search"
- [ ] Check UI remains clean and readable

**Expected Results**:
- Clear "No results" message
- Option to clear search (refresh/reset button)
- User can easily start a new search

#### Step 4.3: Case-Insensitive Search
- [ ] Search for "INCEPTION" (uppercase)
- [ ] Verify "Inception" movie still appears in results
- [ ] Search for "inception" (lowercase)
- [ ] Verify same results returned

**Expected Results**:
- Search is case-insensitive
- Same results for "Inception", "INCEPTION", "inception"

#### Step 4.4: Partial Match Search
- [ ] Search for "Dar" (from "Dark Knight")
- [ ] Verify all movies with "Dark" in title appear
- [ ] Search for "K" (from "Knight", "King", etc.)
- [ ] Verify all movies with "K" appear

**Expected Results**:
```
Search: "K" → Results:
├─ Dark Knight (2008)
├─ [Other movies with K...]
└─ No pagination needed for demo
```

#### Step 4.5: Refresh/Clear Search
- [ ] With active search, click "Refresh" or "Clear" button
- [ ] Verify search box clears
- [ ] Verify all movies reload
- [ ] Check UI updates immediately

**Expected Results**:
- Search input clears
- Full movie list displays
- Loading state handled gracefully

---

### Phase 5: Submit Content Request (SubmitContentRequest)
**Objective**: Add new movie content to the request queue

#### Step 5.1: Open Submit Form
- [ ] Click "Submit Content" button in ChannelBrowser
- [ ] Verify form modal/page appears
- [ ] Check required fields are labeled:
  - [ ] IMDb ID (required)
  - [ ] Title (required)
  - [ ] Director (required)
  - [ ] Genres (required, multi-select)
  - [ ] Release Year (required)
  - [ ] Description (optional)
  - [ ] Torrent Hash (optional)

**Expected Results**:
```
Submit Content Form:
├─ IMDb ID: [tt_______]
├─ Title: [_________]
├─ Director: [_________]
├─ Genres: [Select...]
├─ Year: [2024]
├─ Description: [Optional...]
└─ Torrent Hash: [Optional...]
```

#### Step 5.2: Fill Form with Valid Data
- [ ] Enter IMDb ID: `tt0111161` (Shawshank Redemption)
- [ ] Enter Title: `The Shawshank Redemption`
- [ ] Enter Director: `Frank Darabont`
- [ ] Select Genres: Drama, Crime, Prison
- [ ] Enter Year: `1994`
- [ ] Enter Description: "Two imprisoned men bond..."
- [ ] Enter Torrent Hash: `QmAb...xyz` (optional)
- [ ] Verify form accepts all inputs

**Expected Results**:
- All fields populate correctly
- No validation errors
- "Submit" button is enabled

#### Step 5.3: Validate IMDb ID Format
- [ ] Try submitting with invalid IMDb ID: `12345` (too short)
- [ ] Verify error message: "IMDb ID must start with 'tt' and contain digits"
- [ ] Try IMDb ID: `ttABCDEF` (non-numeric)
- [ ] Verify error: "IMDb ID must contain only 'tt' followed by digits"
- [ ] Enter valid format: `tt0111161`
- [ ] Verify error clears

**Expected Results**:
```
Valid IMDb ID Format:
✓ tt0111161 → Valid
✗ 12345 → Invalid (too short)
✗ ttABCDEF → Invalid (non-numeric)
✗ imdb0111161 → Invalid (wrong prefix)
```

#### Step 5.4: Verify Required Fields
- [ ] Clear IMDb ID field
- [ ] Try to submit form
- [ ] Verify error: "IMDb ID is required"
- [ ] Clear Title field
- [ ] Verify error: "Title is required"
- [ ] Clear Director field
- [ ] Verify error: "Director is required"
- [ ] Check all required fields are enforced

**Expected Results**:
- Form prevents submission with empty required fields
- Clear error messages for each missing field
- User can fix and resubmit

#### Step 5.5: Submit Content Request
- [ ] Fill all required fields with valid data
- [ ] Click "Submit Content" button
- [ ] Verify loading spinner appears
- [ ] Wait for success confirmation (2-5 seconds)
- [ ] Check success message: "Content request submitted successfully"

**Expected Results**:
```
Request Submitted:
- Status: 🟢 Success
- Request ID: [UUID]
- Status: pending_review
- Timestamp: 2024-11-01 16:25:30
```

#### Step 5.6: Verify Request Stored on Ledger
- [ ] Navigate back to ChannelBrowser
- [ ] The newly submitted movie should NOT appear in QueryAll yet (pending review)
- [ ] Verify status shows as "pending_review"
- [ ] Check GetRequestHistory to see submission entry

**Expected Results**:
- New request visible in request history
- Status: pending_review
- Can see: actor, timestamp, imdb_id, title

---

### Phase 6: Chaincode Ledger Verification
**Objective**: Verify data is stored and queryable on the blockchain ledger

#### Step 6.1: Check Request Status
- [ ] Call `GetRequestHistory` for the submitted IMDb ID
- [ ] Verify entry shows:
  - [ ] IMDb ID: `tt0111161`
  - [ ] Title: `The Shawshank Redemption`
  - [ ] Status: `pending_review`
  - [ ] Actor: Your identity public key
  - [ ] Timestamp: Current time
  - [ ] Action: `submit_content_request`

**Expected Results**:
```
Request History Entry:
{
  "imdb_id": "tt0111161",
  "title": "The Shawshank Redemption",
  "status": "pending_review",
  "actor": "0x1234...",
  "timestamp": "2024-11-01T16:25:30Z",
  "action": "submit_content_request"
}
```

#### Step 6.2: Verify Duplicate Prevention
- [ ] Try submitting another request with same IMDb ID
- [ ] Verify error: "Content with this IMDb ID already submitted"
- [ ] Check that request status doesn't change
- [ ] Verify chaincode enforces uniqueness per IMDb ID

**Expected Results**:
- Error message for duplicate submission
- Status remains "pending_review"
- RequestHistory unchanged

---

### Phase 7: Admin Approval (ApproveContentRequest)
**Objective**: Admin approves content request and movie enters ledger

#### Step 7.1: Get Admin Identity
- [ ] Switch to admin account/identity
- [ ] Verify admin has elevated permissions
- [ ] Check admin can call `ApproveContentRequest`

**Expected Results**:
- Admin identity is set/loaded
- Admin functions available in UI

#### Step 7.2: Approve Content Request
- [ ] Navigate to pending requests
- [ ] Find request for `tt0111161` (Shawshank Redemption)
- [ ] Click "Approve" button
- [ ] Verify confirmation dialog appears
- [ ] Click "Confirm Approval"
- [ ] Observe loading spinner
- [ ] Wait for success confirmation (2-5 seconds)

**Expected Results**:
```
Approval Confirmation:
- Status: 🟢 Approved
- IMDb ID: tt0111161
- Movie: The Shawshank Redemption
- Timestamp: 2024-11-01 16:27:15
```

#### Step 7.3: Verify Movie Now in QueryAll
- [ ] Navigate back to ChannelBrowser
- [ ] Refresh movie list
- [ ] Verify "The Shawshank Redemption" now appears
- [ ] Check all metadata is displayed correctly:
  - [ ] Title: ✓
  - [ ] Director: ✓
  - [ ] Year: ✓
  - [ ] Genres: ✓
  - [ ] Description: ✓
  - [ ] Torrent Hash: ✓ (if provided)
  - [ ] Average Rating: ✓ (initial value)

**Expected Results**:
```
Movie Card Now Visible:
┌─ The Shawshank Redemption ──────────┐
│ Director: Frank Darabont            │
│ Year: 1994                          │
│ Genres: [Drama] [Crime]             │
│ Description: Two imprisoned men...  │
│ ⭐ 8.9/10 | 👁 0 views              │
│ IMDb: tt0111161                     │
│ Hash: QmAb...xyz (if provided)      │
└─────────────────────────────────────┘
```

#### Step 7.4: Verify RequestHistory Updated
- [ ] Call `GetRequestHistory` for same IMDb ID
- [ ] Verify new entry shows:
  - [ ] Action: `approve_content_request`
  - [ ] Status changed to: `approved`
  - [ ] Actor: Admin identity
  - [ ] Timestamp: Approval time
- [ ] Previous submission entry still visible (full audit trail)

**Expected Results**:
```
Audit Trail:
1. submit_content_request | pending_review | 2024-11-01 16:25:30
2. approve_content_request | approved | 2024-11-01 16:27:15
```

---

### Phase 8: Audit Trail & GetRequestHistory
**Objective**: Verify complete audit trail is maintained

#### Step 8.1: View Complete History
- [ ] Search for a movie with multiple actions in history
- [ ] Verify all entries displayed chronologically
- [ ] Check each entry shows:
  - [ ] Timestamp (in order)
  - [ ] Actor (identity that performed action)
  - [ ] Action type (submit, approve, etc.)
  - [ ] Status at that time

**Expected Results**:
```
Complete Audit Trail:
1. 2024-11-01 16:25:30 | User123 | submit_content_request | pending_review
2. 2024-11-01 16:27:15 | Admin456 | approve_content_request | approved
```

#### Step 8.2: Verify Immutability
- [ ] Try to modify an audit trail entry (attempt to change timestamp/actor)
- [ ] Verify modification is rejected or impossible
- [ ] Check that blockchain ledger immutability is maintained

**Expected Results**:
- Audit entries are read-only
- Cannot modify historical data
- System prevents tampering

#### Step 8.3: Test History with Multiple Actors
- [ ] Submit content with Actor A
- [ ] Approve with Actor B (admin)
- [ ] Verify both actors appear in history
- [ ] Check identity tracking works correctly

**Expected Results**:
- Audit trail shows multiple actors
- Each action attributed to correct identity
- Complete chain of responsibility visible

---

### Phase 9: Error Handling & Edge Cases
**Objective**: Verify robust error handling throughout the workflow

#### Step 9.1: Network Disconnection
- [ ] Connect to network successfully
- [ ] Disconnect network (or simulate network failure)
- [ ] Try to query movies
- [ ] Verify error message: "Network connection lost"
- [ ] Check "Reconnect" button is available
- [ ] Reconnect successfully

**Expected Results**:
```
Error Handling:
- Network error detected
- User-friendly error message
- Reconnect option provided
- Component recovers gracefully
```

#### Step 9.2: Invalid Chaincode Response
- [ ] Simulate malformed response from chaincode
- [ ] Verify component handles error gracefully
- [ ] Check error message: "Failed to parse chaincode response"
- [ ] Verify retry option is available

**Expected Results**:
- No application crash
- Clear error message
- Retry functionality available

#### Step 9.3: Timeout Handling
- [ ] Make chaincode call with slow network
- [ ] If call times out (>30 seconds), verify timeout error
- [ ] Check error message: "Request timed out. Please try again."
- [ ] Verify automatic retry or manual retry option

**Expected Results**:
- Timeout detected (typically 30 seconds)
- User-friendly timeout message
- Retry mechanism available

#### Step 9.4: Authorization Errors
- [ ] Try admin-only function with regular user
- [ ] Verify error: "Insufficient permissions"
- [ ] Try accessing with no identity
- [ ] Verify error: "Please set up identity first"

**Expected Results**:
```
Authorization:
- Regular user ─X→ ApproveContentRequest (403 error)
- No identity ─X→ Any chaincode call (Identity required)
- Admin ─✓→ ApproveContentRequest (Success)
```

---

### Phase 10: Performance & Load Testing
**Objective**: Verify performance under realistic load

#### Step 10.1: Large Movie List
- [ ] If ledger has 100+ movies, verify:
  - [ ] QueryAll returns all results
  - [ ] UI renders efficiently
  - [ ] Search filters quickly (<1 second)
  - [ ] No memory leaks or slowdowns

**Expected Results**:
- Large lists load within 3-5 seconds
- Search results appear in <1 second
- Smooth scrolling and interaction
- No UI freezing or lag

#### Step 10.2: Repeated Queries
- [ ] Call QueryAll 10 times rapidly
- [ ] Verify no errors or duplicate requests
- [ ] Check that responses are consistent
- [ ] Monitor for memory issues

**Expected Results**:
- All 10 queries succeed
- Consistent results
- No memory leaks
- UI remains responsive

#### Step 10.3: Concurrent Operations
- [ ] Submit content while another search is running
- [ ] Verify both operations complete successfully
- [ ] Check that results don't interfere
- [ ] Verify order of operations is correct

**Expected Results**:
- Operations complete without interference
- Results are correct and consistent
- No race conditions detected

---

## Summary Checklist

### Core Functionality
- [ ] Phase 1: Identity Management ✓
- [ ] Phase 2: Network Connection ✓
- [ ] Phase 3: Query Movies ✓
- [ ] Phase 4: Search Functionality ✓
- [ ] Phase 5: Submit Content ✓
- [ ] Phase 6: Ledger Verification ✓
- [ ] Phase 7: Admin Approval ✓
- [ ] Phase 8: Audit Trail ✓
- [ ] Phase 9: Error Handling ✓
- [ ] Phase 10: Performance ✓

### Build & Testing
- [ ] Pre-commit hook passes all 5 steps
- [ ] Jest tests: 17/17 passing
- [ ] Cypress E2E tests: All passing
- [ ] Go chaincode builds successfully
- [ ] No compilation errors
- [ ] No runtime errors

### Documentation
- [ ] CHAINCODE_DEPLOYMENT.md complete
- [ ] All components documented
- [ ] Error messages are clear
- [ ] User flows well-documented

## Troubleshooting

### Common Issues

**Issue**: "Network connection failed"
- Check Kaleido gateway URL is correct
- Verify internet connection
- Check firewall/VPN settings

**Issue**: "Chaincode not found"
- Verify chaincode is installed on channel
- Check channel name spelling
- Ensure organization MSP is correct

**Issue**: "Invalid IMDb ID format"
- Ensure ID starts with "tt"
- Follow with 7-10 digits (e.g., tt0111161)
- No special characters or spaces

**Issue**: "Authorization denied"
- Verify you're using admin identity for approvals
- Check MSP configuration
- Ensure identity credentials are valid

## Success Criteria

✅ **Testing Complete** when:
1. All 10 phases pass without critical errors
2. All core chaincode functions work end-to-end
3. Error handling is robust and user-friendly
4. Performance is acceptable (<5 seconds per operation)
5. Audit trail is complete and immutable
6. All UI components render correctly
7. Network connection is stable
8. No compilation or runtime errors

---

**Last Updated**: 2024-11-01  
**Test Environment**: Kaleido network (u0inmt8fjp)  
**Channel**: movies  
**Chaincode**: movie-chaincode v1.0
