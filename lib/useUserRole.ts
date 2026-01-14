"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, getDocFromServer } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { UserRole, ROLE_PERMISSIONS, Permission, hasPermission, isAdminRole, DEFAULT_ROLE } from "@/lib/roles";
import { UserProfile } from "@/lib/userSchema";

interface UseUserRoleReturn {
  role: UserRole | null;
  user: UserProfile | null;
  loading: boolean;
  hasPermission: (permission: Permission) => boolean;
  isAdmin: boolean;
}

export function useUserRole(): UseUserRoleReturn {
  const [role, setRole] = useState<UserRole | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRole = async (authUser: any) => {
      if (!authUser) {
        setRole(null);
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        // Force read from server to avoid stale cache after role changes
        const snap = await getDocFromServer(doc(db, "users", authUser.uid));
        if (snap.exists()) {
          let userData = snap.data() as UserProfile;

          // Legacy users without roles: default locally to avoid permission errors
          if (!userData.role) {
            console.warn("User without role detected. Defaulting locally:", DEFAULT_ROLE);
            userData = { ...userData, role: DEFAULT_ROLE };
          }

          console.log("User role loaded:", userData.role, "| Type:", typeof userData.role, "| User:", userData.email);
          console.log("Full user data:", userData);
          setRole(userData.role);
          setUser(userData);
        } else {
          // User doc doesn't exist - this should not happen after signup fix
          console.warn(`User document not found for ${authUser.uid}`);
          setRole(null);
          setUser(null);
        }
      } catch (error) {
        console.error("Error loading user role:", error);
        // Fallback to cache if server fetch fails (offline scenario)
        try {
          const snap = await getDoc(doc(db, "users", authUser.uid));
          if (snap.exists()) {
            let userData = snap.data() as UserProfile;
            // Even in cache fallback, assign default if missing
            if (!userData.role) {
              userData = { ...userData, role: DEFAULT_ROLE };
            }
            console.log("Loaded role from cache:", userData.role);
            setRole(userData.role);
            setUser(userData);
          } else {
            setRole(null);
            setUser(null);
          }
        } catch (cacheError) {
          console.error("Cache read also failed:", cacheError);
          setRole(null);
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };

    // Listen to auth state changes to handle hard refreshes and login/logout
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      console.log("Auth state changed:", authUser?.uid || "No user");
      setLoading(true);
      loadRole(authUser);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  const checkPermission = (permission: Permission): boolean => {
    return hasPermission(role, permission);
  };

  const isAdmin = isAdminRole(role);

  return {
    role,
    user,
    loading,
    hasPermission: checkPermission,
    isAdmin,
  };
}
