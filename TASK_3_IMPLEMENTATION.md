# ✨ Task 3: Server Certificate Endpoint - Implementation Guide

**Priority:** HIGH (Unblocks all remaining work)  
**Estimated Time:** 2-3 hours  
**Difficulty:** Medium  
**Date Started:** October 30, 2025

---

## 🎯 Objective

Create a new API endpoint `GET /api/users/{email}/certificate` that returns a user's public certificate. This endpoint is required by the RemoteHouse component to establish secure connections between clients.

---

## 📋 Implementation Checklist

- [ ] Create new route file: `server/app/api/users/[email]/route.ts`
- [ ] Implement GET handler to query user by email
- [ ] Add proper error handling (404 for non-existent users)
- [ ] Test with curl/Postman
- [ ] Verify TypeScript compiles
- [ ] Integrate with frontend secureConnection utility
- [ ] Test end-to-end with RemoteHouse component

---

## 🔍 Current Server Architecture

### Existing Files
- **Registration Endpoint:** `server/app/api/register/route.ts`
- **Database Models:** `server/db/models.ts`
- **User Model Structure:**
  ```typescript
  @Table({ tableName: 'user' })
  export class UserModel extends Model {
    @PrimaryKey @AutoIncrement @Column id!: number;
    @Unique @AllowNull(false) @Column email!: string;
    @AllowNull(false) @Column certificate!: string;
  }
  ```

### Key Details
- Database: PostgreSQL with Sequelize ORM
- Framework: Next.js 13+ with app router
- User model stores `email` and `certificate` fields
- Registration already saves certificate to database
- Parsing: `parseCertWithNodeCrypto()` available for certificate parsing

---

## 💻 Implementation Steps

### Step 1: Create Directory Structure

```bash
mkdir -p server/app/api/users/[email]
```

### Step 2: Create Route Handler

**File:** `server/app/api/users/[email]/route.ts`

```typescript
import 'reflect-metadata';
import { NextRequest, NextResponse } from 'next/server';
import { initDatabase, UserModel } from '@/db/models';

export const runtime = 'nodejs';

/**
 * GET /api/users/{email}/certificate
 * 
 * Retrieves a user's certificate by email address.
 * Used by remote clients to establish secure connections.
 * 
 * @param req - Next.js request object
 * @param context - Route context with params
 * @returns Certificate in PEM format or 404 if user not found
 */
export async function GET(
  req: NextRequest,
  context: { params: { email: string } }
) {
  try {
    await initDatabase();

    const { email } = context.params;

    // Validate email parameter
    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    // URL decode email (in case it contains special characters)
    const decodedEmail = decodeURIComponent(email);

    // Query database for user
    const user = await UserModel.findOne({
      where: { email: decodedEmail },
      attributes: ['email', 'certificate']
    });

    // User not found
    if (!user) {
      return NextResponse.json(
        { error: `User with email ${decodedEmail} not found` },
        { status: 404 }
      );
    }

    // Return certificate
    return NextResponse.json(
      {
        email: user.email,
        certificate: user.certificate
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error fetching user certificate:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## 🧪 Testing the Endpoint

### Test 1: Fetch Valid User Certificate

```bash
# After registering a user with email test@example.com:
curl http://localhost:3001/api/users/test@example.com/certificate

# Expected response (status 200):
# {
#   "email": "test@example.com",
#   "certificate": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
# }
```

### Test 2: Non-existent User

```bash
curl http://localhost:3001/api/users/nonexistent@example.com/certificate

# Expected response (status 404):
# { "error": "User with email nonexistent@example.com not found" }
```

### Test 3: Invalid Email Parameter

```bash
curl http://localhost:3001/api/users//certificate

# Expected response (status 400):
# { "error": "Email parameter is required" }
```

### Test 4: Email with Special Characters

```bash
# URL encode email addresses with special characters
curl "http://localhost:3001/api/users/test%2Buser@example.com/certificate"

# Should work if user exists
```

---

## 🔌 Frontend Integration

### Update `client/src/util/secureConnection.ts`

Replace the placeholder in `fetchRemoteUserCertificate()`:

```typescript
export async function fetchRemoteUserCertificate(email: string): Promise<string> {
  try {
    // Fetch certificate from server
    const response = await fetch(`/api/users/${encodeURIComponent(email)}/certificate`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`User ${email} not found on server`);
      }
      throw new Error(`Failed to fetch certificate: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.certificate) {
      throw new Error('Invalid certificate response from server');
    }

    return data.certificate;
  } catch (error) {
    console.error('Error fetching remote user certificate:', error);
    throw error;
  }
}
```

---

## 📊 API Specification

### Request
```
GET /api/users/{email}/certificate
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| email | string (URL param) | Yes | User's email address |

### Response (Success - 200)
```json
{
  "email": "user@example.com",
  "certificate": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
}
```

### Response (Not Found - 404)
```json
{
  "error": "User with email user@example.com not found"
}
```

### Response (Error - 500)
```json
{
  "error": "Internal server error"
}
```

---

## 🔒 Security Considerations

### ✅ Implemented
- ✅ Email URL encoding/decoding for special characters
- ✅ Database query with proper WHERE clause
- ✅ No exposed sensitive data (only certificate and email)
- ✅ Proper error messages (404 for non-existent users)
- ✅ Error handling for database queries

### ⏳ Future Enhancements
- Rate limiting on this endpoint (prevent certificate enumeration)
- Optional authentication/authorization check
- Caching for frequently accessed certificates
- Audit logging of certificate requests

---

## 🐛 Debugging Tips

### If endpoint returns 404 for existing user:
1. Verify user was registered (check database)
2. Check email spelling matches exactly
3. Try with URL-encoded email
4. Check database connection

### If endpoint returns 500:
1. Check server logs for error message
2. Verify database is running
3. Check Sequelize connection string
4. Verify UserModel table exists

### To check database directly:
```bash
# Connect to PostgreSQL database
psql $PGSQL_DATABASE_URL

# Query users table
SELECT email, LENGTH(certificate) as cert_length FROM "user";
```

---

## ✅ Success Criteria

Task 3 is complete when:

- [ ] Route file created: `server/app/api/users/[email]/route.ts`
- [ ] GET handler returns certificate for valid users (200)
- [ ] Returns 404 for non-existent users
- [ ] Returns 400 for missing email parameter
- [ ] URL encoding handles special characters
- [ ] No TypeScript compilation errors
- [ ] curl tests pass
- [ ] Frontend integration works
- [ ] No console errors in browser/server
- [ ] Database queries are performant

---

## 📝 Example curl Commands

```bash
# 1. Register a user (creates user in database)
curl -X POST http://localhost:3001/api/register \
  -H "Content-Type: application/json" \
  -d '{"certificate":"-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"}'

# 2. Fetch that user's certificate
curl http://localhost:3001/api/users/user@example.com/certificate

# 3. Test with URL encoding
curl "http://localhost:3001/api/users/test%2Buser@example.com/certificate"

# 4. Pretty print response
curl http://localhost:3001/api/users/user@example.com/certificate | jq .
```

---

## 🚀 Next Steps After Task 3

1. **Verify:** Run curl tests to confirm endpoint works
2. **Integrate:** Update `secureConnection.ts` with real implementation
3. **Test:** Run manual Task 9 tests with real certificates
4. **Automate:** Write Cypress tests for Task 10

---

## 📚 Reference Files

- `server/app/api/register/route.ts` - Example route implementation
- `server/db/models.ts` - UserModel structure
- `client/src/util/secureConnection.ts` - Frontend integration point

---

## 💡 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Email not found in DB | Verify registration succeeded first |
| URL encoding issues | Use `encodeURIComponent()` in frontend |
| 500 errors | Check server logs and database connection |
| TypeScript errors | Ensure types match NextResponse generic |
| Certificate format wrong | Verify database stores PEM format correctly |

---

## ✨ Implementation Tips

1. **Copy from existing endpoint:** Use `/api/register/route.ts` as template
2. **Handle encoding:** Always `decodeURIComponent()` URL parameters
3. **Attribute selection:** Use `attributes` in Sequelize to limit data transfer
4. **Error logging:** Add console.error() for debugging
5. **Test early:** Use curl to test before integrating with frontend

---

## 📞 Status Tracking

| Step | Status | Notes |
|------|--------|-------|
| Directory created | ⏳ | `server/app/api/users/[email]/` |
| Route file created | ⏳ | `route.ts` with GET handler |
| Tests passing | ⏳ | Curl tests verified |
| Frontend integration | ⏳ | `secureConnection.ts` updated |
| End-to-end test | ⏳ | RemoteHouse fetches cert successfully |
| Task 3 complete | ⏳ | Ready for Tasks 9-10 |

---

## 🎯 Ready to Implement!

**Next Action:** Create the route file and test with curl.

When complete, this endpoint will enable:
- RemoteHouse to fetch remote user certificates
- Secure client-to-client connections
- Tasks 9 and 10 to proceed with real data

**Estimated time for this task: 30 minutes to 1 hour**

---

**Document Version:** 1.0  
**Last Updated:** October 30, 2025  
**Status:** Ready for implementation
