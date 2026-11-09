/**
 * Take a READ-ONLY snapshot of the live Firestore data + Auth users, for seeding
 * the local emulator. This script never writes to production: it only calls
 * .get(), listCollections() and auth.listUsers().
 *
 * USAGE:  npm run emulator:pull
 * OUTPUT: emulator-seed/prod-snapshot.json  (gitignored — contains real data)
 *
 * Credentials: FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
 * from .env.local (same as the app's API routes).
 * On a network with SSL interception, run with INSECURE_TLS=1 (dev machines only).
 */
import { mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import nextEnv from "@next/env";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp, GeoPoint, DocumentReference } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { ROOT, SNAPSHOT_PATH } from "./emulator-shared.mjs";

if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("❌ Emulator env vars are set in this shell; unset them so the snapshot reads the live project.");
  process.exit(1);
}
if (process.env.INSECURE_TLS === "1") process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

nextEnv.loadEnvConfig(ROOT);
const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
  console.error("❌ Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY in .env.local");
  process.exit(1);
}

const app = initializeApp({
  credential: cert({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore(app);
db.settings({ preferRest: true });

// Encode Firestore-specific types so they survive JSON and can be restored.
function encode(value) {
  if (value instanceof Timestamp) return { __type: "timestamp", seconds: value.seconds, nanoseconds: value.nanoseconds };
  if (value instanceof GeoPoint) return { __type: "geopoint", latitude: value.latitude, longitude: value.longitude };
  if (value instanceof DocumentReference) return { __type: "ref", path: value.path };
  if (Buffer.isBuffer(value)) return { __type: "bytes", base64: value.toString("base64") };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)]));
  }
  return value;
}

// Collections whose documents have subcollections worth copying (per firestore.rules).
const WITH_SUBCOLLECTIONS = new Set(["users"]);

async function dumpCollection(colRef, withSubcollections) {
  const snap = await colRef.get();
  const docs = [];
  for (const doc of snap.docs) {
    const entry = { id: doc.id, data: encode(doc.data()) };
    if (withSubcollections) {
      const subs = await doc.ref.listCollections();
      if (subs.length) {
        entry.subcollections = {};
        for (const sub of subs) entry.subcollections[sub.id] = await dumpCollection(sub, false);
      }
    }
    docs.push(entry);
  }
  return docs;
}

console.log(`📥 Reading live project "${FIREBASE_PROJECT_ID}" (read-only)...`);
const snapshot = { takenAt: new Date().toISOString(), sourceProject: FIREBASE_PROJECT_ID, collections: {}, authUsers: [] };

for (const col of await db.listCollections()) {
  const docs = await dumpCollection(col, WITH_SUBCOLLECTIONS.has(col.id));
  snapshot.collections[col.id] = docs;
  console.log(`   ${col.id.padEnd(22)} ${docs.length} docs`);
}

let pageToken;
do {
  const page = await getAuth(app).listUsers(1000, pageToken);
  for (const u of page.users) {
    snapshot.authUsers.push({
      uid: u.uid,
      email: u.email ?? null,
      displayName: u.displayName ?? null,
      disabled: u.disabled,
      customClaims: u.customClaims ?? null,
    });
  }
  pageToken = page.pageToken;
} while (pageToken);
console.log(`   ${"(auth users)".padEnd(22)} ${snapshot.authUsers.length} users`);

mkdirSync(dirname(SNAPSHOT_PATH), { recursive: true });
writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2));
console.log(`\n✅ Snapshot saved to ${SNAPSHOT_PATH}`);
console.log("   Next: with `npm run emulators` running, run `npm run emulator:seed`.");
process.exit(0);
