/**
 * Shared settings for the local Firebase Emulator workflow.
 * See the "Local testing with the Firebase Emulator" section in CLAUDE.md.
 */
import { join, dirname } from "path";
import { fileURLToPath } from "url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Must start with "demo-": Firebase treats demo-* projects as emulator-only,
// so tools refuse to contact real Google servers with this ID.
export const EMULATOR_PROJECT_ID = "demo-ledger";
export const FIRESTORE_HOST = "127.0.0.1:8085";
export const AUTH_HOST = "127.0.0.1:9099";

// Emulator state saved between sessions (gitignored).
export const EMULATOR_DATA_DIR = join(ROOT, "emulator-data");
// Read-only snapshot of production used to seed the emulator (gitignored).
export const SNAPSHOT_PATH = join(ROOT, "emulator-seed", "prod-snapshot.json");

/** Env vars that point the Firebase SDKs (client and Admin) at the emulators. */
export const EMULATOR_ENV = {
  NEXT_PUBLIC_USE_FIREBASE_EMULATOR: "true",
  NEXT_PUBLIC_FIREBASE_EMULATOR_PROJECT_ID: EMULATOR_PROJECT_ID,
  FIREBASE_EMULATOR_PROJECT_ID: EMULATOR_PROJECT_ID,
  FIRESTORE_EMULATOR_HOST: FIRESTORE_HOST,
  FIREBASE_AUTH_EMULATOR_HOST: AUTH_HOST,
  GCLOUD_PROJECT: EMULATOR_PROJECT_ID,
};

export async function assertEmulatorsRunning() {
  for (const [name, host] of [["Firestore", FIRESTORE_HOST], ["Auth", AUTH_HOST]]) {
    try {
      await fetch(`http://${host}/`);
    } catch {
      console.error(`❌ ${name} emulator is not running on ${host}.`);
      console.error("   Start it first in another terminal:  npm run emulators");
      process.exit(1);
    }
  }
}
