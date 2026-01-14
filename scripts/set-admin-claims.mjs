/**
 * Migration Script: Set Custom Claims for Existing Admin Users
 * 
 * This script reads all users from Firestore and sets custom claims
 * for users who have admin role in their Firestore document.
 * 
 * Usage: node scripts/set-admin-claims.mjs
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

// Validate environment variables
const requiredEnvVars = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL'
];

for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    console.error(`❌ Missing required environment variable: ${varName}`);
    process.exit(1);
  }
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

async function setAdminClaims() {
  try {
    console.log('🔍 Scanning Firestore for admin users...\n');
    
    // Get all users from Firestore
    const usersSnapshot = await db.collection('users').get();
    
    if (usersSnapshot.empty) {
      console.log('⚠️  No users found in Firestore');
      return;
    }
    
    console.log(`📋 Found ${usersSnapshot.size} users in Firestore\n`);
    
    let adminCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const uid = userData.uid;
      const email = userData.email;
      const role = userData.role;
      
      console.log(`\n👤 User: ${email}`);
      console.log(`   UID: ${uid}`);
      console.log(`   Firestore Role: ${role}`);
      
      if (role === 'admin') {
        adminCount++;
        
        try {
          // Get current custom claims
          const userRecord = await auth.getUser(uid);
          const currentClaims = userRecord.customClaims || {};
          
          console.log(`   Current Custom Claims:`, JSON.stringify(currentClaims));
          
          // Check if already has admin claim
          if (currentClaims.admin === true && currentClaims.role === 'admin') {
            console.log(`   ✅ Already has admin custom claims - skipping`);
            skippedCount++;
            continue;
          }
          
          // Set custom claims
          await auth.setCustomUserClaims(uid, {
            ...currentClaims,
            role: 'admin',
            admin: true
          });
          
          console.log(`   ✅ Custom claims updated successfully!`);
          updatedCount++;
          
        } catch (error) {
          console.error(`   ❌ Error setting custom claims:`, error.message);
          errorCount++;
        }
      } else {
        // Non-admin user - ensure they have their role in custom claims
        try {
          const userRecord = await auth.getUser(uid);
          const currentClaims = userRecord.customClaims || {};
          
          if (!currentClaims.role) {
            await auth.setCustomUserClaims(uid, {
              ...currentClaims,
              role: role
            });
            console.log(`   ✅ Set role custom claim: ${role}`);
            updatedCount++;
          } else {
            console.log(`   ℹ️  Already has role custom claim: ${currentClaims.role}`);
            skippedCount++;
          }
        } catch (error) {
          console.error(`   ❌ Error:`, error.message);
          errorCount++;
        }
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log('='.repeat(60));
    console.log(`Total users scanned:       ${usersSnapshot.size}`);
    console.log(`Admin users found:         ${adminCount}`);
    console.log(`Custom claims updated:     ${updatedCount}`);
    console.log(`Already up-to-date:        ${skippedCount}`);
    console.log(`Errors:                    ${errorCount}`);
    console.log('='.repeat(60));
    
    if (updatedCount > 0) {
      console.log('\n✅ Migration complete!');
      console.log('⚠️  Note: Users need to log out and log back in for custom claims to take effect.');
    } else if (skippedCount > 0) {
      console.log('\n✅ All users already have custom claims set!');
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the migration
console.log('🚀 Starting custom claims migration...\n');
setAdminClaims()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
