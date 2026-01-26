#!/usr/bin/env node

/**
 * Diagnostic Script: Check Business and User Setup
 * 
 * This script checks for businessId mismatches and helps diagnose
 * why users show as "pending" and why challans aren't visible across users.
 * 
 * Usage: node scripts/diagnose-business.mjs <admin-email>
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
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

async function diagnose(adminEmail) {
  console.log(`\n🔍 Diagnosing business for admin: ${adminEmail}\n`);
  console.log('='.repeat(80));

  try {
    // 1. Get admin user from Auth
    console.log('\n📌 Step 1: Checking Firebase Auth...');
    const authUser = await auth.getUserByEmail(adminEmail);
    console.log(`✅ Auth User Found:`);
    console.log(`   - UID: ${authUser.uid}`);
    console.log(`   - Email: ${authUser.email}`);
    console.log(`   - Display Name: ${authUser.displayName || 'Not set'}`);
    
    // Get custom claims
    const claims = authUser.customClaims || {};
    console.log(`   - Custom Claims:`);
    console.log(`     * role: ${claims.role || 'NOT SET ❌'}`);
    console.log(`     * businessId: ${claims.businessId || 'NOT SET ❌'}`);
    console.log(`     * admin: ${claims.admin || 'NOT SET ❌'}`);

    // 2. Get admin user from Firestore
    console.log('\n📌 Step 2: Checking Firestore Document...');
    const userDocRef = db.collection('users').doc(authUser.uid);
    const userDocSnap = await userDocRef.get();
    
    if (!userDocSnap.exists) {
      console.log('❌ PROBLEM: Firestore document does NOT exist!');
      console.log('   This is why the user might not be working correctly.');
      console.log(`   Expected path: users/${authUser.uid}`);
    } else {
      const userData = userDocSnap.data();
      console.log(`✅ Firestore Document Found:`);
      console.log(`   - uid: ${userData.uid || 'NOT SET ❌'}`);
      console.log(`   - email: ${userData.email || 'NOT SET ❌'}`);
      console.log(`   - role: ${userData.role || 'NOT SET ❌'}`);
      console.log(`   - businessId: ${userData.businessId || 'NOT SET ❌'}`);
      console.log(`   - status: ${userData.status || 'NOT SET ❌'}`);
      console.log(`   - isOwner: ${userData.isOwner ?? 'NOT SET ❌'}`);
      console.log(`   - createdBy: ${userData.createdBy || 'NOT SET ❌'}`);
    }

    // 3. Check for business record
    const adminBusinessId = claims.businessId || (userDocSnap.exists ? userDocSnap.data().businessId : null);
    
    if (adminBusinessId) {
      console.log(`\n📌 Step 3: Checking Business Record (${adminBusinessId})...`);
      const businessDocRef = db.collection('businesses').doc(adminBusinessId);
      const businessDocSnap = await businessDocRef.get();
      
      if (!businessDocSnap.exists) {
        console.log('❌ PROBLEM: Business document does NOT exist!');
        console.log(`   Expected path: businesses/${adminBusinessId}`);
      } else {
        const businessData = businessDocSnap.data();
        console.log(`✅ Business Document Found:`);
        console.log(`   - name: ${businessData.name || 'NOT SET'}`);
        console.log(`   - ownerId: ${businessData.ownerId || 'NOT SET'}`);
        console.log(`   - status: ${businessData.status || 'NOT SET'}`);
      }
    } else {
      console.log('\n📌 Step 3: Checking Business Record...');
      console.log('⚠️  No businessId found - LEGACY USER');
    }

    // 4. List all users created by this admin
    console.log('\n📌 Step 4: Checking Users Created by This Admin...');
    const effectiveBusinessId = adminBusinessId || authUser.uid;
    
    const usersQuery = db.collection('users').where('businessId', '==', effectiveBusinessId);
    const usersSnap = await usersQuery.get();
    
    console.log(`\n   Found ${usersSnap.size} users in Firestore with businessId = ${effectiveBusinessId}:`);
    
    if (usersSnap.size === 0) {
      console.log('   ❌ NO USERS FOUND! This is the problem.');
      console.log('   Created users might have a different businessId or no Firestore doc.');
    } else {
      usersSnap.forEach((doc) => {
        const data = doc.data();
        console.log(`   - ${data.email} (${data.role}) - Status: ${data.status || 'NOT SET'} - businessId: ${data.businessId}`);
      });
    }

    // 5. Check Auth users created by this admin
    console.log('\n📌 Step 5: Checking All Auth Users...');
    const allUsers = await auth.listUsers();
    const createdUsers = allUsers.users.filter(u => {
      const userClaims = u.customClaims || {};
      return userClaims.createdBy === authUser.uid || userClaims.businessId === effectiveBusinessId;
    });

    console.log(`\n   Found ${createdUsers.length} users in Auth created by/for this admin:`);
    createdUsers.forEach(u => {
      const userClaims = u.customClaims || {};
      console.log(`   - ${u.email} (${userClaims.role || 'NO ROLE'}) - businessId: ${userClaims.businessId || 'NOT SET ❌'}`);
    });

    // 6. Check delivery challans
    console.log('\n📌 Step 6: Checking Delivery Challans...');
    const challansQuery = db.collection('deliveryChallans').where('businessId', '==', effectiveBusinessId);
    const challansSnap = await challansQuery.get();
    
    console.log(`\n   Found ${challansSnap.size} delivery challans with businessId = ${effectiveBusinessId}:`);
    if (challansSnap.size === 0) {
      console.log('   ℹ️  No challans found. Users might be creating challans with different businessId.');
    } else {
      challansSnap.forEach((doc) => {
        const data = doc.data();
        console.log(`   - ${data.challanNumber} - Customer: ${data.customerName} - userId: ${data.userId?.slice(0, 8)}...`);
      });
    }

    // 7. Summary and Recommendations
    console.log('\n' + '='.repeat(80));
    console.log('\n📋 DIAGNOSIS SUMMARY:');
    console.log('='.repeat(80));

    const issues = [];
    const fixes = [];

    if (!claims.businessId) {
      issues.push('❌ Admin has NO businessId in custom claims');
      fixes.push('Run: node scripts/fix-business-admin.mjs ' + adminEmail);
    }

    if (!userDocSnap.exists) {
      issues.push('❌ Admin has NO Firestore document');
      fixes.push('Create Firestore document for admin user');
    } else if (!userDocSnap.data().businessId) {
      issues.push('❌ Admin Firestore document has NO businessId');
      fixes.push('Update Firestore document with businessId');
    }

    if (usersSnap.size === 0 && createdUsers.length > 0) {
      issues.push('❌ Created users are NOT appearing in Firestore queries');
      fixes.push('Created users need to login once to create their Firestore documents');
    }

    if (issues.length === 0) {
      console.log('✅ No issues detected! Business setup looks good.');
    } else {
      console.log('\n⚠️  Issues Found:');
      issues.forEach(issue => console.log(`   ${issue}`));
      
      console.log('\n🔧 Recommended Fixes:');
      fixes.forEach(fix => console.log(`   ${fix}`));
    }

    console.log('\n' + '='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

// Get email from command line
const adminEmail = process.argv[2];

if (!adminEmail) {
  console.error('❌ Usage: node scripts/diagnose-business.mjs <admin-email>');
  console.error('   Example: node scripts/diagnose-business.mjs babarakbar76@gain');
  process.exit(1);
}

diagnose(adminEmail).then(() => {
  console.log('✅ Diagnosis complete');
  process.exit(0);
}).catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
