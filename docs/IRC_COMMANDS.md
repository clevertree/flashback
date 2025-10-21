# IRC Commands Protocol

## Server Connection Commands

### 1. /LIST Command
**Trigger**: When connecting to a server  
**Action**: Client runs `/LIST`  
**Response**: Returns the connected user list of that server

### 2. New User Connection Event
**Trigger**: When a new user connects  
**Action**: Server sends an event notifying all connected users  
**Response**: All clients update their user list when receiving this response

## Direct Client Communication (DCC)

### 3. /File Command
**Context**: Within DCC chatroom only  
**Action**: Opens up a streaming request from one client to another

#### File Streaming Workflow:
a. **Request Approval**: If the request is approved, file instantly begins streaming  
b. **Caching Options**: While file stream is caching, user gets options to:
   - Save
   - Open  
   - Playback
c. **Media Playback**: Playback is defaulted for any media file  
d. **Resume Capability**: Server attempts to decode playback statistics for resume functionality  
e. **Start Time Parameter**: File command provides parameter for start time to resume stream at specified time

## Protocol Extensions
- Custom commands may be implemented beyond standard IRC protocol
- DCC file streaming with resume support
- Real-time media playback with time-based seeking
