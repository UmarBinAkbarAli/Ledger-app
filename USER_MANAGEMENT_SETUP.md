# User Management Setup Guide

## Step 1: Install Required Package

You need to install firebase-admin for the user creation API to work.

**Open Command Prompt (not PowerShell)** and run:

```bash
cd c:\Users\umar.akbar\Documents\Ledger-app
npm install firebase-admin
```

If that doesn't work, try running PowerShell as Administrator and run:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
npm install firebase-admin
```

## Step 2: Get Firebase Admin Credentials

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click the gear icon (⚙️) > **Project Settings**
4. Go to the **Service Accounts** tab
5. Click **Generate New Private Key** button
6. Download the JSON file

## Step 3: Set Up Environment Variables

1. Open (or create) the file `.env.local` in your project root
2. Add these variables from the downloaded JSON file:

```env
# Your existing Firebase config (keep these as is)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# NEW: Add these for Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour\nPrivate\nKey\nHere\n-----END PRIVATE KEY-----\n"
```

**Important:** 
- The `FIREBASE_PRIVATE_KEY` must be wrapped in quotes
- Keep the `\n` characters in the private key string
- You can find these values in the downloaded JSON file:
  - `project_id` → `FIREBASE_PROJECT_ID`
  - `client_email` → `FIREBASE_CLIENT_EMAIL`
  - `private_key` → `FIREBASE_PRIVATE_KEY`

## Step 4: Deploy Firestore Rules

Run this command to update your Firestore security rules:

```bash
firebase deploy --only firestore:rules
```

If you don't have Firebase CLI installed:
```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

## Step 5: Create Your First Admin User

Since you need an admin to create other users, manually set your first admin:

1. Sign up through your app normally at `/signup`
2. Go to [Firebase Console](https://console.firebase.google.com)
3. Navigate to **Firestore Database**
4. Find the `users` collection
5. Click on your user document
6. Edit the `role` field: change from `sales_user` to `admin`
7. Click **Update**

## Step 6: Start Your Development Server

```bash
npm run dev
```

## Step 7: Test the Feature

1. Log in with your admin account
2. You should now see a **Users** link in the sidebar
3. Click it to view the user list
4. Click **Create User** to add a new user
5. Fill in the form and submit
6. The new user will be created without logging you out!

## Troubleshooting

### Error: "Cannot find module 'firebase-admin'"
- Run `npm install firebase-admin` again
- Make sure you're in the correct directory
- Restart your dev server after installing

### Error: "Missing or invalid authorization header"
- Check that your `.env.local` file has all Firebase Admin credentials
- Restart your dev server after adding environment variables
- Make sure the private key is properly formatted with `\n` characters

### Error: "Only admins can create users"
- Make sure you've changed your user role to `admin` in Firestore
- Log out and log back in to refresh your session
- Check that the user document exists in Firestore

### Navigation doesn't show "Users" menu
- Make sure your role is set to `admin` in Firestore
- Clear your browser cache
- Check the browser console for any errors

## Features Available

### For Admin Users:
- ✅ View all users in the system
- ✅ Create new users with any role
- ✅ Edit user roles and status
- ✅ View user details and activity
- ✅ Activate/Deactivate users
- ✅ Full access to all navigation items

### For Accountant Users:
- ✅ Access to all data management features
- ✅ View reports and export data
- ✅ Manage customers, suppliers, sales, purchases, expenses
- ❌ Cannot manage users or change roles

### For Sales Users:
- ✅ Manage customers
- ✅ Create and view sales
- ✅ Limited dashboard access
- ❌ Cannot access financial reports
- ❌ Cannot manage other modules

### For Viewer Users:
- ✅ Read-only access to reports
- ✅ Basic dashboard view
- ❌ Cannot create or edit anything

## Security Notes

- All routes are protected by Firebase Auth
- Navigation items are hidden based on user permissions
- API endpoints verify admin role before allowing user creation
- Firestore rules enforce role-based access control
- User role changes require admin privileges
- Session is preserved when creating users (no logout)

## Need Help?

Check the console logs in your browser and terminal for detailed error messages.
