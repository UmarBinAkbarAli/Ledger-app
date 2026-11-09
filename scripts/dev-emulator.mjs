/**
 * Run the Next.js dev server against the LOCAL Firebase emulators instead of the
 * live project. Nothing you do in this mode touches production data.
 *
 * USAGE:  npm run emulators      (terminal 1)
 *         npm run dev            (terminal 2)  → http://localhost:3000
 *
 * Env vars set here override .env.local (Next.js never overwrites existing env).
 */
import { spawn } from "child_process";
import { ROOT, EMULATOR_ENV, assertEmulatorsRunning } from "./emulator-shared.mjs";

await assertEmulatorsRunning();

console.log("🧪 Starting Next.js in EMULATOR mode — connected to local emulators, NOT the live database.\n");
const child = spawn("npx next dev", {
  cwd: ROOT,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, ...EMULATOR_ENV },
});
child.on("exit", (code) => process.exit(code ?? 0));
