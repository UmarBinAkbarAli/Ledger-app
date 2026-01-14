/**
 * Server-Side Audit Logging System
 * 
 * Uses Firebase Admin SDK to create immutable audit trail for security-critical operations.
 * This is more secure than client-side logging as it cannot be bypassed.
 * 
 * IMPORTANT: Use this in API routes, not client-side code
 */

import { getAdminFirestore } from './firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

const adminDb = getAdminFirestore();

export enum AuditAction {
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  ROLE_CHANGED = 'ROLE_CHANGED',
  PASSWORD_RESET = 'PASSWORD_RESET',
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
}

export interface AuditLogEntry {
  action: AuditAction;
  actorUid: string;
  actorEmail?: string;
  targetUid?: string;
  targetEmail?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Timestamp;
  success: boolean;
  errorMessage?: string;
}

/**
 * Logs an audit event to Firestore using Admin SDK
 * 
 * @param action The action being performed
 * @param actorUid UID of the user performing the action
 * @param details Additional details about the action
 */
export async function logAuditEventServer(
  action: AuditAction,
  actorUid: string,
  details: {
    actorEmail?: string;
    targetUid?: string;
    targetEmail?: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    success: boolean;
    errorMessage?: string;
  }
): Promise<void> {
  try {
    const logEntry: AuditLogEntry = {
      action,
      actorUid,
      actorEmail: details.actorEmail,
      targetUid: details.targetUid,
      targetEmail: details.targetEmail,
      details: details.metadata,
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
      timestamp: Timestamp.now(),
      success: details.success,
      errorMessage: details.errorMessage,
    };

    // Store in separate audit log collection (immutable, tamper-proof)
    await adminDb.collection('auditLogs').add(logEntry);
    
    console.log(`📋 Audit log (server): ${action} by ${actorUid} - ${details.success ? 'SUCCESS' : 'FAILED'}`);
  } catch (error) {
    // CRITICAL: Never fail request if audit logging fails
    // But log the error for monitoring
    console.error('❌ Failed to write server-side audit log:', error);
    
    // In production, send to external monitoring (Sentry, DataDog, etc.)
    // This ensures we know when audit logging is broken
  }
}

/**
 * Extract IP address from Next.js request headers
 */
export function getIpAddress(request: Request): string | undefined {
  const headers = request.headers;
  
  // Try various headers in order of preference
  return (
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') || // Cloudflare
    headers.get('x-client-ip') ||
    undefined
  );
}

/**
 * Extract user agent from Next.js request headers
 */
export function getUserAgent(request: Request): string | undefined {
  return request.headers.get('user-agent') || undefined;
}

/**
 * Helper to create audit log details from request
 */
export function createAuditDetails(
  request: Request,
  success: boolean,
  targetUid?: string,
  targetEmail?: string,
  metadata?: Record<string, any>,
  errorMessage?: string
) {
  return {
    targetUid,
    targetEmail,
    metadata,
    ipAddress: getIpAddress(request),
    userAgent: getUserAgent(request),
    success,
    errorMessage,
  };
}

