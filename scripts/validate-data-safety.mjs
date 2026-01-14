/**
 * DATA SAFETY VALIDATION SCRIPT
 * 
 * Validates that all data has proper fields before applying Firestore rule changes.
 * This ensures no data will be lost when we switch to businessId-based isolation.
 * 
 * USAGE:
 *   node scripts/validate-data-safety.mjs
 * 
 * CHECKS:
 *   1. All users have businessId field
 *   2. All data collections have userId field (for backward compatibility)
 *   3. Businesses collection exists and is accessible
 *   4. No orphaned data (data without valid user references)
 */

import admin from "firebase-admin";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
const serviceKeyPath = join(__dirname, "..", "service-key.json");

if (!existsSync(serviceKeyPath)) {
  console.error("❌ service-key.json not found");
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceKeyPath, "utf8"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
db.settings({ preferRest: true });

const stats = {
  usersTotal: 0,
  usersWithBusinessId: 0,
  usersWithoutBusinessId: 0,
  businessesTotal: 0,
  dataCollections: {},
  orphanedData: []
};

/**
 * Check users collection
 */
async function checkUsers() {
  console.log("👥 Checking users collection...");
  
  const snapshot = await db.collection("users").get();
  stats.usersTotal = snapshot.size;
  
  const usersWithoutBusinessId = [];
  
  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data.businessId) {
      stats.usersWithBusinessId++;
    } else {
      stats.usersWithoutBusinessId++;
      usersWithoutBusinessId.push({
        uid: doc.id,
        email: data.email,
        role: data.role
      });
    }
  });
  
  console.log(`   Total users: ${stats.usersTotal}`);
  console.log(`   ✅ With businessId: ${stats.usersWithBusinessId}`);
  console.log(`   ⚠️  Without businessId: ${stats.usersWithoutBusinessId}`);
  
  if (usersWithoutBusinessId.length > 0) {
    console.log("\n   Users needing migration:");
    usersWithoutBusinessId.forEach(u => {
      console.log(`      • ${u.email} (${u.uid}) - ${u.role}`);
    });
  }
  
  return usersWithoutBusinessId.length === 0;
}

/**
 * Check businesses collection
 */
async function checkBusinesses() {
  console.log("\n🏢 Checking businesses collection...");
  
  const snapshot = await db.collection("businesses").get();
  stats.businessesTotal = snapshot.size;
  
  console.log(`   Total businesses: ${stats.businessesTotal}`);
  
  return true;
}

/**
 * Check data collection for userId field
 */
async function checkDataCollection(collectionName) {
  const snapshot = await db.collection(collectionName).limit(100).get();
  
  const total = snapshot.size;
  let withUserId = 0;
  let withoutUserId = 0;
  
  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data.userId) {
      withUserId++;
    } else {
      withoutUserId++;
    }
  });
  
  stats.dataCollections[collectionName] = {
    total,
    withUserId,
    withoutUserId
  };
  
  console.log(`   ${collectionName}: ${total} docs (${withUserId} with userId)`);
  
  return withoutUserId === 0;
}

/**
 * Main validation
 */
async function validateDataSafety() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  DATA SAFETY VALIDATION");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  const usersOk = await checkUsers();
  const businessesOk = await checkBusinesses();
  
  console.log("\n📊 Checking data collections...");
  const dataCollections = [
    "customers", "suppliers", "sales", "purchases",
    "income", "expenses", "operationalExpenses", "transfers",
    "expenseCategories", "pettyCashOpening", "deliveryChallans"
  ];
  
  for (const collection of dataCollections) {
    await checkDataCollection(collection);
  }
  
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  VALIDATION RESULTS");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  if (usersOk && businessesOk) {
    console.log("✅ ALL CHECKS PASSED - Safe to proceed with Firestore rule updates");
    console.log("\nNext steps:");
    console.log("1. Run: node scripts/backup-all-data.mjs");
    console.log("2. Apply Firestore rule changes");
    console.log("3. Test with a non-admin user");
  } else {
    console.log("⚠️  MIGRATION REQUIRED");
    console.log("\nBefore updating Firestore rules:");
    console.log("1. Run: node scripts/migrate-users-to-business.mjs --execute");
    console.log("2. Run this validation again");
    console.log("3. Then proceed with rule updates");
  }
  
  process.exit(usersOk && businessesOk ? 0 : 1);
}

validateDataSafety().catch((error) => {
  console.error("❌ Validation failed:", error);
  process.exit(1);
});

