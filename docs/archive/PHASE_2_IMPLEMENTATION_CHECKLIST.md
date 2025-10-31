# Phase 2 Implementation Checklist

**Phase Status:** 🔴 Blocked - Relay Tracker not started  
**Peer Server Status:** ✅ Complete  
**Client Integration Status:** ⏳ Planned  
**Estimated Completion:** 2-3 weeks

---

## RELAY TRACKER BACKEND (2.1) - `/server` directory

### Certificate Registration (2.1.1)
- [ ] Create `/server/app/api/relay/register/route.ts`
- [ ] Parse incoming certificate (PEM format)
- [ ] Validate certificate structure
- [ ] Extract email from CN field
- [ ] Check email uniqueness in database
- [ ] Store certificate + email in DB
- [ ] Return 200 with client_id or 409 if exists
- [ ] Write tests for all paths (valid, malformed, duplicate)

### Database Schema
- [ ] Create `clients` table:
  ```
  id: UUID
  email: STRING (unique)
  certificate: TEXT (PEM)
  created_at: TIMESTAMP
  expires_at: TIMESTAMP (optional)
  ```
- [ ] Create `broadcasts` table:
  ```
  id: UUID
  client_id: UUID (FK)
  port: INTEGER
  addresses: JSON array
  capabilities: JSON
  created_at: TIMESTAMP
  expires_at: TIMESTAMP (TTL)
  last_heartbeat: TIMESTAMP
  ```

### Broadcast Ready Endpoint (2.1.2)
- [ ] Create `/server/app/api/relay/broadcast/ready/route.ts`
- [ ] Extract client certificate from TLS connection
- [ ] Validate client cert matches registered cert
- [ ] Parse request body: `{port, addresses, capabilities}`
- [ ] Validate port (1-65535)
- [ ] Validate addresses (IP format)
- [ ] Insert/update broadcast record (expires in 1 hour)
- [ ] Return 200 with `{broadcast_id, expires_in: 3600}`
- [ ] Handle TLS cert mismatch (401 Unauthorized)
- [ ] Write integration tests

**TLS Setup Required:**
- [ ] Configure Express/Next.js to accept client certificates
- [ ] Set `requestCert: true` on HTTPS server
- [ ] Make certificates optional for now (mutual TLS can be enforced later)
- [ ] Extract certificate from `req.client.cert`

### Broadcast Lookup Endpoint (2.1.3)
- [ ] Create `/server/app/api/relay/broadcast/lookup/route.ts`
- [ ] Extract client certificate from TLS
- [ ] Query `broadcasts` table by email
- [ ] Check expiration (return 404 if expired)
- [ ] Return `{email, port, addresses}`
- [ ] Return 404 if not found or expired
- [ ] Handle TLS validation
- [ ] Write tests for all paths

### List Peers Endpoint (2.1.4)
- [ ] Create `/server/app/api/relay/broadcast/list/route.ts`
- [ ] Extract client certificate from TLS
- [ ] Query all non-expired broadcasts
- [ ] Filter out self (don't return caller)
- [ ] Return array of peers
- [ ] Handle empty list (return `[]`)
- [ ] Write tests

### Expiration Management (2.1.5)
- [ ] Create background job: Clean expired broadcasts
- [ ] Run every 5 minutes
- [ ] Delete broadcasts where `expires_at < NOW()`
- [ ] Log cleanup statistics
- [ ] Handle errors gracefully
- [ ] Note: NO heartbeat endpoint (client-to-client only)

### TLS/mTLS Configuration (2.1 Support)
- [ ] Install Node.js TLS libraries (`tls`, `https`)
- [ ] Create certificate validator middleware
- [ ] Extract client cert from `req.socket.getPeerCertificate()`
- [ ] Compare against stored certificate
- [ ] Document certificate format requirements
- [ ] Create test certificates (self-signed)

### Tests (2.1 Support)
- [ ] Integration tests for all 4 endpoints (no heartbeat)
- [ ] Certificate validation tests
- [ ] Expiration tests
- [ ] Database cleanup tests
- [ ] Error handling tests
- [ ] Generate test certificates

**Estimated Effort:** 6-8 days

---

## PEER SERVER UPDATES (2.2) - `client/src-tauri/src/http_server.rs`

### Multi-Address Binding (2.2.1)
- [ ] Change bind address from `127.0.0.1` to `0.0.0.0`
- [ ] Update code: `listener = TcpListener::bind("0.0.0.0:0")?`
- [ ] Test server is reachable from other machine
- [ ] Test server is reachable from same machine
- [ ] Consider IPv6 binding (`::`)?

### Get Local IP Addresses (2.2.2)
- [ ] Add `ipnetwork` crate to `Cargo.toml`
- [ ] Create function `get_local_addresses() -> Vec<String>`
- [ ] Get all network interfaces
- [ ] Filter IPv4 addresses (skip loopback)
- [ ] Get IPv6 addresses (skip link-local, loopback)
- [ ] Return sorted list
- [ ] Handle errors (no network, permissions)
- [ ] Test on macOS, Linux, Windows

**Pseudo-code:**
```rust
fn get_local_addresses() -> Vec<String> {
  use pnet::datalink;
  let mut addresses = Vec::new();
  
  for interface in datalink::interfaces() {
    for ip in interface.ips {
      match ip.ip() {
        IpAddr::V4(addr) => {
          if !addr.is_loopback() {
            addresses.push(addr.to_string());
          }
        }
        IpAddr::V6(addr) => {
          if !addr.is_loopback() && !addr.is_link_local() {
            addresses.push(addr.to_string());
          }
        }
      }
    }
  }
  addresses
}
```

### Emit Address List to UI (2.2.3)
- [ ] Update `http-file-server-ready` event
- [ ] Include `addresses: Vec<String>` in payload
- [ ] Test TypeScript types match Rust struct
- [ ] Update Tauri `invoke` call
- [ ] Verify UI receives addresses

**Code change:**
```rust
app_handle.emit_all("http-file-server-ready", json!({
  "port": listener.local_addr()?.port(),
  "addresses": get_local_addresses()?
}))?;
```

**Estimated Effort:** 2 days

---

## CLIENT CERTIFICATE & REGISTRATION (2.3) - `client/src-tauri/src`

### Generate Self-Signed Certificate (2.3.1)
- [ ] Add `rcgen` crate to `Cargo.toml`
- [ ] Create function `generate_certificate(email: &str) -> Result<(String, String)>`
  - Returns: (certificate_pem, private_key_pem)
- [ ] Use ed25519 for key generation
- [ ] Set CN=email in certificate
- [ ] Set valid_for_days = 365
- [ ] Handle certificate generation errors
- [ ] Test certificate format

**Pseudo-code:**
```rust
use rcgen::generate_simple_self_signed_cert;

fn generate_certificate(email: &str) -> Result<(String, String)> {
  let subject_alt_names = vec![email.to_string()];
  let cert = generate_simple_self_signed_cert(
    subject_alt_names,
    365
  )?;
  Ok((cert.serialize_pem()?, cert.serialize_private_key_pem()?))
}
```

### Store Certificate Locally (2.3.1 Support)
- [ ] Use Tauri `app_dir()` for storage
- [ ] Create directory: `~/.dcc/certificates/`
- [ ] Store: `client.crt` (certificate)
- [ ] Store: `client.key` (private key)
- [ ] Protect private key (0600 permissions)
- [ ] Load on startup if exists
- [ ] Generate if missing

### Register with Relay on Startup (2.3.2)
- [ ] Create function `register_with_relay(email: &str, cert: &str, relay_url: &str)`
- [ ] POST to `{relay_url}/api/relay/register`
- [ ] Send body: `{certificate: cert, email: email}`
- [ ] Handle response:
  - [ ] 200 OK: Log success, continue
  - [ ] 409 Conflict: Email exists, show error, ask user for new email
  - [ ] Other errors: Retry or fail gracefully
- [ ] Add error handling and logging
- [ ] Test with mock relay server

### Gather & Send Address List (2.3.3)
- [ ] Create function `broadcast_ready(relay_url: &str, port: u16, addresses: Vec<String>)`
- [ ] POST to `{relay_url}/api/relay/broadcast/ready`
- [ ] Send body: `{port, addresses, capabilities: {...}}`
- [ ] Include client certificate (mutual TLS)
- [ ] Handle response: `{broadcast_id, expires_in}`
- [ ] Store broadcast_id for heartbeat
- [ ] Handle errors

**Pseudo-code:**
```rust
async fn broadcast_ready(
  relay_url: &str,
  port: u16,
  addresses: Vec<String>
) -> Result<String> {
  let client = reqwest::Client::builder()
    .identity(load_client_identity()?)
    .build()?;
  
  let response = client
    .post(&format!("{}/api/relay/broadcast/ready", relay_url))
    .json(&json!({
      "port": port,
      "addresses": addresses
    }))
    .send()
    .await?;
  
  let body: BroadcastResponse = response.json().await?;
  Ok(body.broadcast_id)
}
```

### Note on Heartbeat (2.3.4)

**IMPORTANT:** Heartbeat is NOT sent to Relay Tracker in Phase 2A.

- Broadcasts stay alive via 1-hour TTL
- Background cleanup deletes expired broadcasts
- Client goes offline → broadcast expires naturally
- Heartbeat is PHASE 2B+ (client-to-client keepalive)
- Phase 2B will add peer-to-peer health checks

### Error Handling & Logging (2.3 Support)
- [ ] Log certificate generation
- [ ] Log relay registration success/failure
- [ ] Log broadcast ready success/failure
- [ ] Emit events to UI for user feedback
- [ ] Handle network timeouts gracefully

**Estimated Effort:** 3.5-4 days

---

## REMOTEHOUSE UPDATES (2.4) - `client/src/components/RemoteHouse`

### Query Relay for Peer List (2.4.1)
**Challenge:** Browser can't do mutual TLS. Solution: Use Tauri bridge.

- [ ] Create Tauri command: `query_relay_peers(relay_url: String) -> Vec<Peer>`
- [ ] In Rust:
  - [ ] Query relay `/api/relay/broadcast/list`
  - [ ] Validate TLS cert
  - [ ] Return peer list
- [ ] In React:
  - [ ] Call Tauri command on component mount
  - [ ] Handle loading state
  - [ ] Cache result (5 minute TTL)
  - [ ] Show peer list in UI
  - [ ] Refresh on user request

**Peer struct:**
```typescript
interface Peer {
  email: string;
  port: number;
  addresses: string[];
  lastSeen: string;
}
```

### Address Try-Order Logic (2.4.2)
- [ ] Create function `connectToPeer(peer: Peer) -> Promise<Response>`
- [ ] Try addresses in order:
  1. Local IPv4 (192.168... or 10...)
  2. Local IPv6 (fe80:...)
  3. Public IPv4
  4. Public IPv6
- [ ] On each failure, try next address
- [ ] On success: Set `connectedPeer`, cache winning address
- [ ] Implement timeout (5 seconds per address)
- [ ] Log all attempts

**Pseudo-code:**
```typescript
async function connectToPeer(peer: Peer): Promise<string> {
  for (const address of peer.addresses) {
    try {
      const response = await fetch(
        `http://${address}:${peer.port}/api/files`,
        {timeout: 5000}
      );
      if (response.ok) {
        return address; // Success!
      }
    } catch (e) {
      console.log(`${address} failed: ${e.message}`);
    }
  }
  throw new Error('All addresses failed');
}
```

### Peer Status Indicators (2.4.3)
- [ ] Add peer status enum: `online | offline | checking | error`
- [ ] Show visual indicator in UI
  - [ ] `●` Green: Online (successfully connected)
  - [ ] `○` Gray: Offline (no addresses reachable)
  - [ ] `◐` Yellow: Checking (currently trying)
  - [ ] `!` Red: Error (show error message)
- [ ] Update status as connection attempts progress
- [ ] Auto-refresh periodically (5 seconds)

### Integration Tests (2.4 Support)
- [ ] Test querying mock relay
- [ ] Test address try-order logic
- [ ] Test connection fallback
- [ ] Test status indicators
- [ ] Test error cases (no peers, timeout, etc.)

**Estimated Effort:** 2-3 days

---

## TESTING & VERIFICATION

### End-to-End Test Scenario
- [ ] Start User A app
  - [ ] Certificate generated ✓
  - [ ] Registered with relay ✓
  - [ ] Broadcast ready sent ✓
  - [ ] Heartbeat running ✓
- [ ] Start User B app
  - [ ] Sees User A in peer list ✓
- [ ] User B visits User A
  - [ ] Tries addresses in order ✓
  - [ ] Successfully connects ✓
  - [ ] Can browse files ✓
- [ ] User A goes offline
  - [ ] Broadcast expires ✓
  - [ ] User B sees offline status ✓

### Automated Tests
- [ ] Unit tests: Certificate generation
- [ ] Unit tests: IP address detection
- [ ] Integration tests: Relay registration
- [ ] Integration tests: Broadcast ready/lookup
- [ ] Integration tests: Address try-order
- [ ] E2E tests: Full flow (User A → User B)

---

## DEPENDENCIES TO ADD

### Rust Crates (`client/src-tauri/Cargo.toml`)
- [ ] `rcgen = "0.10"` - Certificate generation
- [ ] `pnet = "0.34"` - Network interface enumeration
- [ ] `rustls = "0.21"` - TLS client
- [ ] `tokio-rustls = "0.24"` - Tokio integration
- [ ] `reqwest = "0.11"` with `rustls-tls` feature - HTTP client with TLS

### Node.js Packages (`server/package.json`)
- [ ] `node-forge` or `pem` - Certificate parsing
- [ ] `node-jwk-to-pem` - Certificate conversion (if needed)

### Versions
- [ ] Check crate compatibility
- [ ] Verify all deps compile on macOS/Linux/Windows

---

## DOCUMENTATION TO CREATE

### 1. CLIENT_CERTIFICATE_GUIDE.md
- How certificates are generated
- Where they're stored
- How they're used for Relay identification
- What CN field contains

### 2. MUTUAL_TLS_SETUP.md
- How to configure Relay to expect client certs
- How to configure client to send certs
- Certificate validation flow
- Testing mutual TLS

### 3. ADDRESS_LIST_NAT_TRAVERSAL.md
- Why address list is needed
- How addresses are ordered
- Why local addresses tried first
- How it handles network changes

### 4. PHASE_2_COMPLETION.md
- Checklist of all completed items
- Test results
- Known issues
- Performance metrics

---

## BLOCKERS & RISKS

### High Risk
- 🔴 **Mutual TLS in Node.js** - Ensure client cert extraction works
- 🔴 **Certificate format** - Must be compatible between Rust/Node/Browser
- 🔴 **IP detection** - Must work cross-platform (macOS/Linux/Windows)

### Medium Risk
- 🟡 **Expiration management** - TTL handling in database
- 🟡 **Network reachability** - Some addresses may not be reachable
- 🟡 **Browser CORS** - If browser needs to contact relay

### Low Risk
- 🟢 **Tauri event emission** - Standard Tauri feature
- 🟢 **React state management** - Standard React patterns

---

## EFFORT ESTIMATE SUMMARY

| Component | Est. Days | Status |
|-----------|-----------|--------|
| Relay (2.1) | 6-10 | ⏳ Not started |
| Peer Server (2.2) | 2 | ⏳ Not started |
| Client Cert (2.3) | 3.5-4 | ⏳ Not started |
| RemoteHouse (2.4) | 2-3 | ⏳ Not started |
| Testing & Docs | 3-4 | ⏳ Not started |
| **TOTAL** | **16-25 days** | **🔴 BLOCKED** |

**Timeline:** 3-5 weeks (assuming 5-day work week with other obligations)

**Critical Path:** Relay Tracker backend (2.1) → Client registration (2.3.2) → Broadcast ready (2.3.3)

---

## PHASE 2 SIGN-OFF CRITERIA

Phase 2 is complete when:

4. ✅ User B receives User A's address list
5. ✅ User B tries addresses in order
6. ✅ User B successfully connects to User A
7. ✅ User B browses User A's files
8. ✅ Broadcasts expire automatically after 1 hour
9. ✅ Cleanup job runs every 5 minutes
10. ✅ All tested end-to-end with 2 real instances

**Note on Heartbeat:** Client-to-client heartbeat added in Phase 2B. Phase 2A uses TTL-based expiration.

**Sign-off:** When all 9 criteria met and tests pass

```

