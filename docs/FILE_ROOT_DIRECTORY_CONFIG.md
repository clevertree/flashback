# File Root Directory Configuration

## Overview

The `fileRootDirectory` config setting enables clients to specify a local directory containing files that should be served via HTTPS to other clients. This is a **client-only** configuration that is never sent to the server.

## Architecture

```
┌─ UI Layer ──────────────────────────────────┐
│                                             │
│  SettingsSection                            │
│  - Display/edit fileRootDirectory in main   │
│    settings UI                              │
│  - Persisted to localStorage                │
│                                             │
│  BroadcastSection                           │
│  - Show fileRootDirectory field for         │
│    convenience before starting listener     │
│  - Allow editing/updating before "Ready!"   │
│                                             │
└────────────────┬────────────────────────────┘
                 │ setConfig({ fileRootDirectory })
                 ▼
┌─ Config Layer ──────────────────────────────┐
│                                             │
│  client/src/app/config.ts                   │
│  - AppConfig.fileRootDirectory?: string     │
│  - Stored in localStorage                   │
│  - Default: empty string                    │
│                                             │
└────────────────┬────────────────────────────┘
                 │ getConfig() retrieves value
                 ▼
┌─ Rust Layer (Tauri) ────────────────────────┐
│                                             │
│  client/src-tauri/src/main.rs               │
│  - RuntimeConfig.file_root_directory        │
│  - Passed to HTTP listener startup          │
│  - NOT sent in api_register_json            │
│  - NOT sent in any server requests          │
│                                             │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─ HTTP Server (Future) ──────────────────────┐
│                                             │
│  HTTP Listener                              │
│  - Serves files from fileRootDirectory      │
│  - Listens on localhost:PORT for browser    │
│  - Returns files with HTTP cache headers    │
│  - ETag + Last-Modified validation          │
│                                             │
└─────────────────────────────────────────────┘
```

## Files Modified

### 1. `client/src/app/config.ts`
- Added `fileRootDirectory?: string` field to AppConfig interface
- No server transmission - purely local config

### 2. `client/src/components/SettingsSection/SettingsSection.tsx`
- Added `fileRootDirectory` prop to SettingsSectionProps
- Added `onChangeFileRootDirectory` callback
- Added "File Hosting" section with text input
- Displays help text explaining it's for local HTTP file serving

### 3. `client/src/app/page.tsx`
- Import SettingsSection component
- Add state for `showSettings` visibility
- Add Settings toggle button
- Render SettingsSection with fileRootDirectory config and handlers
- Pass config values and onChange callbacks

### 4. `client/src/app/sections/BroadcastSection.tsx`
- Import `setConfig` from config
- Add state for `fileRootDirectory`
- Add input field for fileRootDirectory in broadcast form
- Allow editing with immediate config persistence
- Display help text: "Directory containing files to serve via HTTPS to other clients"

### 5. `client/src-tauri/src/main.rs`
- Added `file_root_directory: String` to RuntimeConfig struct
- Updated Default impl to initialize empty string
- ✅ UNDONE: Removed fileRootDirectory from api_register_json (never sent to server)

## Important Notes

### ❌ NOT Sent to Server
- fileRootDirectory is **never** included in registration payload
- It's a client-only setting
- The server has no knowledge of this configuration

### ✅ Used By HTTP Listener
- When HTTP listener starts (in future implementation), it will:
  1. Read fileRootDirectory from RuntimeConfig
  2. Validate the directory exists
  3. Serve files from that directory to other clients
  4. Return HTTP headers with ETag and Last-Modified

### UI Locations
1. **Main Settings** (toggle from page header)
   - SettingsSection component
   - Can be edited anytime
   - Persists to localStorage

2. **Broadcast Ready** (before starting listener)
   - BroadcastSection component
   - Convenience field for quick setup
   - Same config, just easier access during broadcast flow

## Socket Code Cleanup (Pending)

The old socket-based peer connection code in `connect_to_server` needs to be retired:
- Remove TcpListener for socket connections (lines ~247-1000)
- Remove DccChat message handling
- Keep HTTPS request handling for HTTP-based client-to-client communication

This will be done as part of the HTTP listener implementation.

## Next Steps

1. ✅ Configuration UI complete (SettingsSection + BroadcastSection)
2. ⏳ Implement HTTP listener in Rust
   - Replace socket listener with HTTP server
   - Read fileRootDirectory from config
   - Serve files with proper cache headers
3. ⏳ Update RemoteHouse to use HTTP URLs
4. ⏳ Add E2E tests for configuration flow

## Testing Checklist

- [ ] SettingsSection renders fileRootDirectory field
- [ ] BroadcastSection renders fileRootDirectory field
- [ ] Config persists to localStorage
- [ ] Both UI locations show same value
- [ ] Editing in Settings updates BroadcastSection
- [ ] Editing in BroadcastSection updates config immediately
- [ ] fileRootDirectory is NOT in registration payload
- [ ] HTTP listener uses fileRootDirectory when started
- [ ] Files served with correct cache headers
