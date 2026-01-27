/**
 * Next.js Instrumentation - Runs at server startup
 * Used to set up global configurations before anything else loads
 */

// DEVELOPMENT ONLY: Bypass SSL for Firebase Admin SDK in dev mode
// This is needed for corporate networks with SSL interception
if (process.env.NODE_ENV === 'development') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.log('🔓 SSL verification disabled for development (Firebase Admin SDK)');
  console.log('⚠️  This will be re-enabled in production');
}

export function register() {
  console.log("✅ Application instrumentation initialized");
  
  if (process.env.NODE_ENV === 'development') {
    console.log("🔧 Development mode: SSL bypass active for Firebase Admin");
  } else {
    console.log("🔒 Production mode: SSL verification enabled");
  }
  
  // Validate critical environment variables
  const requiredEnvVars = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY',
  ];
  
  const missing = requiredEnvVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing);
    console.error('📝 Copy .env.example to .env.local and fill in your values');
  }
}

