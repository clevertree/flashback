# Development Rules & Guidelines

## Component Development
1. **Break down large React components** into meaningful smaller components
2. **Create Cypress tests** in `./test/*` for each component and verify the test in CLI
3. **Maintain build compatibility** between Windows/OSX/Ubuntu

## Documentation Requirements  
4. **Maintain FEATURES.md** with all client and server features
5. **Follow IRC.md** for command protocols used by IRC networks
6. **Maintain COMMANDS.md** with all client commands and server responses

## Protocol Implementation
7. **Not all IRC protocols need to be implemented** - we may create some new commands
8. **Maintain a run-time configuration file** with defaults filled in for all server/client features

## Connection Rules
9. **Users do not auto-connect** with each other unless one side makes a request
10. **Server chatrooms are separate** from DCC (Direct Client to Client) Chatrooms

## Testing Standards
- All components must have corresponding Cypress tests
- Tests must pass in CLI before deployment
- Cross-platform compatibility must be verified

## Build Requirements
- Windows compatibility required
- OSX compatibility required  
- Ubuntu compatibility required
- Runtime configuration with sensible defaults
