/**
 * User Document Schema
 * Defines the structure of user documents in Firestore
 */

import { Timestamp } from "firebase/firestore";
import { UserRole } from "./roles";

/**
 * User status in the system
 */
export enum UserStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  PENDING = "pending", // User invited but hasn't set up account
  DEACTIVATED = "deactivated", // Soft-deleted user
}

/**
 * Complete user profile interface
 * Matches Firestore users/{uid} document structure
 * 
 * MULTI-TENANT MODEL:
 * - businessId is the TENANT BOUNDARY (required for all users)
 * - Admin users own the business (isOwner = true)
 * - Employee users belong to a business (isOwner = false)
 * - All data queries MUST be scoped by businessId
 */
export interface UserProfile {
  // Identity
  uid: string;
  email: string;
  displayName: string;
  photoUrl?: string;

  // Authorization
  role: UserRole;
  status: UserStatus;

  // TENANT ISOLATION (REQUIRED)
  businessId: string; // The business this user belongs to (TENANT BOUNDARY)
  isOwner?: boolean;  // True if this user is the business owner (admin who created it)

  // Legacy field (deprecated, use businessId)
  companyId?: string;

  // Audit trail
  createdAt: Timestamp | Date;
  createdBy?: string; // uid of admin who created this user (for employee users)
  updatedAt?: Timestamp | Date;
  lastLogin?: Timestamp | Date;

  // Metadata
  metadata?: {
    phone?: string;
    position?: string;
    department?: string;
    [key: string]: any;
  };
}

/**
 * Minimal user info for lists and references
 */
export interface UserListItem {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  lastLogin?: Timestamp | Date;
}

/**
 * Form input for creating/editing a user
 */
export interface UserFormInput {
  email: string;
  displayName: string;
  role: UserRole;
  status?: UserStatus;
  metadata?: {
    phone?: string;
    position?: string;
    department?: string;
  };
}

/**
 * API response when creating a user
 */
export interface CreateUserResponse {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Timestamp;
  message: string;
}

/**
 * Convert Firestore timestamp to Date for display
 */
export function normalizeTimestamp(ts: Timestamp | Date | undefined): Date | null {
  if (!ts) return null;
  return ts instanceof Timestamp ? ts.toDate() : ts;
}

/**
 * Create a new user profile object (for employees)
 */
export function createUserProfile(
  uid: string,
  email: string,
  displayName: string,
  role: UserRole,
  businessId: string,
  createdBy?: string,
  metadata?: any
): UserProfile {
  return {
    uid,
    email,
    displayName,
    role,
    status: UserStatus.ACTIVE,
    businessId, // REQUIRED: tenant boundary
    isOwner: false,
    createdAt: new Date(),
    createdBy,
    metadata,
  };
}

/**
 * Create a business owner profile (for admin registration)
 */
export function createOwnerProfile(
  uid: string,
  email: string,
  displayName: string,
  businessId: string
): UserProfile {
  return {
    uid,
    email,
    displayName,
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    businessId,
    isOwner: true, // This user owns the business
    createdAt: new Date(),
  };
}
