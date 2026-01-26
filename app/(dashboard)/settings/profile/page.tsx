"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function ProfileSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [tagline, setTagline] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  // Convert Google Drive sharing link to direct image URL
  const convertGoogleDriveUrl = (url: string): string => {
    if (!url) return url;
    
    // Check if it's a Google Drive link (multiple formats)
    // Format 1: https://drive.google.com/file/d/FILE_ID/view...
    let driveMatch = url.match(/drive\.google\.com\/file\/d\/([^\/\?]+)/);
    
    // Format 2: https://drive.google.com/open?id=FILE_ID
    if (!driveMatch) {
      driveMatch = url.match(/drive\.google\.com\/open\?id=([^\&]+)/);
    }
    
    if (driveMatch) {
      const fileId = driveMatch[1];
      const directUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
      console.log('🔄 Converting Google Drive URL:');
      console.log('   Original:', url);
      console.log('   File ID:', fileId);
      console.log('   Direct URL:', directUrl);
      return directUrl;
    }
    
    console.log('✅ Using URL as-is:', url);
    return url;
  };

  useEffect(() => {
    const loadProfile = async () => {
      const user = auth.currentUser;
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        let businessId: string | null = null;
        
        if (userDoc.exists()) {
          const data = userDoc.data();
          businessId = data.businessId || null;
          
          // Try to load from business first if businessId exists
          if (businessId) {
            const bizDoc = await getDoc(doc(db, "businesses", businessId));
            if (bizDoc.exists()) {
              const bizData = bizDoc.data();
              setCompanyName(bizData.name || data.companyName || "");
              setOwnerName(data.ownerName || "");
              setAddress(bizData.address || data.address || "");
              setPhone(bizData.phone || data.phone || "");
              setEmail(bizData.email || data.email || "");
              setWebsite(data.website || "");
              setTagline(bizData.tagline || data.tagline || "");
              setLogoUrl(bizData.logoUrl || data.logoUrl || "");
              setLoading(false);
              return;
            }
          }
          
          // Fallback to user data
          setCompanyName(data.companyName || "");
          setOwnerName(data.ownerName || "");
          setAddress(data.address || "");
          setPhone(data.phone || "");
          setEmail(data.email || "");
          setWebsite(data.website || "");
          setTagline(data.tagline || "");
          setLogoUrl(data.logoUrl || "");
        }
      } catch (err: any) {
        console.error("Error loading profile:", err);
        setError(err.message);
      }

      setLoading(false);
    };

    loadProfile();
  }, [router]);





  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        setError("You must be logged in.");
        router.push("/login");
        return;
      }

      const convertedLogoUrl = convertGoogleDriveUrl(logoUrl) || null;
      const timestamp = new Date();
      
      // Get businessId from user document
      const userDoc = await getDoc(doc(db, "users", user.uid));
      let businessId: string | null = null;
      
      if (userDoc.exists()) {
        businessId = userDoc.data()?.businessId || null;
      }
      
      if (!businessId) {
        // Try to get from token claims
        try {
          const tokenResult = await user.getIdTokenResult();
          businessId = (tokenResult.claims.businessId as string | undefined) || null;
        } catch (err) {
          console.warn("Could not get businessId from claims");
        }
      }

      // Save to user document (for backward compatibility)
      await setDoc(
        doc(db, "users", user.uid),
        {
          companyName,
          ownerName,
          address,
          phone,
          email,
          website,
          tagline,
          logoUrl: convertedLogoUrl,
          updatedAt: timestamp,
        },
        { merge: true }
      );

      // Save to business document if businessId exists
      if (businessId) {
        await setDoc(
          doc(db, "businesses", businessId),
          {
            name: companyName,
            address,
            phone,
            email,
            tagline,
            logoUrl: convertedLogoUrl,
            ownerId: user.uid,
            status: "active",
            updatedAt: timestamp,
          },
          { merge: true }
        );
        console.log("✅ Profile saved to both users and businesses collections");
      } else {
        console.log("✅ Profile saved to users collection only (no businessId)");
      }

      setSuccess("Profile updated successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      console.error("Error saving profile:", err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-text-secondary">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-light p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-border-light p-6">
          <h1 className="text-2xl font-bold text-text-primary mb-6">Profile Settings</h1>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Company Name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g., Boxilla Packages"
                className="w-full px-4 py-2 border border-border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Owner Name
              </label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g., Babar Akbar"
                className="w-full px-4 py-2 border border-border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Company Address
              </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g., Plot # 470, Bhangoria Goth, Federal B. Industrial Area, Karachi"
                className="w-full px-4 py-2 border border-border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g., 0312-8246221"
                  className="w-full px-4 py-2 border border-border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g., info@company.com"
                  className="w-full px-4 py-2 border border-border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Website (Optional)
              </label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="e.g., www.company.com"
                className="w-full px-4 py-2 border border-border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Tagline/Motto (Optional)
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g., & you think it, we can ink it"
                className="w-full px-4 py-2 border border-border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Company Logo URL (Optional)
              </label>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="e.g., https://i.imgur.com/yourlogo.png"
                className="w-full px-4 py-2 border border-border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              {logoUrl && (
                <div className="mt-3">
                  <p className="text-xs text-text-secondary mb-2">Logo Preview:</p>
                  <img
                    src={convertGoogleDriveUrl(logoUrl)}
                    alt="Company logo preview"
                    className="w-32 h-32 object-contain border rounded-md bg-white"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
              <p className="text-xs text-text-secondary mt-2">
                Paste a direct link to your logo image. Supported sources:
                <br />
                • <strong>Google Drive</strong>: Share link (e.g., https://drive.google.com/file/d/FILE_ID/view) - will be auto-converted
                <br />
                • <a href="https://imgur.com/upload" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  Imgur
                </a>,{" "}
                <a href="https://cloudinary.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  Cloudinary
                </a>, or any direct image URL
              </p>
            </div> 

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="px-6 py-2 bg-gray-100 text-text-primary rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

