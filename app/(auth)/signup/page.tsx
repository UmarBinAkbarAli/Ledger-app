"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { setDoc, doc, addDoc, collection } from "firebase/firestore";
import { DEFAULT_ROLE, UserRole } from "@/lib/roles";
import { UserStatus } from "@/lib/userSchema";
import { createBusiness } from "@/lib/businessSchema";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [businessName, setBusinessName] = useState(""); // NEW: Business name for new admins
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Step 1: Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // Step 2: Get claims from custom claims (set by admin during user creation)
      const idTokenResult = await userCredential.user.getIdTokenResult();
      const roleFromClaims = (idTokenResult.claims.role as string) || null;
      const createdByFromClaims = idTokenResult.claims.createdBy as string | undefined;
      const businessIdFromClaims = idTokenResult.claims.businessId as string | undefined;
      
      console.log("📋 Custom claims:", { role: roleFromClaims, createdBy: createdByFromClaims, businessId: businessIdFromClaims });

      // Determine if this is a NEW ADMIN (self-registration) or EMPLOYEE (created by admin)
      const isNewAdmin = !createdByFromClaims && !businessIdFromClaims;
      
      let finalRole: string;
      let finalBusinessId: string;
      let isOwner: boolean;

      if (isNewAdmin) {
        // NEW ADMIN REGISTRATION: Create a new business
        console.log("🏢 New admin registration - creating business...");
        
        if (!businessName.trim()) {
          setError("Please enter your business name");
          setLoading(false);
          return;
        }
        
        finalRole = UserRole.ADMIN;
        isOwner = true;
        
        // Create business document
        const businessData = createBusiness(uid, businessName.trim(), email);
        const businessRef = await addDoc(collection(db, "businesses"), businessData);
        finalBusinessId = businessRef.id;
        
        console.log("✅ Business created:", finalBusinessId);
      } else {
        // EMPLOYEE FIRST LOGIN: Use businessId from claims
        console.log("👤 Employee first login");
        
        // Validate role from claims
        const validRoles = ["admin", "delivery_challan"];
        finalRole = (roleFromClaims && validRoles.includes(roleFromClaims)) 
          ? roleFromClaims 
          : DEFAULT_ROLE;
        
        finalBusinessId = businessIdFromClaims || createdByFromClaims || uid;
        isOwner = false;
        
        console.log("✅ Using businessId from claims:", finalBusinessId);
      }

      // Step 3: Create user document in Firestore
      await setDoc(doc(db, "users", uid), {
        uid,
        email,
        displayName: displayName || email.split("@")[0],
        role: finalRole,
        status: UserStatus.ACTIVE,
        businessId: finalBusinessId, // TENANT BOUNDARY
        isOwner,
        createdAt: new Date(),
        createdBy: createdByFromClaims || uid,
        lastLogin: new Date(), // ✅ Track signup as first login
        metadata: {},
      });

      console.log("✅ User profile created with businessId:", finalBusinessId);

      // Step 4: Redirect to dashboard
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Signup error:", err);
      setError(err.message || "Failed to create account");
    }

    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <form 
        onSubmit={handleSignup} 
        className="bg-white p-6 rounded-xl shadow-md w-full max-w-sm space-y-4"
      >
        <h1 className="text-2xl font-bold text-center">Create an Account</h1>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <input
          type="email"
          className="w-full border p-2 rounded"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="text"
          className="w-full border p-2 rounded"
          placeholder="Display Name (Optional)"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />

        <input
          type="text"
          className="w-full border p-2 rounded"
          placeholder="Business/Company Name"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
        />
        <p className="text-xs text-gray-500 -mt-2">
          Enter your business name to create your account
        </p>

        <input
          type="password"
          className="w-full border p-2 rounded"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button 
          type="submit"
          disabled={loading || !email || !password}
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? "Creating Account..." : "Sign Up"}
        </button>

        <p className="text-center text-sm">
          Already have an account?{" "}
          <a href="/login" className="text-blue-600">Login</a>
        </p>
      </form>
    </div>
  );
}
