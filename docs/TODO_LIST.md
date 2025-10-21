# Current TODO Items

## High Priority UI Tasks

### 1. Navigation Menu Implementation
- **Task**: Create a Nav menu that appears from the left or right side (configurable)
- **Status**: ✅ Done (Desktop)
- **Notes**: Mobile/collapsible behavior and full responsive layout are deferred per current scope.
- **Requirements**:
  - [x] Configurable positioning (left/right)
  - [x] Smooth animation/transition
  - [x] Auto-hide at <= 800px; fixed at > 800px
  - [ ] Mobile/collapsible menu — deferred

### 2. Theme System Implementation  
- **Task**: Allow switching between themes
- **Status**: ✅ Done
- **Theme Types**:
  - **Stacked theme**: Shows all active UI sections simultaneously
  - **Tabbed theme**: Shows all UI sections in a tabbed interface
- **Requirements**:
  - [x] Theme persistence
  - [x] Smooth transitions
  - [x] Consistent styling across themes

## Development Workflow
- [x] Break down existing large components into smaller ones
- [x] Add Cypress tests for new navigation components
- [x] Add Cypress tests for theme switcher components
- [ ] Verify cross-platform compatibility
- [x] Update configuration system for theme/nav preferences

## Future Enhancements
- DCC chatroom implementation with file streaming
- Video player integration with streaming support
- Advanced IRC protocol command implementation
