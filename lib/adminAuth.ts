import { NextRequest, NextResponse } from "next/server";
import { DecodedIdToken } from "firebase-admin/auth";
import { getAdminAuth, getAdminFirestore } from "./firebaseAdmin";
import { UserRole } from "./roles";
import { logger } from "./logger";

export type AdminSource = "custom_claims" | "firestore" | "none";

export interface AdminVerificationResult {
  isAdmin: boolean;
  businessId: string | null;
  source: AdminSource;
  decodedToken: DecodedIdToken;
}

export function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

async function resolveBusinessId(
  decodedToken: DecodedIdToken,
  userData?: Record<string, any>
): Promise<string | null> {
  if (decodedToken.businessId) {
    return decodedToken.businessId as string;
  }
  if (userData?.businessId) {
    return userData.businessId as string;
  }
  // Fallback to UID for legacy users (preserves access boundary)
  return decodedToken.uid;
}

async function verifyAdmin(
  adminAuth: ReturnType<typeof getAdminAuth>,
  adminDb: ReturnType<typeof getAdminFirestore>,
  decodedToken: DecodedIdToken
): Promise<AdminVerificationResult> {
  // Fast path: custom claims
  if (decodedToken.admin === true || decodedToken.role === UserRole.ADMIN) {
    const businessId = await resolveBusinessId(decodedToken);
    return { isAdmin: true, businessId, source: "custom_claims", decodedToken };
  }

  // Fallback: Firestore lookup (for legacy users without claims)
  try {
    const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
    if (userDoc.exists) {
      const userData = userDoc.data() || {};
      const firestoreRole = userData.role;
      const businessId = await resolveBusinessId(decodedToken, userData);

      if (firestoreRole === "admin" || firestoreRole === UserRole.ADMIN) {
        // Auto-heal: set custom claims so future checks are faster
        try {
          await adminAuth.setCustomUserClaims(decodedToken.uid, {
            role: UserRole.ADMIN,
            admin: true,
            businessId,
          });
          logger.info("✅ Auto-set custom claims for admin user");
        } catch (claimsError) {
          logger.warn("⚠️ Could not auto-set custom claims for admin user", claimsError);
        }

        return { isAdmin: true, businessId, source: "firestore", decodedToken };
      }

      return { isAdmin: false, businessId: null, source: "firestore", decodedToken };
    }
  } catch (firestoreError) {
    logger.warn("⚠️ Firestore admin check failed", firestoreError);
  }

  return { isAdmin: false, businessId: null, source: "none", decodedToken };
}

export async function requireAdmin(
  request: NextRequest
): Promise<{ result?: AdminVerificationResult; errorResponse?: NextResponse }> {
  const adminAuth = getAdminAuth();
  const adminDb = getAdminFirestore();

  const idToken = extractBearerToken(request);
  if (!idToken) {
    return {
      errorResponse: NextResponse.json(
        { success: false, message: "Missing or invalid authorization header", error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  let decodedToken: DecodedIdToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(idToken);
  } catch (error) {
    logger.error("❌ Token verification failed", error);
    return {
      errorResponse: NextResponse.json(
        { success: false, message: "Invalid or expired token", error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  const adminResult = await verifyAdmin(adminAuth, adminDb, decodedToken);
  if (!adminResult.isAdmin) {
    return {
      errorResponse: NextResponse.json(
        { success: false, message: "Only administrators can perform this action", error: "Forbidden" },
        { status: 403 }
      ),
    };
  }

  return { result: adminResult };
}
