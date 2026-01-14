/**
 * Quick Check: What's My Role?
 * 
 * This script checks your current user's role in both Firestore and custom claims
 * 
 * Usage: node scripts/check-my-role.mjs YOUR_EMAIL@example.com
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

// Get email from command line
const email = process.argv[2];

if (!email) {
  console.error('❌ Please provide your email address');
  console.log('Usage: node scripts/check-my-role.mjs your-email@example.com');
  process.exit(1);
}

// Initialize Firebase Admin
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

const app = initializeApp({
  credential: cert(serviceAccount)
});

const auth = getAuth(app);
const db = getFirestore(app);

async function checkMyRole() {
  try {
    console.log(`🔍 Checking role for: ${email}\n`);
    
    // Get user from Firebase Auth by email
    const userRecord = await auth.getUserByEmail(email);
    console.log('✅ User found in Firebase Auth');
    console.log(`   UID: ${userRecord.uid}`);
    console.log(`   Email: ${userRecord.email}`);
    console.log(`   Display Name: ${userRecord.displayName || 'Not set'}`);
    
    // Check custom claims
    const customClaims = userRecord.customClaims || {};
    console.log(`\n📋 Custom Claims (used by API for authorization):`);
    if (Object.keys(customClaims).length === 0) {
      console.log('   ⚠️  NO CUSTOM CLAIMS SET - This is the problem!');
    } else {
      console.log(`   role: ${customClaims.role || 'Not set'}`);
      console.log(`   admin: ${customClaims.admin || 'Not set'}`);
    }
    
    // Check Firestore document
    const userDoc = await db.collection('users').doc(userRecord.uid).get();
    
    if (!userDoc.exists) {
      console.log(`\n⚠️  User document NOT found in Firestore`);
      console.log(`   This user needs to log in for the first time to create their profile`);
    } else {
      const userData = userDoc.data();
      console.log(`\n📄 Firestore Document:`);
      console.log(`   role: ${userData.role || 'Not set'}`);
      console.log(`   status: ${userData.status || 'Not set'}`);
    }
    
    // Analysis
    console.log('\n' + '='.repeat(60));
    console.log('📊 Analysis:');
    console.log('='.repeat(60));
    
    const firestoreRole = userDoc.exists ? userDoc.data().role : null;
    const claimRole = customClaims.role;
    const claimAdmin = customClaims.admin;
    
    if (!userDoc.exists) {
      console.log('❌ No Firestore document - User needs to complete first login');
    } else if (firestoreRole === 'admin' && claimAdmin === true && claimRole === 'admin') {
      console.log('✅ You ARE an admin with proper custom claims');
      console.log('✅ You should be able to create users');
    } else if (firestoreRole === 'admin' && !claimAdmin) {
      console.log('⚠️  You ARE an admin in Firestore, but missing custom claims!');
      console.log('🔧 Solution: Run the migration script:');
      console.log('   node scripts/set-admin-claims.mjs');
    } else if (firestoreRole !== 'admin') {
      console.log(`❌ You are NOT an admin (role: ${firestoreRole})`);
      console.log('   Only admin users can create other users');
    }
    
    console.log('='.repeat(60));
    
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.error(`❌ User not found with email: ${email}`);
      console.log('   Make sure you entered the correct email address');
    } else {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  }
}

checkMyRole()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
