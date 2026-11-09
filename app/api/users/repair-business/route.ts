/**
 * API Route: POST /api/users/repair-business
 * Backfills missing businessId in Firestore and custom claims for a user.
 * Requires admin authentication.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import { isSameTenant, resolveTargetTenantInfo } from "@/lib/tenantAccess";
import { UserRole } from "@/lib/roles";

interface RepairBusinessRequest {
  uid?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // ✅ DEVELOPMENT ONLY: SSL bypass for corporate networks with self-signed certificates
    if (process.env.NODE_ENV === 'development') {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }
    
    const adminAuth = getAdminAuth();
    const adminDb = getAdminFirestore();

    const adminVerification = await requireAdmin(request);
    if (adminVerification.errorResponse) return adminVerification.errorResponse;
    const { decodedToken, businessId: adminBusinessId } = adminVerification.result!;

    const body: RepairBusinessRequest = await request.json();
    const targetUid = body.uid || decodedToken.uid;
    
    // ✅ SAFETY CHECK: Validate that we're only repairing the requester's own account or their employees
    if (targetUid !== decodedToken.uid) {
      // If repairing someone else, they must be an employee of this admin
      if (!adminBusinessId) {
        return NextResponse.json(
          { success: false, message: "Missing business context", error: "Forbidden" },
          { status: 403 }
        );
      }
    }

    // ✅ SAFETY: Get current data BEFORE making any changes
    const userRecord = await adminAuth.getUser(targetUid);
    const userDoc = await adminDb.collection("users").doc(targetUid).get();
    const userData = userDoc.exists ? userDoc.data() || {} : {};
    
    console.log("📋 Repair request for:", targetUid);
    console.log("📋 Original Firestore businessId:", userData.businessId);
    console.log("📋 Original Claims businessId:", userRecord.customClaims?.businessId);

    const targetTenantInfo = resolveTargetTenantInfo(userData, userRecord);
    let targetBusinessId = targetTenantInfo.businessId;
    const targetCreatedBy = targetTenantInfo.createdBy;

    // ✅ LOGIC: Determine the correct businessId
    // Priority: Firestore businessId > Admin businessId > User's own UID (for self-created admins)
    if (!targetBusinessId) {
      if (userData.businessId) {
        // Use Firestore businessId if it exists
        targetBusinessId = userData.businessId;
      } else if (adminBusinessId) {
        // Use admin's businessId for employee
        targetBusinessId = adminBusinessId;
      } else {
        // For self-repair of legacy admin, use their own UID
        targetBusinessId = targetUid;
      }
    }
    
    console.log("📋 Target businessId to set:", targetBusinessId);
    
    // ✅ SAFETY: Verify tenant access (skip for self-repair)
    if (targetUid !== decodedToken.uid) {
      if (
        !isSameTenant({
          adminBusinessId,
          adminUid: decodedToken.uid,
          targetBusinessId,
          targetCreatedBy,
        })
      ) {
        return NextResponse.json(
          { success: false, message: "You can only repair users in your business", error: "Forbidden" },
          { status: 403 }
        );
      }
    }

    const existingClaims = (userRecord.customClaims || {}) as Record<string, any>;
    const roleFromDoc = (userData.role as string) || null;
    const roleFromClaims = (existingClaims.role as string) || null;
    const effectiveRole = (roleFromDoc || roleFromClaims || UserRole.DELIVERY_CHALLAN) as UserRole;

    // ✅ SAFETY: Build new claims preserving ALL existing data
    const newClaims = {
      ...existingClaims, // Preserve ALL existing claims
      role: effectiveRole,
      admin: effectiveRole === UserRole.ADMIN,
      businessId: targetBusinessId,
      createdBy: existingClaims.createdBy || userData.createdBy || targetUid,
    };
    
    console.log("📋 Updating custom claims:", newClaims);

    // ✅ UPDATE: Set custom claims (this is safe - only updates metadata, no data loss)
    await adminAuth.setCustomUserClaims(targetUid, newClaims);
    console.log("✅ Custom claims updated successfully");

    // ✅ SAFETY: Only update Firestore if document exists (no accidental creation)
    if (userDoc.exists) {
      // Build update payload with ONLY missing fields (preserves existing data)
      const updatePayload: Record<string, any> = {
        updatedAt: new Date(),
      };
      
      // Only add fields that are missing or need fixing
      if (!userData.businessId) {
        updatePayload.businessId = targetBusinessId;
        console.log("📝 Adding businessId to Firestore");
      }
      
      if (!userData.status || userData.status === 'undefined') {
        updatePayload.status = 'active';
        console.log("📝 Setting status to active");
      }
      
      if (!userData.role) {
        updatePayload.role = effectiveRole;
        console.log("📝 Adding role to Firestore");
      }
      
      // ✅ SAFE UPDATE: This only updates specified fields, preserves all other data
      await adminDb.collection("users").doc(targetUid).update(updatePayload);
      console.log("✅ Firestore document updated successfully");
      console.log("📝 Updated fields:", Object.keys(updatePayload));
    } else {
      console.log("⚠️ No Firestore document exists - skipping Firestore update");
    }
    
    // ✅ CREATE BUSINESS RECORD if missing (for header display)
    if (targetBusinessId) {
      const businessDocRef = adminDb.collection("businesses").doc(targetBusinessId);
      const businessDoc = await businessDocRef.get();
      
      if (!businessDoc.exists) {
        console.log("📝 Creating missing business record...");
        await businessDocRef.set({
          id: targetBusinessId,
          name: userData.companyName || userRecord.displayName || userRecord.email?.split('@')[0] || "Business",
          email: userData.email || userRecord.email,
          address: userData.address || "",
          phone: userData.phone || "",
          tagline: userData.tagline || "",
          logoUrl: userData.logoUrl || null,
          ownerId: targetUid,
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log("✅ Business record created");
      } else {
        console.log("✅ Business record already exists");
      }
    }

    return NextResponse.json(
      { 
        success: true, 
        message: "Account repaired successfully", 
        uid: targetUid, 
        businessId: targetBusinessId,
        changes: {
          customClaimsUpdated: true,
          firestoreUpdated: userDoc.exists,
          businessIdSet: targetBusinessId,
          statusFixed: !userData.status || userData.status === 'undefined',
        }
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("❌ Repair failed:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: error.message || "Failed to repair business access",
        error: error.code || "REPAIR_FAILED"
      },
      { status: 500 }
    );
  }
}
