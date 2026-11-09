"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

/**
 * Security rules trust the businessId/role in the login token (custom claims),
 * while pages read businessId from the users/{uid} profile. If the two disagree,
 * every query is silently denied and the user just sees empty lists.
 *
 * On load this forces a token refresh (so claims fixed by an admin take effect
 * without logging out) and shows a clear warning if they still don't match.
 */
export default function AccessSyncBanner() {
  const [mismatch, setMismatch] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMismatch(false);
        return;
      }
      try {
        const cached = await user.getIdTokenResult();
        const [token, profile] = await Promise.all([
          user.getIdTokenResult(true),
          getDoc(doc(db, "users", user.uid)),
        ]);
        // An admin changed this user's access since the saved token was issued.
        // Queries on this page already ran with the old token and were denied, so
        // reload once to fetch everything again with the new one.
        const changed =
          cached.claims.businessId !== token.claims.businessId || cached.claims.role !== token.claims.role;
        if (changed) {
          let alreadyReloaded = false;
          try {
            alreadyReloaded = sessionStorage.getItem("accessReloaded") === "1";
            sessionStorage.setItem("accessReloaded", "1");
          } catch {
            alreadyReloaded = true; // no storage: don't risk a reload loop
          }
          if (!alreadyReloaded) {
            window.location.reload();
            return;
          }
        } else {
          try {
            sessionStorage.removeItem("accessReloaded");
          } catch {}
        }
        if (!profile.exists()) return; // first login: profile is created from the claims
        const data = profile.data();
        const claimBiz = token.claims.businessId as string | undefined;
        const claimRole = token.claims.role as string | undefined;
        const bizOff = !!data.businessId && !!claimBiz && claimBiz !== data.businessId;
        const roleOff = !!data.role && !!claimRole && claimRole !== data.role;
        if (bizOff || roleOff) {
          console.error("Account access out of sync", {
            claims: { businessId: claimBiz, role: claimRole },
            profile: { businessId: data.businessId, role: data.role },
          });
        }
        setMismatch(bizOff || roleOff);
      } catch (err) {
        // Offline or transient error: don't warn on a guess.
        console.warn("Access sync check skipped:", err);
      }
    });
  }, []);

  if (!mismatch) return null;
  return (
    <div className="shrink-0 bg-amber-500 text-white text-center py-2 px-4 z-40 text-sm">
      Your account&apos;s access settings are out of sync, so some data may not load. Please ask your admin
      to repair your account, then log out and log back in.
    </div>
  );
}
