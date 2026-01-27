"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function LogoDebugPage() {
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        checkLogo(user);
      } else {
        setResults({ error: "Not logged in. Please go to /login" });
        setLoading(false);
      }
    });
    
    return () => unsubscribe();
  }, []);

  const checkLogo = async (user: any) => {
    try {

      // Get user doc
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.exists() ? userDoc.data() : null;
      const businessId = userData?.businessId;

      // Get token claims
      const tokenResult = await user.getIdTokenResult();
      const claimBusinessId = tokenResult.claims.businessId as string;

      // Get business doc
      let businessData = null;
      const effectiveBusinessId = businessId || claimBusinessId;
      if (effectiveBusinessId) {
        const bizDoc = await getDoc(doc(db, "businesses", effectiveBusinessId));
        businessData = bizDoc.exists() ? bizDoc.data() : null;
      }

      setResults({
        userId: user.uid,
        email: user.email,
        businessId,
        claimBusinessId,
        effectiveBusinessId,
        
        // User collection data
        userExists: !!userData,
        userLogoRaw: userData?.logoUrl || null,
        userCompanyName: userData?.companyName || null,
        userAddress: userData?.address || null,
        userPhone: userData?.phone || null,
        
        // Business collection data
        businessExists: !!businessData,
        businessLogoRaw: businessData?.logoUrl || null,
        businessName: businessData?.name || null,
        businessAddress: businessData?.address || null,
        businessPhone: businessData?.phone || null,
        
        // Status checks
        hasUserLogo: !!userData?.logoUrl,
        hasBusinessLogo: !!businessData?.logoUrl,
        logosSynced: userData?.logoUrl === businessData?.logoUrl,
      });
    } catch (error: any) {
      setResults({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const testImageLoad = (url: string) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ success: true, width: img.width, height: img.height });
      img.onerror = () => resolve({ success: false, error: "Failed to load" });
      img.src = url;
      setTimeout(() => resolve({ success: false, error: "Timeout" }), 5000);
    });
  };

  const [userImgTest, setUserImgTest] = useState<any>(null);
  const [bizImgTest, setBizImgTest] = useState<any>(null);

  const testImages = async () => {
    if (results?.userLogoRaw) {
      const test = await testImageLoad(results.userLogoRaw);
      setUserImgTest(test);
    }
    if (results?.businessLogoRaw) {
      const test = await testImageLoad(results.businessLogoRaw);
      setBizImgTest(test);
    }
  };

  if (loading) {
    return <div className="p-8">Checking logo status...</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🔍 Logo Debug Report</h1>
      
      {results?.error ? (
        <div className="bg-red-50 p-4 rounded border border-red-200">
          <p className="text-red-800">{results.error}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Account Info */}
          <div className="bg-gray-50 p-4 rounded border">
            <h2 className="font-semibold mb-3 text-lg">📧 Account Info</h2>
            <div className="space-y-1 text-sm">
              <p>Email: <span className="font-mono">{results.email}</span></p>
              <p>User ID: <span className="font-mono text-xs">{results.userId}</span></p>
              <p>Business ID (Firestore): <span className="font-mono text-xs">{results.businessId || "null"}</span></p>
              <p>Business ID (Claims): <span className="font-mono text-xs">{results.claimBusinessId || "null"}</span></p>
            </div>
          </div>

          {/* Status Summary */}
          <div className="bg-blue-50 p-4 rounded border border-blue-200">
            <h2 className="font-semibold mb-3 text-lg">📊 Status Summary</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={results.hasUserLogo ? "text-green-600" : "text-red-600"}>
                  {results.hasUserLogo ? "✅" : "❌"}
                </span>
                <span className="text-sm">Logo in users collection</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={results.hasBusinessLogo ? "text-green-600" : "text-red-600"}>
                  {results.hasBusinessLogo ? "✅" : "❌"}
                </span>
                <span className="text-sm">Logo in businesses collection</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={results.logosSynced ? "text-green-600" : "text-yellow-600"}>
                  {results.logosSynced ? "✅" : "⚠️"}
                </span>
                <span className="text-sm">Logos synced (same URL)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={results.businessExists ? "text-green-600" : "text-red-600"}>
                  {results.businessExists ? "✅" : "❌"}
                </span>
                <span className="text-sm">Business record exists</span>
              </div>
            </div>
          </div>

          {/* User Collection Data */}
          {results.userExists && (
            <div className="bg-purple-50 p-4 rounded border border-purple-200">
              <h2 className="font-semibold mb-3 text-lg">👤 Users Collection Data</h2>
              <div className="space-y-2 text-sm">
                <p><strong>Company Name:</strong> {results.userCompanyName || "null"}</p>
                <p><strong>Address:</strong> {results.userAddress || "null"}</p>
                <p><strong>Phone:</strong> {results.userPhone || "null"}</p>
                <p><strong>Logo URL:</strong></p>
                {results.userLogoRaw ? (
                  <>
                    <pre className="bg-white p-2 rounded text-xs overflow-x-auto border">{results.userLogoRaw}</pre>
                    <img src={results.userLogoRaw} alt="User Logo" className="w-32 h-32 object-contain border mt-2" onError={(e) => {
                      (e.target as HTMLImageElement).style.border = "2px solid red";
                    }} />
                  </>
                ) : (
                  <p className="text-gray-500">No logo URL</p>
                )}
              </div>
            </div>
          )}

          {/* Business Collection Data */}
          {results.businessExists && (
            <div className="bg-green-50 p-4 rounded border border-green-200">
              <h2 className="font-semibold mb-3 text-lg">🏢 Businesses Collection Data</h2>
              <div className="space-y-2 text-sm">
                <p><strong>Business Name:</strong> {results.businessName || "null"}</p>
                <p><strong>Address:</strong> {results.businessAddress || "null"}</p>
                <p><strong>Phone:</strong> {results.businessPhone || "null"}</p>
                <p><strong>Logo URL:</strong></p>
                {results.businessLogoRaw ? (
                  <>
                    <pre className="bg-white p-2 rounded text-xs overflow-x-auto border">{results.businessLogoRaw}</pre>
                    <img src={results.businessLogoRaw} alt="Business Logo" className="w-32 h-32 object-contain border mt-2" onError={(e) => {
                      (e.target as HTMLImageElement).style.border = "2px solid red";
                    }} />
                  </>
                ) : (
                  <p className="text-gray-500">No logo URL</p>
                )}
              </div>
            </div>
          )}

          {/* Image Load Test */}
          <div className="bg-yellow-50 p-4 rounded border border-yellow-200">
            <h2 className="font-semibold mb-3 text-lg">🧪 Image Load Test</h2>
            <button
              onClick={testImages}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mb-3"
            >
              Test Image Loading
            </button>
            
            {userImgTest && (
              <div className="mb-2">
                <p className="text-sm"><strong>User Logo Test:</strong></p>
                <pre className="bg-white p-2 rounded text-xs">{JSON.stringify(userImgTest, null, 2)}</pre>
              </div>
            )}
            
            {bizImgTest && (
              <div>
                <p className="text-sm"><strong>Business Logo Test:</strong></p>
                <pre className="bg-white p-2 rounded text-xs">{JSON.stringify(bizImgTest, null, 2)}</pre>
              </div>
            )}
          </div>

          {/* Google Drive Fix */}
          {(results.userLogoRaw?.includes('drive.google.com') || results.businessLogoRaw?.includes('drive.google.com')) && (
            <div className="bg-orange-50 p-4 rounded border-l-4 border-orange-500">
              <h2 className="font-semibold mb-2 text-orange-800">⚠️ Google Drive Logo Detected</h2>
              <p className="text-sm mb-2">Your logo is hosted on Google Drive. Common issues:</p>
              <ul className="text-sm space-y-1 ml-4 list-disc mb-3">
                <li>File may not be set to "Anyone with the link can view"</li>
                <li>Corporate network may block Google Drive</li>
                <li>URL needs to be in direct download format</li>
              </ul>
              <p className="text-sm font-semibold">Recommended Fix:</p>
              <ol className="text-sm space-y-1 ml-4 list-decimal">
                <li>Right-click your logo file in Google Drive</li>
                <li>Select "Share" → "Anyone with the link"</li>
                <li>Copy the sharing link</li>
                <li>Go to Settings → Profile and paste the link again</li>
                <li>Or upload the logo directly (recommended)</li>
              </ol>
            </div>
          )}

          {/* Fix Instructions */}
          {!results.businessExists && (
            <div className="bg-red-50 p-4 rounded border-l-4 border-red-500">
              <h2 className="font-semibold mb-2 text-red-800">❌ Business Record Missing</h2>
              <p className="text-sm mb-2">Your business record doesn't exist. This is causing the logo to not display.</p>
              <p className="text-sm font-semibold">Fix: Go to <a href="/test/diagnose-business" className="text-blue-600 underline">/test/diagnose-business</a> and click Repair</p>
            </div>
          )}

          {results.businessExists && !results.hasBusinessLogo && results.hasUserLogo && (
            <div className="bg-yellow-50 p-4 rounded border-l-4 border-yellow-500">
              <h2 className="font-semibold mb-2 text-yellow-800">⚠️ Logo Not Synced</h2>
              <p className="text-sm mb-2">Your logo is in the users collection but not synced to the businesses collection.</p>
              <p className="text-sm font-semibold">Fix: Go to <a href="/settings/profile" className="text-blue-600 underline">Settings → Profile</a> and click Save</p>
            </div>
          )}

          {!results.hasUserLogo && !results.hasBusinessLogo && (
            <div className="bg-red-50 p-4 rounded border-l-4 border-red-500">
              <h2 className="font-semibold mb-2 text-red-800">❌ No Logo Found</h2>
              <p className="text-sm mb-2">No logo found in either collection.</p>
              <p className="text-sm font-semibold">Fix: Go to <a href="/settings/profile" className="text-blue-600 underline">Settings → Profile</a> and upload a logo</p>
            </div>
          )}

          {results.hasBusinessLogo && results.logosSynced && (
            <div className="bg-green-50 p-4 rounded border-l-4 border-green-500">
              <h2 className="font-semibold mb-2 text-green-800">✅ Everything Looks Good!</h2>
              <p className="text-sm">Logo is properly configured in both collections.</p>
              <p className="text-sm mt-2">If the logo still doesn't show when printing, it might be a Google Drive permissions issue or the image takes too long to load.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
