/**
 * API Route: POST /api/users/create
 * Creates a new user with Firebase Auth and Firestore
 * Requires admin authentication
 * Preserves admin session (unlike client-side createUserWithEmailAndPassword)
 */

import { NextRequest, NextResponse } from "next/server";
import { UserRole, DEFAULT_ROLE } from "@/lib/roles";
import { UserStatus } from "@/lib/userSchema";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";

interface CreateUserRequest {
  email: string;
  displayName: string;
  role: UserRole;
  password?: string; // optional; if not provided, user must reset password
}

interface CreateUserResponse {
  success: boolean;
  uid?: string;
  email?: string;
  displayName?: string;
  role?: UserRole;
  message: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<CreateUserResponse>> {
  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminFirestore();

    // Get the ID token from Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, message: "Missing or invalid authorization header", error: "Unauthorized" },
        { status: 401 }
      );
    }

    const idToken = authHeader.substring(7);

    // Verify the token and get the user
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (error) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired token", error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if the requester is an admin
    const requesterDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
    if (!requesterDoc.exists || requesterDoc.data()?.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { success: false, message: "Only admins can create users", error: "Forbidden" },
        { status: 403 }
      );
    }

    // Parse request body
    const body: CreateUserRequest = await request.json();
    const { email, displayName, role, password } = body;

    // Validate required fields
    if (!email || !displayName) {
      return NextResponse.json(
        { success: false, message: "Email and displayName are required", error: "Bad Request" },
        { status: 400 }
      );
    }

    // Validate role
    if (!Object.values(UserRole).includes(role)) {
      return NextResponse.json(
        { success: false, message: `Invalid role: ${role}`, error: "Bad Request" },
        { status: 400 }
      );
    }

    // Create user in Firebase Auth
    const userRecord = await adminAuth.createUser({
      email,
      displayName,
      password: password || undefined, // let Firebase generate temp password if not provided
      disabled: false,
    });

    // Create user document in Firestore
    await adminDb.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      displayName,
      role,
      status: UserStatus.ACTIVE,
      createdAt: new Date(),
      createdBy: decodedToken.uid,
      metadata: {},
    });

    return NextResponse.json(
      {
        success: true,
        uid: userRecord.uid,
        email,
        displayName,
        role,
        message: `User ${email} created successfully`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating user:", error);

    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to create user",
        error: error.code || "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
