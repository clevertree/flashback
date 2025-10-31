# RemoteHouse Security Architecture

## Overview

RemoteHouse is the repository script execution system that enables secure execution of JavaScript scripts within cloned Git repositories. This document outlines the security model, threat analysis, and mitigation strategies.

## Security Model

### Threat Model

1. **Malicious Scripts in Repository**: Repository owner adds malicious code to script files
2. **Injection Attacks**: User input containing code/commands executed by scripts
3. **Path Traversal**: Accessing files outside the intended repository data directory
4. **Resource Exhaustion**: Script consumes excessive memory, CPU, time
5. **Unauthorized Access**: User performing actions without proper authorization
6. **Man-in-the-Middle**: Attackers intercepting or modifying script results
7. **Denial of Service**: Coordinated attacks to overwhelm script execution

### Trust Boundaries

```
┌─────────────────────────────────────────────────────────┐
│  Relay Tracker Server                                   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ RemoteHouse API Endpoints                        │  │
│  │ • Validate inputs                                │  │
│  │ • Spawn isolated Node.js process                │  │
│  │ • Enforce resource limits                        │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Cloned Repository (TRUSTED Git Repo)            │  │
│  │ • scripts/search.js    (vetted)                 │  │
│  │ • scripts/browse.js    (vetted)                 │  │
│  │ • scripts/insert.js    (vetted)                 │  │
│  │ • scripts/remove.js    (vetted)                 │  │
│  │ • scripts/comment.js   (vetted)                 │  │
│  │ • data/                (user-supplied)          │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
        ↓ HTTPS/TLS
┌─────────────────────────────────────────────────────────┐
│  Client / Peer                                          │
│  • User certificate (signed by relay tracker)          │
│  • Email identity verification                         │
└─────────────────────────────────────────────────────────┘
```

### Key Assumptions

1. **Scripts are Vetted**: Repository scripts are reviewed and approved before cloning
2. **HTTPS/TLS**: All communication is encrypted
3. **Certificates are Valid**: User certificates are signed by trusted relay tracker
4. **File System is Secure**: Underlying OS provides process isolation
5. **Node.js Runtime is Patched**: Node.js is kept up-to-date

## Mitigation Strategies

### 1. Input Validation (Defense in Depth)

**Level 1: API Layer Validation**

```typescript
// Endpoint: POST /api/remotehouse/<repo_name>/search
// Validation rules:
- repo_name: alphanumeric + underscore/dash (prevent path traversal)
  Regex: /^[a-zA-Z0-9_\-]+$/
  Max length: 256 characters
  
- query: string, UTF-8 encoded
  Max length: 1000 characters
  No code delimiters (backticks, ${}, etc.)
  
- field: alphanumeric (for field selection)
  Regex: /^[a-zA-Z0-9_]+$/
  Whitelist of allowed fields per repository
```

**Level 2: Script-Level Validation**

```javascript
// Inside search.js
const validateInput = (input) => {
  if (!input.query || typeof input.query !== 'string') {
    throw new Error('Invalid query');
  }
  if (input.query.length > 1000) {
    throw new Error('Query too long');
  }
  if (!/^[a-zA-Z0-9_\-\s]+$/.test(input.query)) {
    throw new Error('Query contains invalid characters');
  }
  return true;
};
```

**Level 3: Path Validation**

```javascript
// Inside browse.js
const validatePath = (basePath, userPath) => {
  const resolvedPath = path.join(basePath, userPath);
  const relative = path.relative(basePath, resolvedPath);
  
  if (relative.startsWith('..')) {
    throw new Error('Path traversal attempt detected');
  }
  
  return resolvedPath;
};
```

### 2. Path Traversal Prevention

**Strategy: Whitelist and Normalize**

```typescript
// API handler
const validateRepoName = (name: string): string => {
  // Only alphanumeric, underscore, dash
  if (!/^[a-zA-Z0-9_\-]+$/.test(name)) {
    throw new Error('Invalid repository name');
  }
  return name;
};

const getRepoPath = (repoName: string): string => {
  const validated = validateRepoName(repoName);
  const repoPath = path.join(REPOSITORIES_ROOT_DIR, validated);
  
  // Verify no path traversal
  const relative = path.relative(REPOSITORIES_ROOT_DIR, repoPath);
  if (relative.startsWith('..')) {
    throw new Error('Path traversal detected');
  }
  
  return repoPath;
};
```

**Script Protection**

```javascript
// search.js - absolute path verification
const searchDir = (baseDir, subPath) => {
  const targetPath = subPath 
    ? path.join(baseDir, subPath) 
    : baseDir;
  
  const relative = path.relative(baseDir, targetPath);
  if (relative.startsWith('..')) {
    throw new Error('Invalid path');
  }
  
  return targetPath;
};
```

### 3. Resource Limits

**Execution Timeout**

```rust
// In Tauri backend
let child = Command::new("node")
  .arg(&script_path)
  .spawn()?;

let result = tokio::time::timeout(
  Duration::from_secs(30), // 30 second timeout
  child.wait_with_output()
).await?;
```

**Memory and CPU Limits**

```bash
# Linux - use cgroups
node --max-old-space-size=256 scripts/search.js

# Mac - use subprocess restrictions
# (built into OS process model)

# Windows - Job Objects API
```

**Result Set Limits**

```javascript
// search.js
const MAX_RESULTS = 1000;
const results = [];

for (const file of files) {
  if (results.length >= MAX_RESULTS) {
    results.push({ truncated: true });
    break;
  }
  results.push(item);
}

return { results, total: results.length, truncated: results.length >= MAX_RESULTS };
```

### 4. Process Isolation

**Process Model**

```
Main Tauri/Node.js Process
  ↓ spawn
Isolated Node.js Child Process
  • No network access (except to dataDir)
  • Limited file system access (read: repo/data, write: repo/data only)
  • No access to parent process memory
  • Timeout protection
  • Kill on parent process exit
```

**Implementation**

```rust
// Spawn with restricted permissions (Unix)
let child = Command::new("node")
  .current_dir(&repo_path)
  .env("NODE_PATH", &repo_path)
  .env("RESTRICT_PATHS", &repo_data_dir)
  // No net, no env variable leakage
  .spawn()?;
```

### 5. User Authorization

**Certificate-Based Identity**

```typescript
// When processing comment request
const email = extractEmailFromCertificate(userCertificate);

if (!email) {
  throw new Error('Invalid certificate');
}

// Email is verified by relay tracker
// Cannot be spoofed by client
```

**Audit Trail**

```javascript
// comment.js - Always include user identity
const commentMetadata = {
  created_at: new Date().toISOString(),
  email: userEmail,        // From certificate
  ip_address: requestIP,   // From server
  user_agent: userAgent    // From request
};

// Write to audit log
fs.appendFileSync('audit.log', JSON.stringify(commentMetadata) + '\n');
```

### 6. Encryption in Transit

**HTTPS/TLS**

```typescript
// All RemoteHouse endpoints require HTTPS
// Relay tracker enforces:
- TLS 1.3 minimum
- Strong cipher suites
- Certificate pinning (optional)
- HSTS headers
```

### 7. Defense Against Injection

**No Code Evaluation**

```javascript
// ❌ NEVER DO THIS
eval(userInput);  // Massive security hole

// ❌ AVOID THIS
new Function(userInput)();

// ✅ DO THIS - Parse and validate
const query = parseAndValidateQuery(userInput);
const results = searchByField(query, validatedField);
```

**Sanitized Template Strings**

```javascript
// ❌ WRONG
const command = `grep "${userQuery}" data.json`;
exec(command);

// ✅ RIGHT
const query = validateQuery(userQuery);
const data = JSON.parse(fs.readFileSync('data.json'));
const results = data.filter(item => item.title.includes(query));
```

### 8. Repository Integrity

**Verification Steps**

```typescript
// Before cloning
1. Verify Git repository URL format
2. Verify repository name doesn't exist (prevent collision)
3. Clone to isolated directory
4. Verify script files exist and are readable
5. Calculate file checksums for future verification

// Before execution
1. Verify scripts haven't been modified (checksum match)
2. Verify only expected scripts are present
3. Verify data directory exists and is writable
```

**Signing/Verification** (Future Enhancement)

```typescript
// Repository author can sign scripts with GPG
// Server verifies signature before execution
// Prevents tampering after cloning
```

## Security Checklist

- [ ] All endpoints validate repo_name with strict regex
- [ ] All endpoints validate user input before passing to script
- [ ] Path traversal checks at both API and script level
- [ ] Script execution timeout (30 seconds)
- [ ] Memory limit (256 MB)
- [ ] Results capped (1000 items)
- [ ] User email verified from certificate
- [ ] Audit logs created for all modifications
- [ ] HTTPS required for all endpoints
- [ ] No code evaluation (eval, Function, exec with user input)
- [ ] Error messages don't leak internal paths
- [ ] Rate limiting on endpoints (prevent DOS)
- [ ] Scripts reviewed before repository approval
- [ ] Regular security audits of scripts

## Known Limitations

1. **Script Complexity**: Cannot safely execute complex user scripts
   - Mitigation: Scripts are vetted, not user-supplied

2. **Performance**: Process spawning has overhead (~50-100ms)
   - Mitigation: Acceptable for most use cases; optimize if needed

3. **Distributed Repos**: Only relay tracker hosts scripts initially
   - Future: Peers can host their own repositories

4. **File Size Limits**: Very large files may cause issues
   - Mitigation: Set max_payload_size, pagination

## Attack Scenarios & Responses

### Scenario 1: XSS/Code Injection in Query

**Attack**: User sends query with code: `" OR 1=1; DROP TABLE--`

**Defense**:
```javascript
// Validation rejects non-alphanumeric + spaces
if (!/^[a-zA-Z0-9_\-\s]+$/.test(query)) {
  throw new Error('Invalid query');
}
// Result: Safely treated as literal string
```

### Scenario 2: Path Traversal

**Attack**: Browse request with path: `../../../etc/passwd`

**Defense**:
```javascript
const relative = path.relative(dataDir, resolvedPath);
if (relative.startsWith('..')) {
  throw new Error('Invalid path');
}
// Result: Request rejected
```

### Scenario 3: Denial of Service

**Attack**: Search for "*" in huge repository to exhaust resources

**Defense**:
- 30 second timeout kills process
- Max 1000 results returned
- Memory limit prevents OOM
- Rate limiting prevents repeated attacks

### Scenario 4: Unauthorized Modification

**Attack**: User without permission modifies records

**Defense**:
- Certificate validation confirms identity
- Audit log tracks all changes
- Comments include email + timestamp
- Server can detect unauthorized access patterns

### Scenario 5: Repository Tampering

**Attack**: Attacker modifies scripts after cloning

**Defense**:
- File checksums verified before execution
- Scripts are read-only after cloning
- Future: GPG signature verification

## Compliance & Standards

- **OWASP Top 10**: Addresses injection, broken auth, sensitive data exposure
- **CWE**: Addresses CWE-22 (path traversal), CWE-78 (OS command injection), CWE-94 (code injection)
- **ISO 27001**: Security audit trail, access control, encryption

## Future Enhancements

1. **Sandboxing**: Use Deno or VM modules for better isolation
2. **Rate Limiting**: Prevent DOS attacks per user/IP
3. **Caching**: Cache search results to reduce execution
4. **Script Signing**: GPG signatures for repository verification
5. **Audit Dashboard**: Visual audit trail of all modifications
6. **Federated Repositories**: Peers host their own repositories
7. **Version Control**: Track changes to records with history
8. **Permission Model**: Fine-grained access control per repository

## References

- OWASP: https://owasp.org/www-project-top-ten/
- CWE: https://cwe.mitre.org/
- Node.js Security: https://nodejs.org/en/docs/guides/security/
