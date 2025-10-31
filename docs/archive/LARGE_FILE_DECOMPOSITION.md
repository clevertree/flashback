# Large File Decomposition Plan

## Analysis: DccChatroom Component (951 lines)

### Current Structure
The `DccChatroom.tsx` component handles multiple responsibilities:
1. **Chat messaging** - Sending/receiving text messages between peers
2. **File transfer management** - Initiating, receiving, and tracking file transfers
3. **Stream handling** - Managing file streams, URLs, and data chunks
4. **File I/O operations** - Saving files to disk, opening with OS, browser fallbacks
5. **Tauri integration** - Command invocation and event listening
6. **UI rendering** - Chat display, file transfer UI, progress tracking

### Proposed Decomposition

#### 1. **FileTransferHandler.tsx** (Extract ~300 lines)
**Responsibility:** Manage file transfer state and operations
**Contents to move:**
- `handleSendFile()` and related file selection logic
- `streamFileToPeer()` function
- `handleCancelTransfer()` function
- File transfer state management and refs
- Transfer progress tracking logic

**Exports:**
```tsx
export interface FileTransferState {
  transfers: Record<string, TransferInfo>
  outgoingFile: File | null
  incomingFile: { name: string; url?: string; file?: File } | null
}

export function useFileTransfers(peer: DccPeer | null, invokeFn)
export function FileTransferUI({ transfers, incomingFile, onAction })
```

#### 2. **FileOperations.tsx** (Extract ~200 lines)
**Responsibility:** Handle file save/open operations (Tauri + browser fallback)
**Contents to move:**
- `handleOpenWithOS()` function
- `handleOpenWithOS_UsingFile()` function
- `handleSaveToOS()` function
- `handleSaveToOS_UsingFile()` function
- `ensureSaveTarget()` function

**Exports:**
```tsx
export interface FileSaveTarget {
  tmpPath: string
  finalPath: string
  bytesWritten: number
}

export async function saveFileToOS(url: string, name: string)
export async function openFileWithOS(url: string, name: string)
export async function saveFileFromFile(file: File, name: string)
export async function openFileFromFile(file: File, name: string)
```

#### 3. **StreamManager.tsx** (Extract ~150 lines)
**Responsibility:** Handle stream receiving and chunk assembly
**Contents to move:**
- BroadcastChannel listeners for streams and chunks
- Stream data assembly logic
- Chunk reception and buffering

**Exports:**
```tsx
export interface StreamReceiver {
  subscribe(peer: DccPeer, onData: (url: string, file: File) => void)
  unsubscribe()
}

export function useStreamReceiver(peer: DccPeer | null, peer)
```

#### 4. **TauriEventManager.tsx** (Extract ~120 lines)
**Responsibility:** Handle Tauri event listeners and commands
**Contents to move:**
- Tauri event setup and listeners
- Command invocation wrapper
- Desktop-specific event handling

**Exports:**
```tsx
export function useTauriDccEvents(peer: DccPeer | null, callbacks)
export async function invokeDccCommand(cmd: string, args?: any)
```

#### 5. **ChatMessage.tsx** (Extract ~50 lines)
**Responsibility:** Chat message display component
**Contents to move:**
- Message UI rendering
- Message formatting

**Exports:**
```tsx
export interface ChatMessageProps extends DccMessage {
  onPlayback?: (url: string) => void
}

export function ChatMessage(props: ChatMessageProps)
```

### Refactored Main Component
**New DccChatroom.tsx** (~100 lines)
- Orchestrates sub-components
- Maintains chat state
- Handles message sending/receiving

### Benefits
1. **Separation of concerns** - Each component has a single responsibility
2. **Testability** - Smaller units are easier to test and mock
3. **Reusability** - File operations and stream management can be used elsewhere
4. **Maintainability** - Changes to file I/O don't affect chat logic
5. **Performance** - Easier to optimize specific features
6. **Type safety** - Clear interfaces between components

### Migration Steps
1. Create new component files with exported functions
2. Update DccChatroom to import and use the new components
3. Update tests to work with new component structure
4. Verify functionality with Cypress tests
5. Remove old code from DccChatroom

---

## Analysis: main.rs (2876 lines)

### Current Structure
The Rust main.rs file contains:
1. **App initialization** - Tauri setup and app state
2. **Crypto operations** - Key generation, cert creation
3. **File operations** - Key loading, file I/O
4. **UI commands** - Handlers invoked from the frontend
5. **Network operations** - Port allocation, discovery
6. **Database operations** - Key storage and retrieval
7. **Logging** - Diagnostic and debug logging

### Proposed Decomposition

#### 1. **crypto_ops.rs** (~400 lines)
- Key generation and management
- Certificate creation and validation
- Crypto utility functions

#### 2. **file_operations.rs** (~300 lines)
- File I/O for keys and certs
- Path resolution and directory management
- Config file handling

#### 3. **ui_commands.rs** (~600 lines)
- UI command handlers (all #[tauri::command] functions)
- UI-specific state and responses

#### 4. **network_ops.rs** (~200 lines)
- Port allocation and availability checking
- Network discovery functions
- Peer communication setup

#### 5. **models.rs** (~150 lines)
- Data structures and types
- Request/response models
- State structures

### Benefits
- **Faster compilation** - Smaller crates compile independently
- **Easier maintenance** - Find related code quickly
- **Better organization** - Clear module boundaries
- **Testing** - Easier to unit test individual modules
- **Reusability** - Modules can be shared or imported

### Migration Steps
1. Create new module files
2. Move functions and types to appropriate modules
3. Update visibility modifiers (pub)
4. Update imports in main.rs
5. Test compilation and functionality
6. Update module documentation
