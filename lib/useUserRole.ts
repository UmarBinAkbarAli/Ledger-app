"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export function useUserRole() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRole = async () => {
      const user = auth.currentUser;
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      const snap = await getDoc(doc(db, "users", user.uid));
      setRole(snap.exists() ? snap.data().role : null);
      setLoading(false);
    };

    loadRole();
  }, []);

  return { role, loading };
}
