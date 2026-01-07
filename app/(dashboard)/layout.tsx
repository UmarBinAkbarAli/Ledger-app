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
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/login");
      } else {
        setUser(currentUser);
      }
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background-light flex flex-col">
      {/* TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-50 border-b border-border-light bg-white/90 backdrop-blur-md">
        <div className="flex items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="size-10 flex items-center justify-center bg-primary-light rounded-full text-primary">
              <span className="material-symbols-outlined text-[24px]">account_balance_wallet</span>
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold leading-tight tracking-tight text-text-primary">Financial Dashboard</h1>
              <p className="text-sm text-text-secondary hidden sm:block">Welcome back, {user?.displayName || user?.email?.split('@')[0] || 'User'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 md:gap-6 pr-6">
            <button className="flex size-10 items-center justify-center rounded-full bg-white border border-border-light text-text-secondary hover:bg-gray-50 hover:text-primary transition-colors shadow-sm">
              <span className="material-symbols-outlined text-[24px]">notifications</span>
            </button>
            <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-white shadow-md bg-gray-200">
              {user?.photoURL ? (
                <img alt="User Profile" className="h-full w-full object-cover" src={user.photoURL} />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-primary text-white font-bold">
                  {(user?.displayName?.[0] || user?.email?.[0] || 'U').toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 🔴 Offline Banner */}
      {!online && (
        <div className="bg-red-600 text-white text-center py-2 z-40">
          You are offline. Changes will sync automatically once you are online.
        </div>
      )}

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-64 bg-white shadow-md p-5 space-y-4 hidden lg:block">
          <h2 className="text-xl font-bold mb-6 text-text-primary">Menu</h2>

          <nav className="flex flex-col space-y-2">
            <Link className="hover:text-primary transition-colors text-text-primary" href="/dashboard">Dashboard</Link>
            <Link className="hover:text-primary transition-colors text-text-primary" href="/sales">Sales</Link>
            <Link className="hover:text-primary transition-colors text-text-primary" href="/income-list">Income</Link>
            <Link className="hover:text-primary transition-colors text-text-primary" href="/purchase">Purchase</Link>
            <Link className="hover:text-primary transition-colors text-text-primary" href="/expense-list">Expense</Link>
            <Link className="hover:text-primary transition-colors text-text-primary" href="/customers">Customers</Link>
            <Link className="hover:text-primary transition-colors text-text-primary" href="/supplier">Suppliers</Link>
            <Link className="hover:text-primary transition-colors text-text-primary" href="/bank-accounts">Bank Accounts</Link>
            <Link className="hover:text-primary transition-colors text-text-primary" href="/bank-ledger">Bank Ledger</Link>
            <Link className="hover:text-primary transition-colors text-text-primary" href="/petty-cash">Petty Cash</Link>
            <Link className="hover:text-primary transition-colors text-text-primary" href="/operational-expenses">Operational Expenses</Link>
            <Link className="hover:text-primary transition-colors text-text-primary" href="/settings/expense-categories">Expense Categories</Link>
            <div className="border-t border-border-light my-2 pt-2">
              <Link className="hover:text-primary transition-colors text-text-primary flex items-center gap-2" href="/settings/profile">
                <span className="material-symbols-outlined text-[18px]">person</span>
                Profile Settings
              </Link>
            </div>
          </nav>

          <div className="pt-10">
            <LogoutButton />
          </div>
        </aside>

        {/* Page content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
