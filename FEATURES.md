# FEATURES

Client UI
- Configurable slide-out navigation menu (left or right side) with smooth scrolling to sections
- Stacked layout (single-page) with distinct sections: Video, Connection, Chat, Clients, Settings, Instructions
- Settings section controls: Navigation side (Left/Right), Media auto-play preference
- Preferences persist in localStorage via a runtime config layer (nav side, media auto-play)
- Always-visible Media Player section that can accept streaming connections and play back media
- DCC (Direct Client-to-Client) chatroom scaffold opens when user clicks Connect on a peer

Server/Networking (existing)
- Connect to server with IP/port selection
- Auto-generated client port on launch
- Live client list with peer status indicator
- Group chat channels with creation and message broadcasting
- On connect, client may issue /LIST to receive connected users (per IRC.md)
- Server broadcasts user connect events to update client lists

Notes
- Users do not auto-connect to each other; DCC opens only when the user clicks Connect on a peer
- /File command in DCC accepts optional start time parameter to resume from a position (UI stub)
