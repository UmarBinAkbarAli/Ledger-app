# SSL Certificate Workaround for User Creation

## Problem
Corporate network SSL certificate interception blocks Firebase Firestore gRPC connections, preventing server-side Firestore writes when creating users.

### Symptoms
- `SELF_SIGNED_CERT_IN_CHAIN` error when trying to write to Firestore from server-side code
- API requests hang indefinitely on Firestore operations
- `NODE_TLS_REJECT_UNAUTHORIZED=0` doesn't help (gRPC uses its own certificate validation)

## Solution: Role Assignment via Custom Claims

Instead of trying to write Firestore docs server-side (blocked by SSL), we use Firebase Auth **custom claims** to store the role at creation time:

1. **Admin creates user with role selection**
   - API creates Auth user + sets role in custom claims (Auth is HTTPS, works fine)
   - Role is preserved and returned in the response

2. **User appears immediately in Admin list** (with "Pending" status)
   - Admin page fetches both Firestore users and Auth users
   - Shows total created users, active users, and pending users

3. **On first login, role is applied automatically**
   - Client reads role from custom claims
   - Creates Firestore user doc with the correct role
   - User transitions from "Pending" to "Active" status

### Implementation

**API Endpoint: `/api/users/create`**
- Creates user in Firebase Auth
- Sets selected role via `setCustomUserClaims()`
- Returns success with the assigned role
- Optionally generates a password reset link

**Auth List Helper: `/api/users/list-auth`**
- Fetches all Firebase Auth users (including pending ones)
- Merges with Firestore users on the admin page
- Shows "Pending" status until they log in

**Admin Users Page**
- Displays both active (Firestore) and pending (Auth-only) users
- Color-coded status badges: Active (green) vs Pending (orange)
- Shows total count breakdown

**Client Login Flow**
- Reads role from custom claims
- Creates Firestore user doc with that role on first login
- User is now "Active"

## Benefits
- ✅ Completely bypasses Firestore gRPC/SSL issues
- ✅ Role assigned at creation, not on first login
- ✅ Admin can see all created users immediately
- ✅ No server-side Firestore writes (works in any corporate network)
- ✅ Works with existing signup flow
- ✅ Clear "Pending" vs "Active" user states

## Files Modified
- `app/api/users/create/route.ts` - Sets role via custom claims
- `app/api/users/list-auth/route.ts` - NEW: Lists Auth users
- `app/(dashboard)/users/page.tsx` - Merges and displays both user types
- `app/(dashboard)/users/new/page.tsx` - Role selection is now functional
- `app/(auth)/signup/page.tsx` - Reads role from custom claims

## Testing Workflow

1. **Create a new user from Admin panel**
   ```
   Go to /users/new
   Fill: Email, Display Name, select Role
   Click "Create User"
   ✅ User created with role in custom claims
   ✅ Optional: Copy password reset link
   ```

2. **Confirm user appears in list (Pending)**
   ```
   Go to /users
   View the newly created user with "⏳ Pending" status
   Role shows as selected (ADMIN, VIEWER, etc.)
   ```

3. **User logs in**
   ```
   Share password reset link or temporary password
   User logs in at /login or uses reset link
   On login, Firestore user doc created with role from custom claims
   ```

4. **User transitions to Active**
   ```
   Refresh /users page
   User now shows "Active" status (no longer Pending)
   User can access features based on their assigned role
   Admin can edit role via /users/[userId]/edit if needed
   ```

## Notes
- Custom claims store role securely in the Auth token
- No Firestore writes from the server (avoids SSL issues entirely)
- Client creates Firestore doc on first login (within app context)
- Role can be edited after user logs in via the edit page
- Graceful fallback: if Auth list fetch fails, shows Firestore users only

## Quick Commands

```bash
# Start dev server
npm run dev

# Test invalid token (should return 401 fast)
curl -i -X POST http://localhost:3000/api/users/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid" \
  -d '{"email":"test@example.com","displayName":"Test","role":"ADMIN"}'
