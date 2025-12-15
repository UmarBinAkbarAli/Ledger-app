"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import { useState } from "react";
import IncomeForm from "@/components/forms/IncomeForm";
import ExpenseForm from "@/components/forms/ExpenseForm";

export default function DashboardPage() {
  // -------------------------------------------
  // STATE MANAGEMENT
  // -------------------------------------------
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); 

  // -------------------------------------------
  // UI STARTS HERE
  // -------------------------------------------
  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Quick Actions</h2>

      {/* QUICK ACTIONS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <button
          onClick={() => setShowIncomeModal(true)}
          className="bg-green-600 text-white py-4 rounded-xl shadow hover:opacity-80 transition-opacity"
        >
          + Add Income
        </button>

        <button
          onClick={() => setShowExpenseModal(true)}
          className="bg-red-600 text-white py-4 rounded-xl shadow hover:opacity-80 transition-opacity"
        >
          + Add Expense
        </button>

        {/* Navigation Buttons */}
        <QuickAction title="Add Sale" url="/sales/new" color="bg-blue-600" />
        <QuickAction title="Add Purchase" url="/purchase/new" color="bg-blue-600" />
      </div>

      {/* ─────────────────────────────────────────────── */}
      {/* NEW: CLIENT BRANDING BANNER                     */}
      {/* ─────────────────────────────────────────────── */}
      <div className="w-full bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-8 shadow-xl text-white flex flex-col items-start justify-center min-h-[200px]">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2">
          Boxilla Packages
        </h1>
        <div className="h-1 w-20 bg-blue-500 rounded mb-4"></div>
        <p className="text-lg md:text-xl text-gray-300 font-light">
          Welcome back, <span className="font-semibold text-white">Babar Akbar</span>
        </p>
      </div>

      {/* INCOME MODAL */}
      {showIncomeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-lg shadow-lg p-6 relative">
            <button
              onClick={() => setShowIncomeModal(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-black"
            >
              ✕
            </button>
            <h2 className="text-xl font-bold mb-4">Add Income</h2>
            <IncomeForm
              onSuccess={() => {
                setShowIncomeModal(false);
                setRefreshKey((k) => k + 1);
              }}
            />
          </div>
        </div>
      )}

      {/* EXPENSE MODAL */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-lg shadow-lg p-6 relative">
            <button
              onClick={() => setShowExpenseModal(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-black"
            >
              ✕
            </button>
            <h2 className="text-xl font-bold mb-4">Add Expense</h2>
            <ExpenseForm
              onSuccess={() => {
                setShowExpenseModal(false);
                setRefreshKey((k) => k + 1);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// =================================================================
// Quick Action Button Component
// =================================================================
function QuickAction({
  title,
  url,
  color,
}: {
  title: string;
  url: string;
  color: string;
}) {
  return (
    <Link href={url} className="w-full">
      <Button
        className={`${color} w-full text-white py-4 rounded-xl shadow hover:opacity-80 transition-opacity font-regular`}
      >
        {title}
      </Button>
    </Link>
  );
}