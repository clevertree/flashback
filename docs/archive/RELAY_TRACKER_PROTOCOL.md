# Flashback Protocol Specification

**Date:** October 30, 2025  
**Status:** 🔐 Security & Network Protocol Definition  
**Author's Input:** User clarification on Relay Tracker and network protocols

---

## Overview

Flashback uses a **certificate-based authentication model** with a **centralized Relay Tracker** for peer discovery and a **decentralized Peer Server** for file sharing.

---

## Part 1: Relay Tracker Protocol

### Client Registration

**Method:** Self-signed certificate with email embedded

```
Client generates:
  1. Private key (ed25519 or similar)
  2. Self-signed certificate containing:
     - Subject: CN=<email>@flashback or similar
     - Public key
  3. Stores certificate locally for future use

Client sends to Relay Tracker:
  POST /api/relay/register
  Body: {
    "certificate": "<PEM-encoded self-signed cert>",
    "email": "<email@domain.com>"
  }

Relay Tracker validates:
  ✓ Certificate is valid
  ✓ Email matches certificate CN
  ✓ Email does not already exist in database
  ✓ Certificate not previously registered

Relay Tracker stores:
  • Certificate (public key)
  • Email (unique identifier)
  • Registration timestamp
  • Client capabilities/metadata

Client response:
  - Success: 200 OK
  - Email exists: 409 Conflict (user must use different email or reset feature)
  - Invalid cert: 400 Bad Request
```

**Key Points:**
- Self-signed certificates eliminate need for CA infrastructure
- Email is **unique** per certificate
- One certificate = one email = one identity
- Future: Email verification + reset feature can replace certificate

---

### Client Authentication for API Calls

**Two API endpoints need authentication:**
1. `broadcast/ready` - Client announces it's online with port + IPs
2. `broadcast/lookup` - Client queries relay for other online peers

**Authentication Strategy: Mutual TLS with Signature Verification**

#### Option A: Mutual TLS (Recommended for simplicity)
```
Client establishes TLS connection to Relay:
  1. Client presents self-signed certificate (from registration)
  2. Relay verifies certificate matches registered certificate
  3. Relay extracts email from certificate CN
  4. TLS handshake completes - connection authenticated

All subsequent API calls on this connection:
  - Are authenticated by the TLS session
  - Relay knows email of caller
  - No additional auth headers needed
```

**Implementation:**
- Relay: Accept client certificates in TLS
- Relay: Map certificate to email in session
- Client: Send certificate + private key for mutual TLS

**Pros:**
- ✅ No tokens or cookies needed
- ✅ TLS built into all modern clients
- ✅ Works with existing HTTP stacks
- ✅ No session state needed beyond TLS

**Cons:**
- ⚠️ Requires client-side certificate handling
- ⚠️ Not all HTTP clients support mutual TLS easily

---

### **Recommendation: Option A (Mutual TLS)**

For `broadcast/ready` and `broadcast/lookup` APIs, use **Mutual TLS** because:
1. ✅ Simple to implement (TLS built into HTTP clients)
2. ✅ Stateless (no tokens to manage)
3. ✅ Secure by default
4. ✅ Email extraction from certificate
5. ✅ Eliminates token management complexity

---

## What is Mutual TLS? (Deep Dive)

### Regular TLS (HTTPS)
```
Client connects to server:
  1. Client: "Hi server, prove who you are"
  2. Server: "Here's my certificate" (public key + identity)
  3. Client: Verifies certificate is trusted
  4. Client: Sends secret data encrypted with server's public key
  5. Connection established ✓

Result: Only server is authenticated
         Client is anonymous
```

**Example:** When you visit `https://example.com`, the browser verifies the server's certificate but the server doesn't verify you are who you claim to be.

---

### Mutual TLS (mTLS)
```
Client connects to server:
  1. Client: "Hi server, I'll prove who I am too"
  2. Client sends: "Here's MY certificate" (public key + identity)
  3. Server: "Verified, I trust you"
  4. Server sends: "Here's MY certificate" (public key + identity)
  5. Client: "Verified, I trust you"
  6. Connection established ✓

Result: BOTH client AND server are authenticated
        Both prove identity cryptographically
```

**Key difference:** The server (Relay Tracker) asks for and verifies the client's certificate before allowing the connection.

---

### How Mutual TLS Works for Relay Tracker

```
Phase 1: Client Registration (no auth)
  POST /api/relay/register
  Body: {
    "certificate": "-----BEGIN CERTIFICATE-----\n...",
    "email": "user@example.com"
  }
  → Server stores certificate in database
  → Server returns 200 OK

Phase 2: Client Wants to Query Relay (with mutual TLS)
  GET /api/relay/broadcast/lookup?email=peer@example.com

  Step A: TLS Handshake (mutual)
    Client: "Here's my certificate (from registration)"
    Server: "Verified! I found it in database"
    Connection is now authenticated
    
  Step B: HTTP Request
    GET /api/relay/broadcast/lookup?email=peer@example.com
    (Server already knows who sent this because TLS authenticated the client)
    
  Step C: Server Processes
    Server extracts email from client certificate: "user@example.com"
    Server queries database: "Find peer@example.com"
    Server returns peer details (port + addresses)
    
Result: No tokens needed, no auth headers needed
        TLS session proves client identity
```

---

### Code Example: Node.js Mutual TLS

**Setting up the server (Relay Tracker):**
```typescript
import https from 'https';
import fs from 'fs';
import express from 'express';

const app = express();

const options = {
  key: fs.readFileSync('/path/to/server.key'),       // Server's private key
  cert: fs.readFileSync('/path/to/server.crt'),      // Server's certificate
  requestCert: true,                                   // Ask client for certificate
  rejectUnauthorized: false,                           // Accept all (validate in app)
  ca: []                                               // Optional: list of trusted CAs
};

// Create HTTPS server with mutual TLS
const server = https.createServer(options, app);

app.post('/api/relay/broadcast/ready', (req, res) => {
  // Extract client certificate from TLS handshake
  const clientCert = req.socket.getPeerCertificate();
  
  if (!clientCert || clientCert.subject.CN) {
    return res.status(401).json({error: "No client certificate"});
  }
  
  // Extract email from certificate CN (Common Name)
  const email = clientCert.subject.CN;  // e.g., "user@example.com"
  
  // Verify certificate is registered in database
  const registeredCert = db.query(
    "SELECT * FROM clients WHERE email = $1",
    [email]
  );
  
  if (!registeredCert || registeredCert.certificate !== clientCert.raw) {
    return res.status(401).json({error: "Certificate not registered"});
  }
  
  // ✅ Certificate is valid and registered
  // Process the broadcast request
  const {port, addresses} = req.body;
  
  // Insert broadcast
  db.query(
    "INSERT INTO broadcasts (...) VALUES (...)",
    [email, port, addresses]
  );
  
  return res.json({status: "ok", broadcast_id: "..."});
});

server.listen(3000);
```

**Client side (using curl with certificates):**
```bash
# Register (no cert required)
curl -X POST https://localhost:3000/api/relay/register \
  --cacert server.crt \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "certificate": "<PEM cert from earlier>"
  }'

# Query relay (WITH client cert - mutual TLS)
curl -X GET \
  https://localhost:3000/api/relay/broadcast/lookup?email=peer@example.com \
  --cacert server.crt \                    # Trust server's certificate
  --cert client.crt \                      # Send my certificate
  --key client.key                         # Sign with my private key
```

**What happens:**
1. curl sends client certificate (--cert) and key (--key)
2. Server verifies the certificate is registered
3. Server extracts email from certificate CN
4. Server processes the request as authenticated
5. Response is returned

---

#### Option B: JWT Tokens (Alternative)
```
1. During TLS handshake (mutual TLS):
   Client authenticates with certificate
   Relay creates JWT token containing email

2. Client stores JWT token
3. All subsequent API calls include token:
   Headers: Authorization: Bearer <JWT>

Relay validates token before processing request
```

**Pros:**
- ✅ Better mobile compatibility
- ✅ Simpler for HTTP clients
- ✅ Can add token expiration

**Cons:**
- ⚠️ Need session/token storage
- ⚠️ Token expiration management

---

#### Option C: Message Signing (Highest Security)
```
Client signs each API request:
  1. Create request body
  2. Sign body with private key
  3. Send request + signature in header:
     Headers: X-Signature: <base64-signature>

Relay validates:
  1. Extract email from URL/body
  2. Fetch client certificate from database
  3. Verify signature matches certificate public key
  4. Accept if valid
```

**Pros:**
- ✅ Works with regular TLS (no mutual TLS)
- ✅ Per-request authentication (no session state)
- ✅ Prevents MITM attacks
- ✅ Works with HTTP/2, HTTP/3

**Cons:**
- ⚠️ More complex client implementation
- ⚠️ Performance overhead (signature verification)

---

## Part 2: Relay Tracker API Endpoints

### Client Registration (No Auth Required)
```
POST /api/relay/register
Body: {
  "certificate": "<PEM self-signed cert>",
  "email": "<email@domain.com>"
}

Response 200:
{
  "status": "registered",
  "email": "<email@domain.com>",
  "id": "<client-id>"
}

Response 409:
{
  "error": "Email already registered"
}
```

### Broadcast Ready (Mutual TLS Auth Required)
```
POST /api/relay/broadcast/ready
Headers: TLS mutual authentication
Body: {
  "port": 54321,
  "addresses": [
    "192.168.1.50",      // Local network IP (v4)
    "10.0.0.5",          // Private VPN IP
    "2001:db8::1",       // Local IPv6
    "203.0.113.42"       // Public WAN IP (optional)
  ],
  "capabilities": {
    "version": "1.0",
    "features": ["files", "streaming"]
  }
}

Response 200:
{
  "status": "registered",
  "broadcast_id": "<broadcast-session-id>",
  "expires_in": 3600
}

Response 401: Unauthorized (certificate not registered)
Response 400: Invalid addresses format
```

### Broadcast Lookup (Mutual TLS Auth Required)
```
GET /api/relay/broadcast/lookup?email=<target-email>
Headers: TLS client certificate

Response 200:
{
  "email": "<target-email>",
  "status": "online",
  "port": 54321,
  "addresses": [
    "192.168.1.50",
    "10.0.0.5",
    "2001:db8::1"
  ],
  "last_seen": 1698700800,
  "broadcast_expires": 1698704400
}

Response 404: Client not online or does not exist
Response 401: Unauthorized (certificate not registered)
```

### List All Online Peers (Mutual TLS Auth Required)
```
GET /api/relay/broadcast/list
Headers: TLS client certificate

Response 200:
[
  {
    "email": "user.a@example.com",
    "port": 54321,
    "addresses": ["192.168.1.50"],
    "last_seen": 1698700800
  },
  {
    "email": "user.b@example.com",
    "port": 54322,
    "addresses": ["192.168.1.51"],
    "last_seen": 1698700750
  }
]
```

---

## Important: Heartbeat is CLIENT-TO-CLIENT, NOT Relay

**❌ DO NOT build:** `POST /api/relay/broadcast/heartbeat` endpoint

**✅ WHY:** 
- Heartbeat happens between peer clients (P2P keepalive)
- NOT to the Relay Tracker
- Relay uses TTL expiration instead (1 hour, auto-cleanup)

**How broadcasts stay alive:**
```
Client A wants to stay discoverable:
  1. Connects to Relay → broadcasts port + addresses
  2. Relay stores broadcast with expires_at = NOW() + 1 hour
  3. If Client A goes offline → broadcast expires naturally
  4. Cleanup job deletes expired broadcasts every 5 minutes

Direct peer heartbeat (Phase 2B):
  - Client A ↔ Client B exchange keepalives
  - NOT sent to Relay Tracker
  - Implemented in Peer Server HTTP endpoints
```

---

## Part 5: Network Architecture
  "expires_in": 3600
}
```

---

## Part 3: Peer Server (Peer-to-Peer)

### Connection Protocol

**Step 1: Client A Registers with Relay**
```
Client A:
  - Opens ephemeral port (OS-chosen)
  - Registers port + address list with relay via broadcast/ready
  - Relay stores: (ClientA, port, addresses, timestamp)
```

**Step 2: Client B Wants to Connect to Client A**
```
Client B:
  - Queries relay: "Find ClientA@example.com"
  - Relay responds: {port: 54321, addresses: [...]}
```

**Step 3: Client B Connects to Client A**
```
Client B tries addresses in order:
  1. 192.168.1.50:54321 (local network first)
  2. 10.0.0.5:54321 (private IP second)
  3. 2001:db8::1:54321 (IPv6)
  4. 203.0.113.42:54321 (public WAN IP last)

Connection flow:
  ✓ Client B connects to ClientA's Peer Server
  ✓ No authentication required (localhost trust model)
  ✓ Client B accesses /api/files, /content/*, /download/*
  ✓ Files served from ClientA's fileRootDirectory
```

**Key Points:**
- ✅ Clients provide **multiple IPs** (local + remote)
- ✅ Clients try IPs in order (local first = better performance)
- ✅ Relay stores address list at time of broadcast
- ✅ No authentication on Peer Server (for now)
- ✅ Future: Add authentication when needed

---

## Part 4: Peer Server HTTP API

### No Authentication Required (For Now)

```
GET /api/files
  → List files in root

GET /api/files/{path}
  → List files in subdirectory

GET /content/{file}
  → Get text file content

GET /download/{file}
  → Stream/download binary file

GET /health (NEW)
  → Health check for Phase 3
  Response: { status: "ok", email: "user@example.com" }
```

**Future Authentication (TBD):**
- Planned for later phase
- Could be token-based or certificate-based
- Not needed for initial deployment

---

## Part 5: Network Architecture

### Address List Handling

**Client must provide:**
```
addresses: [
  "192.168.1.50",           // Local network (v4)
  "fd00::1",                // Local network (v6)
  "203.0.113.42",           // Public WAN (optional)
  "vpn.example.com"         // DNS hostname (future)
]
```

**Relay stores address list at broadcast time**

**Connecting client tries in order:**
```
for address in relay_response.addresses:
  try:
    connect(address, port, timeout=5s)
    if success:
      return connection
  except:
    continue
  
if no connection:
  fail("Peer unavailable")
```

**Benefits:**
- ✅ Works behind NAT (tries local first)
- ✅ Works across networks (tries public IP)
- ✅ Supports IPv4 and IPv6
- ✅ Handles network changes gracefully

---

## Part 6: Certificate & Authentication Summary

### Registration Flow (No Auth)
```
Client: Register(certificate, email) → Success
Relay: Store certificate, email → Ready
```

### Broadcast Ready (Auth: Mutual TLS)
```
Client: POST /broadcast/ready with cert → TLS authenticated
Relay: Extract email from cert → Accept or reject
```

### Broadcast Lookup (Auth: Mutual TLS)
```
Client: GET /broadcast/lookup?email=X with cert → TLS authenticated
Relay: Extract email from cert → Return peer addresses
```

### Peer File Access (No Auth)
```
Client B: GET http://peer-ip:port/api/files → No auth needed
Peer: Serve files from fileRootDirectory
```

---

## Part 7: Phase Implications

### Phase 2: Requires Relay Tracker Implementation ✅
- ✅ Client registration endpoint
- ✅ Broadcast ready endpoint (mutual TLS)
- ✅ Broadcast lookup endpoint (mutual TLS)
- ✅ List peers endpoint
- ✅ Certificate storage
- ✅ Background cleanup (expiration)
- ⚠️ NO heartbeat endpoint (heartbeat is client-to-client)

**Phase 2 is NOT complete without Relay Tracker** - it's a prerequisite for clients to find each other.

### Phase 3: Friends List & Health Checks
- ✅ Adds local friends storage
- ✅ Periodic health checks (ping /health endpoint)
- ✅ Relay fallback when cached socket fails
- ✅ Health check timeout + retry logic

### Phase 4+: Future Features
- Email verification + reset feature
- Peer Server authentication
- P2P discovery (Kademlia, mDNS, gossip protocols)
- Advanced NAT traversal

---

## Part 8: What Was Confusing in My Understanding

### ❌ Error 1: Phase 2 Was Standalone
- **My understanding:** Phase 2 file sharing could work without Relay Tracker
- **Reality:** Phase 2 REQUIRES Relay Tracker for peer discovery
- **Fix:** Relay Tracker must be implemented in Phase 2, not Phase 3

### ❌ Error 2: Localhost-Only Binding
- **My understanding:** Peer Server only listens on 127.0.0.1
- **Reality:** Peer Server listens on **all addresses** (0.0.0.0), and clients report address list to relay
- **Fix:** Refactor Peer Server to accept list of addresses (v4 + v6)

### ❌ Error 3: Socket Discovery
- **My understanding:** Unclear how relay gets the peer's socket
- **Reality:** Client explicitly sends address list + port via `/broadcast/ready`
- **Fix:** This is now clear

### ❌ Error 4: Authentication Complexity
- **My understanding:** Email spoofing, no clear auth flow
- **Reality:** Certificates eliminate email spoofing, mutual TLS handles auth
- **Fix:** Clear authentication strategy established

### ❌ Error 5: "Relay Status" Endpoint
- **My understanding:** Not clear what this is
- **Reality:** You said you're not sure either - **should we remove it or clarify it?**

### ❌ Error 6: Future P2P Discovery
- **My understanding:** Should be designed now
- **Reality:** Explicitly planned for future phase (not Phase 2 or 3)
- **Fix:** Phase 2 and 3 use Relay Tracker only

---

## Part 9: Action Items

### Document Updates Needed
1. Create `RELAY_TRACKER_PROTOCOL.md` (new comprehensive protocol doc)
2. Create `CLIENT_AUTHENTICATION.md` (certificate + mutual TLS auth)
3. Create `NETWORK_ADDRESSING.md` (address list handling)
4. Update `PHASE_2_RELAY_IMPLEMENTATION.md` (Relay Tracker is Phase 2 prerequisite)
5. Update `SERVER_ARCHITECTURE.md` (address list, not single socket)
6. Remove or clarify "Relay Status" endpoint

### Implementation Priorities for Phase 2
1. **Relay Tracker Implementation** (backend)
   - [ ] Client registration endpoint
   - [ ] Certificate storage
   - [ ] Broadcast ready (mutual TLS)
   - [ ] Broadcast lookup (mutual TLS)
   - [ ] List peers endpoint
   - [ ] Broadcast expiration + cleanup

2. **Client Updates** (Rust/Tauri)
   - [ ] Generate self-signed certificate
   - [ ] Store certificate locally
   - [ ] Register with relay on startup
   - [ ] Gather local + remote addresses
   - [ ] Send address list to relay
   - [ ] Query relay for peers

3. **RemoteHouse Updates** (React)
   - [ ] Query relay to get peer list
   - [ ] Try addresses in order (local first)
   - [ ] Fall back to next address on failure
   - [ ] Show peer availability status

**Note:** Heartbeat is implemented later (Phase 2B) as peer-to-peer keepalive, NOT in Relay Tracker.

---

## Part 10: Security Considerations

### Certificate Security
- ✅ Self-signed eliminates CA compromise risk
- ✅ Email embedded in certificate (immutable)
- ✅ Private key stored locally (client controls)
- ⚠️ Future: Email verification for reset feature

### Mutual TLS Security
- ✅ Prevents certificate spoofing
- ✅ Server validates client certificate
- ✅ No tokens to leak or intercept
- ✅ Standard TLS security

### Peer Server Security
- ✅ localhost trust model (for now)
- ✅ User controls fileRootDirectory
- ✅ Directory traversal prevention
- ⚠️ Future: Authentication when needed

### Network Security
- ✅ Relay doesn't see file transfers
- ✅ Direct P2P connections (no proxy)
- ✅ HTTPS for relay (TLS)
- ✅ Multiple IPs prevent single point of failure

---

## Summary

**Your protocol is well-designed:**
- ✅ Certificate-based identity (no usernames/passwords)
- ✅ Mutual TLS for API authentication
- ✅ Multiple address support for NAT traversal
- ✅ Ephemeral port strategy
- ✅ Clear separation: Relay (discovery) vs Peer (files)

**Key clarifications:**
- 🔐 Phase 2 REQUIRES Relay Tracker
- 📍 Peer Server listens on all IPs (not just localhost)
- 🔑 Mutual TLS recommended for `/broadcast/ready` and `/broadcast/lookup`
- 🌐 Address list enables NAT traversal
- 📌 P2P discovery (Kademlia, mDNS) is Phase 4+

**Next Steps:**
1. Clarify: Should we keep or remove "Relay Status" endpoint?
2. Document: Full relay tracker protocol specification
3. Implement: Relay Tracker as Phase 2 prerequisite
4. Update: Client code to register with relay

---

**Questions:**
1. Should `/api/relay/status` be removed or kept for future monitoring?
2. Should we document the mutual TLS implementation details now, or save for later?
3. Should Phase 2 include Relay Tracker implementation, or is it split across phases?

