# Security Rules - Certificate Handling

## Rule: Public Certificates Must Only Come From Relay Tracker Server

**Date**: October 31, 2025  
**Status**: ENFORCED

### Statement
Public certificates used for establishing TLS handshakes with remote clients must **only** come from the relay tracker server, never from:
- Host client applications
- Peer-to-peer direct connections
- Any other source

### Rationale
The relay tracker server is the trusted authority for certificate verification. It ensures that:
1. **Certificate Ownership**: The certificate belongs to the user's verified email address
2. **Authenticity**: The certificate is authentic and not forged or intercepted
3. **Current Status**: The certificate is up-to-date (users can regenerate keys)
4. **Non-Repudiation**: The relay tracker can verify who holds which certificate

### Implementation

#### Data Flow
```
User clicks "Visit Friend"
    ↓
Client calls apiLookup(email) → Relay Tracker Server
    ↓
Relay Tracker verifies email ownership and returns:
    - Socket info (IP, port)
    - Public certificate for that email
    ↓
Client validates certificate came from relay tracker
    ↓
Client uses certificate to establish TLS handshake
    ↓
RemoteHouse UI loads with verified connection
```

#### Enforcement Points

1. **FriendsListSection.tsx** (L30-53):
   - Calls `apiLookup()` to relay tracker server only
   - Validates that `publicCertificate` is present in response
   - Throws error if certificate is missing or invalid
   - Never accepts certificates from any other source

2. **apiTypes.ts**:
   - `RegisterResultData.publicCertificate` - Certificate from registration/broadcast
   - `ClientInfo.publicCertificate` - Certificate for peer connections
   - Both have JSDoc comments explicitly stating the security rule

3. **RemoteHouse.tsx** (L5):
   - Accepts `publicCertificate` as parameter
   - Must use certificate from relay tracker for handshake
   - Never uses certificates provided by peer client

4. **page.tsx**:
   - Passes `publicCertificate` from `selectedClient` to RemoteHouse
   - `selectedClient` is populated from FriendsListSection callback
   - FriendsListSection callback receives data ONLY from apiLookup()

### Code References

**FriendsListSection.tsx - Lookup Call**:
```typescript
// IMPORTANT: Public certificates MUST ONLY come from the relay tracker server.
// The relay tracker verifies certificate ownership and ensures secure data transfer.
const result = await api.apiLookup(friend.email);

// Validate that certificate was returned by the relay tracker
const publicCertificate = lookupData.publicCertificate || lookupData.certificate;
if (!publicCertificate) {
    throw new Error('No public certificate received from relay tracker. Cannot establish secure connection.');
}
```

### Client-Side Guarantee
The client-side code enforces this rule by:
1. Only calling `apiLookup()` which routes to the relay tracker
2. Validating certificate presence before use
3. Not accepting certificates from any other API endpoint
4. Passing certificate only to RemoteHouse component which uses it for handshake

### Server-Side Requirements
The relay tracker server must:
1. Implement `/api/lookup/{email}` endpoint that returns:
   - User's current socket info
   - User's current public certificate
   - Only after verifying the user is registered
2. Ensure certificate integrity and authenticity
3. Log certificate lookups for audit trail
4. Implement certificate rotation mechanisms

### Future Considerations
- Health checks may require relay tracker to validate peer liveness
- Certificate expiration and renewal must go through relay tracker
- Any peer-to-peer protocol upgrades must still route certificates through relay tracker

### Violations
Any code that attempts to:
- Use certificates from peer client responses
- Accept certificates via broadcast responses instead of explicit lookup
- Skip certificate validation
- Use certificates from unauthorized sources

...is a **SECURITY VIOLATION** and must be rejected during code review.

---

**Last Updated**: October 31, 2025  
**Next Review**: After search feature implementation  
**Enforcement Level**: CRITICAL
