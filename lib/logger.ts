/**
 * Production-Safe Logger
 * Prevents sensitive data from being logged in production
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  /**
   * Debug logs - only in development
   */
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.log('[DEBUG]', ...args);
    }
  },
  
  /**
   * Info logs - only in development
   */
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.log('[INFO]', ...args);
    }
  },
  
  /**
   * Warning logs - always shown
   */
  warn: (...args: any[]) => {
    console.warn('[WARN]', ...args);
  },
  
  /**
   * Error logs - always shown
   */
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
  },
  
  /**
   * Sensitive data logs - NEVER logged in production
   * Use this for passwords, tokens, PII
   */
  sensitive: (...args: any[]) => {
    if (isDevelopment && process.env.LOG_SENSITIVE === 'true') {
      console.log('[SENSITIVE]', ...args);
    }
  },
};
