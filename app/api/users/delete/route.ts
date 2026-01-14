/**
 * API Route: DELETE /api/users/delete
 * Deletes a user from Firebase Auth and Firestore
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

interface DeleteUserRequest {
  uid: string;
}

interface DeleteUserResponse {
  success: boolean;
  message: string;
  error?: string;
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    logger.info("📨 DELETE /api/users/delete called");

    const rateLimitResponse = await applyRateLimit(request, 3);
    if (rateLimitResponse) return rateLimitResponse;

    const adminVerification = await requireAdmin(request);
    if (adminVerification.errorResponse) return adminVerification.errorResponse;
    const { decodedToken, businessId: adminBusinessId } = adminVerification.result!;

    logger.info(`✅ Admin verified, businessId: ${adminBusinessId}`);

    // Parse request body
    const body: DeleteUserRequest = await request.json();
    const { uid } = body;

    if (!uid) {
      return NextResponse.json(
        { success: false, message: "User ID is required", error: "Bad Request" },
        { status: 400 }
      );
    }

    // Prevent self-deletion
    if (uid === decodedToken.uid) {
      return NextResponse.json(
        { success: false, message: "You cannot delete your own account", error: "Bad Request" },
        { status: 400 }
      );
    }

    // Verify user belongs to same business (tenant isolation)
    const userRecord = await adminAuth.getUser(uid);
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
      logger.warn("Admin attempted to delete user from different business");
      return NextResponse.json(
        { success: false, message: "You can only delete users from your own business", error: "Forbidden" },
        { status: 403 }
      );
    }

    const targetEmail = userRecord.email ?? undefined;

    // Delete from Firestore first
    logger.info("🗑️ Deleting user from Firestore...");
    try {
      await adminDb.collection("users").doc(uid).delete();
      logger.info("✅ User deleted from Firestore");
    } catch (error) {
      logger.error("❌ Failed to delete from Firestore:", error);
      // Continue anyway to try deleting from Auth
    }

    // Delete from Firebase Auth
    logger.info("🗑️ Deleting user from Firebase Auth...");
    await adminAuth.deleteUser(uid);
    logger.info("✅ User deleted from Firebase Auth");

    // ✅ AUDIT LOG: Log successful user deletion
    await logAuditEventServer(
      AuditAction.USER_DELETED,
      decodedToken.uid,
      createAuditDetails(
        request,
        true,
        uid,
        targetEmail,
        undefined,
        undefined
      )
    );

    return NextResponse.json(
      {
        success: true,
        message: "User deleted successfully",
      },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error("❌ Error deleting user:", error);

    let userMessage = "Failed to delete user. Please try again.";
    let statusCode = 500;
    
    if (error.code === 'auth/user-not-found') {
      userMessage = "User not found.";
      statusCode = 404;
    }

    return NextResponse.json(
      {
        success: false,
        message: userMessage,
        error: "User Deletion Failed",
      },
      { status: statusCode }
    );
  }
}

