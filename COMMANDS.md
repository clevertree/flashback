# COMMANDS

Client Commands (UI)
- Move Nav: toggles the navigation between left and right sides
- Theme Switcher: selects between Stacked and Tabbed layouts
- Channel Add: creates a new chat channel in the current session
- Send Message: broadcasts a message to the selected channel

Server Responses (existing)
- client-list-updated: emits the list of clients connected
- server-disconnected: notifies clients of disconnection
- server-error: emits string error message
- chat-message: delivers broadcast chat messages including timestamp and channel
