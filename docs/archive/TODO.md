## Active Development Tasks

1. Add password encrypted private key feature. 
This requires the user to enter a password to decrypt the private key upon every use, or upon client load

## Cleanup Tasks (Perform After All Other Tasks Are Done)

1. **Maintain an .md file with unused code inventory** - Create and maintain a file listing all files and source code that appears to be unnecessary or not used anywhere in the codebase

2. **Ensure all React components have Cypress tests** - Verify that all React components have corresponding component tests in cypress/test/ and keep them updated as components evolve

3. **Analyze and reorganize code and scripts** - Review all code and scripts to better organize by function and prevent duplicated functionality across the codebase

4. **Break down large files** - Decompose large files into meaningful smaller components when possible to improve maintainability and readability

5. **Safely retire legacy code** - Remove legacy code that is no longer needed and verify that no references to it remain in use throughout the codebase
