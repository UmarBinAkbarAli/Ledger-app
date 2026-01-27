/**
 * Fix Admin Custom Claims
 * Run this if you're getting 401 errors after security updates
 * 
 * Usage: node scripts/fix-admin-claims.mjs YOUR_EMAIL@gmail.com
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
const envPath = join(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');

// Parse .env file
const lines = envContent.split('\n');
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  
  const equalIndex = trimmed.indexOf('=');
  if (equalIndex === -1) continue;
  
  const key = trimmed.substring(0, equalIndex).trim();
  let value = trimmed.substring(equalIndex + 1).trim();
  
  // Remove quotes
  if ((value.startsWith('"') && value.endsWith('"')) || 
      (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  
  process.env[key] = value;
}

// Initialize Firebase Admin
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

console.log('🔧 Firebase Project:', serviceAccount.projectId);

if (!serviceAccount.projectId || !serviceAccount.privateKey || !serviceAccount.clientEmail) {
  console.error('❌ Missing Firebase credentials in .env.local');
  console.error('Required: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const auth = admin.auth();
const db = admin.firestore();

async function fixAdminClaims(email) {
  try {
    console.log(`🔍 Looking up user: ${email}`);
    
    // Get user by email
    const userRecord = await auth.getUserByEmail(email);
    console.log(`✅ Found user: ${userRecord.uid}`);
    
    // Get Firestore document
    const userDoc = await db.collection('users').doc(userRecord.uid).get();
    const userData = userDoc.data();
    
    if (!userData) {
      console.log('⚠️  No Firestore document found. Creating one...');
      
      const newUserData = {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName || userRecord.email?.split('@')[0] || 'Admin',
        role: 'admin',
        status: 'active',
        businessId: userRecord.uid, // Use UID as businessId for admin
        createdAt: new Date(),
        updatedAt: new Date(),
        isOwner: true,
        metadata: {},
      };
      
      await db.collection('users').doc(userRecord.uid).set(newUserData);
      console.log('✅ Created Firestore document');
    }
    
    // Check current custom claims
    console.log('\n📋 Current custom claims:', userRecord.customClaims || 'None');
    
    // Set admin custom claims
    const customClaims = {
      role: 'admin',
      admin: true,
      businessId: userData?.businessId || userRecord.uid,
    };
    
    await auth.setCustomUserClaims(userRecord.uid, customClaims);
    console.log('\n✅ Updated custom claims:', customClaims);
    
    // Update Firestore if needed
    if (!userData?.businessId) {
      await db.collection('users').doc(userRecord.uid).update({
        businessId: userRecord.uid,
        role: 'admin',
        updatedAt: new Date(),
      });
      console.log('✅ Updated Firestore document with businessId');
    }
    
    console.log('\n🎉 Admin claims fixed successfully!');
    console.log('📝 Next steps:');
    console.log('   1. Logout from the app');
    console.log('   2. Login again');
    console.log('   3. The 401 error should be gone');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'auth/user-not-found') {
      console.log('\n💡 User not found. Please check the email address.');
    }
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.error('❌ Please provide an email address');
  console.log('\nUsage: node scripts/fix-admin-claims.mjs YOUR_EMAIL@gmail.com');
  process.exit(1);
}

// Run the fix
fixAdminClaims(email).then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
