/**
 * Migration Script: Add businessId to Existing Users
 * 
 * This script safely migrates existing users to the multi-tenant architecture
 * by adding businessId field without deleting any existing data.
 * 
 * SAFETY FEATURES:
 * - Dry-run mode by default (no actual changes)
 * - Logs all changes for audit
 * - Idempotent (safe to run multiple times)
 * - Creates backup of user data before changes
 * 
 * USAGE:
 *   node scripts/migrate-users-to-business.mjs              # Dry run (preview only)
 *   node scripts/migrate-users-to-business.mjs --execute    # Actually apply changes
 * 
 * WHAT IT DOES:
 * 1. For admins without businessId:
 *    - Creates a Business document
 *    - Sets businessId = new business ID
 *    - Sets isOwner = true
 * 
 * 2. For employees without businessId:
 *    - Finds their parent admin (via createdBy)
 *    - Sets businessId = parent admin's businessId
 *    - Sets isOwner = false
 */

import admin from "firebase-admin";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line args
const args = process.argv.slice(2);
const DRY_RUN = !args.includes("--execute");
const VERBOSE = args.includes("--verbose") || args.includes("-v");

console.log("═══════════════════════════════════════════════════════════════");
console.log("  MIGRATION: Add businessId to Existing Users");
console.log("═══════════════════════════════════════════════════════════════");
console.log(`  Mode: ${DRY_RUN ? "🔍 DRY RUN (no changes will be made)" : "⚡ EXECUTE (changes will be applied)"}`);
console.log("═══════════════════════════════════════════════════════════════\n");

if (DRY_RUN) {
  console.log("ℹ️  To apply changes, run with --execute flag:");
  console.log("   node scripts/migrate-users-to-business.mjs --execute\n");
}

// Initialize Firebase Admin
const serviceKeyPath = join(__dirname, "..", "service-key.json");

if (!existsSync(serviceKeyPath)) {
  console.error("❌ service-key.json not found at:", serviceKeyPath);
  console.error("   Please ensure your Firebase Admin SDK service key is in the project root.");
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceKeyPath, "utf8"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
db.settings({ preferRest: true }); // Use REST API to bypass gRPC/SSL issues

// Migration statistics
const stats = {
  totalUsers: 0,
  alreadyMigrated: 0,
  adminsCreated: 0,
  businessesCreated: 0,
  employeesMigrated: 0,
  errors: 0,
  skipped: 0,
};

// Audit log for all changes
const auditLog = [];

/**
 * Log a change for audit purposes
 */
function logChange(action, details) {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    ...details,
  };
  auditLog.push(entry);
  
  if (VERBOSE) {
    console.log(`  📝 ${action}:`, JSON.stringify(details, null, 2));
  }
}

/**
 * Create a business document for an admin
 */
async function createBusinessForAdmin(adminUser) {
  const businessData = {
    name: adminUser.displayName ? `${adminUser.displayName}'s Business` : `Business ${adminUser.uid.slice(0, 8)}`,
    email: adminUser.email,
    ownerId: adminUser.uid,
    status: "active",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    settings: {
      currency: "PKR",
      timezone: "Asia/Karachi",
      invoicePrefix: "INV-",
      challanPrefix: "DC-",
      purchasePrefix: "PUR-",
    },
    metadata: {
      migratedAt: new Date().toISOString(),
      migrationSource: "migrate-users-to-business.mjs",
    },
  };

  if (DRY_RUN) {
    // In dry run, generate a fake ID for preview
    const fakeId = `business_${adminUser.uid.slice(0, 8)}`;
    logChange("WOULD_CREATE_BUSINESS", { 
      businessId: fakeId, 
      ownerId: adminUser.uid,
      name: businessData.name 
    });
    return fakeId;
  }

  const businessRef = await db.collection("businesses").add(businessData);
  logChange("CREATED_BUSINESS", { 
    businessId: businessRef.id, 
    ownerId: adminUser.uid,
    name: businessData.name 
  });
  stats.businessesCreated++;
  return businessRef.id;
}

/**
 * Update a user document with businessId
 */
async function updateUserWithBusinessId(userId, businessId, isOwner) {
  const updateData = {
    businessId,
    isOwner,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    metadata: {
      migratedAt: new Date().toISOString(),
      migrationSource: "migrate-users-to-business.mjs",
    },
  };

  if (DRY_RUN) {
    logChange("WOULD_UPDATE_USER", { userId, businessId, isOwner });
    return;
  }

  await db.collection("users").doc(userId).update(updateData);
  logChange("UPDATED_USER", { userId, businessId, isOwner });
}

/**
 * Main migration function
 */
async function migrateUsers() {
  console.log("📊 Loading all users from Firestore...\n");

  // Get all users
  const usersSnapshot = await db.collection("users").get();
  const users = [];
  
  usersSnapshot.forEach((doc) => {
    users.push({ uid: doc.id, ...doc.data() });
  });

  stats.totalUsers = users.length;
  console.log(`📋 Found ${users.length} total users\n`);

  if (users.length === 0) {
    console.log("ℹ️  No users found. Nothing to migrate.");
    return;
  }

  // Separate users into categories
  const admins = users.filter((u) => u.role === "admin");
  const employees = users.filter((u) => u.role !== "admin");

  console.log(`👑 Admins: ${admins.length}`);
  console.log(`👤 Employees: ${employees.length}\n`);

  // Create a backup of current state
  const backupPath = join(__dirname, `backup-users-${Date.now()}.json`);
  writeFileSync(backupPath, JSON.stringify(users, null, 2));
  console.log(`💾 Backup saved to: ${backupPath}\n`);

  // Map to track admin UID -> businessId
  const adminBusinessMap = new Map();

  // ========== PHASE 1: Process Admins ==========
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  PHASE 1: Migrating Admins");
  console.log("═══════════════════════════════════════════════════════════════\n");

  for (const adminUser of admins) {
    console.log(`\n👑 Admin: ${adminUser.email} (${adminUser.uid})`);

    // Check if already migrated
    if (adminUser.businessId) {
      console.log(`   ✅ Already has businessId: ${adminUser.businessId}`);
      adminBusinessMap.set(adminUser.uid, adminUser.businessId);
      stats.alreadyMigrated++;
      continue;
    }

    // Check if this admin already has a business document
    const existingBusiness = await db
      .collection("businesses")
      .where("ownerId", "==", adminUser.uid)
      .limit(1)
      .get();

    let businessId;

    if (!existingBusiness.empty) {
      // Use existing business
      businessId = existingBusiness.docs[0].id;
      console.log(`   📦 Found existing business: ${businessId}`);
      logChange("FOUND_EXISTING_BUSINESS", { 
        userId: adminUser.uid, 
        businessId 
      });
    } else {
      // Create new business
      console.log(`   🏢 Creating new business...`);
      businessId = await createBusinessForAdmin(adminUser);
      console.log(`   ✨ ${DRY_RUN ? "Would create" : "Created"} business: ${businessId}`);
    }

    // Update admin user with businessId
    await updateUserWithBusinessId(adminUser.uid, businessId, true);
    console.log(`   ${DRY_RUN ? "🔍 Would update" : "✅ Updated"} user with businessId`);

    adminBusinessMap.set(adminUser.uid, businessId);
    stats.adminsCreated++;
  }

  // ========== PHASE 2: Process Employees ==========
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  PHASE 2: Migrating Employees");
  console.log("═══════════════════════════════════════════════════════════════\n");

  for (const employee of employees) {
    console.log(`\n👤 Employee: ${employee.email} (${employee.uid})`);

    // Check if already migrated
    if (employee.businessId) {
      console.log(`   ✅ Already has businessId: ${employee.businessId}`);
      stats.alreadyMigrated++;
      continue;
    }

    // Find parent admin's businessId
    const createdBy = employee.createdBy;
    
    if (!createdBy) {
      console.log(`   ⚠️  No createdBy field - treating as self-owned`);
      
      // If employee has no createdBy, use their own UID as businessId
      // This handles legacy users who might be independent
      const selfBusinessId = employee.uid;
      await updateUserWithBusinessId(employee.uid, selfBusinessId, true);
      console.log(`   ${DRY_RUN ? "🔍 Would set" : "✅ Set"} businessId = own UID (self-owned)`);
      stats.employeesMigrated++;
      continue;
    }

    // Check if parent admin is in our map
    let parentBusinessId = adminBusinessMap.get(createdBy);

    if (!parentBusinessId) {
      // Parent admin might not be processed yet or might not exist
      // Try to fetch parent admin's businessId from Firestore
      console.log(`   🔍 Looking up parent admin: ${createdBy}`);
      
      const parentDoc = await db.collection("users").doc(createdBy).get();
      
      if (parentDoc.exists) {
        const parentData = parentDoc.data();
        parentBusinessId = parentData.businessId || createdBy; // Fallback to createdBy UID
        adminBusinessMap.set(createdBy, parentBusinessId);
        console.log(`   📋 Found parent's businessId: ${parentBusinessId}`);
      } else {
        // Parent doesn't exist - use createdBy as businessId
        console.log(`   ⚠️  Parent admin not found - using createdBy as businessId`);
        parentBusinessId = createdBy;
      }
    }

    // Update employee with parent's businessId
    await updateUserWithBusinessId(employee.uid, parentBusinessId, false);
    console.log(`   ${DRY_RUN ? "🔍 Would update" : "✅ Updated"} with businessId: ${parentBusinessId}`);
    stats.employeesMigrated++;
  }

  // ========== SUMMARY ==========
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  MIGRATION SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════\n");

  console.log(`  📊 Total users processed:     ${stats.totalUsers}`);
  console.log(`  ✅ Already migrated:          ${stats.alreadyMigrated}`);
  console.log(`  👑 Admins migrated:           ${stats.adminsCreated}`);
  console.log(`  🏢 Businesses created:        ${stats.businessesCreated}`);
  console.log(`  👤 Employees migrated:        ${stats.employeesMigrated}`);
  console.log(`  ❌ Errors:                    ${stats.errors}`);
  console.log(`  ⏭️  Skipped:                   ${stats.skipped}`);

  if (DRY_RUN) {
    console.log("\n" + "═".repeat(65));
    console.log("  🔍 DRY RUN COMPLETE - No changes were made");
    console.log("═".repeat(65));
    console.log("\n  To apply these changes, run:");
    console.log("  node scripts/migrate-users-to-business.mjs --execute\n");
  } else {
    console.log("\n" + "═".repeat(65));
    console.log("  ✅ MIGRATION COMPLETE");
    console.log("═".repeat(65) + "\n");
  }

  // Save audit log
  const auditPath = join(__dirname, `migration-audit-${Date.now()}.json`);
  writeFileSync(auditPath, JSON.stringify(auditLog, null, 2));
  console.log(`📝 Audit log saved to: ${auditPath}\n`);
}

// Run migration
migrateUsers()
  .then(() => {
    console.log("✅ Script finished successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  });
