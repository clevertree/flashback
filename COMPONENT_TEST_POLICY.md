# Component Test Coverage Policy

## Enforced Rule: All Components Must Have E2E Tests

Every component must have comprehensive Cypress E2E tests before being merged to main.

## Test Requirements

Each component must have tests covering:

1. **Rendering**: Component renders on page load
2. **User Interactions**: Buttons, inputs, selections work correctly
3. **State Management**: Component state updates properly
4. **Error Handling**: Error messages display correctly
5. **Edge Cases**: Empty states, loading states, validation errors
6. **Accessibility**: Labels, headings, keyboard navigation

## Component Test Coverage

### KeyManagement Component ✅
- **File**: `src/components/KeyManagement.tsx`
- **Tests**: `cypress/e2e/components.cy.ts` (9 tests)
- **Coverage**:
  - ✅ Renders with correct heading and icon
  - ✅ Generate button functionality
  - ✅ Identity details display
  - ✅ Private key display
  - ✅ Save identity action
  - ✅ Loading state handling
  - ✅ Error handling

### NetworkConnection Component ✅
- **File**: `src/components/NetworkConnection.tsx`
- **Tests**: `cypress/e2e/components.cy.ts` (11 tests)
- **Coverage**:
  - ✅ Renders with correct heading and icon
  - ✅ Default URL values
  - ✅ Input field editing
  - ✅ Connection button
  - ✅ Network status display
  - ✅ Connect action handling
  - ✅ Status updates

### ChannelBrowser Component ✅
- **File**: `src/components/ChannelBrowser.tsx`
- **Tests**: `cypress/e2e/components.cy.ts` (9 tests)
- **Coverage**:
  - ✅ Renders channel list
  - ✅ Channel selection
  - ✅ Channel details display
  - ✅ Icon rendering
  - ✅ Content grid display
  - ✅ Empty state handling

### TorrentManager Component ✅
- **File**: `src/components/TorrentManager.tsx`
- **Tests**: `cypress/e2e/components.cy.ts` (12 tests)
- **Coverage**:
  - ✅ Renders with correct heading and icon
  - ✅ Input fields and default values
  - ✅ Input field editing
  - ✅ Add torrent button
  - ✅ Validation (magnet link required)
  - ✅ Adding torrent action
  - ✅ Loading state handling
  - ✅ Downloads section display
  - ✅ Progress bar rendering
  - ✅ Download stats display

## Cross-Component Tests ✅
- **Tests**: `cypress/e2e/components.cy.ts` (3 integration tests)
- **Coverage**:
  - ✅ All components render on page load
  - ✅ Separate state management across components
  - ✅ Sequential operations work correctly

## Error Handling Tests ✅
- **Tests**: `cypress/e2e/components.cy.ts` (3 tests)
- **Coverage**:
  - ✅ Network error handling
  - ✅ Error message display consistency
  - ✅ Retry after error

## Accessibility & UI Tests ✅
- **Tests**: `cypress/e2e/components.cy.ts` (5 tests)
- **Coverage**:
  - ✅ Proper heading hierarchy
  - ✅ Visible labels for inputs
  - ✅ Proper button states
  - ✅ Responsive layout
  - ✅ Error state styling

## Total Test Count
- **Total Cypress E2E Tests**: 52 tests across all components
- **Test File**: `cypress/e2e/components.cy.ts`

## Running Tests

```bash
# Run all Cypress E2E tests
npm run cypress:open

# Run Cypress tests in headless mode
npm run cypress:run

# Run specific test file
npm run cypress:run -- --spec cypress/e2e/components.cy.ts
```

## Test Data Attributes

Components use `data-testid` for reliable element selection:

```tsx
<div data-testid="key-icon">...</div>
<div data-testid="network-icon">...</div>
<div data-testid="download-icon">...</div>
```

## Enforcement

### Pre-Commit Hook
Before committing component changes, run:
```bash
npm run cypress:run
```

### CI/CD Pipeline
All tests must pass before merge:
1. Unit tests: `npm run test`
2. Build: `npm run build`
3. E2E tests: `npm run cypress:run`
4. Tauri build: `npm run tauri:build`

### Component Modification Rule
**RULE**: If you modify ANY component, you MUST:
1. Update the corresponding E2E tests
2. Run all tests locally
3. Ensure all tests pass before committing

## Test Structure

Each component section in `components.cy.ts` includes:
- Basic rendering tests
- User interaction tests
- State management tests
- Error handling tests
- Edge case tests

## Future Components

When adding new components:
1. Create component in `src/components/`
2. Add E2E tests in `cypress/e2e/components.cy.ts`
3. Add test data attributes to component
4. Ensure all tests pass before merge
5. Update this document with coverage info

## Maintenance

### Monthly Test Review
- Verify all tests still pass
- Update tests for component changes
- Remove obsolete test cases
- Add tests for new features

### Known Limitations
- E2E tests use mock data (real API mocking not yet implemented)
- Network calls are mocked in Cypress
- Real Tauri backend calls not tested (requires full app build)

## References
- Cypress Documentation: https://docs.cypress.io/
- Testing Best Practices: https://docs.cypress.io/guides/references/best-practices
- Component Testing: https://docs.cypress.io/guides/component-testing/overview
