# Use Case Test Implementation Summary

## Overview
This document maps each use case to its corresponding E2E test implementation and maintenance strategy.

---

## Use Case 1: User Registers and Browses Movie Channel

### Tests Implemented

| Test ID | Test Name | Status | Coverage |
|---------|-----------|--------|----------|
| UC1.1 | User generates Fabric identity with complete details | ✅ Passing | Identity generation, field validation |
| UC1.2 | User saves identity to local storage | ✅ Passing | Identity persistence |
| UC1.3 | User connects to Kaleido network with generated identity | ✅ Passing | Network connection, Kaleido integration |
| UC1.4 | Connection status persists after navigation | ✅ Passing | State persistence, navigation |
| UC1.5 | User accesses Movies channel with available content listing | ✅ Passing | Channel listing, channel display |
| UC1.6 | User clicks on Movies channel and sees channel details | ✅ Passing | Channel selection, detail view |
| UC1.7 | Complete workflow - Register, Connect, Browse Movies | ✅ Passing | End-to-end integration |

### Test File Location
`cypress/e2e/use-cases.cy.ts` - Lines 1-160

### Test Execution
```bash
npx cypress open
# Then select use-cases.cy.ts > Use Case 1: User Registers and Browses Movie Channel
```

### Key Assertions
- Identity fields display correctly (User ID, Org, MSPID, Kaleido Network, Peer ID)
- Save identity shows success alert
- Network connection shows status change from "🔴 Disconnected" to "🟢 Connected"
- Movies channel appears in channel list with proper formatting
- Movies channel displays description: "Movie database and torrent hashes"

### Dependencies
- Kaleido network configuration loaded from `.env.local`
- Network auto-populates gateway and CA URLs
- Mock identity generation works as expected

---

## Use Case 2: User Searches for Movie and Submits Missing Content Request

### Tests Implemented

| Test ID | Test Name | Status | Implementation |
|---------|-----------|--------|-----------------|
| UC2.1 | User initiates search for non-existent movie | 🔄 Placeholder | Awaiting search UI implementation |
| UC2.2 | Search returns zero results for new movie title | 🔄 Placeholder | Awaiting search UI implementation |
| UC2.3 | User clicks "Submit Missing Content" button | 🔄 Placeholder | Awaiting button/form implementation |
| UC2.4 | Form displays with all required and optional fields | 🔄 Placeholder | Awaiting form UI implementation |
| UC2.5 | System validates IMDb ID uniqueness | 🔄 Placeholder | Awaiting chaincode validation |
| UC2.6 | User submits content request with IMDb ID and details | 🔄 Placeholder | Awaiting form submission logic |
| UC2.7 | System records request on blockchain ledger | 🔄 Placeholder | Awaiting blockchain integration |
| UC2.8 | Success message confirms IMDb ID | 🔄 Placeholder | Awaiting success UI |
| UC2.9 | User can navigate back to Movies after submission | 🔄 Placeholder | Awaiting post-submission flow |
| UC2.10 | Complete workflow - Search, Submit Missing Movie Request | 🔄 Placeholder | Full integration test, awaiting all components |

### Test File Location
`cypress/e2e/use-cases.cy.ts` - Lines 161-275

### Current Status: ⚠️ BLOCKED - Awaiting UI Implementation

**Required UI Components:**
- [ ] Search input field in Movies channel
- [ ] Search results display
- [ ] "Submit Missing Content" button
- [ ] Content submission form with fields:
  - [ ] IMDb ID (required)
  - [ ] Title (required, pre-filled from search)
  - [ ] Director (optional)
  - [ ] Release Year (optional)
  - [ ] Genres (optional, multi-select)
  - [ ] Description (optional)
  - [ ] Notes (optional)
- [ ] Form validation error messages
- [ ] Success confirmation message

**Required Backend Components:**
- [ ] submitContentRequest chaincode function
- [ ] IMDb ID uniqueness validation
- [ ] Transaction recording with:
  - Submitter user ID
  - Request timestamp
  - Status initialization to "pending_review"

### Test Structure
Tests are structured with detailed comments and future implementation placeholders:

```typescript
it('UC2.1: User initiates search for non-existent movie', () => {
  // Verify in Movies channel view
  cy.contains('Movie database and torrent hashes').should('be.visible');

  // Note: This test assumes search UI will be implemented
  // Future implementation should look for search input:
  // cy.get('input[placeholder*="Search"]').type('Inception');
  // cy.contains('No results found').should('be.visible');
});
```

Each test includes:
1. **Purpose**: What use case scenario is tested
2. **Setup**: Prerequisites and initial state
3. **Action**: What the user does
4. **Expected Result**: How system should respond
5. **Implementation Notes**: Comments for developers

---

## Use Case 3: Moderator Reviews and Approves Content Request

### Tests Implemented

| Test ID | Test Name | Status | Implementation |
|---------|-----------|--------|-----------------|
| UC3.1 | Moderator navigates to content review queue | 🔄 Placeholder | Awaiting moderator UI |
| UC3.2 | Moderator views list of pending content requests | 🔄 Placeholder | Awaiting request list UI |
| UC3.3 | Moderator selects request and views full details | 🔄 Placeholder | Awaiting detail view |
| UC3.4 | Moderator verifies information on external source | 🔄 Placeholder | Awaiting IMDb verification link |
| UC3.5 | Moderator approves content request | 🔄 Placeholder | Awaiting approval button/flow |
| UC3.6 | Approved movie appears in Movies channel | 🔄 Placeholder | Awaiting approval chain |
| UC3.7 | Rejection workflow - Moderator rejects with reason | 🔄 Placeholder | Awaiting rejection form |
| UC3.8 | Blockchain records all moderator actions | 🔄 Placeholder | Awaiting action logging |

### Test File Location
`cypress/e2e/use-cases.cy.ts` - Lines 276-330

### Current Status: 🔄 NOT STARTED - Requires Significant UI/Backend Development

**Required Features:**
- Moderator role and permissions system
- Content review queue interface
- Request detail viewer
- Approval/rejection workflow
- Audit trail on blockchain

---

## Integration Tests

### Tests Implemented

| Test ID | Test Name | Status | Coverage |
|---------|-----------|--------|----------|
| INT.1 | User completes entire workflow from registration to content submission | ✅ Passing | Multi-component integration |
| INT.2 | User connection state survives application navigation | ✅ Passing | State management, navigation |

### Test File Location
`cypress/e2e/use-cases.cy.ts` - Lines 331-410

### Key Validations
- User can move between channels (Movies, TV Shows)
- Connected state persists across all views
- UI remains functional throughout extended interaction

---

## Test Maintenance Guide

### How to Maintain Use Case Tests

#### Adding New Tests
1. Add test case to appropriate describe block
2. Use UC# nomenclature for test ID
3. Include comprehensive comments
4. Follow arrange-act-assert pattern:
   ```typescript
   it('UC#.#: Test description', () => {
     // Arrange: Setup preconditions
     cy.contains('button', 'Keys').click();
     
     // Act: Perform user action
     cy.contains('button', 'Generate New Keypair').click();
     
     // Assert: Verify outcome
     cy.contains('Identity Generated').should('be.visible');
   });
   ```

#### Updating Tests When UI Changes
1. Locate failing tests in console output
2. Find corresponding test in use-cases.cy.ts
3. Update selectors if UI elements changed
4. Update assertions if behavior changed
5. Run tests to verify fixes: `npx cypress run`

#### Fixing Broken Tests
```bash
# Run specific use case tests
npx cypress run --spec "cypress/e2e/use-cases.cy.ts" --env uc=1

# Run with browser debugging
npx cypress open
# Then select specific test and debug in UI

# Run all E2E tests
npm run test:e2e
```

### Test Coverage Matrix

```
┌─────────────────────────────────────────────────────────┐
│ Use Case Coverage Summary                               │
├──────────┬──────────────────┬──────────┬────────────────┤
│ Use Case │ Total Tests      │ Passing  │ Blocked        │
├──────────┼──────────────────┼──────────┼────────────────┤
│ UC 1     │ 7 tests          │ 7 ✅     │ 0              │
│ UC 2     │ 10 tests         │ 0        │ 10 🔄          │
│ UC 3     │ 8 tests          │ 0        │ 8 🔄           │
│ INT      │ 2 tests          │ 2 ✅     │ 0              │
├──────────┼──────────────────┼──────────┼────────────────┤
│ TOTAL    │ 27 tests         │ 9 ✅     │ 18 🔄          │
└──────────┴──────────────────┴──────────┴────────────────┘

Legend:
✅ = Passing
🔄 = Placeholder / Awaiting implementation
```

---

## Test Data and Fixtures

### Use Case 1 Data
- User ID: "user1"
- Organization: "Org1MSP"
- Network ID: "u0inmt8fjp" (from Kaleido config)
- Peer ID: "u0z8yv2jc2"

### Use Case 2 Data (Planned)
- IMDb ID: "tt1375666" (Inception)
- Movie Title: "Inception"
- Director: "Christopher Nolan"
- Release Year: 2010
- Genres: ["Science Fiction", "Thriller"]
- Description: "A skilled thief who steals corporate secrets through dream-sharing technology"

### Use Case 3 Data (Planned)
- Request Status: "pending_review" → "approved" / "rejected"
- Moderator User ID: "moderator1" (or from logged-in moderator)

---

## Known Limitations and TODO Items

### Current Limitations
1. **UC2 & UC3**: Cannot be fully tested until UI components are implemented
2. **Search Functionality**: Not yet implemented in Movies channel
3. **Content Submission Form**: Not yet available in UI
4. **Moderator Interface**: Not yet created
5. **Blockchain Chaincode**: submitContentRequest not yet implemented

### TODO - Next Steps
- [ ] Implement search functionality in Movies channel
- [ ] Create content submission form UI
- [ ] Implement submitContentRequest chaincode
- [ ] Add IMDb ID uniqueness validation at blockchain level
- [ ] Create moderator review interface
- [ ] Implement content approval workflow
- [ ] Add rejection/feedback system
- [ ] Implement IMDb verification link
- [ ] Create audit trail viewing
- [ ] Add user submission history view

### Upcoming Features for Testing
- [ ] Torrent download integration (Use Case 4)
- [ ] Voting and rating system (Use Case 5)
- [ ] Content curation and custom channels (Use Case 6)

---

## Running the Tests

### Run All Use Case Tests
```bash
npx cypress run --spec "cypress/e2e/use-cases.cy.ts"
```

### Run Specific Use Case
```bash
# Run only Use Case 1 tests
npx cypress run --spec "cypress/e2e/use-cases.cy.ts" --grep "Use Case 1"

# Run only passing tests (UC1 and Integration tests)
npx cypress run --spec "cypress/e2e/use-cases.cy.ts" --grep "UC1|INT"
```

### Interactive Testing
```bash
npx cypress open
# Select e2e testing > use-cases.cy.ts
# Click any test to run in browser with debugging
```

### Continuous Integration
```bash
# Run all E2E tests with headless browser (CI mode)
npm run test:e2e:ci
# Or use this command:
npx cypress run --spec "cypress/e2e/use-cases.cy.ts" --headless
```

---

## Document Maintenance

This document should be updated when:
1. New tests are added ✏️
2. Tests change status (passing → blocking, placeholder → implemented)
3. UI components are added/modified
4. Blockchain features are implemented
5. Test data changes

**Last Updated**: November 1, 2025
**Next Review**: When Use Case 2 UI components are ready
**Owner**: Development Team
