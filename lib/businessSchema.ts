/**
 * Business Entity Schema
 * The Business is the TENANT BOUNDARY in this multi-tenant system.
 * All data belongs to a Business, not individual users.
 */

import { Timestamp } from "firebase/firestore";

/**
 * Business status
 */
export enum BusinessStatus {
  ACTIVE = "active",
  SUSPENDED = "suspended",
  DELETED = "deleted",
}

/**
 * Business profile interface
 * This is the tenant entity - all users and data belong to a Business
 */
export interface Business {
  // Identity
  id: string; // Firestore document ID
  
  // Business Information
  name: string;
  tradeName?: string; // Trading name if different
  
  // Contact
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  
  // Branding
  logoUrl?: string;
  tagline?: string;
  
  // Owner (Admin who created this business)
  ownerId: string; // UID of the admin who owns this business
  
  // Status
  status: BusinessStatus;
  
  // Audit
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  
  // Settings
  settings?: {
    currency?: string;
    timezone?: string;
    fiscalYearStart?: string; // MM-DD format
    invoicePrefix?: string;
    challanPrefix?: string;
    purchasePrefix?: string;
    [key: string]: any;
  };
  
  // Metadata
  metadata?: {
    industry?: string;
    size?: string;
    [key: string]: any;
  };
}

/**
 * Minimal business info for lists
 */
export interface BusinessListItem {
  id: string;
  name: string;
  ownerId: string;
  status: BusinessStatus;
}

/**
 * Create a new business with defaults
 */
export function createBusiness(
  ownerId: string,
  name: string,
  email: string
): Omit<Business, "id"> {
  return {
    name,
    email,
    ownerId,
    status: BusinessStatus.ACTIVE,
    createdAt: new Date(),
    settings: {
      currency: "PKR",
      timezone: "Asia/Karachi",
      invoicePrefix: "INV-",
      challanPrefix: "DC-",
      purchasePrefix: "PUR-",
    },
  };
}
