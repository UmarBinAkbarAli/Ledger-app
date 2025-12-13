"use client";

import { useUserRole } from "@/lib/useUserRole";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminOnly({ children }: { children: any }) {
  const { role, loading } = useUserRole();
  const router = useRouter();

  useEffect(() => {
    if (!loading && role !== "admin") {
      router.replace("/sales/new");
    }
  }, [role, loading]);

  if (loading) return null;
  if (role !== "admin") return null;

  return children;
}
