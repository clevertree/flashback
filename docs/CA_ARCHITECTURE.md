# Certificate Authority Architecture for Flashback

**Status:** Architecture Design  
**Date:** October 31, 2025  
**Version:** 1.0  
**Scope:** Redesign certificate infrastructure from self-signed to CA-issued model

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Model (To Be Replaced)](#current-model-to-be-replaced)
3. [New CA Model](#new-ca-model)
4. [CSR (Certificate Signing Request) Flow](#csr-certificate-signing-request-flow)
5. [Email Uniqueness Enforcement](#email-uniqueness-enforcement)
6. [Certificate Storage & Distribution](#certificate-storage--distribution)
7. [Key Management](#key-management)
8. [Trust Model](#trust-model)
9. [Certificate Revocation](#certificate-revocation)
10. [Migration Strategy](#migration-strategy)
11. [Security Considerations](#security-considerations)
12. [Implementation Phases](#implementation-phases)

---

## Executive Summary

### The Problem with Current Model

**Current (Self-Signed):**
```
1. Client generates own key + certificate locally
2. Client sends full certificate to relay tracker
3. Relay stores certificate in database
4. Relay distributes certificate to other clients
5. Each certificate is unique, not verifiable by CA
```

**Issues:**
- Relay becomes single point of trust
- No central authority to verify certificates
- Hard to revoke certificates
- No standardized validation
- Difficult to enforce email uniqueness

### New Model (Certificate Authority)

```
1. Client generates private key locally (keeps secret)
2. Client creates CSR (Certificate Signing Request) from key
3. Client sends CSR + email to relay tracker (CA)
4. Relay CA verifies email uniqueness
5. Relay CA signs CSR → creates certificate
6. Relay returns signed certificate to client
7. Client stores certificate locally
8. Relay stores ONLY: email → certificate fingerprint
```

**Benefits:**
- Relay acts as trusted Certificate Authority
- Certificates are CA-issued, verifiable by all peers
- Email uniqueness enforced at CA level
- Certificate revocation possible
- Standardized X.509 validation
- Secure chain of trust

---

## Current Model (To Be Replaced)

### Flow: Self-Signed Certificate

```
Client                          Relay Tracker (DB)
  │
  ├─ gen-key (CLI)
  │  ├─ Generate private key locally
  │  └─ Generate self-signed certificate
  │     (Certificate contains email in SAN)
  │
  ├─ Register with relay
  │  └─ POST /api/relay/register
  │     Body: { certificate: "-----BEGIN CERT..." }
  │
  │                            ✓ POST /api/relay/register
  │                            ├─ Parse cert
  │                            ├─ Extract email from cert
  │                            ├─ Check email not in DB
  │                            ├─ Store: { email, certificate }
  │                            └─ Return: { email }
  │
  ├─ Broadcast (via bootstrap)
  │
  └─ Peer Discovery
     └─ Other peer queries relay for this peer
        ├─ Relay returns certificate to querying peer
        └─ Querying peer validates against relay cert
```

### Storage

**Database (relay_tracker):**
```sql
users table:
  - email (string, unique)
  - certificate (text) ← Full PEM stored
  - created_at
  - updated_at
```

### Problems with This Model

1. **Full certificate in database** - Privacy concern, bloat
2. **No CA trust** - Each cert is equally trusted/untrusted
3. **No revocation** - Can't easily revoke bad certificate
4. **No renewal** - Certificate expires, no standardized renewal
5. **No key escrow** - Can't recover if client loses key

---

## New CA Model

### High-Level Architecture

```
┌─────────────────────────────────┐
│   Relay Tracker (CA Root)       │
│  - Issues certificates          │
│  - Signs CSRs                   │
│  - Enforces email uniqueness    │
│  - Stores fingerprints only     │
└─────────────────────────────────┘
         ↑           ↓
         │ CSR       │ Signed Cert
         │           │
    ┌────┴───────────┴─────┐
    │   Peer Certificates  │
    │  (Trusted by all)    │
    └──────────────────────┘
         ↓        ↓       ↓
    Peer A    Peer B    Peer C
```

### Flow: CA-Issued Certificate

```
Client                          Relay Tracker (CA)
  │
  ├─ gen-key (CLI)
  │  ├─ Generate private key locally (KEEP SECRET)
  │  ├─ Generate CSR from private key
  │  │  (CSR contains email in SAN)
  │  └─ Store private key locally
  │
  ├─ Register with relay (NEW CA FLOW)
  │  └─ POST /api/relay/auth/csr
  │     Body: { email, csr: "-----BEGIN CSR..." }
  │
  │                            ✓ POST /api/relay/auth/csr
  │                            ├─ Parse CSR
  │                            ├─ Extract email from CSR
  │                            ├─ Verify email in CSR matches request
  │                            ├─ Check email not in CA database
  │                            ├─ Sign CSR with CA private key
  │                            │  └─ Create X.509 certificate
  │                            ├─ Extract fingerprint from cert
  │                            ├─ Store: { email, fingerprint }
  │                            └─ Return: { certificate: "...", expires_at: ... }
  │
  ├─ Store certificate locally
  │  └─ Save to certificate.pem
  │
  └─ Peer verification
     └─ When peer validates certificate
        ├─ Extract issuer from cert
        ├─ Verify issuer is relay tracker CA
        ├─ Verify signature with CA public key
        └─ Certificate is valid!
```

### Storage (New)

**Database (relay_tracker):**
```sql
users table:
  - email (string, unique)
  - cert_fingerprint (string, sha256)  ← Only fingerprint, not full cert
  - created_at
  - updated_at
  - is_active (boolean, for revocation)
```

**Client Local Storage:**
```
~/.flashback/
├─ private.key                    ← Keep secret!
└─ certificate.pem               ← Public, but cached from CA
```

---

## CSR (Certificate Signing Request) Flow

### Step 1: Client Generates Private Key & CSR

**Rust Code (on client):**
```rust
use rcgen::{Certificate, CertificateParams, KeyPair};

// 1. Generate private key (Ed25519 or RSA)
let key_pair = KeyPair::generate(&rcgen::PKCS_ED25519)?;
let private_key_pem = key_pair.serialize_pem();

// 2. Create CSR parameters
let mut params = CertificateParams::new([email.clone()]);
params.key_pair = Some(key_pair);

// 3. Generate CSR (not certificate)
let csr_pem = params.serialize_request(&key_pair)?;

// 4. Store private key securely
fs::write(priv_path, private_key_pem)?;

// Store CSR only temporarily (for sending to relay)
```

### Step 2: Client Sends CSR to Relay CA

**HTTP Request:**
```http
POST /api/relay/auth/csr HTTP/1.1
Host: relay.example.com
Content-Type: application/json

{
  "email": "alice@example.com",
  "csr": "-----BEGIN CERTIFICATE REQUEST-----\nMIIBpDCCAQoCAQAwXjELMAkGA1UEBhMCVVMx\n...",
  "algorithm": "ed25519"
}
```

**Request Validation:**
```typescript
// 1. Parse CSR
const csr = parseCSR(body.csr);
const csrEmail = extractEmailFromCSR(csr);

// 2. Verify email matches
if (csrEmail !== body.email) {
  return error("CSR email mismatch", 400);
}

// 3. Check email not registered
const existing = await UserModel.findOne({ email });
if (existing) {
  return error("Email already registered", 409);
}

// 4. CSR is valid if passed all checks
```

### Step 3: Relay CA Signs CSR

**Relay CA Process:**
```typescript
// 1. Load CA private key (stored on relay server)
const caPrivateKey = fs.readFileSync('/secure/ca-private-key.pem');

// 2. Sign CSR
const certificate = signCSR(csr, caPrivateKey, {
  expiresInDays: 365,
  issuer: {
    commonName: "Flashback CA",
    organizationName: "Flashback Network"
  }
});

// 3. Extract fingerprint
const fingerprint = sha256(certificate);

// 4. Store in database
await UserModel.create({
  email,
  cert_fingerprint: fingerprint,
  is_active: true
});

// 5. Return certificate to client
return {
  certificate,
  expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  issued_by: "Flashback CA"
};
```

### Step 4: Client Stores Certificate

**Client Process:**
```rust
// 1. Receive signed certificate from relay
let cert_pem = response.certificate;

// 2. Parse and validate certificate
let cert = parse_x509_cert(&cert_pem)?;

// 3. Verify issuer is relay CA
let issuer = cert.issuer();
if issuer.commonName != "Flashback CA" {
  return error("Certificate not issued by trusted CA");
}

// 4. Verify certificate signature
verify_signature(&cert, &ca_public_key)?;

// 5. Store certificate
fs::write(cert_path, cert_pem)?;

// 6. Done! Private key + certificate are ready to use
```

---

## Email Uniqueness Enforcement

### Problem: Preventing Duplicate Registrations

**Attack Scenarios:**
1. Alice registers alice@example.com
2. Attacker tries to register with alice@example.com again
3. Attacker tries to register with different CSR but same email

### Solution: Email Uniqueness in CA

**Database Constraint:**
```sql
CREATE UNIQUE INDEX idx_users_email ON users(email);
```

**Registration Flow:**
```typescript
// 1. Check if email exists
const existing = await UserModel.findOne({ email });
if (existing && existing.is_active) {
  return error("Email already registered", 409);
}

// 2. If exists but is_active=false (revoked), allow re-registration
if (existing && !existing.is_active) {
  // Update existing record
  existing.cert_fingerprint = newFingerprint;
  existing.is_active = true;
  await existing.save();
} else {
  // Create new record
  await UserModel.create({
    email,
    cert_fingerprint: fingerprint,
    is_active: true
  });
}
```

### Certificate Reset Mechanism

**For when user loses private key:**

```typescript
// POST /api/relay/auth/reset
// Requires proof of identity (old certificate + password/2FA)

if (!validateOldCertificate(request.old_cert)) {
  return error("Invalid certificate proof", 401);
}

// Mark old entry as revoked
const existing = await UserModel.findOne({ email });
existing.is_active = false;
await existing.save();

// Sign new CSR
const newCert = signCSR(request.csr, caPrivateKey);

// Create new entry
await UserModel.create({
  email,
  cert_fingerprint: sha256(newCert),
  is_active: true
});

return { certificate: newCert };
```

---

## Certificate Storage & Distribution

### What Relay CA Stores

**Before (Current Model):**
```
users:
  - email: "alice@example.com"
  - certificate: "-----BEGIN CERTIFICATE-----\nMIIC..." (1-3 KB)
  - created_at
  - updated_at
```

**After (CA Model):**
```
users:
  - email: "alice@example.com"
  - cert_fingerprint: "a3f4b7e9d2c6f1a8..." (64 bytes, SHA-256)
  - is_active: true
  - created_at
  - updated_at
  - revoked_at (nullable)
```

**Benefit:** ~99% storage reduction per user!

### What Relay CA Distributes

**Current Model:**
```
GET /api/relay/broadcast/lookup?email=alice
←  Returns full certificate (1-3 KB)
```

**New CA Model:**
```
GET /api/relay/broadcast/lookup?email=alice
←  Returns:
   {
     email: "alice@example.com",
     is_registered: true,
     is_active: true,
     socket_addresses: [...],  // if broadcasting
     port: 8080
     // NO certificate here!
   }

// Client gets certificate from:
// 1. Local cache (if has it)
// 2. Ask Alice directly (peer-to-peer)
// 3. Trust-on-first-use model
```

### Peer-to-Peer Certificate Exchange

**When connecting to new peer:**
```
Peer A wants certificate for Peer B

Option 1: Already have it
  └─ Use cached certificate

Option 2: First time meeting
  └─ Request certificate from Peer B directly
     GET /api/certs/my-certificate
     ← Returns signed certificate
     ← Verify signature with CA public key
     ← Trust established!

Option 3: Trust-on-First-Use (TOFU)
  └─ Accept certificate from peer
  └─ Pin the certificate locally
  └─ Future connections must match pin
```

---

## Key Management

### CA Private Key (Relay Server)

**Storage:**
```
/secure/ca-private-key.pem     ← Highly secured
/secure/ca-certificate.pem     ← CA's own certificate
```

**Protection:**
- Encrypted at rest (OpenSSL AES-256)
- Never leaves relay server
- Only accessible by CA service
- Rotated annually
- Backed up securely

**Usage:**
- Only for signing CSRs
- Only by authorized code path
- Logged and audited

### Client Private Key (Per Device)

**Storage:**
```
~/.flashback/private.key        ← Device-specific
```

**Protection:**
- Stored locally (not sent anywhere)
- Can be encrypted with password (optional)
- User controls backup/recovery
- Device-specific (not synced between devices)

**Usage:**
- For signing commits
- For peer-to-peer authentication
- For creating CSR

---

## Trust Model

### Certificate Chain

```
Relay CA (Root)
     ↓
     ├─ Peer A Certificate
     │   ├─ Issued by: Relay CA
     │   ├─ Subject: alice@example.com
     │   ├─ Signature: Valid (signed by CA)
     │   └─ Trust: HIGH (verified by CA)
     │
     ├─ Peer B Certificate
     │   ├─ Issued by: Relay CA
     │   ├─ Subject: bob@example.com
     │   ├─ Signature: Valid (signed by CA)
     │   └─ Trust: HIGH (verified by CA)
     │
     └─ (Any future peer)
        └─ All verify against same CA root
```

### Verification Algorithm

```typescript
function verifyCertificate(cert: X509Certificate, caPublicKey): boolean {
  // 1. Check certificate is valid (not expired)
  if (cert.notAfter < Date.now()) {
    return false;  // Expired
  }
  
  // 2. Check issuer is relay CA
  if (cert.issuer.commonName !== "Flashback CA") {
    return false;  // Not issued by CA
  }
  
  // 3. Verify digital signature
  const isSignatureValid = verifySignature(
    cert.tbs_certificate,          // Data that was signed
    cert.signature,                // The signature
    caPublicKey                    // CA's public key
  );
  
  if (!isSignatureValid) {
    return false;  // Signature invalid
  }
  
  // 4. Check email is in certificate
  const email = extractEmailFromCert(cert);
  if (!email) {
    return false;  // No email
  }
  
  return true;  // Certificate is valid!
}
```

### Trust Assumptions

1. **Relay CA is trusted** - Client must know CA's public key
2. **CA signs correctly** - CA signs CSRs from legitimate users
3. **CA verifies emails** - CA ensures email uniqueness
4. **Certificates are shared** - Peers can distribute each other's certs
5. **No revocation required** (initially) - Expired certs become invalid

---

## Certificate Revocation

### Explicit Revocation

**When certificate should be revoked:**
- User requests revocation
- User's private key is compromised
- Email transferred to new owner
- User account deleted

**Revocation Process:**

```typescript
// POST /api/relay/auth/revoke
// Requires: email, proof (old certificate + password)

if (!validateProof(request)) {
  return error("Invalid proof", 401);
}

const user = await UserModel.findOne({ email });
user.is_active = false;
user.revoked_at = new Date();
await user.save();

// Immediately revoke everywhere
// Broadcast revocation to peer network via gossip
broadcastRevocation({
  email: user.email,
  revoked_at: user.revoked_at,
  reason: request.reason || "User requested"
});

return { status: "revoked" };
```

### Implicit Revocation (Expiration)

**Certificate lifecycle:**
```
Created (Day 0)
   ↓
   Active (Days 1-364)
   ├─ Can sign commits
   ├─ Can authenticate
   └─ Fully trusted
   ↓
Expired (Day 365+)
   └─ No longer valid
   └─ Must request new certificate
```

**No separate CRL needed** - Just check expiration date

### Revocation Distribution

**Peers learn about revocation via:**
1. Check is_active flag on relay when looking up peer
2. Gossip protocol broadcasts revocation messages
3. Certificate cache cleared after revocation

---

## Migration Strategy

### Phase 1: CA Infrastructure (Weeks 1-2)

**Relay Server Changes:**
- [ ] Generate CA root key and certificate
- [ ] Create `/api/relay/auth/csr` endpoint
- [ ] Modify database schema (add fingerprint)
- [ ] Add CSR signing logic
- [ ] Update `/api/relay/broadcast/lookup` (remove cert)
- [ ] Add certificate revocation endpoint

**Testing:**
- [ ] CSR parsing and validation
- [ ] Certificate signing and verification
- [ ] Email uniqueness enforcement
- [ ] Revocation logic

### Phase 2: Client CSR Flow (Weeks 2-3)

**Client Changes:**
- [ ] Modify `gen-key` to create CSR instead of self-signed cert
- [ ] Implement CSR signing request to relay
- [ ] Parse and store signed certificate
- [ ] Update registration flow
- [ ] Validate received certificates

**Testing:**
- [ ] CSR generation on client
- [ ] CSR submission to relay
- [ ] Certificate reception and storage
- [ ] Validation of signed certificate

### Phase 3: Peer Certificate Distribution (Weeks 3-4)

**Bootstrap Node Changes:**
- [ ] Add `/api/certs/my-certificate` endpoint
- [ ] Implement certificate exchange during peer discovery
- [ ] Cache peer certificates locally
- [ ] Verify certificates during handshake

**Testing:**
- [ ] Certificate exchange between peers
- [ ] Certificate validation
- [ ] Cache management

### Phase 4: Migration & Backward Compatibility (Weeks 4-5)

**Compatibility Period:**
- [ ] Accept both old (self-signed) and new (CA-signed) certs
- [ ] Migrate existing users' certificates to CA
- [ ] Handle expired certificates gracefully
- [ ] Provide reset mechanism for users

**Deprecation:**
- [ ] Log warnings for old certificate format
- [ ] Set deadline for CA migration
- [ ] Provide migration guide

### Phase 5: Testing & Hardening (Weeks 5-6)

**Security Review:**
- [ ] Audit CA key storage
- [ ] Review CSR validation
- [ ] Test revocation flow
- [ ] Verify certificate chain validation

---

## Security Considerations

### Threats & Mitigations

| Threat | Mitigation |
|--------|-----------|
| **Attacker obtains CA private key** | Encrypted storage, access control, key rotation |
| **CSR hijacking** | Email verification in CSR, IP rate limiting |
| **Certificate spoofing** | Signature verification, fingerprint validation |
| **Replay attacks** | Timestamp validation, nonce in CSR |
| **Man-in-the-middle** | HTTPS only, certificate pinning |
| **Private key compromise** | Revocation mechanism, certificate reset |

### CA Private Key Protection

```
Encryption:
  - OpenSSL AES-256-GCM
  - Key in environment variable (never in code)
  
Access Control:
  - Only CA service can use it
  - No SSH access with key
  - Separate secure partition
  
Audit Trail:
  - Log all CSR signings
  - Log all revocations
  - Monitor for suspicious activity
  
Rotation:
  - Annual CA key rotation
  - Create new CA certificate
  - Re-sign with new key (phased)
```

### CSR Validation

```typescript
function validateCSR(csr: string, email: string): boolean {
  // 1. Parse CSR
  const parsed = parseCSR(csr);
  
  // 2. Verify email in CSR matches request
  const csrEmail = extractEmailFromCSR(parsed);
  if (csrEmail !== email) {
    return false;  // Email mismatch
  }
  
  // 3. Verify CSR signature (proves client has private key)
  if (!verifyCSRSignature(parsed)) {
    return false;  // CSR not signed with claimed key
  }
  
  // 4. Check algorithm strength
  const keySize = getKeySize(parsed);
  if (keySize < 2048 && algorithm !== "ed25519") {
    return false;  // Key too small
  }
  
  // 5. Check no suspicious extensions
  for (const ext of parsed.extensions || []) {
    if (isBlacklisted(ext.name)) {
      return false;  // Suspicious extension
    }
  }
  
  return true;
}
```

---

## Implementation Example

### Complete CSR → Certificate Flow

```rust
// CLIENT: Generate CSR
fn generate_csr(email: &str) -> Result<(String, String)> {
  // Generate key pair
  let key_pair = KeyPair::generate(&rcgen::PKCS_ED25519)?;
  let private_key = key_pair.serialize_pem();
  
  // Create CSR
  let mut params = CertificateParams::new([email.to_string()]);
  params.key_pair = Some(key_pair);
  let csr = params.serialize_request(&key_pair)?;
  
  // Save private key
  fs::write("private.key", &private_key)?;
  
  Ok((csr, private_key))
}

// CLIENT: Submit CSR to relay
async fn register_with_ca(email: &str, csr: &str) -> Result<String> {
  let client = reqwest::Client::new();
  let response = client
    .post("https://relay.example.com/api/relay/auth/csr")
    .json(&json!({
      "email": email,
      "csr": csr
    }))
    .send()
    .await?;
  
  let body: CertResponse = response.json().await?;
  
  // Save certificate
  fs::write("certificate.pem", &body.certificate)?;
  
  Ok(body.certificate)
}

// RELAY: Receive CSR and sign
async fn sign_csr(body: CSRRequest) -> Result<Certificate> {
  // Validate CSR
  let csr = parseCSR(&body.csr)?;
  let email = extractEmailFromCSR(&csr)?;
  
  // Verify email not in use
  let existing = UserModel::findOne(&email);
  if existing.is_some() {
    return Err("Email already registered");
  }
  
  // Sign CSR
  let ca_key = loadCAPrivateKey()?;
  let certificate = signCSR(&csr, &ca_key, {
    expiresInDays: 365,
    issuer: "Flashback CA"
  })?;
  
  // Store fingerprint
  let fingerprint = sha256(&certificate);
  UserModel::create({
    email: &email,
    cert_fingerprint: &fingerprint,
    is_active: true
  });
  
  Ok(certificate)
}
```

---

## Comparison: Before and After

### Registration API Change

**Before (Self-Signed):**
```
POST /api/relay/register
Body: { certificate: "-----BEGIN CERT..." }
Response: { email: "alice@example.com" }

Database stores: certificate (full PEM, 1-3 KB)
```

**After (CA-Issued):**
```
POST /api/relay/auth/csr
Body: { email: "alice@example.com", csr: "-----BEGIN CSR..." }
Response: { certificate: "-----BEGIN CERT..." }

Database stores: cert_fingerprint (SHA-256, 64 bytes)
```

### Trust Model

**Before:**
```
Peer A (has self-signed cert) 
  ↓ Self-verification
  └─ "I trust my own certificate"

Peer B (receives cert from Peer A or relay)
  └─ "I must trust relay tracker to verify this"
```

**After:**
```
Relay CA (root of trust)
  ↓ Signs CSRs
  ├─ Peer A's Certificate (signed by CA)
  └─ Peer B's Certificate (signed by CA)

Peer A verifying Peer B
  └─ "Relay CA signed this, so it's valid!"
  └─ Verification: Check signature with CA's public key
```

---

## Conclusion

This CA model provides:
- ✅ Centralized trust authority (Relay CA)
- ✅ Standardized X.509 certificates
- ✅ Email uniqueness enforcement
- ✅ Certificate revocation capability
- ✅ Reduced storage (fingerprints only)
- ✅ Improved security (verified certificates)
- ✅ Scalable key management

The migration from self-signed to CA-issued certificates is a fundamental security improvement that enables the new decentralized git protocol and commit signing features.
