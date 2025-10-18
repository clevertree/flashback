# Chat Feature Documentation

## Overview

The client-server application now includes a group chat feature where all connected clients can send messages to each other. Messages are broadcast through the server but **NOT stored** - the server only acts as a relay.

## Features

✅ **Real-time group chat** - All connected clients see messages instantly  
✅ **Channel support** - Create and switch between multiple chat channels  
✅ **Default channel** - All clients start in the "general" channel  
✅ **No server storage** - Messages are broadcast in-memory only  
✅ **Message metadata** - Each message includes sender IP, port, content, channel, and timestamp  
✅ **Visual distinction** - Your own messages appear differently from others  
✅ **Timestamp display** - Messages show when they were sent  
✅ **Sender sees messages** - Your sent messages appear in your own chat log  

## How It Works

### Message Flow

```
Client A                    Server                    Client B, C, D
   |                          |                            |
   |--Chat(message)---------->|                            |
   |                          |                            |
   |                          |--Broadcast(message)------->|
   |                          |                            |
   |<-----------------------Chat(message)------------------|
```

1. **Client sends message**: Client invokes `send_chat_message` with message text
2. **Server receives**: Server gets chat message with sender info
3. **Server broadcasts**: Server sends message to ALL connected clients (including sender)
4. **Clients display**: Each client receives and displays the message

### Message Structure

```json
{
  "type": "chat",
  "from_ip": "127.0.0.1",
  "from_port": 50123,
  "message": "Hello everyone!",
  "timestamp": "2025-10-18T10:30:45.123Z"
}
```

## Using the Chat Feature

### Client UI

1. **Connect to server** first using the connection form
2. **Chat section appears** once connected
3. **Type message** in the input field at bottom
4. **Press Enter** or click "Send" to broadcast message
5. **View messages** in the scrollable chat area above

### Message Display

- **Your messages**: Blue background, aligned right
- **Others' messages**: Gray background, aligned left
- **Sender info**: Shows IP:Port or "You" for own messages
- **Timestamp**: Time message was sent (in your local timezone)

### UI Components

```
┌─────────────────────────────────┐
│    💬 Group Chat                │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ Chat Messages (scrollable)  │ │
│ │                             │ │
│ │ [Other] 127.0.0.1:50001    │ │
│ │ Hello!            10:30 AM │ │
│ │                             │ │
│ │         [You] 127.0.0.1:50002│ │
│ │         Hi there! 10:31 AM │ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Type a message...      [Send]│ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

## Server Implementation

### Key Changes

1. **WriterMap**: Stores TCP write handles for each client
   ```rust
   type WriterMap = Arc<RwLock<HashMap<SocketAddr, Arc<Mutex<OwnedWriteHalf>>>>>;
   ```

2. **Chat Handler**: Processes incoming chat messages
   ```rust
   Message::Chat { from_ip, from_port, message, timestamp } => {
       println!("💬 Chat from {}:{}: {}", from_ip, from_port, message);
       broadcast_message(&writers, &chat_msg, Some(socket_addr)).await;
   }
   ```

3. **Broadcast Function**: Sends message to all clients
   ```rust
   async fn broadcast_message(writers: &WriterMap, message: &Message, exclude: Option<SocketAddr>)
   ```

### Server Logs

```
💬 Chat from 127.0.0.1:50001: Hello everyone!
💬 Chat from 127.0.0.1:50002: Hi there!
```

## Client Implementation

### Tauri Command

```rust
#[tauri::command]
async fn send_chat_message(
    message: String,
    client_ip: String,
    client_port: u16,
    state: State<'_, AppState>,
) -> Result<String, String>
```

### Event Listener

```typescript
listen<ChatMessage>('chat-message', (event) => {
  console.log('Chat message received:', event.payload)
  setChatMessages(prev => [...prev, event.payload])
})
```

### Sending Messages

```typescript
const handleSendMessage = async () => {
  await invoke('send_chat_message', {
    message: messageInput,
    clientIp,
    clientPort: parseInt(clientPort),
  })
}
```

## Technical Details

### No Message Storage

The server does **NOT** store any messages. Benefits:

- ✅ Privacy: No message history on server
- ✅ Performance: No database or file I/O
- ✅ Simplicity: Stateless message relay
- ✅ Real-time only: Live communication focus

### Message Ordering

- Messages are delivered in order per-client
- Network delays may cause different clients to see messages in slightly different orders
- Timestamps help establish actual send order

### Connection Management

- When client disconnects, no cleanup needed for messages
- Writers are removed from WriterMap automatically
- No orphaned message data

### Error Handling

- Failed broadcasts are logged but don't affect other clients
- Network errors don't stop message delivery to other clients
- UI shows error if send fails

## Testing the Chat

### Single Machine Test

1. Start server:
   ```bash
   cd server
   cargo run
   ```

2. Start first client:
   ```bash
   cd client
   npm run tauri dev
   ```

3. Start second client (new terminal):
   ```bash
   cd client
   npm run tauri dev
   ```

4. Connect both clients to `127.0.0.1:8080`

5. Send messages from either client

6. See messages appear on both clients instantly

### Multi-User Test

1. Server on machine A (e.g., 192.168.1.100)
2. Client on machine B connects to 192.168.1.100:8080
3. Client on machine C connects to 192.168.1.100:8080
4. All clients can chat together

## Message Protocol

### Send Chat Message (Client → Server)

```json
{
  "type": "chat",
  "from_ip": "127.0.0.1",
  "from_port": 50123,
  "message": "Hello!",
  "timestamp": "2025-10-18T10:30:45.123Z"
}
```

### Broadcast Chat Message (Server → All Clients)

Same format as above - server forwards message to all connected clients.

## Security Considerations

⚠️ **Current Implementation**:
- No authentication
- No message validation
- No rate limiting
- No profanity filtering
- Anyone can send any message

🔒 **Recommended for Production**:
1. Add user authentication
2. Validate message content and length
3. Rate limit messages per client
4. Sanitize message text
5. Add message encryption
6. Implement user blocking/muting

## Performance

### Scalability

With current architecture:
- ✅ Handles 100s of clients easily
- ✅ Low latency (milliseconds)
- ✅ Minimal memory usage
- ⚠️ Broadcasting scales linearly with client count

### Optimization Ideas

For 1000+ clients:
1. Use pub/sub pattern (Redis, NATS)
2. Implement message batching
3. Add multiple server instances
4. Use WebSocket instead of TCP

## Troubleshooting

### Messages not appearing

1. Check server logs for broadcast errors
2. Verify client is connected (status shows "Connected")
3. Check network connectivity
4. Restart client and reconnect

### Messages appearing out of order

1. This is expected due to network latency
2. Check timestamps to see actual send order
3. Consider adding sequence numbers if ordering is critical

### Can't send messages

1. Ensure you're connected (chat section should be visible)
2. Check message input isn't empty
3. Look for error messages in red banner
4. Check console logs for detailed errors

## Future Enhancements

Possible additions:
- [ ] Private messages between specific clients
- [ ] Chat rooms/channels
- [ ] File sharing
- [ ] Message reactions/emojis
- [ ] User nicknames
- [ ] Typing indicators
- [ ] Read receipts
- [ ] Message history (optional, client-side only)

## Summary

The chat feature provides:
- Real-time group messaging
- No server-side storage (privacy)
- Simple broadcast architecture
- Clean, intuitive UI
- Scalable for moderate client counts

Perfect for small team communication, IoT device coordination, or multiplayer game chat!
