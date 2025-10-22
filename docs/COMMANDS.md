# COMMANDS

Client Commands (UI)
- Settings: change Navigation side (Left/Right); toggle Media auto-play
- Channel Add: creates a new chat channel in the current session
- Send Message: broadcasts a message to the selected channel
- DCC Connect: from Clients list, click Connect on a peer to open a direct chatroom (no auto-connect). Note: DCC signaling is peer-to-peer only and is not relayed by the server.
- DCC Approval: receiving client shows an approval prompt for new peers; once approved, future requests from the same ip:port auto-open
- /File in DCC: initiates a file request. Sender selects a file; receiver may Open with OS, Save to OS, or Playback in the Media Player. Optional parameter: start=<seconds> to resume at a time.

On Connect
- Client issues /LIST to server to request the connected user list

Server Events/Responses (per IRC.md, extended)
- client-list-updated: emits the list of clients connected
- user-connected: notifies clients when a new user connects (used to refresh user list)
- server-disconnected: notifies clients of disconnection
- server-error: emits string error message
- chat-message: delivers broadcast chat messages including timestamp and channel

Notes
- Not all IRC protocols are implemented; extensions are documented here. See IRC.md for baseline commands.
