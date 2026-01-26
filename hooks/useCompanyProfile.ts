"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export interface CompanyProfile {
  companyName: string;
  ownerName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  tagline: string;
  logoUrl: string | null;
}

// Convert Google Drive sharing link to direct image URL
const convertGoogleDriveUrl = (url: string | null): string | null => {
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
    console.log('🔄 useCompanyProfile: Converting Google Drive URL');
    console.log('   Original:', url);
    console.log('   Direct URL:', directUrl);
    return directUrl;
  }
  
  return url;
};

export function useCompanyProfile() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setError("Not logged in");
          setLoading(false);
          return;
        }

        const userDoc = await getDoc(doc(db, "users", user.uid));
        let userData: any = null;
        let businessId: string | null = null;

        if (userDoc.exists()) {
          userData = userDoc.data();
          businessId = userData?.businessId ?? null;
        }

        if (!businessId) {
          try {
            const tokenResult = await user.getIdTokenResult();
            businessId = (tokenResult.claims.businessId as string | undefined) || null;
          } catch (claimErr) {
            console.warn("useCompanyProfile: failed to read token claims", claimErr);
          }
        }

        if (businessId) {
          const bizDoc = await getDoc(doc(db, "businesses", businessId));
          if (bizDoc.exists()) {
            const biz = bizDoc.data() as any;
            setProfile({
              companyName: biz.name || userData?.companyName || "Company Name",
              ownerName: userData?.ownerName || "",
              address: biz.address || userData?.address || "",
              phone: biz.phone || userData?.phone || "",
              email: biz.email || userData?.email || "",
              website: userData?.website || "",
              tagline: biz.tagline || userData?.tagline || "",
              logoUrl: convertGoogleDriveUrl(biz.logoUrl || userData?.logoUrl || null),
            });
            return;
          }
        }

        if (userData) {
          setProfile({
            companyName: userData.companyName || "Company Name",
            ownerName: userData.ownerName || "",
            address: userData.address || "",
            phone: userData.phone || "",
            email: userData.email || "",
            website: userData.website || "",
            tagline: userData.tagline || "",
            logoUrl: convertGoogleDriveUrl(userData.logoUrl) || null,
          });
        } else {
          setError("Profile not found");
        }
      } catch (err: any) {
        console.error("Error loading company profile:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  return { profile, loading, error };
}
