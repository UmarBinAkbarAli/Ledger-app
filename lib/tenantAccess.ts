import { UserRecord } from "firebase-admin/auth";

interface TenantMatchInput {
  adminBusinessId: string | null;
  adminUid: string;
  targetBusinessId?: string | null;
  targetCreatedBy?: string | null;
}

export function isSameTenant({
  adminBusinessId,
  adminUid,
  targetBusinessId,
  targetCreatedBy,
}: TenantMatchInput): boolean {
  if (!adminBusinessId) return false;
  if (targetBusinessId) {
    return targetBusinessId === adminBusinessId;
  }
  return (
    adminBusinessId === adminUid &&
    !!targetCreatedBy &&
    targetCreatedBy === adminUid
  );
}

export function resolveTargetTenantInfo(
  userDocData?: Record<string, any> | null,
  userRecord?: UserRecord | null
): { businessId: string | null; createdBy: string | null } {
  const docBusinessId = userDocData?.businessId as string | undefined;
  const docCreatedBy = userDocData?.createdBy as string | undefined;
  const claims = userRecord?.customClaims as Record<string, any> | undefined;
  const claimBusinessId = (claims?.businessId as string | undefined) || undefined;
  const claimCreatedBy = (claims?.createdBy as string | undefined) || undefined;

  return {
    businessId: docBusinessId || claimBusinessId || null,
    createdBy: docCreatedBy || claimCreatedBy || null,
  };
}
