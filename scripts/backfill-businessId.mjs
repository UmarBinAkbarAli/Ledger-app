// Backfill businessId on legacy documents so Firestore rules allow access.
// Usage: node scripts/backfill-businessId.mjs
// Optional env: GOOGLE_APPLICATION_CREDENTIALS or service-key.json in project root.

import fs from "fs";
import path from "path";

// Bypass corporate MITM for admin SDK (same as app workaround)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Use Firestore REST client to avoid gRPC certificate issues
import { Firestore } from "@google-cloud/firestore";

const serviceKeyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), "service-key.json");
if (!fs.existsSync(serviceKeyPath)) {
  console.error(`Service key not found at ${serviceKeyPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceKeyPath, "utf8"));

const db = new Firestore({
  projectId: serviceAccount.project_id || serviceAccount.projectId,
  credentials: {
    client_email: serviceAccount.client_email,
    private_key: serviceAccount.private_key,
  },
  preferRest: true,
});

// Collections to backfill
const TARGET_COLLECTIONS = [
  "users",
  "deliveryChallans",
  "customers",
  "suppliers",
  "sales",
  "purchases",
  "expenses",
  "income",
  "operationalExpenses",
  "transfers",
  "pettyCashOpening",
  "expenseCategories",
];

// Cache user businessId lookups
const userBizCache = new Map();

async function getBusinessIdForUser(userId) {
  if (!userId) return null;
  if (userBizCache.has(userId)) return userBizCache.get(userId);
  const snap = await db.collection("users").doc(userId).get();
  const bizId = snap.exists ? snap.data().businessId || userId : userId;
  userBizCache.set(userId, bizId);
  return bizId;
}

async function backfillCollection(colName) {
  console.log(`\n=== Backfilling ${colName} ===`);
  const colRef = db.collection(colName);
  let processed = 0;
  let updated = 0;

  const snap = await colRef.get();
  for (const docSnap of snap.docs) {
    processed += 1;
    const data = docSnap.data();

    if (data.businessId) continue; // already set

    const userId = data.businessId || data.userId || data.createdBy || data.ownerId || data.uid;
    const bizId = await getBusinessIdForUser(userId);
    if (!bizId) {
      console.warn(`Skipping ${colName}/${docSnap.id}: cannot determine businessId`);
      continue;
    }

    await docSnap.ref.update({ businessId: bizId });
    updated += 1;

    if (updated % 50 === 0) {
      console.log(`Updated ${updated} of ${processed} so far...`);
    }
  }

  console.log(`Done ${colName}: processed ${processed}, updated ${updated}`);
}

async function main() {
  for (const col of TARGET_COLLECTIONS) {
    await backfillCollection(col);
  }
  console.log("\nBackfill complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed", err);
  process.exit(1);
});
