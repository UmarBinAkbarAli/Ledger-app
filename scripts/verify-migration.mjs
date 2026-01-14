/**
 * Verification Script: Check Migration Status
 * 
 * This script verifies that all users have been properly migrated
 * to the multi-tenant architecture with businessId.
 * 
 * USAGE:
 *   node scripts/verify-migration.mjs
 */

import admin from "firebase-admin";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log("═══════════════════════════════════════════════════════════════");
console.log("  VERIFICATION: Check User Migration Status");
console.log("═══════════════════════════════════════════════════════════════\n");

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

async function verify() {
  // Get all users
  const usersSnapshot = await db.collection("users").get();
  const users = [];
  usersSnapshot.forEach((doc) => {
    users.push({ uid: doc.id, ...doc.data() });
  });

  // Get all businesses
  const businessesSnapshot = await db.collection("businesses").get();
  const businesses = [];
  businessesSnapshot.forEach((doc) => {
    businesses.push({ id: doc.id, ...doc.data() });
  });

  console.log(`📊 Total Users: ${users.length}`);
  console.log(`🏢 Total Businesses: ${businesses.length}\n`);

  // Categorize users
  const withBusinessId = users.filter((u) => u.businessId);
  const withoutBusinessId = users.filter((u) => !u.businessId);
  const admins = users.filter((u) => u.role === "admin");
  const owners = users.filter((u) => u.isOwner === true);

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  MIGRATION STATUS");
  console.log("═══════════════════════════════════════════════════════════════\n");

  console.log(`  ✅ Users with businessId:     ${withBusinessId.length}/${users.length}`);
  console.log(`  ❌ Users without businessId:  ${withoutBusinessId.length}/${users.length}`);
  console.log(`  👑 Admin users:               ${admins.length}`);
  console.log(`  🏠 Business owners:           ${owners.length}`);

  const migrationComplete = withoutBusinessId.length === 0;

  console.log("\n═══════════════════════════════════════════════════════════════");
  if (migrationComplete) {
    console.log("  ✅ MIGRATION COMPLETE - All users have businessId");
  } else {
    console.log("  ⚠️  MIGRATION INCOMPLETE - Some users need migration");
  }
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Show users without businessId
  if (withoutBusinessId.length > 0) {
    console.log("Users needing migration:");
    console.log("─".repeat(65));
    for (const user of withoutBusinessId) {
      console.log(`  • ${user.email} (${user.uid}) - Role: ${user.role}`);
    }
    console.log("\nRun: node scripts/migrate-users-to-business.mjs --execute");
  }

  // Show all businesses
  if (businesses.length > 0) {
    console.log("\n📦 Businesses:");
    console.log("─".repeat(65));
    for (const biz of businesses) {
      const owner = users.find((u) => u.uid === biz.ownerId);
      const memberCount = users.filter((u) => u.businessId === biz.id).length;
      console.log(`  • ${biz.name || "Unnamed"} (${biz.id})`);
      console.log(`    Owner: ${owner?.email || biz.ownerId}`);
      console.log(`    Members: ${memberCount}`);
    }
  }

  // Show user-business mapping
  console.log("\n👥 User-Business Mapping:");
  console.log("─".repeat(65));
  for (const user of users) {
    const status = user.businessId ? "✅" : "❌";
    const ownerBadge = user.isOwner ? " 👑" : "";
    console.log(`  ${status} ${user.email} → ${user.businessId || "NONE"}${ownerBadge}`);
  }
}

verify()
  .then(() => {
    console.log("\n✅ Verification complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Verification failed:", error);
    process.exit(1);
  });
