# Phase 2A: Relay Tracker Backend - Implementation Plan

**Start Date:** November 2, 2025 (Monday)  
**Duration:** 1-2 weeks (6-10 days)  
**Status:** 🟢 READY TO START  
**Team:** 1 backend developer

---

## Phase 2A Overview

**What:** Build Relay Tracker backend (centralized peer discovery)  
**Why:** Phase 2 cannot work without peer discovery  
**How:** Next.js API routes with mutual TLS + PostgreSQL  
**Done When:** All 5 endpoints working with tests

---

## What You're Building

### 4 API Endpoints

```
POST /api/relay/register
  Purpose: Register client certificate + email
  Auth: None (open registration)
  Returns: 200 OK or 409 Conflict

POST /api/relay/broadcast/ready
  Purpose: Announce you're online (port + addresses)
  Auth: Mutual TLS ✓
  Returns: broadcast_id + expiration

GET /api/relay/broadcast/lookup?email=user@example.com
  Purpose: Find peer by email
  Auth: Mutual TLS ✓
  Returns: peer details (port, addresses)

GET /api/relay/broadcast/list
  Purpose: List all online peers
  Auth: Mutual TLS ✓
  Returns: array of peers

NOTE: Heartbeat is CLIENT-TO-CLIENT only (peer servers ping each other)
      Do NOT build a heartbeat endpoint to the Relay Tracker
      Instead: broadcasts expire after 1 hour, background cleanup removes expired entries
```

### Database Schema

```sql
-- Registered clients (by email)
CREATE TABLE clients (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  certificate TEXT NOT NULL,  -- PEM format
  created_at TIMESTAMP DEFAULT NOW()
);

-- Active broadcasts (expires in 1 hour)
CREATE TABLE broadcasts (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  port INTEGER NOT NULL,
  addresses JSON NOT NULL,  -- ["192.168.1.50", "fd00::1"]
  capabilities JSON,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,  -- NOW() + 3600 seconds
  last_heartbeat TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_broadcasts_email 
  ON broadcasts USING (clients.email);
CREATE INDEX idx_broadcasts_expires 
  ON broadcasts (expires_at);
```

---

## Day-by-Day Implementation Plan

### Day 1: Project Setup & Database

**Morning:**
- [ ] Clone/verify `/server` directory structure
- [ ] Verify Next.js 14+ is configured
- [ ] Set up PostgreSQL (local or Docker)
- [ ] Create `.env.local`:
  ```
  DATABASE_URL=postgresql://user:password@localhost:5432/relay_tracker
  TLS_CERT_PATH=/path/to/server.crt
  TLS_KEY_PATH=/path/to/server.key
  ```

**Afternoon:**
- [ ] Run database migrations (create tables)
- [ ] Test database connection
- [ ] Create test data insert script
- [ ] Verify database ready

**Checklist:**
- [ ] Database created and accessible
- [ ] Tables created with indexes
- [ ] `.env.local` configured
- [ ] Can query database from Node.js

**Code to create:**
- `server/lib/db.ts` - Database connection + queries
- `server/lib/migrations.sql` - Schema creation
- `server/scripts/init-db.sh` - Database setup script

---

### Day 2: Register Endpoint (No Auth)

**What:** POST `/api/relay/register` (certificate + email → register)

**Morning:**
- [ ] Create `/server/app/api/relay/register/route.ts`
- [ ] Parse incoming JSON: `{certificate, email}`
- [ ] Validate certificate format (PEM)
- [ ] Validate email format (email@example.com)
- [ ] Extract CN from certificate
- [ ] Check email uniqueness

**Afternoon:**
- [ ] Insert into database
- [ ] Handle duplicate email error (409 Conflict)
- [ ] Return 200 with client_id
- [ ] Add error handling
- [ ] Write unit tests

**Success Criteria:**
- [ ] Valid cert + email → 200 OK
- [ ] Duplicate email → 409 Conflict
- [ ] Malformed cert → 400 Bad Request
- [ ] Database has new record

**Code example:**
```typescript
// POST /api/relay/register
export async function POST(request: Request) {
  const {certificate, email} = await request.json();
  
  // Validate
  if (!certificate || !email) return Response.json({error: "Missing fields"}, {status: 400});
  
  // Parse certificate
  const cert = parseCertificate(certificate);
  if (!cert) return Response.json({error: "Invalid certificate"}, {status: 400});
  
  // Check uniqueness
  const existing = await db.query('SELECT id FROM clients WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    return Response.json({error: "Email already registered"}, {status: 409});
  }
  
  // Insert
  const client_id = crypto.randomUUID();
  await db.query(
    'INSERT INTO clients (id, email, certificate) VALUES ($1, $2, $3)',
    [client_id, email, certificate]
  );
  
  return Response.json({client_id}, {status: 200});
}
```

---

### Day 3: Broadcast Ready Endpoint (Mutual TLS)

**What:** POST `/api/relay/broadcast/ready` (mutual TLS auth, register online status)

**Key Challenge:** Extract client certificate from HTTPS request

**Morning:**
- [ ] Create `/server/app/api/relay/broadcast/ready/route.ts`
- [ ] Set up Express middleware to extract client cert
- [ ] Validate client cert matches registered cert
- [ ] Parse request: `{port, addresses, capabilities}`
- [ ] Validate port (1-65535)
- [ ] Validate addresses (IP format, array)

**Afternoon:**
- [ ] Insert/update broadcast record
- [ ] Set expires_at = NOW() + 3600 (1 hour)
- [ ] Return broadcast_id + expires_in
- [ ] Handle auth failures (401 Unauthorized)
- [ ] Write tests

**TLS Setup Required:**
```javascript
// In server initialization
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync(process.env.TLS_KEY_PATH),
  cert: fs.readFileSync(process.env.TLS_CERT_PATH),
  requestCert: true,  // Ask client for cert
  rejectUnauthorized: false  // Accept all (validate in app)
};

https.createServer(options, app).listen(3000);
```

**Code example:**
```typescript
// POST /api/relay/broadcast/ready
export async function POST(request: Request) {
  // Extract certificate from TLS connection
  const clientCert = request.headers['x-ssl-cert'];
  if (!clientCert) return Response.json({error: "No client certificate"}, {status: 401});
  
  // Find registered client
  const client = await db.query(
    'SELECT id FROM clients WHERE certificate = $1',
    [clientCert]
  );
  if (client.rows.length === 0) {
    return Response.json({error: "Certificate not registered"}, {status: 401});
  }
  
  const {port, addresses, capabilities} = await request.json();
  
  // Validate
  if (!port || port < 1 || port > 65535) {
    return Response.json({error: "Invalid port"}, {status: 400});
  }
  
  // Insert/update broadcast
  const broadcast_id = crypto.randomUUID();
  await db.query(
    `INSERT INTO broadcasts (id, client_id, port, addresses, capabilities, expires_at)
     VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '1 hour')
     ON CONFLICT (client_id) DO UPDATE SET
       port = $3,
       addresses = $4,
       expires_at = NOW() + INTERVAL '1 hour'`,
    [broadcast_id, client.rows[0].id, port, JSON.stringify(addresses), JSON.stringify(capabilities)]
  );
  
  return Response.json({broadcast_id, expires_in: 3600}, {status: 200});
}
```

---

### Day 4: Broadcast Lookup Endpoint (Mutual TLS)

**What:** GET `/api/relay/broadcast/lookup?email=user@example.com` (find peer)

**Morning:**
- [ ] Create `/server/app/api/relay/broadcast/lookup/route.ts`
- [ ] Extract and validate client cert
- [ ] Get email from query parameter
- [ ] Query database for broadcast

**Afternoon:**
- [ ] Check if broadcast expired
- [ ] Return peer details or 404
- [ ] Handle errors
- [ ] Write tests

**Code example:**
```typescript
// GET /api/relay/broadcast/lookup?email=user@example.com
export async function GET(request: Request) {
  // Validate TLS
  const clientCert = request.headers['x-ssl-cert'];
  if (!clientCert) return Response.json({error: "No client certificate"}, {status: 401});
  
  const email = new URL(request.url).searchParams.get('email');
  if (!email) return Response.json({error: "Missing email"}, {status: 400});
  
  // Query
  const result = await db.query(
    `SELECT b.port, b.addresses, b.last_heartbeat as last_seen
     FROM broadcasts b
     JOIN clients c ON b.client_id = c.id
     WHERE c.email = $1 AND b.expires_at > NOW()`,
    [email]
  );
  
  if (result.rows.length === 0) {
    return Response.json({error: "Peer not found or offline"}, {status: 404});
  }
  
  const broadcast = result.rows[0];
  return Response.json({
    email,
    port: broadcast.port,
    addresses: broadcast.addresses,
    last_seen: broadcast.last_seen
  }, {status: 200});
}
```

---

### Day 5: List Endpoint (Mutual TLS)

**What:** GET `/api/relay/broadcast/list` (find all online peers)

**Morning:**
- [ ] Create `/server/app/api/relay/broadcast/list/route.ts`
- [ ] Extract and validate client cert
- [ ] Query all non-expired broadcasts

**Afternoon:**
- [ ] Return array of all peers (email, port, addresses)
- [ ] Filter out self (don't list the caller)
- [ ] Handle errors
- [ ] Write tests

**Code:**
```typescript
// GET /api/relay/broadcast/list
export async function GET(request: Request) {
  const clientCert = request.headers['x-ssl-cert'];
  if (!clientCert) return Response.json({error: "Unauthorized"}, {status: 401});
  
  // Get caller's email
  const callerResult = await db.query(
    'SELECT id FROM clients WHERE certificate = $1',
    [clientCert]
  );
  if (callerResult.rows.length === 0) {
    return Response.json({error: "Unauthorized"}, {status: 401});
  }
  const callerId = callerResult.rows[0].id;
  
  const result = await db.query(
    `SELECT c.email, b.port, b.addresses
     FROM broadcasts b
     JOIN clients c ON b.client_id = c.id
     WHERE b.expires_at > NOW() AND b.client_id != $1
     ORDER BY c.email`,
    [callerId]
  );
  
  return Response.json(result.rows, {status: 200});
}
```

**Note on Heartbeat:** Heartbeat is CLIENT-TO-CLIENT only (peer servers ping each other), NOT to Relay Tracker. Broadcasts stay alive via 1-hour expiration + background cleanup.

---

### Day 6: Expiration Management & Cleanup

**Background Job:**
- [ ] Create cleanup job that runs every 5 minutes
- [ ] Delete broadcasts where expires_at < NOW()
- [ ] Log deleted count
- [ ] Handle errors

**Code:**
```typescript
// In server.ts or separate cron file
import cron from 'node-cron';

// Run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    const result = await db.query(
      'DELETE FROM broadcasts WHERE expires_at < NOW()'
    );
    console.log(`[Cleanup] Deleted ${result.rowCount} expired broadcasts`);
  } catch (error) {
    console.error('[Cleanup] Error:', error);
  }
});
```

---

### Day 7-8: TLS Configuration & Testing

**TLS Setup:**
- [ ] Generate test certificates (self-signed)
- [ ] Configure Node.js HTTPS server
- [ ] Extract client cert from request
- [ ] Validate cert matches database

**Testing:**
- [ ] Write integration tests for all 4 endpoints
- [ ] Test with curl + certificates
- [ ] Test certificate validation
- [ ] Test expiration
- [ ] Test error cases (401, 404, 409, 400)

**Test Certificates:**
```bash
# Generate server cert
openssl req -x509 -newkey rsa:2048 -keyout server.key -out server.crt \
  -days 365 -nodes -subj "/CN=localhost"

# Generate client cert
openssl req -x509 -newkey rsa:2048 -keyout client.key -out client.crt \
  -days 365 -nodes -subj "/CN=test@example.com"
```

**Test curl commands:**
```bash
# Register
curl -X POST http://localhost:3000/api/relay/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","certificate":"<cert_pem>"}'

# Broadcast ready (with client cert)
curl --cert client.crt --key client.key \
  -X POST https://localhost:3000/api/relay/broadcast/ready \
  -H "Content-Type: application/json" \
  -d '{"port":54321,"addresses":["192.168.1.50"]}'

# Lookup (with client cert)
curl --cert client.crt --key client.key \
  https://localhost:3000/api/relay/broadcast/lookup?email=test@example.com
```

---

## Success Criteria

### Functional Requirements
✅ Client can register with certificate + email  
✅ Client can broadcast port + addresses (mutual TLS)  
✅ Client can lookup peer by email (mutual TLS)  
✅ Client can get list of all peers (mutual TLS)  
✅ Broadcasts expire after 1 hour  
✅ Cleanup job removes expired broadcasts  
✅ Heartbeat is CLIENT-TO-CLIENT (not Relay endpoint)

### Non-Functional Requirements
✅ All endpoints respond in <100ms (lookup, list)  
✅ Mutual TLS properly validates certificates  
✅ Database indexes working (fast queries)  
✅ All error cases handled (400, 401, 404, 409)  
✅ All tests passing  
✅ 0 build errors/warnings  

### Testing
✅ Unit tests for database queries  
✅ Integration tests for all 4 endpoints  
✅ Certificate validation tests  
✅ Expiration tests  
✅ Error handling tests  

---

## Checklist for Phase 2A

### Setup (Day 1)
- [ ] PostgreSQL running locally
- [ ] Database created and migrated
- [ ] Tables created with indexes
- [ ] `.env.local` configured
- [ ] Node.js dependencies installed

### Register Endpoint (Day 2)
- [ ] POST /api/relay/register working
- [ ] Valid cert + email → 200 OK
- [ ] Duplicate email → 409 Conflict
- [ ] Unit tests passing
- [ ] Error handling complete

### Broadcast Ready (Day 3)
- [ ] POST /api/relay/broadcast/ready working
- [ ] Mutual TLS validation working
- [ ] Port + addresses stored
- [ ] Expiration set to 1 hour
- [ ] Integration tests passing

### Lookup Endpoint (Day 4)
- [ ] GET /api/relay/broadcast/lookup working
- [ ] Returns peer details or 404
- [ ] Mutual TLS working
- [ ] Tests passing

### List Endpoint (Day 5)
- [ ] GET /api/relay/broadcast/list working
- [ ] Returns all non-expired peers
- [ ] Filters out self (caller)
- [ ] Tests passing
- [ ] Note: Heartbeat is CLIENT-TO-CLIENT, not Relay endpoint

### Expiration & Cleanup (Day 6)
- [ ] Background cleanup job running
- [ ] Expired broadcasts deleted
- [ ] No memory leaks
- [ ] Error handling working

### TLS & Testing (Day 7-8)
- [ ] Test certificates generated
- [ ] Node.js HTTPS server configured
- [ ] Client cert extraction working
- [ ] All integration tests passing (4 endpoints)
- [ ] Can test with curl + certificates

---

## Dependencies to Add

**package.json additions:**
```json
{
  "dependencies": {
    "pg": "^8.11.0",  // PostgreSQL client
    "node-forge": "^1.3.0",  // Certificate parsing
    "node-cron": "^3.0.2"  // Cron jobs
  },
  "devDependencies": {
    "@types/node-forge": "^1.3.0",
    "@types/node-cron": "^3.0.8"
  }
}
```

**Install:**
```bash
npm install pg node-forge node-cron
npm install --save-dev @types/node-forge @types/node-cron
```

---

## File Structure to Create

```
server/
├── app/
│   ├── api/
│   │   └── relay/
│   │       ├── register/
│   │       │   └── route.ts
│   │       └── broadcast/
│   │           ├── ready/
│   │           │   └── route.ts
│   │           ├── lookup/
│   │           │   └── route.ts
│   │           ├── list/
│   │           │   └── route.ts
│   │           └── heartbeat/
│   │               └── route.ts
│   └── api.test.ts
├── lib/
│   ├── db.ts (database connection)
│   └── certificate.ts (cert parsing)
├── scripts/
│   ├── init-db.sh (create tables)
│   └── generate-test-certs.sh
└── tests/
    └── relay.test.ts (integration tests)
```

---

## Daily Standup Template

```
Date: Nov X, 2025

COMPLETED TODAY:
- [ ] 3-5 checklist items
- [ ] Code review passed
- [ ] Tests written and passing

IN PROGRESS:
- [ ] Current task
- [ ] Blockers: None / [describe]

PLANNED TOMORROW:
- [ ] Next 2-3 checklist items

RISKS:
- [ ] None / [describe]

METRICS:
- Lines of code: XXX
- Test coverage: XX%
- Build time: XXs
```

---

## Success Metrics (By End of Phase 2A)

**Code Quality:**
- ✅ 0 TypeScript errors
- ✅ All tests passing (90%+ coverage)
- ✅ No console errors
- ✅ Database queries optimized

**Performance:**
- ✅ Lookup <100ms
- ✅ Broadcast ready <1s
- ✅ Heartbeat <500ms
- ✅ List <200ms

**Security:**
- ✅ Mutual TLS enforced
- ✅ Certificate validation working
- ✅ No SQL injection possible
- ✅ Error messages don't leak info

**Functionality:**
- ✅ All 5 endpoints working
- ✅ Expiration management working
- ✅ Cleanup job running
- ✅ End-to-end flow tested

---

## What Comes After Phase 2A

**Phase 2B (Week 2):** Client certificate generation + Peer Server enhancements
- Generate self-signed certs in Tauri
- Bind Peer Server to 0.0.0.0 (all IPs)
- Detect local IP addresses
- Register with Relay on startup

**Phase 2C (Week 3):** Discovery integration + RemoteHouse updates
- Query Relay for peer list
- Try addresses in order
- Show peers in RemoteHouse UI
- E2E testing (two real instances)

---

## Questions During Implementation?

Check:
1. **RELAY_TRACKER_PROTOCOL.md** - Protocol details
2. **PHASE_2_QUICK_REFERENCE.md** - API summary
3. **PHASE_2_IMPLEMENTATION_CHECKLIST.md** - Detailed tasks
4. **Code examples above** - Implementation templates

---

**Status: Ready to begin Phase 2A - November 2, 2025**

**Good luck! 🚀**

