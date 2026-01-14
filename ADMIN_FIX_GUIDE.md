# 🆘 ADMIN ACCESS FIX - Quick Solution

## The Problem

The new security fixes check for admin status in **custom claims**, but your existing admin users don't have custom claims set yet. That's why you're getting "Only administrators can create users" even though you're an admin in Firestore.

## ✅ Quick Fix (2 Steps)

### Step 1: Check Your Role

Run this command with YOUR email address:

```bash
node scripts/check-my-role.mjs your-email@example.com
```

**Example:**
```bash
node scripts/check-my-role.mjs umar.akbar@company.com
```

This will show you:
- ✅ Your role in Firestore
- ⚠️ Your custom claims status
- 🔧 What needs to be fixed

### Step 2: Set Custom Claims for All Admins

Run this migration script:

```bash
node scripts/set-admin-claims.mjs
```

This will:
- Scan all users in Firestore
- Find users with `role: "admin"`
- Set custom claims: `{ role: "admin", admin: true }`
- Also fix custom claims for other roles

**⚠️ IMPORTANT:** After running the script, you MUST **log out and log back in** for the custom claims to take effect!

---

## 🔍 How to Check If You're Admin (Manual)

### Option 1: Firebase Console (Easiest)
1. Go to Firebase Console → Firestore Database
2. Open the `users` collection
3. Find your user document (search by email)
4. Check the `role` field:
   - `role: "admin"` = You're an admin ✅
   - `role: "accountant"` = You're an accountant
   - `role: "sales_user"` = You're a sales user
   - `role: "viewer"` = You're a viewer

### Option 2: In Your App
1. Open browser Dev Tools (F12)
2. Go to Console tab
3. Run this code:
   ```javascript
   // Get current user info
   const user = firebase.auth().currentUser;
   
   // Get ID token with claims
   user.getIdTokenResult().then(result => {
     console.log('Your Email:', result.claims.email);
     console.log('Your Role (Firestore):', result.claims.role);
     console.log('Admin Flag:', result.claims.admin);
     
     if (result.claims.admin === true || result.claims.role === 'admin') {
       console.log('✅ You ARE an admin!');
     } else {
       console.log('❌ You are NOT an admin (role:', result.claims.role, ')');
     }
   });
   ```

---

## 📝 What the Migration Script Does

The script is **100% safe** and only:
1. ✅ Reads users from Firestore
2. ✅ Checks their `role` field
3. ✅ Sets matching custom claims in Firebase Auth
4. ✅ Does NOT modify any Firestore data
5. ✅ Does NOT delete any users
6. ✅ Skips users who already have custom claims

**No data is lost or modified!**

---

## 🐛 Troubleshooting

### "Cannot find module 'dotenv'"
```bash
npm install dotenv
```

### "Missing required environment variable"
Make sure your `.env.local` file has:
```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

### "I ran the script but still can't create users"
**You MUST log out and log back in!** Custom claims are cached in your session.

1. Click Logout
2. Login again with the same credentials
3. Try to create a user

### "Error: auth/user-not-found"
- Double-check your email address spelling
- Make sure you're using the email you log in with

---

## 🎯 After Running the Script

1. ✅ Log out of your app
2. ✅ Log back in
3. ✅ Go to Users page → Create User
4. ✅ Should work now!

If you still have issues, run the check script again:
```bash
node scripts/check-my-role.mjs your-email@example.com
```

---

## 📚 Why This Happened

The old code checked admin status in **Firestore** (which causes SSL/gRPC issues).

The new secure code checks admin status in **custom claims** (much faster and more secure).

But existing users don't have custom claims yet → that's why you need this one-time migration.

**New users created after today will automatically get custom claims and won't need this fix!**

---

## ✅ Summary

```bash
# 1. Check your role
node scripts/check-my-role.mjs your-email@example.com

# 2. Set custom claims for all admins
node scripts/set-admin-claims.mjs

# 3. Log out and log back in

# 4. Try creating a user - should work now!
```

---

**Need help?** Check the script output - it will tell you exactly what's wrong and how to fix it!
