# FEATURES

Client UI
- Configurable slide-out navigation menu (left or right side) with smooth scrolling to sections
- Responsive nav: auto-hides when window width <= 800px; fixed at > 800px with content offset so nothing appears under it
- Stacked layout (single-page) with distinct sections: Video, Connection, Chat, Clients, Settings, Instructions
- Settings section controls: Navigation side (Left/Right), Media auto-play preference
- Preferences persist in localStorage via a runtime config layer (nav side, media auto-play, approved DCC peers)
- Always-visible Media Player section that can accept streaming connections and play back media
- DCC (Direct Client-to-Client) chatroom opens when user clicks Connect on a peer; receiving client shows an approval prompt (one-time per peer)
- DCC window includes logs panel and /File workflow (sender picks file; receiver can Open, Save, or Playback in the video player)

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
