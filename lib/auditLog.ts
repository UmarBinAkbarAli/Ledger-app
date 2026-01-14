/**
 * Audit Logging System
 * Creates immutable audit trail for security-critical operations
 */

import { db } from './firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

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
 * Logs an audit event to Firestore
 * @param action The action being performed
 * @param actorUid UID of the user performing the action
 * @param details Additional details about the action
 */
export async function logAuditEvent(
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
) {
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
    await addDoc(collection(db, 'auditLogs'), logEntry);
    
    console.log(`📋 Audit log: ${action} by ${actorUid}`);
  } catch (error) {
    // CRITICAL: Never fail request if audit logging fails
    console.error('❌ Failed to write audit log:', error);
    // In production, send to external monitoring (Sentry, DataDog, etc.)
  }
}
