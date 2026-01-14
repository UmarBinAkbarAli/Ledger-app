/**
 * API Route: GET /api/users/list-auth
 * Lists all Firebase Auth users (for admin to see created users before first login)
 * Requires admin authentication
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";
import { logger } from "@/lib/logger";
import { requireAdmin } from "@/lib/adminAuth";
import { applyRateLimit } from "@/lib/rateLimiter";
import { isSameTenant, resolveTargetTenantInfo } from "@/lib/tenantAccess";

const adminAuth = getAdminAuth();
const adminDb = getAdminFirestore();

interface AuthUser {
  uid: string;
  email: string;
  displayName?: string;
  role?: string;
  createdBy?: string;
  businessId?: string;
  createdAt: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    logger.info("📨 GET /api/users/list-auth called");

    const rateLimitResponse = await applyRateLimit(request, 1);
    if (rateLimitResponse) return rateLimitResponse;

    const adminVerification = await requireAdmin(request);
    if (adminVerification.errorResponse) return adminVerification.errorResponse;
    const { decodedToken, businessId: adminBusinessId } = adminVerification.result!;

    logger.info("✅ Admin user verified, listing Auth users");

    // Get all Auth users (paginated)

    if (!adminBusinessId) {
      return NextResponse.json(
        { success: false, message: "Missing business context", error: "Forbidden" },
        { status: 403 }
      );
    }

    const businessUserIds = new Set<string>();
    try {
      const businessUsersSnap = await adminDb
        .collection("users")
        .where("businessId", "==", adminBusinessId)
        .get();
      businessUsersSnap.forEach((docSnap) => businessUserIds.add(docSnap.id));
    } catch (error: any) {
      logger.warn("Could not load business users for Auth filtering:", error.message);
    }

    const authUsers: AuthUser[] = [];
    let pageToken: string | undefined;

    try {
      do {
        const listUsersResult = await adminAuth.listUsers(1000, pageToken);
        
        for (const userRecord of listUsersResult.users) {
          const { businessId: targetBusinessId, createdBy: targetCreatedBy } =
            resolveTargetTenantInfo(undefined, userRecord);
          const isInBusinessUsers = businessUserIds.has(userRecord.uid);

          if (
            !isInBusinessUsers &&
            !isSameTenant({
              adminBusinessId,
              adminUid: decodedToken.uid,
              targetBusinessId,
              targetCreatedBy,
            })
          ) {
            continue;
          }

          if (!isInBusinessUsers && targetBusinessId) {
            try {
              const userDoc = await adminDb.collection("users").doc(userRecord.uid).get();
              if (userDoc.exists) {
                const userData = userDoc.data() || {};
                if (userData.businessId && userData.businessId !== adminBusinessId) {
                  continue;
                }
              }
            } catch (error: any) {
              logger.warn("Could not confirm Auth user businessId:", error.message);
            }
          }
          authUsers.push({
            uid: userRecord.uid,
            email: userRecord.email || "no-email",
            displayName: userRecord.displayName,
            role: (userRecord.customClaims?.role as string) || undefined,
            createdBy: (userRecord.customClaims?.createdBy as string) || undefined,
            businessId: (userRecord.customClaims?.businessId as string) || undefined,
            createdAt: new Date(userRecord.metadata.creationTime || 0).toISOString(),
          });
        }

        pageToken = listUsersResult.pageToken;
      } while (pageToken);

      logger.info(`✅ Listed ${authUsers.length} Auth users`);
    } catch (error: any) {
      logger.warn("⚠️ Could not list Auth users (may be gRPC issue):", error.message);
      // Return empty list if we can't access Auth users via gRPC
      return NextResponse.json(
        { success: true, users: [], message: "Could not fetch Auth users due to connection issues" },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { success: true, users: authUsers },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error("❌ Error listing Auth users:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to list Auth users" },
      { status: 500 }
    );
  }
}
