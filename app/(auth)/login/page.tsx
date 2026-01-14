"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { UserStatus } from "@/lib/userSchema";
import { DEFAULT_ROLE } from "@/lib/roles";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Check if Firestore doc exists (for admin-created users logging in for first time)
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (!userDocSnap.exists()) {
        // First login for admin-created user - create Firestore doc
        console.log("📋 First login - creating Firestore user document...");

        // Get role, createdBy, and businessId from custom claims (set by admin during creation)
        const idTokenResult = await user.getIdTokenResult();
        const roleFromClaims = (idTokenResult.claims.role as string) || DEFAULT_ROLE;
        const createdByFromClaims = idTokenResult.claims.createdBy as string | undefined;
        const businessIdFromClaims = idTokenResult.claims.businessId as string | undefined;

        console.log("📋 User role from custom claims:", roleFromClaims);
        console.log("📋 Created by (parent admin):", createdByFromClaims || "self");
        console.log("📋 Business ID:", businessIdFromClaims || "none");

        // businessId is REQUIRED for tenant isolation
        const finalBusinessId = businessIdFromClaims || createdByFromClaims || user.uid;

        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email?.split("@")[0] || "User",
          role: roleFromClaims,
          status: UserStatus.ACTIVE,
          businessId: finalBusinessId, // TENANT BOUNDARY
          isOwner: false, // Employees are not owners
          createdAt: new Date(),
          createdBy: createdByFromClaims || user.uid,
          lastLogin: new Date(), // ✅ Track first login
          metadata: {},
        });

        console.log("✅ Firestore user document created - businessId:", finalBusinessId);
      } else {
        // ✅ User exists - update lastLogin timestamp
        console.log("📋 Updating lastLogin timestamp...");
        try {
          await updateDoc(userDocRef, {
            lastLogin: new Date(),
          });
          console.log("✅ lastLogin updated");
        } catch (updateError) {
          console.warn("⚠️ Could not update lastLogin:", updateError);
          // Don't block login if update fails
        }
      }
      
      router.push("/dashboard"); // redirect after login
    } catch (err: any) {
      setError("Invalid email or password");
    }

    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <form 
        onSubmit={handleLogin} 
        className="bg-white p-6 rounded-xl shadow-md w-full max-w-sm space-y-4"
      >
        <h1 className="text-2xl font-bold text-center">Login</h1>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <input
          type="email"
          className="w-full border p-2 rounded"
          placeholder="Email"
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          className="w-full border p-2 rounded"
          placeholder="Password"
          onChange={(e) => setPassword(e.target.value)}
        />

        <button 
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <p className="text-center text-sm">
          Don’t have an account?{" "}
          <a href="/signup" className="text-blue-600">Sign Up</a>
        </p>
      </form>
    </div>
  );
}
