/**
 * API Route: POST /api/users/update-role
 * Updates a user's role in both Firestore AND custom claims
 * Requires admin authentication
 * 
 * CRITICAL: This endpoint ensures role changes take effect immediately
 * by syncing Firestore role with Firebase Auth custom claims
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";
import { UserRole } from "@/lib/roles";
import { logger } from "@/lib/logger";
import { logAuditEventServer, AuditAction, createAuditDetails } from "@/lib/auditLogServer";
import { requireAdmin } from "@/lib/adminAuth";
import { applyRateLimit } from "@/lib/rateLimiter";
import { isSameTenant, resolveTargetTenantInfo } from "@/lib/tenantAccess";

interface UpdateRoleRequest {
  uid: string;
  role: UserRole;
}

interface UpdateRoleResponse {
  success: boolean;
  message: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminFirestore();

    logger.info("📨 POST /api/users/update-role called");

    const rateLimitResponse = await applyRateLimit(request, 2);
    if (rateLimitResponse) return rateLimitResponse;

    const adminVerification = await requireAdmin(request);
    if (adminVerification.errorResponse) return adminVerification.errorResponse;
    const { decodedToken, businessId: adminBusinessId } = adminVerification.result!;

    logger.info(`✅ Admin verified, businessId: ${adminBusinessId}`);

    // Parse request body
    const body: UpdateRoleRequest = await request.json();
    const { uid, role } = body;

    if (!uid || !role) {
      return NextResponse.json(
        { success: false, message: "User ID and role are required", error: "Bad Request" },
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

    // Prevent self-role change
    if (uid === decodedToken.uid) {
      return NextResponse.json(
        { success: false, message: "You cannot change your own role", error: "Bad Request" },
        { status: 400 }
      );
    }

    // Get user to verify they exist
    logger.info("Fetching user from Firebase Auth...");
    const userRecord = await adminAuth.getUser(uid);

    // Verify tenant match and preserve businessId
    const userDoc = await adminDb.collection("users").doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() || {} : null;
    let { businessId: targetBusinessId, createdBy: targetCreatedBy } =
      resolveTargetTenantInfo(userData, userRecord);

    // Backfill missing businessId using admin's businessId when allowed
    if (!targetBusinessId && adminBusinessId) {
      targetBusinessId = adminBusinessId;
    }

    if (
      !isSameTenant({
        adminBusinessId,
        adminUid: decodedToken.uid,
        targetBusinessId,
        targetCreatedBy,
      })
    ) {
      return NextResponse.json(
        { success: false, message: "You can only update users in your business", error: "Forbidden" },
        { status: 403 }
      );
    }
    logger.info("User found:", userRecord.email);

    // Update custom claims (preserve businessId/createdBy)
    logger.info("Updating custom claims...");
    const existingClaims = (userRecord.customClaims || {}) as Record<string, any>;
    const customClaims: Record<string, any> = {
      ...existingClaims,
      role,
      admin: role === UserRole.ADMIN,
    };

    if (targetBusinessId) {
      customClaims.businessId = targetBusinessId;
    }
    if (targetCreatedBy) {
      customClaims.createdBy = targetCreatedBy;
    }

    await adminAuth.setCustomUserClaims(uid, customClaims);
    logger.info("Custom claims updated");

    if (userDoc.exists) {
      const updatePayload: Record<string, any> = {
        role,
        updatedAt: new Date(),
      };
      if (targetBusinessId && !userData?.businessId) {
        updatePayload.businessId = targetBusinessId;
      }
      await adminDb.collection("users").doc(uid).update(updatePayload);
    }


    // ✅ AUDIT LOG: Log role change
    await logAuditEventServer(
      AuditAction.ROLE_CHANGED,
      decodedToken.uid,
      createAuditDetails(
        request,
        true,
        uid,
        userRecord.email,
        { newRole: role },
        undefined
      )
    );

    return NextResponse.json(
      {
        success: true,
        message: `Role updated to ${role}. User must log out and log back in for changes to take full effect.`,
      },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error("❌ Error updating role:", error);

    let userMessage = "Failed to update role. Please try again.";
    let statusCode = 500;
    
    if (error.code === 'auth/user-not-found') {
      userMessage = "User not found.";
      statusCode = 404;
    }

    return NextResponse.json(
      {
        success: false,
        message: userMessage,
        error: "Role Update Failed",
      },
      { status: statusCode }
    );
  }
}

