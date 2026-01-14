import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, getIdToken } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDvK5FfRfvQ5YB_FPwMhSqqjH3Xk8VxD-U",
  authDomain: "ledger-app-for-boxilla.firebaseapp.com",
  projectId: "ledger-app-for-boxilla",
  storageBucket: "ledger-app-for-boxilla.firebasestorage.app",
  messagingSenderId: "348055008563",
  appId: "1:348055008563:web:3fa5c85c1ae00bbcce8c51",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function testCreateUser() {
  try {
    // Sign in with test admin account
    const userCredential = await signInWithEmailAndPassword(
      auth,
      "umar.akbar.test@gmail.com",
      "TestPassword123!"
    );
    
    const idToken = await getIdToken(userCredential.user);
    console.log("✅ Signed in, ID token obtained");
    console.log("Token (first 50 chars):", idToken.substring(0, 50));

    // Call the create user API
    const response = await fetch("http://localhost:3000/api/users/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        email: `testuser${Date.now()}@example.com`,
        displayName: "Test User " + Date.now(),
        role: "SALES_USER",
      }),
    });

    const data = await response.json();
    console.log("API Response Status:", response.status);
    console.log("API Response:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
}

testCreateUser();
