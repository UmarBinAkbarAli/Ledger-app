/**
 * Business Context Hook
 * Provides businessId for tenant-scoped operations throughout the app.
 * 
 * CRITICAL: Every data operation MUST use businessId from this hook
 * to ensure proper tenant isolation.
 */

"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Business } from "@/lib/businessSchema";
import { UserProfile } from "@/lib/userSchema";

interface UseBusinessReturn {
  businessId: string | null;
  business: Business | null;
  user: UserProfile | null;
  isOwner: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to get the current user's business context
 * 
 * Usage:
 * ```tsx
 * const { businessId, loading } = useBusiness();
 * 
 * // Always scope queries by businessId
 * const q = query(
 *   collection(db, "sales"),
 *   where("businessId", "==", businessId)
 * );
 * ```
 */
export function useBusiness(): UseBusinessReturn {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setBusinessId(null);
        setBusiness(null);
        setUser(null);
        setIsOwner(false);
        setLoading(false);
        return;
      }

      try {
        // Load user profile to get businessId
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        
        if (!userDoc.exists()) {
          // User exists in Auth but not Firestore (pending first login)
          // Try to get businessId from custom claims
          const tokenResult = await firebaseUser.getIdTokenResult();
          const claimBusinessId = tokenResult.claims.businessId as string | undefined;
          
          if (claimBusinessId) {
            setBusinessId(claimBusinessId);
            // Load business details
            const bizDoc = await getDoc(doc(db, "businesses", claimBusinessId));
            if (bizDoc.exists()) {
              setBusiness({ id: bizDoc.id, ...bizDoc.data() } as Business);
            }
          }
          setLoading(false);
          return;
        }

        const userData = userDoc.data() as UserProfile;
        setUser(userData);
        
        // Get businessId from user profile
        const userBusinessId = userData.businessId;
        
        if (!userBusinessId) {
          // MIGRATION: Old users without businessId
          // For now, use their uid as businessId (legacy behavior)
          console.warn("⚠️ User missing businessId, using legacy userId isolation");
          setBusinessId(firebaseUser.uid);
          setIsOwner(true); // Assume old users are owners
          setLoading(false);
          return;
        }

        setBusinessId(userBusinessId);
        setIsOwner(userData.isOwner === true);

        // Load full business details
        const businessDoc = await getDoc(doc(db, "businesses", userBusinessId));
        if (businessDoc.exists()) {
          setBusiness({ id: businessDoc.id, ...businessDoc.data() } as Business);
        }
      } catch (err: any) {
        console.error("Error loading business context:", err);
        setError(err.message || "Failed to load business context");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return { businessId, business, user, isOwner, loading, error };
}

/**
 * Get businessId synchronously from current user (for use in callbacks)
 * Returns null if not available
 * 
 * PREFER useBusiness() hook when possible
 */
export async function getBusinessId(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;

  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (!userDoc.exists()) {
      // Fallback to custom claims
      const tokenResult = await user.getIdTokenResult();
      return (tokenResult.claims.businessId as string) || user.uid;
    }
    
    const userData = userDoc.data() as UserProfile;
    return userData.businessId || user.uid; // Fallback for legacy users
  } catch (error) {
    console.error("Error getting businessId:", error);
    return user.uid; // Fallback to userId for legacy support
  }
}
