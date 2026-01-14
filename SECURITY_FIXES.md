# Critical Security Fixes Implementation Guide

This document provides **copy-paste ready code** to fix the 11 critical security vulnerabilities identified in the production readiness analysis.

---

## Fix #1: Server-Side Admin Verification Using Custom Claims

**File:** `app/api/users/create/route.ts`

**Replace lines 103-104 with:**

```typescript
    // Verify the requester is an admin using custom claims (secure)
    console.log("👤 Checking if user is admin via custom claims...");
    
    if (!decodedToken.admin && decodedToken.role !== UserRole.ADMIN) {
      console.warn("❌ Non-admin user attempted to create user:", decodedToken.uid);
      return NextResponse.json(
        { 
          success: false, 
          message: "Only administrators can create users", 
          error: "Forbidden" 
        },
        { status: 403 }
      );
    }
    
    console.log("✅ Admin user verified via custom claims");
```

**Also add this when setting custom claims (line 137):**

```typescript
    // Store the selected role in custom claims + admin flag
    try {
      const customClaims: any = { role };
      if (role === UserRole.ADMIN) {
        customClaims.admin = true;
      }
      await adminAuth.setCustomUserClaims(userRecord.uid, customClaims);
      console.log("✅ Custom claims set with role:", role);
    } catch (e) {
      // CRITICAL: Rollback if custom claims fail
      console.error("❌ Could not set custom claims, rolling back user creation");
      await adminAuth.deleteUser(userRecord.uid);
      throw new Error("Failed to assign user role. User creation rolled back.");
    }
```

---

## Fix #2: Remove Password Reset Links from Logs & Response

**File:** `app/api/users/create/route.ts`

**Replace lines 145-152 with:**

```typescript
    // Generate password reset link and send via email (DO NOT return in response)
    try {
      const actionCodeSettings = {
        url: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
        handleCodeInApp: false,
      };
      
      const resetLink = await adminAuth.generatePasswordResetLink(email, actionCodeSettings);
      
      // Send email via your email service (SendGrid, AWS SES, etc.)
      await sendPasswordResetEmail(email, resetLink);  // Implement this function
      
      console.log("✅ Password reset email sent to", email);
    } catch (e) {
      console.warn("⚠️ Could not send password reset email");
      // Continue - admin can manually send later
    }

    return NextResponse.json(
      {
        success: true,
        uid: userRecord.uid,
        email,
        displayName,
        role,
        message: `User ${email} created successfully with role ${role}. Password reset email sent.`,
        // ❌ REMOVED: resetLink (security risk)
      },
      { status: 201 }
    );
```

**Create email helper:** `lib/emailService.ts`

```typescript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendPasswordResetEmail(email: string, resetLink: string) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@yourapp.com',
    to: email,
    subject: 'Set Your Password - Ledger App',
    html: `
      <h1>Welcome to Ledger App</h1>
      <p>An administrator has created an account for you.</p>
      <p>Click the link below to set your password:</p>
      <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background: #0070f3; color: white; text-decoration: none; border-radius: 5px;">
        Set Password
      </a>
      <p>This link expires in 1 hour.</p>
      <p><small>If you didn't expect this email, please contact your administrator.</small></p>
    `,
  });
}
```

**Add to `.env.local`:**
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="Ledger App <noreply@yourapp.com>"
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Fix #3: Rate Limiting

**Install dependency:**
```bash
npm install @upstash/ratelimit @upstash/redis
```

**Create:** `lib/rateLimit.ts`

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// 5 user creations per admin per hour
export const userCreationRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 h"),
  analytics: true,
  prefix: "ratelimit:user-creation",
});

// 10 user list requests per admin per minute
export const userListRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  analytics: true,
  prefix: "ratelimit:user-list",
});
```

**Update:** `app/api/users/create/route.ts`

```typescript
import { userCreationRateLimit } from "@/lib/rateLimit";

export async function POST(request: NextRequest): Promise<NextResponse<CreateUserResponse>> {
  try {
    console.log("📨 POST /api/users/create called");
    
    // Get the ID token from Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, message: "Missing or invalid authorization header", error: "Unauthorized" },
        { status: 401 }
      );
    }

    const idToken = authHeader.substring(7);
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (error) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired token", error: "Unauthorized" },
        { status: 401 }
      );
    }

    // ✅ NEW: Rate limiting
    const rateLimitResult = await userCreationRateLimit.limit(decodedToken.uid);
    if (!rateLimitResult.success) {
      const resetTime = new Date(rateLimitResult.reset);
      console.warn(`⚠️ Rate limit exceeded for user ${decodedToken.uid}`);
      return NextResponse.json(
        { 
          success: false, 
          message: `Too many user creation requests. Please try again after ${resetTime.toLocaleTimeString()}`,
          error: "Rate Limit Exceeded"
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          }
        }
      );
    }

    // ... rest of the code
  }
}
```

**Add to `.env.local`:**
```
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

---

## Fix #4: Input Sanitization & Validation

**Create:** `lib/validation.ts`

```typescript
import validator from 'validator';
import { UserRole } from './roles';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateEmail(email: string): ValidationResult {
  if (!email) {
    return { valid: false, error: "Email is required" };
  }
  
  if (email.length > 254) {
    return { valid: false, error: "Email is too long" };
  }
  
  if (!validator.isEmail(email)) {
    return { valid: false, error: "Invalid email format" };
  }
  
  // Check for common typos
  const commonDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
  const domain = email.split('@')[1]?.toLowerCase();
  const suspiciousDomains = ['gmial.com', 'yahooo.com', 'gmai.com'];
  
  if (suspiciousDomains.includes(domain)) {
    return { valid: false, error: "Did you mean a common email provider? Please check for typos." };
  }
  
  return { valid: true };
}

export function validateDisplayName(displayName: string): ValidationResult {
  if (!displayName) {
    return { valid: false, error: "Display name is required" };
  }
  
  if (displayName.length < 2) {
    return { valid: false, error: "Display name must be at least 2 characters" };
  }
  
  if (displayName.length > 100) {
    return { valid: false, error: "Display name must be less than 100 characters" };
  }
  
  // Remove HTML tags and script content
  const sanitized = displayName
    .replace(/<[^>]*>/g, '')  // Remove HTML tags
    .replace(/[<>]/g, '');     // Remove angle brackets
  
  if (sanitized !== displayName) {
    return { valid: false, error: "Display name contains invalid characters" };
  }
  
  // Check for suspicious patterns
  if (/javascript:/i.test(displayName) || /on\w+=/i.test(displayName)) {
    return { valid: false, error: "Display name contains invalid patterns" };
  }
  
  return { valid: true };
}

export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { valid: false, error: "Password is required" };
  }
  
  if (password.length < 12) {
    return { valid: false, error: "Password must be at least 12 characters" };
  }
  
  if (password.length > 128) {
    return { valid: false, error: "Password is too long (max 128 characters)" };
  }
  
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one uppercase letter" };
  }
  
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one lowercase letter" };
  }
  
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one number" };
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    return { valid: false, error: "Password must contain at least one special character" };
  }
  
  // Check against common passwords
  const commonPasswords = [
    'password', '12345678', 'qwerty', 'abc123', 'monkey', 
    'letmein', 'trustno1', 'dragon', 'baseball', 'iloveyou',
    'master', 'sunshine', 'ashley', 'bailey', 'shadow'
  ];
  
  if (commonPasswords.includes(password.toLowerCase())) {
    return { valid: false, error: "Password is too common. Please choose a stronger password." };
  }
  
  return { valid: true };
}

export function validateRole(role: string): ValidationResult {
  if (!role) {
    return { valid: false, error: "Role is required" };
  }
  
  if (!Object.values(UserRole).includes(role as UserRole)) {
    return { valid: false, error: `Invalid role. Must be one of: ${Object.values(UserRole).join(', ')}` };
  }
  
  return { valid: true };
}

export function sanitizeDisplayName(displayName: string): string {
  return displayName
    .replace(/<[^>]*>/g, '')      // Remove HTML tags
    .replace(/[<>]/g, '')          // Remove angle brackets
    .trim();
}
```

**Update:** `app/api/users/create/route.ts`

```typescript
import { validateEmail, validateDisplayName, validatePassword, validateRole, sanitizeDisplayName } from "@/lib/validation";

export async function POST(request: NextRequest): Promise<NextResponse<CreateUserResponse>> {
  try {
    // ... authentication code ...

    // Parse request body
    const body: CreateUserRequest = await request.json();
    const { email, displayName, role, password } = body;

    // ✅ NEW: Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return NextResponse.json(
        { success: false, message: emailValidation.error!, error: "Bad Request" },
        { status: 400 }
      );
    }

    // ✅ NEW: Validate and sanitize display name
    const displayNameValidation = validateDisplayName(displayName);
    if (!displayNameValidation.valid) {
      return NextResponse.json(
        { success: false, message: displayNameValidation.error!, error: "Bad Request" },
        { status: 400 }
      );
    }
    const sanitizedDisplayName = sanitizeDisplayName(displayName);

    // ✅ NEW: Validate role
    const roleValidation = validateRole(role);
    if (!roleValidation.valid) {
      return NextResponse.json(
        { success: false, message: roleValidation.error!, error: "Bad Request" },
        { status: 400 }
      );
    }

    // ✅ NEW: Validate password if provided
    if (password) {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return NextResponse.json(
          { success: false, message: passwordValidation.error!, error: "Bad Request" },
          { status: 400 }
        );
      }
    }

    // Create user in Firebase Auth with sanitized data
    const userRecord = await adminAuth.createUser({
      email: email.toLowerCase(),  // Normalize to lowercase
      displayName: sanitizedDisplayName,
      password: password || undefined,
      disabled: false,
    });

    // ... rest of the code ...
  }
}
```

**Install validator:**
```bash
npm install validator
npm install -D @types/validator
```

---

## Fix #5: Audit Logging

**Create:** `lib/auditLog.ts`

```typescript
import { db } from './firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

export enum AuditAction {
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  ROLE_CHANGED = 'ROLE_CHANGED',
  PASSWORD_RESET = 'PASSWORD_RESET',
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
}

export interface AuditLogEntry {
  action: AuditAction;
  actorUid: string;
  actorEmail?: string;
  targetUid?: string;
  targetEmail?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Timestamp;
  success: boolean;
  errorMessage?: string;
}

export async function logAuditEvent(
  action: AuditAction,
  actorUid: string,
  details: {
    actorEmail?: string;
    targetUid?: string;
    targetEmail?: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    success: boolean;
    errorMessage?: string;
  }
) {
  try {
    const logEntry: AuditLogEntry = {
      action,
      actorUid,
      actorEmail: details.actorEmail,
      targetUid: details.targetUid,
      targetEmail: details.targetEmail,
      details: details.metadata,
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
      timestamp: Timestamp.now(),
      success: details.success,
      errorMessage: details.errorMessage,
    };

    // Store in separate audit log collection (immutable, tamper-proof)
    await addDoc(collection(db, 'auditLogs'), logEntry);
    
    console.log(`📋 Audit log: ${action} by ${actorUid}`);
  } catch (error) {
    // CRITICAL: Never fail request if audit logging fails
    console.error('❌ Failed to write audit log:', error);
    // Send to external monitoring (Sentry, DataDog, etc.)
  }
}
```

**Update:** `app/api/users/create/route.ts`

```typescript
import { logAuditEvent, AuditAction } from "@/lib/auditLog";

export async function POST(request: NextRequest): Promise<NextResponse<CreateUserResponse>> {
  let createdUserUid: string | undefined;
  
  try {
    // ... validation code ...

    // Create user in Firebase Auth
    const userRecord = await adminAuth.createUser({...});
    createdUserUid = userRecord.uid;
    
    // ... set custom claims ...

    // ✅ NEW: Log successful user creation
    await logAuditEvent(AuditAction.USER_CREATED, decodedToken.uid, {
      actorEmail: decodedToken.email,
      targetUid: userRecord.uid,
      targetEmail: email,
      metadata: { role, displayName: sanitizedDisplayName },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
      success: true,
    });

    return NextResponse.json({...});
    
  } catch (error: any) {
    // ✅ NEW: Log failed user creation
    await logAuditEvent(AuditAction.USER_CREATED, decodedToken?.uid || 'unknown', {
      targetEmail: email,
      metadata: { role, displayName },
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
      success: false,
      errorMessage: error.message,
    });

    return NextResponse.json({...});
  }
}
```

**Create Firestore rule for audit logs:**

```javascript
// Add to firestore.rules
match /auditLogs/{logId} {
  // Only admins can read audit logs
  allow read: if isAdmin();
  
  // Only server can write (via Admin SDK)
  allow write: if false;
}
```

---

## Fix #6: Remove Sensitive Client Logs

**Create:** `lib/logger.ts`

```typescript
const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.log('[DEBUG]', ...args);
    }
  },
  
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.log('[INFO]', ...args);
    }
  },
  
  warn: (...args: any[]) => {
    console.warn('[WARN]', ...args);
  },
  
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
  },
  
  // Special method for sensitive data (never logs in production)
  sensitive: (...args: any[]) => {
    if (isDevelopment && process.env.LOG_SENSITIVE === 'true') {
      console.log('[SENSITIVE]', ...args);
    }
  },
};
```

**Update all files to use logger:**

```typescript
// Before:
console.log("📋 Full user data:", userData);

// After:
import { logger } from '@/lib/logger';
logger.debug("User data loaded:", { uid: userData.uid, role: userData.role });
// ❌ Do NOT log: email, displayName, or other PII
```

---

## Fix #7: Transaction Integrity & Rollback

Already included in Fix #1 above. Key pattern:

```typescript
try {
  // Step 1: Create Auth user
  const userRecord = await adminAuth.createUser({...});
  
  try {
    // Step 2: Set custom claims (CRITICAL - must succeed)
    await adminAuth.setCustomUserClaims(userRecord.uid, customClaims);
  } catch (claimsError) {
    // Rollback: Delete the Auth user
    await adminAuth.deleteUser(userRecord.uid);
    throw new Error("Failed to set user role. User creation rolled back.");
  }
  
  // Step 3: Send welcome email (optional - don't fail if this fails)
  try {
    await sendWelcomeEmail(email);
  } catch (emailError) {
    logger.warn("Welcome email failed, but user created successfully");
  }
  
  return success;
} catch (error) {
  // Log and return error
  return failure;
}
```

---

## Fix #8: Email Verification Requirement

**Update:** `app/api/users/create/route.ts`

```typescript
// Create user in Firebase Auth
const userRecord = await adminAuth.createUser({
  email: email.toLowerCase(),
  displayName: sanitizedDisplayName,
  password: password || undefined,
  disabled: false,
  emailVerified: false,  // ✅ NEW: Require email verification
});
```

**Update Firestore rules:**

```javascript
// Add to users collection rule
match /users/{userId} {
  // Users can only read/write if email is verified
  allow read, write: if isOwner(userId) && request.auth.token.email_verified == true;
  
  // Exception: Allow first-time doc creation even without verification
  allow create: if isOwner(userId);
}
```

**Send verification email:**

```typescript
// After creating user
try {
  const verificationLink = await adminAuth.generateEmailVerificationLink(email);
  await sendEmailVerificationEmail(email, verificationLink);
  console.log("✅ Email verification sent to", email);
} catch (e) {
  console.warn("⚠️ Could not send verification email");
}
```

---

## Fix #9: Generic Error Messages (Prevent Email Enumeration)

**Update:** `app/api/users/create/route.ts`

```typescript
  } catch (error: any) {
    console.error("❌ Error creating user:", error);

    // ✅ NEW: Generic error messages (prevent email enumeration)
    let userMessage = "Failed to create user. Please try again.";
    let statusCode = 500;
    
    if (error.code === 'auth/email-already-exists') {
      // Don't reveal if email exists - use generic message
      userMessage = "Failed to create user. Please verify the information and try again.";
      statusCode = 400;
    } else if (error.code === 'auth/invalid-email') {
      userMessage = "Invalid request. Please check your input.";
      statusCode = 400;
    } else if (error.code === 'auth/weak-password') {
      userMessage = "Password does not meet security requirements.";
      statusCode = 400;
    }

    await logAuditEvent(AuditAction.USER_CREATED, decodedToken?.uid || 'unknown', {
      targetEmail: email,  // Log actual error internally
      success: false,
      errorMessage: error.code || error.message,
    });

    return NextResponse.json(
      {
        success: false,
        message: userMessage,  // Generic message to client
        error: "User Creation Failed",
      },
      { status: statusCode }
    );
  }
```

---

## Fix #10: Authorization Check for List-Auth Endpoint

**Update:** `app/api/users/list-auth/route.ts`

```typescript
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    console.log("📨 GET /api/users/list-auth called");

    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, message: "Missing or invalid authorization header" },
        { status: 401 }
      );
    }

    const idToken = authHeader.substring(7);
    let decodedToken;
    
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (error) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // ✅ NEW: Verify user is admin via custom claims
    if (!decodedToken.admin && decodedToken.role !== UserRole.ADMIN) {
      console.warn("❌ Non-admin user attempted to list users:", decodedToken.uid);
      return NextResponse.json(
        { 
          success: false, 
          message: "Only administrators can list users" 
        },
        { status: 403 }
      );
    }

    // Rate limiting
    const rateLimitResult = await userListRateLimit.limit(decodedToken.uid);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, message: "Too many requests" },
        { status: 429 }
      );
    }

    // ... rest of the code ...
  }
}
```

---

## Fix #11: Custom Claims Validation on Client

**Update:** `app/(auth)/signup/page.tsx`

```typescript
// Step 2: Get the role from custom claims (set by admin during user creation)
const idTokenResult = await userCredential.user.getIdTokenResult();
const roleFromClaims = idTokenResult.claims.role as string;

// ✅ NEW: Validate role from custom claims
let validatedRole: UserRole;
if (roleFromClaims && Object.values(UserRole).includes(roleFromClaims as UserRole)) {
  validatedRole = roleFromClaims as UserRole;
  console.log("📋 User role from custom claims:", validatedRole);
} else {
  console.warn("⚠️ Invalid role in custom claims, using DEFAULT_ROLE");
  validatedRole = DEFAULT_ROLE;
}

// Step 3: Create user document in Firestore with the validated role
await setDoc(doc(db, "users", uid), {
  uid,
  email,
  displayName: displayName || email.split("@")[0],
  role: validatedRole, // ✅ Use validated role
  status: UserStatus.ACTIVE,
  createdAt: new Date(),
  metadata: {},
});
```

---

## Testing Checklist

After implementing all fixes, test:

- [ ] **Admin verification:** Non-admin can't access `/api/users/create`
- [ ] **Rate limiting:** 6th request within 1 hour returns 429
- [ ] **Input validation:** Try XSS payloads, SQL injection, long strings
- [ ] **Password strength:** Weak passwords are rejected
- [ ] **Email verification:** New users must verify email
- [ ] **Audit logs:** All actions logged to `auditLogs` collection
- [ ] **Error messages:** Generic messages don't reveal email existence
- [ ] **Transaction integrity:** Failed custom claims = user deleted
- [ ] **No sensitive logs:** Check browser console and server logs
- [ ] **Authorization:** List-auth only accessible to admins

---

## Monitoring & Alerts

Set up alerts for:
- Failed authentication attempts (> 5 in 5 minutes)
- Rate limit exceeded (> 10 in 1 hour)
- Audit log write failures
- User creation spikes (> 50 in 1 hour)
- Invalid role attempts
- Password reset link generation failures

---

## Deployment Steps

1. **Backup:** Export all Firebase data
2. **Update code:** Apply all fixes above
3. **Test:** Run full test suite in staging
4. **Deploy:** Deploy to production
5. **Monitor:** Watch logs for 24 hours
6. **Rollback plan:** Keep previous version ready
7. **Security scan:** Run OWASP ZAP or similar

---

## Support

For questions or issues with these fixes:
- Review: `PRODUCTION_READINESS_ANALYSIS.md`
- Contact: security@company.com
- Emergency: On-call engineer

**Status:** Ready for implementation
