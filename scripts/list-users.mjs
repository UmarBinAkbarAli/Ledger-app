/**
 * List all Firebase Auth users
 * Helps identify which email to use for fix-admin-claims
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
const envPath = join(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');

const lines = envContent.split('\n');
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  
  const equalIndex = trimmed.indexOf('=');
  if (equalIndex === -1) continue;
  
  const key = trimmed.substring(0, equalIndex).trim();
  let value = trimmed.substring(equalIndex + 1).trim();
  
  if ((value.startsWith('"') && value.endsWith('"')) || 
      (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  
  process.env[key] = value;
}

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const auth = admin.auth();

async function listUsers() {
  try {
    console.log('📋 Listing all Firebase Auth users...\n');
    
    const listUsersResult = await auth.listUsers(1000);
    
    if (listUsersResult.users.length === 0) {
      console.log('No users found.');
      return;
    }
    
    listUsersResult.users.forEach((userRecord, index) => {
      console.log(`${index + 1}. ${userRecord.email || 'No email'}`);
      console.log(`   UID: ${userRecord.uid}`);
      console.log(`   Display Name: ${userRecord.displayName || 'None'}`);
      console.log(`   Custom Claims:`, userRecord.customClaims || 'None');
      console.log('');
    });
    
    console.log(`Total users: ${listUsersResult.users.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

listUsers().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
