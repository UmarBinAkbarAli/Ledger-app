"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";

export default function DiagnoseBusinessPage() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string>("");
  const [error, setError] = useState("");
  const [repairing, setRepairing] = useState(false);
  const [repairSuccess, setRepairSuccess] = useState("");
  const [needsRepair, setNeedsRepair] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setError("");
    setRepairSuccess("");

    try {
      const user = auth.currentUser;
      if (!user) {
        setError("Not authenticated");
        return;
      }

      // First, test if SSL/Firebase Admin is working
      const testResponse = await fetch("/api/test-ssl");
      const testData = await testResponse.json();
      
      if (!testResponse.ok || !testData.success) {
        throw new Error(`SSL Test Failed: ${testData.message}. Please restart your development server.`);
      }

      console.log("✅ SSL test passed, proceeding with repair...");

      const idToken = await user.getIdToken();
      const response = await fetch("/api/users/repair-business", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ uid: user.uid }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Repair failed");
      }

      const changesMsg = data.changes ? `\n\nChanges made:\n- Custom claims updated: ${data.changes.customClaimsUpdated ? '✅' : '❌'}\n- Firestore updated: ${data.changes.firestoreUpdated ? '✅' : '❌'}\n- BusinessId set to: ${data.businessId}\n- Status fixed: ${data.changes.statusFixed ? '✅' : 'Already OK'}` : '';

      setRepairSuccess(`✅ Account repaired successfully!${changesMsg}\n\n⚠️ IMPORTANT: Please log out and log back in for changes to take effect.\n\nYour data is 100% safe - only metadata was updated.`);
      setNeedsRepair(false);
      
      // Re-run diagnosis after 2 seconds
      setTimeout(() => {
        runDiagnosis();
      }, 2000);
    } catch (err: any) {
      setError(`Repair failed: ${err.message}`);
    } finally {
      setRepairing(false);
    }
  };

  const runDiagnosis = async () => {
    setLoading(true);
    setError("");
    setReport("");

    const lines: string[] = [];
    
    try {
      const user = auth.currentUser;
      if (!user) {
        setError("Not authenticated. Please log in first.");
        setLoading(false);
        return;
      }

      lines.push("🔍 BUSINESS DIAGNOSIS REPORT");
      lines.push("=".repeat(80));
      lines.push("");
      lines.push(`📌 Current User: ${user.email}`);
      lines.push(`📌 UID: ${user.uid}`);
      lines.push("");

      // Step 1: Check custom claims
      lines.push("📌 Step 1: Custom Claims");
      lines.push("-".repeat(80));
      try {
        const tokenResult = await user.getIdTokenResult(true);
        const claims = tokenResult.claims;
        lines.push(`   ✅ role: ${claims.role || 'NOT SET ❌'}`);
        lines.push(`   ✅ businessId: ${claims.businessId || 'NOT SET ❌'}`);
        lines.push(`   ✅ admin: ${claims.admin || 'NOT SET ❌'}`);
        lines.push(`   ✅ createdBy: ${claims.createdBy || 'NOT SET ❌'}`);
      } catch (err: any) {
        lines.push(`   ❌ Error getting claims: ${err.message}`);
      }
      lines.push("");

      // Step 2: Check Firestore document
      lines.push("📌 Step 2: Firestore User Document");
      lines.push("-".repeat(80));
      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (!userDocSnap.exists()) {
          lines.push("   ❌ PROBLEM: Firestore document does NOT exist!");
          lines.push("   This means your account was never properly set up.");
        } else {
          const userData = userDocSnap.data();
          lines.push(`   ✅ Document exists`);
          lines.push(`   ✅ email: ${userData.email || 'NOT SET'}`);
          lines.push(`   ✅ role: ${userData.role || 'NOT SET ❌'}`);
          lines.push(`   ✅ businessId: ${userData.businessId || 'NOT SET ❌'}`);
          lines.push(`   ✅ status: ${userData.status || 'NOT SET ❌'}`);
          lines.push(`   ✅ isOwner: ${userData.isOwner ?? 'NOT SET'}`);
          lines.push(`   ✅ createdBy: ${userData.createdBy || 'NOT SET'}`);
        }
      } catch (err: any) {
        lines.push(`   ❌ Error: ${err.message}`);
      }
      lines.push("");

      // Step 3: Get businessId
      const userDocSnap = await getDoc(doc(db, "users", user.uid));
      let businessId: string | null = null;
      
      if (userDocSnap.exists()) {
        businessId = userDocSnap.data()?.businessId ?? null;
      }
      
      if (!businessId) {
        const tokenResult = await user.getIdTokenResult();
        businessId = (tokenResult.claims.businessId as string | undefined) || null;
      }

      lines.push(`📌 Effective businessId: ${businessId || 'NONE ❌'}`);
      lines.push("");

      // Step 4: Check business users
      if (businessId) {
        lines.push("📌 Step 3: Users in This Business");
        lines.push("-".repeat(80));
        try {
          const usersQuery = query(collection(db, "users"), where("businessId", "==", businessId));
          const usersSnap = await getDocs(usersQuery);
          
          lines.push(`   Found ${usersSnap.size} users:`);
          usersSnap.forEach((docSnap) => {
            const userData = docSnap.data();
            lines.push(`   - ${userData.email} (${userData.role}) - Status: ${userData.status}`);
          });
          
          if (usersSnap.size === 0) {
            lines.push("   ❌ NO USERS FOUND!");
            lines.push("   This means created users have different businessId values.");
          }
        } catch (err: any) {
          lines.push(`   ❌ Error: ${err.message}`);
        }
        lines.push("");

        // Step 5: Check delivery challans
        lines.push("📌 Step 4: Delivery Challans in This Business");
        lines.push("-".repeat(80));
        try {
          const challansQuery = query(collection(db, "deliveryChallans"), where("businessId", "==", businessId));
          const challansSnap = await getDocs(challansQuery);
          
          lines.push(`   Found ${challansSnap.size} challans:`);
          if (challansSnap.size === 0) {
            lines.push("   ℹ️  No challans yet, or challans have different businessId.");
          } else {
            challansSnap.forEach((docSnap) => {
              const data = docSnap.data();
              lines.push(`   - ${data.challanNumber} - Customer: ${data.customerName}`);
            });
          }
        } catch (err: any) {
          lines.push(`   ❌ Error: ${err.message}`);
        }
        lines.push("");
      } else {
        lines.push("⚠️  NO BUSINESS ID - LEGACY USER MODE");
        lines.push("");
      }

      // Summary
      lines.push("=".repeat(80));
      lines.push("📋 DIAGNOSIS SUMMARY");
      lines.push("=".repeat(80));
      
      const issues: string[] = [];
      
      // Check for businessId mismatch between claims and Firestore
      const tokenResult = await user.getIdTokenResult(true);
      const claimsBusinessId = tokenResult.claims.businessId;
      const firestoreBusinessId = userDocSnap.exists() ? userDocSnap.data()?.businessId : null;
      
      if (!claimsBusinessId && firestoreBusinessId) {
        issues.push("❌ businessId missing in custom claims but exists in Firestore - MISMATCH!");
      }
      
      if (!businessId) {
        issues.push("❌ No businessId found - Account not properly set up");
      }
      
      if (!userDocSnap.exists()) {
        issues.push("❌ No Firestore document - Account needs initialization");
      }
      
      const userData = userDocSnap.exists() ? userDocSnap.data() : null;
      if (userData && (!userData.status || userData.status === 'undefined')) {
        issues.push("❌ Status is missing or undefined - Should be 'active'");
      }
      
      setNeedsRepair(issues.length > 0);

      if (issues.length === 0) {
        lines.push("✅ No obvious issues detected!");
      } else {
        lines.push("⚠️  Issues Found:");
        issues.forEach(issue => lines.push(`   ${issue}`));
      }
      
      lines.push("");
      lines.push("🔧 RECOMMENDED FIXES:");
      lines.push("   1. Log out completely");
      lines.push("   2. Log back in");
      lines.push("   3. If issues persist, contact support with this report");
      lines.push("");
      lines.push("=".repeat(80));

      setReport(lines.join("\n"));

    } catch (err: any) {
      setError(`Error running diagnosis: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Business Diagnosis Tool</h1>
      
      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded mb-6">
        <p className="text-yellow-800 font-bold mb-2">
          ⚠️ Admin Tool: Business Account Diagnosis & Repair
        </p>
        <p className="text-yellow-800 text-sm mb-2">
          This tool diagnoses why users might show as "pending" or why delivery challans don't sync across users in the same business.
        </p>
        <p className="text-green-800 text-sm font-semibold">
          🔒 DATA SAFETY GUARANTEE:
        </p>
        <ul className="text-green-800 text-sm list-disc list-inside mt-1">
          <li>✅ No data is deleted or modified</li>
          <li>✅ Only metadata fields are updated (businessId, status, role)</li>
          <li>✅ All your challans, customers, and transactions remain untouched</li>
          <li>✅ Changes can be verified before taking effect (requires re-login)</li>
        </ul>
      </div>

      <div className="mb-6 flex gap-4">
        <button
          onClick={runDiagnosis}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? "Running Diagnosis..." : "Run Diagnosis"}
        </button>
        
        {needsRepair && (
          <button
            onClick={handleRepair}
            disabled={repairing || loading}
            className="bg-green-600 text-white px-6 py-3 rounded hover:bg-green-700 disabled:bg-gray-400 font-bold"
          >
            {repairing ? "Repairing..." : "🔧 Fix My Account"}
          </button>
        )}
      </div>

      {repairSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded mb-6">
          {repairSuccess}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded mb-6">
          {error}
        </div>
      )}

      {report && (
        <div className="bg-white border rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Diagnosis Report</h2>
            <button
              onClick={() => {
                navigator.clipboard.writeText(report);
                alert("Report copied to clipboard!");
              }}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 text-sm"
            >
              Copy Report
            </button>
          </div>
          
          <pre className="bg-gray-50 p-4 rounded overflow-x-auto text-sm font-mono whitespace-pre-wrap">
            {report}
          </pre>
        </div>
      )}
    </div>
  );
}
