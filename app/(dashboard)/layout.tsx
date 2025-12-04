"use client";

import { ReactNode, useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import useOnlineStatus from "@/app/hooks/useOnlineStatus";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  const online = useOnlineStatus();

  useEffect(() => {
    onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/login");
      } else {
        setUser(currentUser);
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="flex min-h-screen bg-gray-100">

      {/* 🔴 Offline Banner (Top, Full Width) */}
      {!online && (
        <div className="fixed top-0 left-0 w-full bg-red-600 text-white text-center py-2 z-50">
          You are offline. Changes will sync automatically once you are online.
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-md p-5 space-y-4">
        <h2 className="text-xl font-bold mb-6">Ledger App</h2>

        <nav className="flex flex-col space-y-2">
          <Link className="hover:text-blue-600" href="/dashboard">Dashboard</Link>
          <Link className="hover:text-blue-600" href="/sales">Sales</Link>
          <Link className="hover:text-blue-600" href="/purchase">Purchase</Link>
          <Link className="hover:text-blue-600" href="/income">Add Income</Link>
          <Link className="hover:text-blue-600" href="/income-list">Income List</Link>
          <Link className="hover:text-blue-600" href="/expenses">Expenses</Link>
          <Link className="hover:text-blue-600" href="/expense-list">Expense List</Link>
          <Link className="hover:text-blue-600" href="/customers">Customers</Link>
        </nav>

        <div className="pt-10">
          <LogoutButton />
        </div>
      </aside>

      {/* Page content */}
      <main className="flex-1 p-6 pt-16"> {/* pt-16 prevents content hiding under banner */}
        {children}
      </main>
    </div>
  );
}
