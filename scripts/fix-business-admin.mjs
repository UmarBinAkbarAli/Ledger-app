#!/usr/bin/env node

/**
 * Fix Script: Repair Business Admin Setup
 * 
 * This script fixes businessId issues for an admin user by:
 * 1. Setting businessId in custom claims
 * 2. Creating/updating Firestore document
 * 3. Creating business record if missing
 * 
 * Usage: node scripts/fix-business-admin.mjs <admin-email>
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Handle SSL certificate issues (if needed in corporate environments)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Load environment variables
config({ path: join(__dirname, '..', '.env.local') });

// Initialize Firebase Admin
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

const app = initializeApp({
  credential: cert(serviceAccount),
});

const auth = getAuth(app);
const db = getFirestore(app);

async function fixBusinessAdmin(adminEmail) {
  console.log(`\n🔧 Fixing business setup for admin: ${adminEmail}\n`);
  console.log('='.repeat(80));

  try {
    // 1. Get admin user from Auth
    console.log('\n📌 Step 1: Getting admin user...');
    const authUser = await auth.getUserByEmail(adminEmail);
    console.log(`✅ Found user: ${authUser.email} (${authUser.uid})`);

    const claims = authUser.customClaims || {};
    const currentBusinessId = claims.businessId;

    // 2. Determine businessId to use
    // If admin already has businessId, keep it. Otherwise use their UID
    const businessId = currentBusinessId || authUser.uid;
    console.log(`\n📌 Step 2: Using businessId: ${businessId}`);

    if (!currentBusinessId) {
      console.log('   ℹ️  No businessId found, using UID as businessId');
    } else {
      console.log('   ℹ️  Admin already has businessId, preserving it');
    }

    // 3. Update custom claims
    console.log('\n📌 Step 3: Updating custom claims...');
    await auth.setCustomUserClaims(authUser.uid, {
      role: 'admin',
      admin: true,
      businessId: businessId,
    });
    console.log('✅ Custom claims updated');

    // 4. Create/Update Firestore user document
    console.log('\n📌 Step 4: Creating/updating Firestore document...');
    const userDocRef = db.collection('users').doc(authUser.uid);
    const userDocSnap = await userDocRef.get();

    if (!userDocSnap.exists) {
      console.log('   Creating new Firestore document...');
      await userDocRef.set({
        uid: authUser.uid,
        email: authUser.email,
        displayName: authUser.displayName || authUser.email?.split('@')[0] || 'Admin',
        role: 'admin',
        status: 'active',
        businessId: businessId,
        isOwner: true,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: authUser.uid, // Self-created
        metadata: {},
      });
      console.log('✅ Firestore document created');
    } else {
      console.log('   Updating existing Firestore document...');
      await userDocRef.update({
        businessId: businessId,
        role: 'admin',
        status: 'active',
        isOwner: true,
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log('✅ Firestore document updated');
    }

    // 5. Create/Update business record
    console.log('\n📌 Step 5: Creating/updating business record...');
    const businessDocRef = db.collection('businesses').doc(businessId);
    const businessDocSnap = await businessDocRef.get();

    if (!businessDocSnap.exists) {
      console.log('   Creating new business document...');
      await businessDocRef.set({
        id: businessId,
        name: authUser.displayName || authUser.email?.split('@')[0] || 'Business',
        email: authUser.email,
        ownerId: authUser.uid,
        status: 'active',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log('✅ Business document created');
    } else {
      console.log('   Business document already exists');
      // Optionally update ownerId if needed
      const businessData = businessDocSnap.data();
      if (businessData.ownerId !== authUser.uid) {
        console.log('   Updating business ownerId...');
        await businessDocRef.update({
          ownerId: authUser.uid,
          updatedAt: FieldValue.serverTimestamp(),
        });
        console.log('✅ Business ownerId updated');
      }
    }

    // 6. Fix all users created by this admin
    console.log('\n📌 Step 6: Fixing users created by this admin...');
    
    // Get all Auth users
    const allUsers = await auth.listUsers();
    const createdUsers = allUsers.users.filter(u => {
      const userClaims = u.customClaims || {};
      return userClaims.createdBy === authUser.uid && u.uid !== authUser.uid;
    });

    console.log(`   Found ${createdUsers.length} users to fix...`);

    for (const user of createdUsers) {
      const userClaims = user.customClaims || {};
      
      // Update custom claims if businessId is wrong
      if (userClaims.businessId !== businessId) {
        console.log(`   Fixing ${user.email}...`);
        await auth.setCustomUserClaims(user.uid, {
          ...userClaims,
          businessId: businessId,
        });
        console.log(`   ✅ Updated custom claims for ${user.email}`);
      }

      // Update Firestore document if it exists
      const employeeDocRef = db.collection('users').doc(user.uid);
      const employeeDocSnap = await employeeDocRef.get();
      
      if (employeeDocSnap.exists) {
        const employeeData = employeeDocSnap.data();
        if (employeeData.businessId !== businessId) {
          await employeeDocRef.update({
            businessId: businessId,
            updatedAt: FieldValue.serverTimestamp(),
          });
          console.log(`   ✅ Updated Firestore document for ${user.email}`);
        }
      } else {
        console.log(`   ⚠️  ${user.email} has no Firestore document - will be created on first login`);
      }
    }

    // 7. Fix delivery challans
    console.log('\n📌 Step 7: Fixing delivery challans...');
    
    // Find challans created by admin or their users but with wrong/missing businessId
    const adminAndEmployeeUids = [authUser.uid, ...createdUsers.map(u => u.uid)];
    
    for (const uid of adminAndEmployeeUids) {
      // Get challans with null or wrong businessId
      const challansQuery = db.collection('deliveryChallans').where('userId', '==', uid);
      const challansSnap = await challansQuery.get();
      
      for (const doc of challansSnap.docs) {
        const challanData = doc.data();
        if (challanData.businessId !== businessId) {
          await doc.ref.update({
            businessId: businessId,
            updatedAt: FieldValue.serverTimestamp(),
          });
          console.log(`   ✅ Fixed challan ${challanData.challanNumber} (${doc.id})`);
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ FIX COMPLETE!');
    console.log('='.repeat(80));
    console.log('\n📋 Summary:');
    console.log(`   - Admin businessId: ${businessId}`);
    console.log(`   - Users fixed: ${createdUsers.length}`);
    console.log(`   - Business record: ${businessDocSnap.exists ? 'Updated' : 'Created'}`);
    console.log('\n🔄 Next Steps:');
    console.log('   1. Ask users to log out and log back in');
    console.log('   2. Users who never logged in should login now');
    console.log('   3. Verify challans are now visible across all users');
    console.log('\n' + '='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Get email from command line
const adminEmail = process.argv[2];

if (!adminEmail) {
  console.error('❌ Usage: node scripts/fix-business-admin.mjs <admin-email>');
  console.error('   Example: node scripts/fix-business-admin.mjs babarakbar76@gain');
  process.exit(1);
}

fixBusinessAdmin(adminEmail).then(() => {
  console.log('✅ Fix complete');
  process.exit(0);
}).catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
