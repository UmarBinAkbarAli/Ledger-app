"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import { useState } from "react"; // Removed useEffect since we don't fetch data anymore

// Removed unused firebase imports to prevent accidental reads
// import { db, auth } from "@/lib/firebase"; 
// import { collection, query, where, getDocs } from "firebase/firestore";

import IncomeForm from "@/components/forms/IncomeForm";
import ExpenseForm from "@/components/forms/ExpenseForm";

// Removed Recharts imports since you deleted the chart
/* import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from "recharts"; 
*/

export default function DashboardPage() {
  // -------------------------------------------
  // STATE MANAGEMENT
  // -------------------------------------------
  // We only need states for the Modals now. 
  // All other stats (income, expense, chartData) are deleted.
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  
  // This key forces a refresh if needed, though less useful without stats.
  const [refreshKey, setRefreshKey] = useState(0); 

  // -------------------------------------------
  // UI STARTS HERE
  // -------------------------------------------
  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Quick Actions</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <button
          onClick={() => setShowIncomeModal(true)}
          className="bg-green-600 text-white py-4 rounded-xl shadow hover:opacity-80"
        >
          + Add Income
        </button>

        <button
          onClick={() => setShowExpenseModal(true)}
          className="bg-red-600 text-white py-4 rounded-xl shadow hover:opacity-80"
        >
          + Add Expense
        </button>

        {/* Navigation Buttons */}
        <QuickAction title="Add Sale" url="/sales/new" color="bg-blue-600" />
        <QuickAction title="Add Purchase" url="/purchase/new" color="bg-blue-600" />
      </div>

      {/* INCOME MODAL */}
      {showIncomeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
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
    <Link href={url}>
      <Button
        className={`${color} w-full text-white py-4 rounded-xl shadow hover:opacity-80 font-regular`}
      >
        {title}
      </Button>
    </Link>
  );
}