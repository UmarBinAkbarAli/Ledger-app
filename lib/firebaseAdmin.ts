/**
 * Shared Firebase Admin SDK initialization
 * This prevents the "app already exists" error across API routes
 * 
 * IMPORTANT: Uses REST API instead of gRPC to bypass corporate SSL interception
 */

import { initializeApp, cert, getApps, getApp, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";

// Global singleton for admin app
let adminApp: App | null = null;
let adminAuth: Auth | null = null;
let adminDb: Firestore | null = null;
let firestoreSettingsApplied = false;

function initializeAdminApp(): App {
  const apps = getApps();
  
  if (apps.length > 0) {
    return getApp();
  }

  // Local emulator mode (set by scripts/dev-emulator.mjs). The Admin SDK routes all
  // Firestore/Auth calls to the emulators when these env vars are set; we also
  // initialize WITHOUT production credentials and require a "demo-" project ID,
  // so a misconfiguration fails instead of reaching the live project.
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    const projectId = process.env.FIREBASE_EMULATOR_PROJECT_ID || "demo-ledger";
    if (!projectId.startsWith("demo-")) {
      throw new Error(`Emulator mode requires a "demo-" project ID (got "${projectId}").`);
    }
    if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      throw new Error("Emulator mode needs BOTH FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST set.");
    }
    console.log(`🧪 Firebase Admin using local emulators (project "${projectId}")`);
    return initializeApp({ projectId });
  }

  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  };

  if (!serviceAccount.projectId || !serviceAccount.privateKey || !serviceAccount.clientEmail) {
    console.error("❌ Missing Firebase Admin credentials");
    throw new Error("Missing Firebase Admin credentials in environment variables. Check .env.local file.");
  }

  return initializeApp({
    credential: cert(serviceAccount as any),
  });
}

export function getAdminApp(): App {
  if (!adminApp) {
    adminApp = initializeAdminApp();
  }
  return adminApp;
}

export function getAdminAuth(): Auth {
  if (!adminAuth) {
    adminAuth = getAuth(getAdminApp());
  }
  return adminAuth;
}

export function getAdminFirestore(): Firestore {
  if (!adminDb) {
    adminDb = getFirestore(getAdminApp());

    // ✅ Use REST API instead of gRPC for better corporate network compatibility
    // This avoids SSL certificate issues without disabling security
    if (!firestoreSettingsApplied) {
      try {
        adminDb.settings({
          preferRest: true,  // Use REST API instead of gRPC
          ignoreUndefinedProperties: true, // Ignore undefined values
        });
        firestoreSettingsApplied = true;
        console.log("✅ Firestore Admin initialized with REST API");
      } catch (error) {
        console.warn("⚠️ Firestore settings already applied");
      }
    }
  }
  return adminDb;
}
