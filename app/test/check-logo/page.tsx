"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function CheckLogoPage() {
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkLogo();
  }, []);

  const checkLogo = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        setResults({ error: "Not logged in" });
        setLoading(false);
        return;
      }

      // Get user doc
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.exists() ? userDoc.data() : null;
      const businessId = userData?.businessId;

      // Get token claims
      const tokenResult = await user.getIdTokenResult();
      const claimBusinessId = tokenResult.claims.businessId as string;

      // Get business doc
      let businessData = null;
      if (businessId || claimBusinessId) {
        const bizDoc = await getDoc(doc(db, "businesses", businessId || claimBusinessId));
        businessData = bizDoc.exists() ? bizDoc.data() : null;
      }

      setResults({
        userId: user.uid,
        email: user.email,
        businessId,
        claimBusinessId,
        userLogo: userData?.logoUrl || null,
        businessLogo: businessData?.logoUrl || null,
        businessExists: !!businessData,
        userHasLogo: !!userData?.logoUrl,
        businessHasLogo: !!businessData?.logoUrl,
      });
    } catch (error: any) {
      setResults({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <p>Checking logo status...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Logo Status Check</h1>
      
      {results?.error ? (
        <div className="bg-red-50 p-4 rounded">
          <p className="text-red-800">{results.error}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded">
            <h2 className="font-semibold mb-2">User Info</h2>
            <p className="text-sm">Email: {results.email}</p>
            <p className="text-sm">Business ID: {results.businessId}</p>
            <p className="text-sm">Claim Business ID: {results.claimBusinessId}</p>
          </div>

          <div className="bg-blue-50 p-4 rounded">
            <h2 className="font-semibold mb-2">Logo Status</h2>
            <p className="text-sm">
              ✅ User collection has logo: {results.userHasLogo ? "YES" : "NO"}
            </p>
            <p className="text-sm">
              ✅ Business collection has logo: {results.businessHasLogo ? "YES" : "NO"}
            </p>
            <p className="text-sm">
              ✅ Business record exists: {results.businessExists ? "YES" : "NO"}
            </p>
          </div>

          {results.userLogo && (
            <div className="bg-green-50 p-4 rounded">
              <h2 className="font-semibold mb-2">User Logo URL</h2>
              <p className="text-xs break-all">{results.userLogo}</p>
              <img src={results.userLogo} alt="User Logo" className="mt-2 w-32 h-32 object-contain border" />
            </div>
          )}

          {results.businessLogo && (
            <div className="bg-green-50 p-4 rounded">
              <h2 className="font-semibold mb-2">Business Logo URL</h2>
              <p className="text-xs break-all">{results.businessLogo}</p>
              <img src={results.businessLogo} alt="Business Logo" className="mt-2 w-32 h-32 object-contain border" />
            </div>
          )}

          {results.userHasLogo && !results.businessHasLogo && (
            <div className="bg-yellow-50 p-4 rounded border-l-4 border-yellow-500">
              <h2 className="font-semibold mb-2">⚠️ Fix Required</h2>
              <p className="text-sm mb-2">
                Your logo is in the user collection but not synced to the business collection.
              </p>
              <p className="text-sm font-semibold">
                To fix: Go to Settings → Profile and click Save (even without changes)
              </p>
            </div>
          )}

          {!results.userHasLogo && !results.businessHasLogo && (
            <div className="bg-red-50 p-4 rounded border-l-4 border-red-500">
              <h2 className="font-semibold mb-2">❌ No Logo Found</h2>
              <p className="text-sm">
                No logo found in either collection. Upload one in Settings → Profile.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
