/**
 * API Route: POST /api/users/create
 * Creates a new user with Firebase Auth and Firestore
 * Requires admin authentication
 * Preserves admin session (unlike client-side createUserWithEmailAndPassword)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";
import { UserRole, DEFAULT_ROLE } from "@/lib/roles";
import {
  validateEmail,
  validateDisplayName,
  validatePassword,
  validateRole,
  sanitizeDisplayName,
  sanitizeEmail
} from "@/lib/validation";
import { logger } from "@/lib/logger";
import { logAuditEventServer, AuditAction, createAuditDetails } from "@/lib/auditLogServer";
import { requireAdmin } from "@/lib/adminAuth";
import { applyStrictRateLimit } from "@/lib/rateLimiterEnhanced";
import { sendPasswordResetEmail } from "@/lib/emailService";

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
  resetLink?: string;
  message: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<CreateUserResponse>> {
  let createdUserUid: string | undefined;
  let decodedToken: any;
  let requestBody: any;
  let resetLink: string | null = null;
  let usedTempPassword = false;

  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminFirestore();

    logger.info("📨 POST /api/users/create called");

    const rateLimitResponse = await applyStrictRateLimit(request);
    if (rateLimitResponse) return rateLimitResponse as NextResponse<CreateUserResponse>;

    const adminVerification = await requireAdmin(request);
    if (adminVerification.errorResponse) return adminVerification.errorResponse as NextResponse<CreateUserResponse>;
    decodedToken = adminVerification.result!.decodedToken;
    const { businessId: adminBusinessId, source: adminSource } = adminVerification.result!;

    // ✅ FIX: For legacy admins without businessId, use their UID as businessId
    let businessId = adminBusinessId;
    if (!businessId) {
      logger.warn("⚠️ Admin has no businessId, using UID as fallback");
      businessId = decodedToken.uid;

      // Auto-fix: Update admin's custom claims with businessId
      try {
        await adminAuth.setCustomUserClaims(decodedToken.uid, {
          role: UserRole.ADMIN,
          admin: true,
          businessId: decodedToken.uid
        });
        logger.info("✅ Auto-set businessId in custom claims");
      } catch (e) {
        logger.warn("⚠️ Could not auto-set businessId in custom claims");
      }

      // Auto-fix: Update admin's Firestore document with businessId
      try {
        await adminDb.collection("users").doc(decodedToken.uid).update({
          businessId: decodedToken.uid
        });
        logger.info("✅ Auto-set businessId in Firestore");
      } catch (e) {
        logger.warn("⚠️ Could not auto-set businessId in Firestore");
      }
    }
    
    logger.info(`✅ Admin verified via ${adminSource}, businessId: ${businessId}`);

    // Parse request body
    requestBody = await request.json();
    const { email, displayName, role, password } = requestBody;

    // ✅ SECURITY FIX: Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      logger.warn("❌ Invalid email:", emailValidation.error);
      return NextResponse.json(
        { success: false, message: emailValidation.error!, error: "Bad Request" },
        { status: 400 }
      );
    }

    // ✅ SECURITY FIX: Validate and sanitize display name
    const displayNameValidation = validateDisplayName(displayName);
    if (!displayNameValidation.valid) {
      logger.warn("❌ Invalid display name:", displayNameValidation.error);
      return NextResponse.json(
        { success: false, message: displayNameValidation.error!, error: "Bad Request" },
        { status: 400 }
      );
    }
    const sanitizedDisplayName = sanitizeDisplayName(displayName);

    // ✅ SECURITY FIX: Validate role
    const roleValidation = validateRole(role);
    if (!roleValidation.valid) {
      logger.warn("❌ Invalid role:", roleValidation.error);
      return NextResponse.json(
        { success: false, message: roleValidation.error!, error: "Bad Request" },
        { status: 400 }
      );
    }

    // ✅ SECURITY FIX: Validate password if provided
    if (password) {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        logger.warn("❌ Weak password provided");
        return NextResponse.json(
          { success: false, message: passwordValidation.error!, error: "Bad Request" },
          { status: 400 }
        );
      }
    }

    // Create user in Firebase Auth with sanitized data
    const buildTempPassword = () => {
      const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const lower = "abcdefghijklmnopqrstuvwxyz";
      const nums = "0123456789";
      const all = upper + lower + nums;
      const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
      let pwd = pick(upper) + pick(lower) + pick(nums);
      while (pwd.length < 14) {
        pwd += pick(all);
      }
      return pwd;
    };

    const effectivePassword = password || buildTempPassword();
    usedTempPassword = !password;

    logger.info("🔐 Creating user in Firebase Auth...");
    const sanitizedEmail = sanitizeEmail(email);
    const userRecord = await adminAuth.createUser({
      email: sanitizedEmail,
      displayName: sanitizedDisplayName,
      password: effectivePassword,
      disabled: false,
      emailVerified: false,
    });
    createdUserUid = userRecord.uid;
    logger.info("✅ User created in Firebase Auth:", userRecord.uid);

    // Store role AND createdBy in custom claims with rollback on failure
    // createdBy is used for tenant isolation - users only see users they created
    // businessId is the TENANT BOUNDARY - all data must be scoped by this
    try {
      const customClaims: any = {
        role,
        createdBy: decodedToken.uid,  // Track which admin created this user
        businessId: businessId,  // ✅ TENANT BOUNDARY - same business as admin
      };
      if (role === UserRole.ADMIN) {
        customClaims.admin = true;
      }
      await adminAuth.setCustomUserClaims(userRecord.uid, customClaims);
      logger.info("✅ Custom claims set with role:", role, "businessId:", businessId);
    } catch (e) {
      logger.error("❌ Could not set custom claims, rolling back user creation");
      try {
        await adminAuth.deleteUser(userRecord.uid);
        logger.info("✅ User creation rolled back successfully");
      } catch (deleteError) {
        logger.error("❌ Failed to rollback user creation:", deleteError);
      }
      return NextResponse.json(
        { success: false, message: "Failed to assign user role. User creation rolled back.", error: "Internal Server Error" },
        { status: 500 }
      );
    }

    // ✅ FIX: Create Firestore user document immediately
    // This ensures the user appears in the user list right away
    logger.info("📝 Creating Firestore user document...");
    try {
      const userDocData = {
        uid: userRecord.uid,
        email: sanitizedEmail,
        displayName: sanitizedDisplayName,
        role,
        status: "active", // UserStatus.ACTIVE
        businessId: businessId,
        createdBy: decodedToken.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      };

      await adminDb.collection("users").doc(userRecord.uid).set(userDocData);
      logger.info("✅ Firestore user document created successfully");
    } catch (firestoreError) {
      logger.error("❌ Could not create Firestore document, rolling back user creation");
      try {
        await adminAuth.deleteUser(userRecord.uid);
        logger.info("✅ User creation rolled back successfully");
      } catch (deleteError) {
        logger.error("❌ Failed to rollback user creation:", deleteError);
      }
      return NextResponse.json(
        { success: false, message: "Failed to create user profile. User creation rolled back.", error: "Internal Server Error" },
        { status: 500 }
      );
    }

    // ✅ SECURITY: Generate password reset link and send via EMAIL ONLY (never in response/logs)
    if (usedTempPassword) {
      try {
        const resetLink = await adminAuth.generatePasswordResetLink(sanitizedEmail);
        
        // Send password reset email securely
        await sendPasswordResetEmail(sanitizedEmail, resetLink, sanitizedDisplayName);
        logger.info("✅ Password reset email sent successfully");
      } catch (emailError) {
        logger.error("❌ Failed to send password reset email:", emailError);
        // Don't fail user creation if email fails - admin can resend manually
      }
    }

    // ✅ AUDIT LOG: Log successful user creation
    await logAuditEventServer(
      AuditAction.USER_CREATED,
      decodedToken.uid,
      createAuditDetails(
        request,
        true,
        userRecord.uid,
        sanitizedEmail,
        { role, displayName: sanitizedDisplayName, businessId },
        undefined
      )
    );

    return NextResponse.json(
      {
        success: true,
        uid: userRecord.uid,
        email: sanitizedEmail,
        displayName: sanitizedDisplayName,
        role,
        message: usedTempPassword
          ? `User ${sanitizedEmail} created successfully. Password reset email sent to ${sanitizedEmail}.`
          : `User ${sanitizedEmail} created successfully with provided password.`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    logger.error("❌ Error creating user:", error);

    let userMessage = "Failed to create user. Please try again.";
    let statusCode = 500;

    if (error.code === 'auth/email-already-exists') {
      userMessage = "A user with this email already exists.";
      statusCode = 400;
    } else if (error.code === 'auth/invalid-email') {
      userMessage = "Invalid email address.";
      statusCode = 400;
    } else if (error.code === 'auth/weak-password') {
      userMessage = "Password does not meet security requirements.";
      statusCode = 400;
    }

    // ✅ AUDIT LOG: Log failed user creation
    try {
      await logAuditEventServer(
        AuditAction.USER_CREATED,
        decodedToken?.uid || 'unknown',
        createAuditDetails(
          request,
          false,
          createdUserUid,
          requestBody?.email,
          { role: requestBody?.role, displayName: requestBody?.displayName },
          error.code || error.message
        )
      );
    } catch (auditError) {
      logger.error("❌ Failed to log audit event:", auditError);
    }

    return NextResponse.json(
      {
        success: false,
        message: userMessage,
        error: "User Creation Failed",
      },
      { status: statusCode }
    );
  }
}
