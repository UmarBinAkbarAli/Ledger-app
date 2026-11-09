// src/lib/firebase.ts

import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  connectFirestoreEmulator
} from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";

// Validate that all required environment variables are present
const requiredEnvVars = {
  'NEXT_PUBLIC_FIREBASE_API_KEY': process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN': process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID': process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET': process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID': process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  'NEXT_PUBLIC_FIREBASE_APP_ID': process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const missingVars = Object.entries(requiredEnvVars)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error('❌ Missing environment variables:', missingVars);
  console.error('📝 Please ensure .env.local file exists in the root directory');
  console.error('🔄 After creating .env.local, restart the dev server with: npm run dev');
  throw new Error(
    `Missing required environment variables: ${missingVars.join(', ')}\n\n` +
    `Please check that .env.local exists and restart the dev server.`
  );
}

// Local emulator mode — enabled by `npm run dev` (scripts/dev-emulator.mjs).
// In this mode the app talks to the Firebase Emulator Suite on this machine and
// NEVER to the live project. A "demo-" project ID is enforced: Firebase treats
// demo-* projects as emulator-only, so nothing can reach production.
export const USE_FIREBASE_EMULATOR = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";
const EMULATOR_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_PROJECT_ID || "demo-ledger";

if (USE_FIREBASE_EMULATOR && !EMULATOR_PROJECT_ID.startsWith("demo-")) {
  throw new Error(
    `Emulator mode requires a "demo-" project ID (got "${EMULATOR_PROJECT_ID}") so it can never touch production.`
  );
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: USE_FIREBASE_EMULATOR ? EMULATOR_PROJECT_ID : process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!
};

const app = initializeApp(firebaseConfig);

// ⭐ Offline Firestore using the NEW, SAFE API
// In emulator mode use an in-memory cache, so emulator data and queued writes are
// never stored in the browser's IndexedDB alongside the live app's offline cache.
export const db = initializeFirestore(
  app,
  USE_FIREBASE_EMULATOR
    ? { localCache: memoryLocalCache() }
    : {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager() // <-- FIXED (no argument required)
        }),
      }
);

// Auth
export const auth = getAuth(app);

if (USE_FIREBASE_EMULATOR) {
  connectFirestoreEmulator(db, "127.0.0.1", 8085);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  if (typeof window !== "undefined") {
    console.warn(`🧪 Firebase EMULATOR mode (project "${EMULATOR_PROJECT_ID}") — not connected to the live database.`);
  }
}
