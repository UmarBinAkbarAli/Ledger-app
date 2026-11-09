/**
 * Start the Firebase Emulator Suite (Auth + Firestore + UI) for local testing.
 *
 * USAGE:  npm run emulators
 *
 * - Uses the emulator-only project "demo-ledger" — never the live project.
 * - Loads firestore.rules, so security rules are tested locally too.
 * - Restores data from ./emulator-data if present, and saves it back there when
 *   you stop the emulators with Ctrl+C. Delete that folder to start fresh.
 * - Emulator UI (browse/edit data): http://127.0.0.1:4000
 */
import { spawn } from "child_process";
import { existsSync } from "fs";
import { ROOT, EMULATOR_PROJECT_ID, EMULATOR_DATA_DIR } from "./emulator-shared.mjs";

const args = [
  "firebase", "emulators:start",
  "--only", "auth,firestore",
  "--project", EMULATOR_PROJECT_ID,
  `--export-on-exit=${EMULATOR_DATA_DIR}`,
];
if (existsSync(EMULATOR_DATA_DIR)) {
  args.push(`--import=${EMULATOR_DATA_DIR}`);
  console.log("📂 Restoring saved emulator data from ./emulator-data");
} else {
  console.log("🆕 No saved emulator data yet — starting empty (run `npm run emulator:seed` to load data).");
}

const command = ["npx", ...args.map((a) => (a.includes(" ") ? `"${a}"` : a))].join(" ");
const child = spawn(command, { cwd: ROOT, stdio: "inherit", shell: true });
child.on("exit", (code) => process.exit(code ?? 0));
