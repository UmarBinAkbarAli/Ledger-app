#!/usr/bin/env node

/**
 * Fix Purchase Bill Number Duplicates
 * 
 * This script:
 * 1. Finds all purchases with duplicate bill numbers
 * 2. Renumbers them sequentially while preserving data
 * 3. Ensures chronological order is maintained
 * 
 * 100% SAFE: No data is deleted, only billNumber field is updated
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Handle SSL certificate issues
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

const db = getFirestore(app);

// Force REST API to bypass SSL issues
db.settings({
  preferRest: true,
});

async function fixPurchaseDuplicates(businessId) {
  console.log(`\n🔍 Analyzing purchases for business: ${businessId}\n`);
  console.log('='.repeat(80));

  try {
    // Get all purchases for this business
    const purchasesQuery = db.collection('purchases').where('businessId', '==', businessId);
    const snapshot = await purchasesQuery.get();

    console.log(`\n📊 Found ${snapshot.size} total purchases\n`);

    // Group by bill number to find duplicates
    const billMap = new Map();
    const purchases = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      purchases.push({
        id: doc.id,
        billNumber: data.billNumber || 'UNKNOWN',
        date: data.date || '',
        supplier: data.supplierName || '',
        amount: data.totalAmount || 0,
        createdAt: data.createdAt?.toDate?.() || new Date(data.date || Date.now()),
      });

      const billNum = data.billNumber || 'UNKNOWN';
      if (!billMap.has(billNum)) {
        billMap.set(billNum, []);
      }
      billMap.get(billNum).push(doc.id);
    });

    // Sort purchases by creation date (chronological order)
    purchases.sort((a, b) => a.createdAt - b.createdAt);

    // Find duplicates
    const duplicates = [];
    billMap.forEach((ids, billNum) => {
      if (ids.length > 1) {
        duplicates.push({ billNum, count: ids.length, ids });
      }
    });

    if (duplicates.length === 0) {
      console.log('✅ No duplicate bill numbers found!\n');
      return;
    }

    console.log(`⚠️  Found ${duplicates.length} duplicate bill numbers:\n`);
    duplicates.forEach(({ billNum, count, ids }) => {
      console.log(`   - ${billNum}: ${count} occurrences`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('\n🔧 RENUMBERING STRATEGY:');
    console.log('='.repeat(80));
    console.log('\n1. Sort all purchases chronologically by creation date');
    console.log('2. Assign sequential bill numbers: PUR-0001, PUR-0002, PUR-0003...');
    console.log('3. Update each purchase with its new bill number');
    console.log('4. All data remains intact - only billNumber field changes\n');

    console.log('='.repeat(80));
    console.log('\n📋 PREVIEW OF CHANGES:\n');

    // Show first 10 purchases with their new numbers
    purchases.slice(0, 10).forEach((p, idx) => {
      const newBillNumber = `PUR-${String(idx + 1).padStart(4, '0')}`;
      const change = p.billNumber !== newBillNumber ? '🔄 CHANGED' : '✅ OK';
      console.log(`   ${change} | Old: ${p.billNumber} → New: ${newBillNumber} | ${p.date} | ${p.supplier}`);
    });

    if (purchases.length > 10) {
      console.log(`   ... and ${purchases.length - 10} more purchases`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n⚠️  CONFIRMATION REQUIRED');
    console.log('='.repeat(80));
    console.log('\nThis will renumber ALL purchases in chronological order.');
    console.log('Your data is 100% safe - only bill numbers will change.');
    console.log('\nTo proceed, run with --confirm flag:');
    console.log(`   node scripts/fix-purchase-duplicates.mjs ${businessId} --confirm\n`);

    // Check for --confirm flag
    if (!process.argv.includes('--confirm')) {
      console.log('❌ Aborting - no changes made\n');
      return;
    }

    console.log('\n' + '='.repeat(80));
    console.log('🚀 APPLYING CHANGES...');
    console.log('='.repeat(80) + '\n');

    let updated = 0;
    let skipped = 0;

    for (let i = 0; i < purchases.length; i++) {
      const purchase = purchases[i];
      const newBillNumber = `PUR-${String(i + 1).padStart(4, '0')}`;

      if (purchase.billNumber === newBillNumber) {
        skipped++;
        continue;
      }

      await db.collection('purchases').doc(purchase.id).update({
        billNumber: newBillNumber,
        updatedAt: FieldValue.serverTimestamp(),
        // Track that this was auto-corrected
        _renumbered: true,
        _oldBillNumber: purchase.billNumber,
      });

      updated++;
      if (updated % 10 === 0) {
        console.log(`   ✅ Updated ${updated}/${purchases.length} purchases...`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ RENUMBERING COMPLETE!');
    console.log('='.repeat(80));
    console.log(`\n📊 Results:`);
    console.log(`   - Total purchases: ${purchases.length}`);
    console.log(`   - Updated: ${updated}`);
    console.log(`   - Already correct: ${skipped}`);
    console.log(`   - New bill number range: PUR-0001 to PUR-${String(purchases.length).padStart(4, '0')}`);
    console.log('\n✅ All purchase records are now sequentially numbered!');
    console.log('✅ No data was lost - all purchases preserved with correct dates.\n');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Get businessId from command line
const businessId = process.argv[2];

if (!businessId || businessId === '--confirm') {
  console.error('❌ Usage: node scripts/fix-purchase-duplicates.mjs <businessId> [--confirm]');
  console.error('   Example: node scripts/fix-purchase-duplicates.mjs u1ANgxcQ0VR989czN48c');
  console.error('\n   First run without --confirm to preview changes');
  console.error('   Then run with --confirm to apply changes');
  process.exit(1);
}

fixPurchaseDuplicates(businessId).then(() => {
  console.log('✅ Script complete');
  process.exit(0);
}).catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
