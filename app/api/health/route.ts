/**
 * Health check endpoint to verify Firebase Admin SDK initialization
 */

import { NextResponse } from "next/server";
import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export async function GET() {
  try {
    console.log("🔍 Health check called");

    // Check environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    console.log("📋 Environment variables:");
    console.log("  Project ID:", projectId ? "✅" : "❌ Missing");
    console.log("  Client Email:", clientEmail ? "✅" : "❌ Missing");
    console.log("  Private Key:", privateKey ? `✅ (${privateKey.length} chars)` : "❌ Missing");

    if (!projectId || !clientEmail || !privateKey) {
      return NextResponse.json(
        {
          status: "error",
          message: "Missing Firebase credentials",
          missing: {
            projectId: !projectId,
            clientEmail: !clientEmail,
            privateKey: !privateKey,
          },
        },
        { status: 500 }
      );
    }

    // Try to initialize Firebase Admin SDK
    const apps = getApps();
    let adminApp: App | undefined = apps.find((app: App) => app?.name === "default");

    if (!adminApp) {
      const serviceAccount = {
        projectId,
        privateKey: privateKey.replace(/\\n/g, "\n"),
        clientEmail,
      };

      console.log("🔧 Initializing Firebase Admin SDK...");
      try {
        adminApp = initializeApp({
          credential: cert(serviceAccount as any),
        });
        console.log("✅ Firebase Admin SDK initialized");
      } catch (initError: any) {
        if (initError.code === "app/invalid-app-options") {
          console.log("⚠️ App already initialized, getting existing app");
          adminApp = apps[0];
        } else {
          throw initError;
        }
      }
    } else {
      console.log("✅ Firebase Admin SDK already initialized");
    }

    // Try to get Firestore
    getFirestore(adminApp);
    console.log("✅ Firestore client obtained");

    // Try to get Auth
    getAuth(adminApp);
    console.log("✅ Auth client obtained");

    return NextResponse.json(
      {
        status: "ok",
        message: "Firebase Admin SDK is properly initialized",
        projectId,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("❌ Health check failed:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error.message || "Health check failed",
        error: error.code || error.name,
      },
      { status: 500 }
    );
  }
}
