# Client UI Completion Implementation Plan

**Date Created:** October 30, 2025  
**Status:** In Progress  
**Priority:** High

---

## Overview

This plan describes the implementation of the complete client UI, transitioning from a DCC-based architecture to a secure file-sharing system called **RemoteHouse**. After registration, users will see a list of connected clients and can "visit" them to view their shared files (markdown, media, CSS - never HTML).

---

## Architecture Overview

### Current Flow
```
KeySection → ServerSection → BroadcastSection → DccChatroom
```

### Target Flow
```
KeySection → ServerSection → ClientsList (with refresh) → RemoteHouse
```

---

## Implementation Tasks

### Phase 1: Client List Display (Tasks 1-2)

#### Task 1: Add Client List UI after registration
**Status:** Not Started  
**Effort:** 2-3 hours  
**Description:**
- Display ClientsList component after successful server registration
- Add a refresh button to fetch updated client list (non-real-time)
- Implement API call to `/api/clients` endpoint after registration
- Persist client list in component state
- Show loading states during refresh

**Files to Modify:**
- `client/src/app/page.tsx` - Add ClientsList rendering
- `client/src/app/sections/ServerSection.tsx` - Trigger ClientsList display
- `client/src/app/sections/BroadcastSection.tsx` - Possibly remove or hide after registration

**Implementation Steps:**
1. Create new section component for ClientsList container
2. Add API call to fetch clients after registration
3. Add refresh button with loading state
4. Pass client info to ClientsList component
5. Update state management in page.tsx

#### Task 2: Remove DCC Chatroom component
**Status:** Not Started  
**Effort:** 1-2 hours  
**Description:**
- Delete DccChatroom component and all related files
- Remove DCC-related message handling from main.rs
- Update imports and references throughout codebase
- Clean up DCC-related state management
- Remove DCC chat tests (DccChatroom.cy.ts)

**Files to Delete:**
- `client/src/components/DccChatroom/` (entire directory)
- `client/cypress/test/dcc_chatroom.cy.ts`

**Files to Modify:**
- `client/src/app/page.tsx` - Remove DccChatroom import/usage
- `client/src-tauri/src/main.rs` - Remove DCC message types and handlers
- Any components importing DccChatroom

---

### Phase 2: Backend Updates (Task 3)

#### Task 3: Add server API endpoint for user certificate by email
**Status:** Not Started  
**Effort:** 2-3 hours  
**Description:**
- Create new server endpoint to retrieve user's public certificate
- Endpoint format: `GET /api/users/{email}/certificate` or `GET /api/certificate?email=...`
- Store certificate with user registration
- Return certificate in PEM format
- Include error handling for non-existent users

**Server Files to Modify:**
- `server/app/api/` - Create new route handler
- `server/db/models.ts` - Ensure certificate is stored with user
- Update registration handler to store certificate

**Implementation Steps:**
1. Update user registration to store public certificate
2. Create new endpoint that queries user by email
3. Return certificate in standardized format
4. Add proper error responses (404 for user not found)
5. Test endpoint with multiple users

---

### Phase 3: RemoteHouse Component (Tasks 4-5)

#### Task 4: Rename 'Connect' button to 'Visit' in ClientsList
**Status:** Not Started  
**Effort:** 30 minutes  
**Description:**
- Update button text from "Connect" to "Visit"
- Change onDccConnect callback to onVisitClient
- Update callback signature and handling

**Files to Modify:**
- `client/src/components/ClientsList/ClientsList.tsx`

#### Task 5: Create RemoteHouse UI component
**Status:** Not Started  
**Effort:** 3-4 hours  
**Description:**
- Create new component: `RemoteHouse.tsx`
- Display files from remote client
- File list view with filtering for supported types
- File viewer with syntax highlighting for markdown/CSS
- Image/video player for media files
- Close button to return to ClientsList

**Component Features:**
- Accept `clientIp`, `clientPort`, `clientEmail` as props
- Display file list fetched from remote client
- Show file preview/viewer
- Back button to return to ClientsList
- Error states for connection failures

**Files to Create:**
- `client/src/components/RemoteHouse/RemoteHouse.tsx`
- `client/src/components/RemoteHouse/RemoteHouse.cy.tsx` (tests)

**Implementation Steps:**
1. Create RemoteHouse component with basic layout
2. Add file list display
3. Implement file viewer logic
4. Add close/back functionality
5. Style with Tailwind CSS

---

### Phase 4: Secure Connection (Task 6)

#### Task 6: Implement secure HTTPS connection with certificate encryption
**Status:** Not Started  
**Effort:** 4-5 hours  
**Description:**
- Set up HTTPS requests using certificate-based encryption
- Create utility functions for secure communication
- Use existing public/private key infrastructure

**Secure Connection Utilities:**
1. `fetchRemoteUserCertificate(email)` - Fetch user's cert from server
2. `encryptConnection(clientCert)` - Establish encrypted connection
3. `makeSecureRequest(ip, port, endpoint, method, body)` - Make encrypted requests

**Files to Create:**
- `client/src/util/secureConnection.ts` - Certificate and HTTPS utilities

**Implementation Steps:**
1. Retrieve remote user's certificate from server
2. Verify certificate validity
3. Use certificate to encrypt outgoing requests
4. Verify responses with certificate signatures
5. Handle certificate-based authentication

---

### Phase 5: File Serving (Task 7)

#### Task 7: Add file retrieval endpoints on client
**Status:** Not Started  
**Effort:** 3-4 hours  
**Description:**
- Add Tauri command endpoints to serve files
- Restrict to markdown, media (images, video), CSS files only
- Never serve HTML files
- Secure endpoints with certificate verification

**New Tauri Commands:**
- `list_files()` - List available shareable files
- `get_file(path)` - Retrieve file with content type
- `verify_certificate(cert)` - Verify incoming certificate

**File Restrictions:**
- ✅ Allow: `.md`, `.markdown`, `.txt`, `.css`, `.jpg`, `.png`, `.gif`, `.mp4`, `.webm`, `.mp3`, `.wav`
- ❌ Block: `.html`, `.js`, `.jsx`, `.ts`, `.tsx`, `.exe`, `.bin`, `.sh`, `.bat`, etc.

**Files to Modify:**
- `client/src-tauri/src/main.rs` - Add file serving Tauri commands
- `client/src-tauri/src/lib.rs` - Create file filtering utilities

**Implementation Steps:**
1. Add file type whitelist/blacklist
2. Create Tauri commands for file operations
3. Implement certificate verification
4. Add proper error handling
5. Serve files with correct content-type headers

---

### Phase 6: Integration & Testing (Tasks 8-10)

#### Task 8: Integrate RemoteHouse into main page flow
**Status:** Not Started  
**Effort:** 2-3 hours  
**Description:**
- Update page.tsx to manage RemoteHouse state
- Add navigation between ClientsList and RemoteHouse
- Pass selected client data to RemoteHouse
- Maintain proper component hierarchy

**State Management:**
- `selectedClient` - Currently visited client info
- `showRemoteHouse` - Toggle RemoteHouse visibility
- `clientList` - List of available clients

**Files to Modify:**
- `client/src/app/page.tsx` - Update main component
- `client/src/app/sections/` - Create ClientsListSection wrapper

**Implementation Steps:**
1. Add selectedClient state to page.tsx
2. Create handler for "Visit" button
3. Conditionally render RemoteHouse or ClientsList
4. Pass callbacks for back/close navigation
5. Manage client list refresh state

#### Task 9: Test client list refresh and RemoteHouse navigation
**Status:** Not Started  
**Effort:** 2-3 hours  
**Description:**
- Test complete user flow from registration to file viewing
- Verify refresh button works correctly
- Test error handling and edge cases
- Test RemoteHouse file rendering

**Test Scenarios:**
1. Register with server
2. ClientsList displays after registration
3. Refresh button fetches updated list
4. Click "Visit" opens RemoteHouse
5. Files render correctly (markdown, images, CSS)
6. Back button returns to ClientsList
7. Error states handled gracefully

#### Task 10: Create/update Cypress e2e tests
**Status:** Not Started  
**Effort:** 3-4 hours  
**Description:**
- Add tests for new ClientsList functionality
- Add tests for RemoteHouse component
- Update DCC-related tests
- Test file rendering and previews

**New Test Files:**
- `client/cypress/test/clients_list_refresh.cy.ts` - ClientsList refresh
- `client/cypress/test/remote_house.cy.ts` - RemoteHouse navigation and file viewing

**Tests to Create:**
1. Client list displays after registration
2. Refresh button updates client list
3. Visit button opens RemoteHouse
4. RemoteHouse closes and returns to list
5. Files render correctly
6. Error states are handled

---

## Dependencies & Prerequisites

### Client-Side:
- React/Next.js components
- Tauri IPC commands
- TailwindCSS for styling
- Certificate crypto library (existing)

### Server-Side:
- Node.js API endpoint for certificate retrieval
- Database schema update to store certificates

### Testing:
- Cypress for e2e tests
- Multiple client instances for testing

---

## Risk Assessment

| Task | Risk Level | Mitigation |
|------|-----------|-----------|
| 1. ClientsList display | Low | Reuse existing component |
| 2. Remove DCC | Low | Good grep search for all refs |
| 3. Certificate endpoint | Medium | Coordinate with server team |
| 4. Button rename | Low | Simple text change |
| 5. RemoteHouse component | Medium | Start with basic UI, iterate |
| 6. Secure HTTPS | High | Use well-tested crypto libs |
| 7. File serving | Medium | Strict file type whitelist |
| 8. Integration | Low | Already planned components |
| 9. Manual testing | Low | Straightforward workflows |
| 10. E2E tests | Medium | Complex multi-client scenarios |

---

## Timeline Estimate

- **Phase 1 (Tasks 1-2):** 3-5 hours
- **Phase 2 (Task 3):** 2-3 hours
- **Phase 3 (Tasks 4-5):** 3-4 hours
- **Phase 4 (Task 6):** 4-5 hours
- **Phase 5 (Task 7):** 3-4 hours
- **Phase 6 (Tasks 8-10):** 7-10 hours

**Total Estimated Effort:** 22-31 hours

---

## Success Criteria

✅ User can register with server  
✅ ClientsList displays after registration  
✅ Refresh button successfully updates client list  
✅ "Visit" button opens RemoteHouse  
✅ RemoteHouse displays remote client's files  
✅ Only supported file types (md, media, css) are visible  
✅ HTML files are never served or displayed  
✅ Connection is secured with certificate-based encryption  
✅ Users can view markdown with syntax highlighting  
✅ Users can view images and media files  
✅ E2E tests pass for complete workflow  
✅ No DCC components remain in codebase

---

## Notes

- DCC functionality is completely removed in favor of RemoteHouse
- All communication is secured with certificate-based encryption
- File sharing is read-only (no uploads in this phase)
- HTML files are explicitly blocked for security
- Client list is fetched on demand (not real-time broadcast)

---

## Checklist

- [ ] Phase 1: ClientsList & Remove DCC (Tasks 1-2)
- [ ] Phase 2: Server certificate endpoint (Task 3)
- [ ] Phase 3: RemoteHouse component (Tasks 4-5)
- [ ] Phase 4: Secure connection (Task 6)
- [ ] Phase 5: File serving (Task 7)
- [ ] Phase 6: Integration & testing (Tasks 8-10)
- [ ] All tests passing
- [ ] Code review & merge
