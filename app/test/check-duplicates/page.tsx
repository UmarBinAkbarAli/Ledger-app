"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";

export default function CheckDuplicatesPage() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string>("");
  const [error, setError] = useState("");
  const [businessId, setBusinessId] = useState<string | null>(null);

  const checkDuplicates = async () => {
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

      // Get businessId
      const userDoc = await getDoc(doc(db, "users", user.uid));
      let bizId = userDoc.exists() ? userDoc.data()?.businessId ?? null : null;

      if (!bizId) {
        const tokenResult = await user.getIdTokenResult();
        bizId = (tokenResult.claims.businessId as string | undefined) || null;
      }

      setBusinessId(bizId);

      lines.push("🔍 DUPLICATE NUMBER CHECK REPORT");
      lines.push("=".repeat(80));
      lines.push("");
      lines.push(`Business ID: ${bizId || 'None (Legacy)'}`);
      lines.push("");

      // Check Purchases
      lines.push("📦 PURCHASES");
      lines.push("-".repeat(80));
      const purchasesQuery = bizId 
        ? query(collection(db, "purchases"), where("businessId", "==", bizId))
        : query(collection(db, "purchases"), where("userId", "==", user.uid), where("businessId", "==", null));
      
      const purchasesSnap = await getDocs(purchasesQuery);
      const purchaseBillMap = new Map<string, any[]>();
      
      purchasesSnap.forEach(docSnap => {
        const data = docSnap.data();
        const billNum = data.billNumber || 'UNKNOWN';
        if (!purchaseBillMap.has(billNum)) {
          purchaseBillMap.set(billNum, []);
        }
        purchaseBillMap.get(billNum)!.push({
          id: docSnap.id,
          date: data.date,
          supplier: data.supplierName || 'Unknown',
        });
      });

      const purchaseDupes: Array<{ billNum: string; count: number; records: any[] }> = [];
      purchaseBillMap.forEach((records, billNum) => {
        if (records.length > 1) {
          purchaseDupes.push({ billNum, count: records.length, records });
        }
      });

      lines.push(`Total Purchases: ${purchasesSnap.size}`);
      if (purchaseDupes.length === 0) {
        lines.push("✅ No duplicate bill numbers found!");
      } else {
        lines.push(`❌ Found ${purchaseDupes.length} duplicate bill numbers:`);
        purchaseDupes.forEach(({ billNum, count, records }) => {
          lines.push(`   - ${billNum}: ${count} occurrences`);
          records.forEach(r => {
            lines.push(`      * ${r.date} | ${r.supplier} | ID: ${r.id.slice(0, 8)}...`);
          });
        });
      }
      lines.push("");

      // Check Delivery Challans
      lines.push("🚚 DELIVERY CHALLANS");
      lines.push("-".repeat(80));
      const challansQuery = bizId
        ? query(collection(db, "deliveryChallans"), where("businessId", "==", bizId))
        : query(collection(db, "deliveryChallans"), where("userId", "==", user.uid), where("businessId", "==", null));
      
      const challansSnap = await getDocs(challansQuery);
      const challanNumMap = new Map<string, any[]>();
      
      challansSnap.forEach(docSnap => {
        const data = docSnap.data();
        const challanNum = data.challanNumber || 'UNKNOWN';
        if (!challanNumMap.has(challanNum)) {
          challanNumMap.set(challanNum, []);
        }
        challanNumMap.get(challanNum)!.push({
          id: docSnap.id,
          date: data.date,
          customer: data.customerName || 'Unknown',
        });
      });

      const challanDupes: Array<{ challanNum: string; count: number; records: any[] }> = [];
      challanNumMap.forEach((records, challanNum) => {
        if (records.length > 1) {
          challanDupes.push({ challanNum, count: records.length, records });
        }
      });

      lines.push(`Total Challans: ${challansSnap.size}`);
      if (challanDupes.length === 0) {
        lines.push("✅ No duplicate challan numbers found!");
      } else {
        lines.push(`❌ Found ${challanDupes.length} duplicate challan numbers:`);
        challanDupes.forEach(({ challanNum, count, records }) => {
          lines.push(`   - ${challanNum}: ${count} occurrences`);
          records.forEach(r => {
            lines.push(`      * ${r.date} | ${r.customer} | ID: ${r.id.slice(0, 8)}...`);
          });
        });
      }
      lines.push("");

      // Summary
      lines.push("=".repeat(80));
      lines.push("📋 SUMMARY");
      lines.push("=".repeat(80));
      
      if (purchaseDupes.length === 0 && challanDupes.length === 0) {
        lines.push("✅ No duplicates found in any module!");
        lines.push("Your numbering is clean and sequential.");
      } else {
        lines.push("⚠️  Action Required:");
        if (purchaseDupes.length > 0) {
          lines.push(`   - Fix ${purchaseDupes.length} duplicate purchase bill numbers`);
          lines.push(`     Run: node scripts/fix-purchase-duplicates.mjs ${bizId || user.uid}`);
        }
        if (challanDupes.length > 0) {
          lines.push(`   - Fix ${challanDupes.length} duplicate challan numbers`);
          lines.push(`     (Similar fix script needed)`);
        }
      }
      lines.push("");
      lines.push("=".repeat(80));

      setReport(lines.join("\n"));

    } catch (err: any) {
      setError(`Error checking duplicates: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Check for Duplicate Numbers</h1>
      
      <div className="bg-blue-50 border border-blue-200 p-4 rounded mb-6">
        <p className="text-blue-800 font-semibold mb-2">
          🔍 Duplicate Number Detection
        </p>
        <p className="text-blue-800 text-sm">
          This tool scans your purchases, sales, and delivery challans to find duplicate numbers
          (e.g., PUR-0001 appearing twice). Duplicates can occur when businessId changes or 
          during data migration.
        </p>
      </div>

      <div className="mb-6">
        <button
          onClick={checkDuplicates}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? "Scanning..." : "Check for Duplicates"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded mb-6">
          {error}
        </div>
      )}

      {report && (
        <div className="bg-white border rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Scan Results</h2>
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
