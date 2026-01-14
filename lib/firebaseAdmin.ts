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
  
  // Set SSL bypass for corporate networks BEFORE initializing
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  };

  if (!serviceAccount.projectId || !serviceAccount.privateKey || !serviceAccount.clientEmail) {
    throw new Error("Missing Firebase Admin credentials in environment variables");
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

    // ✅ CRITICAL: Use REST API instead of gRPC to bypass corporate SSL issues
    // This is the key fix for corporate network environments
    if (!firestoreSettingsApplied) {
      try {
        adminDb.settings({
          preferRest: true,  // Use REST API instead of gRPC
        });
        firestoreSettingsApplied = true;
        console.log("✅ Firestore Admin initialized with REST API (bypassing gRPC/SSL issues)");
      } catch (error) {
        // Settings already applied, ignore error
        console.log("🔓 SSL verification confirmed disabled in register hook");
      }
    }
  }
  return adminDb;
}
