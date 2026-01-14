/**
 * Input Validation & Sanitization Utilities
 * Protects against XSS, injection attacks, and invalid data
 */

import { UserRole } from './roles';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates email format and length
 */
export function validateEmail(email: string): ValidationResult {
  if (!email) {
    return { valid: false, error: "Email is required" };
  }
  
  if (email.length > 254) {
    return { valid: false, error: "Email is too long" };
  }
  
  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: "Invalid email format" };
  }
  
  // Check for dangerous characters
  if (/<|>|javascript:|on\w+=/i.test(email)) {
    return { valid: false, error: "Email contains invalid characters" };
  }
  
  return { valid: true };
}

/**
 * Validates display name and checks for XSS attempts
 */
export function validateDisplayName(displayName: string): ValidationResult {
  if (!displayName) {
    return { valid: false, error: "Display name is required" };
  }
  
  if (displayName.length < 2) {
    return { valid: false, error: "Display name must be at least 2 characters" };
  }
  
  if (displayName.length > 100) {
    return { valid: false, error: "Display name must be less than 100 characters" };
  }
  
  // Check for HTML tags and script content
  if (/<[^>]*>/g.test(displayName)) {
    return { valid: false, error: "Display name cannot contain HTML tags" };
  }
  
  // Check for suspicious patterns (XSS attempts)
  if (/javascript:/i.test(displayName) || /on\w+=/i.test(displayName)) {
    return { valid: false, error: "Display name contains invalid patterns" };
  }
  
  return { valid: true };
}

/**
 * Validates password strength
 */
export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { valid: false, error: "Password is required" };
  }
  
  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters" };
  }
  
  if (password.length > 128) {
    return { valid: false, error: "Password is too long (max 128 characters)" };
  }
  
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one uppercase letter" };
  }
  
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one lowercase letter" };
  }
  
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one number" };
  }
  
  // Check against common weak passwords
  const weakPasswords = [
    'password', '12345678', 'qwerty', 'abc123', 'password1',
    'password123', '123456789', 'iloveyou', 'welcome'
  ];
  
  if (weakPasswords.includes(password.toLowerCase())) {
    return { valid: false, error: "Password is too common. Please choose a stronger password." };
  }
  
  return { valid: true };
}

/**
 * Validates role against allowed values
 */
export function validateRole(role: string): ValidationResult {
  if (!role) {
    return { valid: false, error: "Role is required" };
  }
  
  if (!Object.values(UserRole).includes(role as UserRole)) {
    return { valid: false, error: `Invalid role. Must be one of: ${Object.values(UserRole).join(', ')}` };
  }
  
  return { valid: true };
}

/**
 * Sanitizes display name by removing dangerous characters
 */
export function sanitizeDisplayName(displayName: string): string {
  return displayName
    .replace(/<[^>]*>/g, '')      // Remove HTML tags
    .replace(/[<>]/g, '')          // Remove angle brackets
    .trim();
}

/**
 * Sanitizes email by converting to lowercase and trimming
 */
export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim();
}
