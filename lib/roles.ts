/**
 * Role & Permission Definitions
 * Single source of truth for all role-based authorization in the app
 */

/**
 * User roles available in the system
 */
export enum UserRole {
  ADMIN = "admin",
  ACCOUNTANT = "accountant",
  SALES_USER = "sales_user",
  DELIVERY_CHALLAN = "delivery_challan",
  VIEWER = "viewer",
}

/**
 * Permissions that can be granted to roles
 */
export enum Permission {
  // User management
  CREATE_USERS = "create_users",
  EDIT_USERS = "edit_users",
  DELETE_USERS = "delete_users",
  CHANGE_ROLES = "change_roles",
  VIEW_ALL_USERS = "view_all_users",

  // Data management
  MANAGE_ALL_DATA = "manage_all_data",
  MANAGE_CUSTOMERS = "manage_customers",
  MANAGE_SUPPLIERS = "manage_suppliers",
  MANAGE_SALES = "manage_sales",
  MANAGE_PURCHASES = "manage_purchases",
  MANAGE_EXPENSES = "manage_expenses",
  MANAGE_INCOME = "manage_income",
  MANAGE_DELIVERY_CHALLANS = "manage_delivery_challans",

  // Reporting & exports
  VIEW_REPORTS = "view_reports",
  EXPORT_DATA = "export_data",
  VIEW_BANK_ACCOUNTS = "view_bank_accounts",

  // Settings
  MANAGE_SETTINGS = "manage_settings",
  MANAGE_COMPANY_PROFILE = "manage_company_profile",

  // Dashboard access
  ACCESS_DASHBOARD = "access_dashboard",
}

/**
 * Permission matrix: maps each role to its allowed permissions
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    // All permissions
    Permission.CREATE_USERS,
    Permission.EDIT_USERS,
    Permission.DELETE_USERS,
    Permission.CHANGE_ROLES,
    Permission.VIEW_ALL_USERS,
    Permission.MANAGE_ALL_DATA,
    Permission.MANAGE_CUSTOMERS,
    Permission.MANAGE_SUPPLIERS,
    Permission.MANAGE_SALES,
    Permission.MANAGE_PURCHASES,
    Permission.MANAGE_EXPENSES,
    Permission.MANAGE_INCOME,
    Permission.MANAGE_DELIVERY_CHALLANS,
    Permission.VIEW_REPORTS,
    Permission.EXPORT_DATA,
    Permission.VIEW_BANK_ACCOUNTS,
    Permission.MANAGE_SETTINGS,
    Permission.MANAGE_COMPANY_PROFILE,
    Permission.ACCESS_DASHBOARD,
  ],

  [UserRole.ACCOUNTANT]: [
    // Full data access + reporting
    Permission.MANAGE_ALL_DATA,
    Permission.MANAGE_CUSTOMERS,
    Permission.MANAGE_SUPPLIERS,
    Permission.MANAGE_SALES,
    Permission.MANAGE_PURCHASES,
    Permission.MANAGE_EXPENSES,
    Permission.MANAGE_INCOME,
    Permission.MANAGE_DELIVERY_CHALLANS,
    Permission.VIEW_REPORTS,
    Permission.EXPORT_DATA,
    Permission.VIEW_BANK_ACCOUNTS,
    Permission.MANAGE_COMPANY_PROFILE,
    Permission.ACCESS_DASHBOARD,
  ],

  [UserRole.SALES_USER]: [
    // Limited to sales operations
    Permission.MANAGE_CUSTOMERS,
    Permission.MANAGE_SALES,
    Permission.MANAGE_DELIVERY_CHALLANS,
    Permission.VIEW_REPORTS,
    Permission.ACCESS_DASHBOARD,
  ],

  [UserRole.DELIVERY_CHALLAN]: [
    // Delivery challan only
    Permission.MANAGE_DELIVERY_CHALLANS,
  ],

  [UserRole.VIEWER]: [
    // Read-only access
    Permission.VIEW_REPORTS,
    Permission.ACCESS_DASHBOARD,
  ],
};

/**
 * Role display names for UI
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: "Administrator",
  [UserRole.ACCOUNTANT]: "Accountant",
  [UserRole.SALES_USER]: "Sales User",
  [UserRole.DELIVERY_CHALLAN]: "Delivery Challan User",
  [UserRole.VIEWER]: "Viewer",
};

/**
 * Default role for new user signups
 */
export const DEFAULT_ROLE = UserRole.ADMIN;

/**
 * Roles that can manage other users
 */
export const ADMIN_ROLES = [UserRole.ADMIN];

/**
 * Check if a role has a specific permission
 * @param role - User role
 * @param permission - Permission to check
 * @returns true if role has permission
 */
export function hasPermission(role: UserRole | null, permission: Permission): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role];
  return permissions.includes(permission);
}

/**
 * Check if a role is an admin role
 * @param role - User role
 * @returns true if role is admin
 */
export function isAdminRole(role: UserRole | null): boolean {
  return role === UserRole.ADMIN;
}

/**
 * Check if a role can manage users
 * @param role - User role
 * @returns true if role can manage users
 */
export function canManageUsers(role: UserRole | null): boolean {
  return hasPermission(role, Permission.CHANGE_ROLES) || hasPermission(role, Permission.CREATE_USERS);
}
