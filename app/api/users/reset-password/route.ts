/**
 * API Route: POST /api/users/reset-password
 * Generates a password reset link for a user
 * Requires admin authentication
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";
import { logger } from "@/lib/logger";
import { logAuditEventServer, AuditAction, createAuditDetails } from "@/lib/auditLogServer";
import { requireAdmin } from "@/lib/adminAuth";
import { applyRateLimit } from "@/lib/rateLimiter";
import { isSameTenant, resolveTargetTenantInfo } from "@/lib/tenantAccess";

const adminAuth = getAdminAuth();
const adminDb = getAdminFirestore();

interface ResetPasswordRequest {
  uid: string;
}

interface ResetPasswordResponse {
  success: boolean;
  message: string;
  resetLink?: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<ResetPasswordResponse>> {
  try {
    logger.info("📨 POST /api/users/reset-password called");

    const rateLimitResponse = await applyRateLimit(request, 3);
    if (rateLimitResponse) return rateLimitResponse;

    const adminVerification = await requireAdmin(request);
    if (adminVerification.errorResponse) return adminVerification.errorResponse;
    const { decodedToken, businessId: adminBusinessId } = adminVerification.result!;

    logger.info(`✅ Admin verified, businessId: ${adminBusinessId}`);

    // Parse request body
    const body: ResetPasswordRequest = await request.json();
    const { uid } = body;

    if (!uid) {
      return NextResponse.json(
        { success: false, message: "User ID is required", error: "Bad Request" },
        { status: 400 }
      );
    }

    // Get user email
    const userRecord = await adminAuth.getUser(uid);
    if (!userRecord.email) {
      return NextResponse.json(
        { success: false, message: "User has no email address", error: "Bad Request" },
        { status: 400 }
      );
    }

    // Verify user belongs to same business (tenant isolation)
    const userDoc = await adminDb.collection("users").doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() || {} : null;
    const { businessId: targetBusinessId, createdBy: targetCreatedBy } =
      resolveTargetTenantInfo(userData, userRecord);

    if (
      !isSameTenant({
        adminBusinessId,
        adminUid: decodedToken.uid,
        targetBusinessId,
        targetCreatedBy,
      })
    ) {
      logger.warn("Admin attempted to reset password for user from different business");
      return NextResponse.json(
        { success: false, message: "You can only reset passwords for users from your own business", error: "Forbidden" },
        { status: 403 }
      );
    }

    logger.info("🔑 Generating password reset link...");
    const resetLink = await adminAuth.generatePasswordResetLink(userRecord.email);
    logger.info("✅ Password reset link generated");

    // TODO: Send email with reset link
    // await sendPasswordResetEmail(userRecord.email, resetLink);

    // Return reset link to authenticated admin caller

    // ✅ AUDIT LOG: Log password reset
    await logAuditEventServer(
      AuditAction.PASSWORD_RESET,
      decodedToken.uid,
      createAuditDetails(
        request,
        true,
        uid,
        userRecord.email,
        undefined,
        undefined
      )
    );

    return NextResponse.json(
      {
        success: true,
        message: `Password reset email sent to ${userRecord.email}`,
        resetLink,
      },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error("❌ Error generating password reset link:", error);

    let userMessage = "Failed to generate password reset link. Please try again.";
    let statusCode = 500;
    
    if (error.code === 'auth/user-not-found') {
      userMessage = "User not found.";
      statusCode = 404;
    }

    return NextResponse.json(
      {
        success: false,
        message: userMessage,
        error: "Password Reset Failed",
      },
      { status: statusCode }
    );
  }
}

