"use client";

import { useUserRole } from "@/lib/useUserRole";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { UserRole } from "@/lib/roles";

export default function AccountantOnly({ children }: { children: any }) {
  const { role, loading } = useUserRole();
  const router = useRouter();

  const isAllowed = role === UserRole.ADMIN || role === UserRole.ACCOUNTANT;

  useEffect(() => {
    if (!loading && !isAllowed) {
      router.replace("/dashboard");
    }
  }, [role, loading, isAllowed, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
          <p>You do not have permission to access this page. Only accountants and administrators can access this area.</p>
        </div>
      </div>
    );
  }

  return children;
}
