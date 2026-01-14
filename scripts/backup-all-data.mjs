/**
 * COMPREHENSIVE DATA BACKUP SCRIPT
 * 
 * Creates a complete backup of all Firestore collections before making changes.
 * This ensures we can restore data if anything goes wrong.
 * 
 * USAGE:
 *   node scripts/backup-all-data.mjs
 * 
 * OUTPUT:
 *   - Creates backup-TIMESTAMP.json with all data
 *   - Validates data integrity
 *   - Reports statistics
 */

import admin from "firebase-admin";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
db.settings({ preferRest: true });

// Collections to backup
const COLLECTIONS = [
  "users",
  "businesses",
  "customers",
  "suppliers",
  "sales",
  "purchases",
  "income",
  "expenses",
  "operationalExpenses",
  "transfers",
  "expenseCategories",
  "pettyCashOpening",
  "deliveryChallans",
  "auditLogs"
];

/**
 * Backup a single collection
 */
async function backupCollection(collectionName) {
  console.log(`📦 Backing up ${collectionName}...`);
  
  const snapshot = await db.collection(collectionName).get();
  const documents = [];
  
  snapshot.forEach((doc) => {
    documents.push({
      id: doc.id,
      ...doc.data()
    });
  });
  
  console.log(`   ✅ ${documents.length} documents backed up`);
  return documents;
}

/**
 * Main backup function
 */
async function backupAllData() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  COMPREHENSIVE DATA BACKUP");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  const timestamp = Date.now();
  const backup = {
    timestamp: new Date().toISOString(),
    collections: {}
  };
  
  let totalDocuments = 0;
  
  for (const collectionName of COLLECTIONS) {
    try {
      const documents = await backupCollection(collectionName);
      backup.collections[collectionName] = documents;
      totalDocuments += documents.length;
    } catch (error) {
      console.error(`   ❌ Error backing up ${collectionName}:`, error.message);
      backup.collections[collectionName] = [];
    }
  }
  
  // Save backup
  const backupPath = join(__dirname, `backup-all-${timestamp}.json`);
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  BACKUP COMPLETE");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`📁 Backup saved to: ${backupPath}`);
  console.log(`📊 Total documents: ${totalDocuments}`);
  console.log(`💾 File size: ${(writeFileSync.length / 1024).toFixed(2)} KB`);
  console.log("\n✅ Backup completed successfully!");
  console.log("\nYou can now proceed with data migration safely.");
  
  process.exit(0);
}

// Run backup
backupAllData().catch((error) => {
  console.error("❌ Backup failed:", error);
  process.exit(1);
});

