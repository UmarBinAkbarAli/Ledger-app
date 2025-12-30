# Security Setup Guide

## 🔒 Critical Security Steps

### 1. Deploy Firestore Security Rules

**IMPORTANT:** Your database is currently unprotected. Follow these steps immediately:

#### Option A: Using Firebase Console (Recommended for beginners)
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `ledger-app-for-boxilla`
3. Click on **Firestore Database** in the left menu
4. Click on the **Rules** tab
5. Copy the contents of `firestore.rules` file
6. Paste it into the rules editor
7. Click **Publish**

#### Option B: Using Firebase CLI
```bash
# Install Firebase CLI if you haven't
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project (if not already done)
firebase init firestore

# Deploy the rules
firebase deploy --only firestore:rules
```

### 2. Environment Variables Setup

**NEVER commit `.env.local` to version control!**

The `.env.local` file contains your Firebase credentials and should only exist on your local machine and deployment platform.

#### For Local Development:
- ✅ `.env.local` is already created with your credentials
- ✅ `.gitignore` is configured to exclude it
- ✅ Verify it's not tracked: `git status` (should not show .env.local)

#### For Production Deployment:

**Vercel:**
1. Go to your project settings on Vercel
2. Navigate to "Environment Variables"
3. Add each variable from `.env.local`:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`

**Netlify:**
1. Go to Site settings → Build & deploy → Environment
2. Add the same variables as above

**Other platforms:**
- Consult your platform's documentation for setting environment variables

### 3. Verify Security Rules Are Active

After deploying the rules, test them:

1. Open your browser's Developer Console (F12)
2. Try to access another user's data (you should get a permission denied error)
3. Try to create a document without authentication (should fail)

### 4. Additional Security Recommendations

#### Enable App Check (Recommended)
App Check helps protect your backend resources from abuse:

1. Go to Firebase Console → App Check
2. Enable App Check for your web app
3. Follow the setup instructions

#### Set up Firebase Authentication Email Verification
```typescript
// After user signs up, send verification email
import { sendEmailVerification } from "firebase/auth";

await sendEmailVerification(user);
```

#### Monitor Security Events
1. Go to Firebase Console → Authentication → Settings
2. Enable "Email enumeration protection"
3. Set up monitoring and alerts

### 5. Regular Security Audits

- [ ] Review Firestore rules monthly
- [ ] Check for exposed API keys in public repositories
- [ ] Monitor Firebase usage for unusual patterns
- [ ] Keep Firebase SDK updated
- [ ] Review user permissions and roles

## 🚨 What to Do If Credentials Are Exposed

If you accidentally committed `.env.local` or exposed your Firebase credentials:

1. **Immediately rotate your Firebase API key:**
   - Go to Google Cloud Console
   - Navigate to APIs & Services → Credentials
   - Delete the exposed key
   - Create a new one
   - Update `.env.local` and deployment environment variables

2. **Review Firebase Authentication logs** for suspicious activity

3. **Check Firestore for unauthorized data access**

4. **Update your security rules** to be more restrictive

## ✅ Security Checklist

- [ ] Firestore security rules deployed
- [ ] `.env.local` not committed to git
- [ ] Environment variables set in production
- [ ] App Check enabled (optional but recommended)
- [ ] Email verification enabled
- [ ] Regular security audits scheduled

## 📞 Support

If you need help with security setup, refer to:
- [Firebase Security Rules Documentation](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Security Best Practices](https://firebase.google.com/docs/rules/best-practices)

