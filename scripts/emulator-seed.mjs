/**
 * Load emulator-seed/prod-snapshot.json into the LOCAL emulators (wipes emulator
 * data first). Works only against the emulator: it sets the emulator env vars
 * itself, uses the "demo-ledger" project and no credentials, so it cannot reach
 * production.
 *
 * USAGE:  npm run emulators        (terminal 1, keep running)
 *         npm run emulator:seed    (terminal 2)
 *
 * Every Auth user gets the password "test1234" (override with EMULATOR_PASSWORD=...)
 * and keeps their real uid, email and custom claims (role, businessId).
 */
import { existsSync, readFileSync } from "fs";
import {
  EMULATOR_ENV, EMULATOR_PROJECT_ID, FIRESTORE_HOST, AUTH_HOST, SNAPSHOT_PATH, assertEmulatorsRunning,
} from "./emulator-shared.mjs";

Object.assign(process.env, EMULATOR_ENV);
if (!EMULATOR_PROJECT_ID.startsWith("demo-")) throw new Error("Refusing to seed a non-demo project.");

const { initializeApp } = await import("firebase-admin/app");
const { getFirestore, Timestamp, GeoPoint } = await import("firebase-admin/firestore");
const { getAuth } = await import("firebase-admin/auth");

const PASSWORD = process.env.EMULATOR_PASSWORD || "test1234";

if (!existsSync(SNAPSHOT_PATH)) {
  console.error(`❌ No snapshot at ${SNAPSHOT_PATH}. Run \`npm run emulator:pull\` first.`);
  process.exit(1);
}
await assertEmulatorsRunning();

const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
const app = initializeApp({ projectId: EMULATOR_PROJECT_ID });
const db = getFirestore(app);
const auth = getAuth(app);

function decode(value) {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === "object") {
    switch (value.__type) {
      case "timestamp": return new Timestamp(value.seconds, value.nanoseconds);
      case "geopoint": return new GeoPoint(value.latitude, value.longitude);
      case "ref": return db.doc(value.path);
      case "bytes": return Buffer.from(value.base64, "base64");
    }
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decode(v)]));
  }
  return value;
}

// 1. Wipe existing emulator data (emulator-only REST endpoints).
console.log("🧹 Clearing emulator data...");
await fetch(`http://${FIRESTORE_HOST}/emulator/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`, { method: "DELETE" });
await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${EMULATOR_PROJECT_ID}/accounts`, { method: "DELETE" });

// 2. Firestore documents.
console.log(`📤 Loading snapshot from ${snapshot.takenAt} into emulator...`);
const writer = db.bulkWriter();
let count = 0;
function writeDocs(colRef, docs) {
  for (const d of docs) {
    const ref = colRef.doc(d.id);
    writer.set(ref, decode(d.data));
    count++;
    for (const [sub, subDocs] of Object.entries(d.subcollections ?? {})) writeDocs(ref.collection(sub), subDocs);
  }
}
for (const [name, docs] of Object.entries(snapshot.collections)) {
  writeDocs(db.collection(name), docs);
  console.log(`   ${name.padEnd(22)} ${docs.length} docs`);
}
await writer.close();

// 3. Auth users with the same uid / email / custom claims.
for (const u of snapshot.authUsers) {
  await auth.createUser({
    uid: u.uid,
    ...(u.email ? { email: u.email, password: PASSWORD } : {}),
    ...(u.displayName ? { displayName: u.displayName } : {}),
    disabled: u.disabled,
  });
  if (u.customClaims) await auth.setCustomUserClaims(u.uid, u.customClaims);
}

console.log(`\n✅ Seeded ${count} documents and ${snapshot.authUsers.length} users into the emulator.`);
console.log(`   Log in at http://localhost:3000 with any real user's email and password "${PASSWORD}".`);
for (const u of snapshot.authUsers) {
  if (u.email) console.log(`   • ${u.email}${u.customClaims?.role ? `  (${u.customClaims.role})` : ""}${u.disabled ? "  [disabled]" : ""}`);
}
console.log("   Data is saved to ./emulator-data when you stop the emulators with Ctrl+C.");
process.exit(0);
