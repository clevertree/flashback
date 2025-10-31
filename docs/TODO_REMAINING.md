# TODO: Client UI Completion - Remaining Tasks

**Last Updated:** October 30, 2025  
**Completed:** 70% (7 of 10 tasks)  
**Remaining:** 30% (3 of 10 tasks)

---

## High Priority (Blocking)

### 1. SERVER: Add certificate retrieval endpoint
**Effort:** 2-3 hours  
**Blocking:** RemoteHouse file preview, secure connections  
**Status:** NOT STARTED

**Requirements:**
- [ ] Create `GET /api/users/{email}/certificate` endpoint in server
- [ ] Return certificate in PEM format
- [ ] Handle 404 for non-existent users
- [ ] Store certificate during `/api/register`
- [ ] Add database schema update if needed
- [ ] Add error handling and validation

**Implementation Notes:**
- Endpoint should be in `server/app/api/`
- Certificate should be stored during user registration
- Return format: `{ "certificate": "-----BEGIN CERTIFICATE-----..." }`

**Test Plan:**
- [ ] Fetch certificate for registered user → returns valid PEM
- [ ] Fetch certificate for unknown user → returns 404
- [ ] Verify certificate matches registration

---

### 2. CLIENT: Connect RemoteHouse to real file API
**Effort:** 3-4 hours  
**Blocking:** File preview functionality  
**Status:** PARTIAL (Tauri commands exist, need frontend integration)

**Requirements:**
- [ ] Update `RemoteHouse.tsx` to call `api.listFiles()` instead of mock data
- [ ] Implement file preview rendering for markdown
- [ ] Implement image preview
- [ ] Implement video player
- [ ] Add loading/error states
- [ ] Add refresh functionality

**Implementation Notes:**
- Use `makeSecureRequest()` from `secureConnection.ts`
- Update `fetchFileList()` to call Tauri command
- Implement markdown rendering (consider using `remark` library)
- Handle different file types appropriately

**Files to Update:**
- [ ] `client/src/components/RemoteHouse/RemoteHouse.tsx`
- [ ] Add markdown rendering library to `package.json`
- [ ] Add markdown-to-HTML converter

---

## Medium Priority (Important)

### 3. Testing: Complete e2e test coverage
**Effort:** 3-4 hours  
**Blocking:** Release readiness  
**Status:** NOT STARTED

**Requirements:**

#### Test: Client List Refresh (`clients_list_refresh.cy.ts`)
- [ ] Register with server
- [ ] Verify ClientsList displays
- [ ] Verify client count shown
- [ ] Click Refresh button
- [ ] Verify list updates
- [ ] Verify loading state
- [ ] Test error handling

#### Test: RemoteHouse Integration (`remote_house_integration.cy.ts`)
- [ ] Register → ClientsList → Visit client flow
- [ ] RemoteHouse modal appears with correct client info
- [ ] File list loads and displays
- [ ] Can select files to preview
- [ ] Markdown preview renders
- [ ] Image preview displays
- [ ] Close button returns to ClientsList
- [ ] Can visit multiple clients in sequence

#### Test: File Type Security (`file_type_security.cy.ts`)
- [ ] HTML files not served
- [ ] JS files not served
- [ ] CSS files allowed
- [ ] Markdown files allowed
- [ ] Image files allowed
- [ ] Video files allowed

**Test Framework:** Cypress with WebdriverIO integration

---

### 4. Implementation: Secure connection with real certificates
**Effort:** 4-5 hours  
**Blocking:** Production security  
**Status:** PARTIAL (Utility functions exist, need Web Crypto API)

**Requirements:**
- [ ] Implement `verifyCertificate()` with actual validation
- [ ] Implement `encodeWithPublicKey()` using Web Crypto API
- [ ] Implement `decodeWithPrivateKey()` using Web Crypto API
- [ ] Add certificate chain validation
- [ ] Add certificate expiration checks
- [ ] Add revocation checking

**Implementation Notes:**
- Use Web Crypto API (`SubtleCrypto`)
- Consider library options: `node-jose`, `libsodium.js`
- Handle key import/export in PEM format
- Add error logging for debugging

---

## Low Priority (Nice to Have)

### 5. UX: Improve error messages
**Effort:** 2 hours  
**Status:** NOT STARTED

**Requirements:**
- [ ] Better error messages for certificate fetch failures
- [ ] Timeout warnings for slow connections
- [ ] Connection retry UI
- [ ] File preview error messages
- [ ] Offline state detection

---

### 6. Performance: Optimize file serving
**Effort:** 2-3 hours  
**Status:** NOT STARTED

**Requirements:**
- [ ] Implement file streaming for large files
- [ ] Add caching for frequently accessed files
- [ ] Add progress indicator for file transfers
- [ ] Implement chunked file transfer
- [ ] Add bandwidth throttling

---

### 7. Features: File filtering enhancements
**Effort:** 2 hours  
**Status:** NOT STARTED

**Requirements:**
- [ ] Add file search/filter in RemoteHouse
- [ ] Add sorting options (name, size, date)
- [ ] Add file preview breadcrumb navigation
- [ ] Add "download" option for safe files
- [ ] Add file metadata display (size, modified date)

---

## Quick Reference: What Works Now

### ✅ Implemented & Ready to Test
- [x] Client list displays after registration
- [x] Refresh button exists in UI
- [x] "Visit" button changes from "Connect"
- [x] RemoteHouse modal component created
- [x] Two-panel layout (files + preview)
- [x] File type detection and filtering
- [x] Close button navigation
- [x] Tauri file serving commands
- [x] Secure connection utility functions

### ⚠️ Works But Needs Integration
- [ ] RemoteHouse → needs to call real Tauri commands
- [ ] File preview → needs markdown/image/video rendering
- [ ] Certificate retrieval → needs server endpoint
- [ ] Secure connections → needs Web Crypto implementation

### ❌ Not Yet Implemented
- [ ] Actual file system access
- [ ] Certificate validation
- [ ] Real encryption/decryption
- [ ] E2E tests
- [ ] Error recovery

---

## Dependencies to Add

### Frontend
```json
{
  "remark": "^14.0.0",
  "remark-html": "^15.0.0",
  "remark-gfm": "^3.0.0",
  "react-markdown": "^8.0.0"
}
```

### Backend (Rust, if needed)
```toml
# Already present; no new Rust deps needed
```

---

## Deployment Checklist

Before shipping to production:
- [ ] All tests passing
- [ ] Certificate validation working
- [ ] File type restrictions enforced
- [ ] Error messages user-friendly
- [ ] Performance tested with large files
- [ ] Security audit of certificate handling
- [ ] Cross-platform testing (Windows, Mac, Linux)
- [ ] Network conditions tested (slow, offline)

---

## Related Issues/Docs

- `IMPLEMENTATION_PLAN.md` - Original planning
- `IMPLEMENTATION_SUMMARY.md` - What was completed
- GitHub Issues: [Link to repo]
- Design Doc: `docs/RemoteHouse.md`

---

## Questions/Notes

**Q: Why is the certificate endpoint in Task 3 blocking?**  
A: Without it, RemoteHouse can't fetch file lists or establish secure connections to remote clients. Currently using mock data.

**Q: Can we test before Task 3 is done?**  
A: Yes! Run with mock data. Just need to implement real API calls in `RemoteHouse.tsx`.

**Q: What's the security risk if we skip file type validation?**  
A: HTML/JS files could execute malicious code. Whitelist approach ensures only safe types served.

**Q: Should we support uploading files?**  
A: Not in this phase. Read-only for now. Uploads would be Phase 2.

---

## Support

For questions about remaining tasks, reference:
1. `IMPLEMENTATION_PLAN.md` - Original plan with details
2. `IMPLEMENTATION_SUMMARY.md` - What was done and how
3. Code comments in implemented files
4. Task descriptions above

---

**Last Update:** October 30, 2025  
**Next Review:** After Task 3 completion
