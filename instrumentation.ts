/**
 * Next.js Instrumentation - Runs at server startup
 * Used to set up global configurations before anything else loads
 */

// CRITICAL: Disable SSL verification FIRST before any other imports
// This must run before Firebase Admin SDK is initialized
if (process.env.NODE_ENV === "development" || process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  console.log("🔓 SSL verification disabled for development (gRPC)");
  
  // Also set for gRPC specifically
  process.env.GRPC_SSL_CIPHER_SUITES = "ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384";
}

export function register() {
  // Re-ensure SSL is disabled
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  console.log("🔓 SSL verification confirmed disabled in register hook");
}

