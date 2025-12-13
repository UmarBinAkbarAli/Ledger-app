"use client";

import { useUserRole } from "@/lib/useUserRole";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AccountantOnly({ children }: { children: any }) {
  const { role, loading } = useUserRole();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !(role === "admin" || role === "accountant")) {
      router.replace("/sales/new");
    }
  }, [role, loading]);

  if (loading) return null;
  if (!(role === "admin" || role === "accountant")) return null;

  return children;
}
