"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import { useState, useEffect } from "react";

import { db, auth } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import IncomeForm from "@/components/forms/IncomeForm";
import ExpenseForm from "@/components/forms/ExpenseForm";


// Recharts
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function DashboardPage() {
  // -------------------------------------------
  // DATE RANGE STATES
  // -------------------------------------------
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [endDate, setEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // -------------------------------------------
  // SUMMARY STATES
  // -------------------------------------------
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [pettyCash, setPettyCash] = useState(0);
  const [totalBankBalance, setTotalBankBalance] = useState(0);
  const [netFlow, setNetFlow] = useState(0);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);



  // Chart Data
  const [chartData, setChartData] = useState<any[]>([]);

  // Loadbank accounts for dashboard use
  useEffect(() => {
  const loadBanks = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const snap = await getDocs(
      collection(db, "users", user.uid, "bankAccounts")
    );

    const list: any[] = [];
    snap.forEach((d) => list.push(d.data()));
    setBankAccounts(list);
  };

  loadBanks();
}, []);


  // -------------------------------------------
  // LOAD DASHBOARD SUMMARY
  // -------------------------------------------
  useEffect(() => {
    const loadSummary = async () => {
      const user = auth.currentUser;
      if (!user) return;

      // ------------------------------
      // INCOME QUERY
      // ------------------------------
      const incomeQuery = query(
        collection(db, "income"),
        where("userId", "==", user.uid),
        where("date", ">=", startDate),
        where("date", "<=", endDate)
      );

      // ------------------------------
      // EXPENSE QUERY
      // ------------------------------
      const expenseQuery = query(
        collection(db, "expenses"),
        where("userId", "==", user.uid),
        where("date", ">=", startDate),
        where("date", "<=", endDate)
      );

      const incomeSnap = await getDocs(incomeQuery);
      const expenseSnap = await getDocs(expenseQuery);

      // ------------------------------
      // TOTAL INCOME
      // ------------------------------
      const incomeTotal = incomeSnap.docs
        .map((d) => Number(d.data().amount || 0))
        .reduce((a, b) => a + b, 0);

      setTotalIncome(incomeTotal);

      // ------------------------------
      // TOTAL EXPENSE
      // ------------------------------
      const expenseTotal = expenseSnap.docs
        .map((d) => Number(d.data().amount || 0))
        .reduce((a, b) => a + b, 0);

      setTotalExpense(expenseTotal);

      // ------------------------------
      // NET FLOW
      // ------------------------------
      setNetFlow(incomeTotal - expenseTotal);

      // ------------------------------
      // PETTY CASH CALCULATION (CASH ONLY)
      // ------------------------------
      const cashIncome = incomeSnap.docs.filter(
        (d) => d.data().paymentMethod === "CASH"
      );

      const cashExpense = expenseSnap.docs.filter(
        (d) => d.data().paymentMethod === "CASH"
      );

      const cashIn = cashIncome
        .map((d) => Number(d.data().amount || 0))
        .reduce((a, b) => a + b, 0);

      const cashOut = cashExpense
        .map((d) => Number(d.data().amount || 0))
        .reduce((a, b) => a + b, 0);

      const cashOpening = 0;
        setPettyCash(cashOpening + cashIn - cashOut);

      // ------------------------------
      // TOTAL BANK BALANCE (BANK ONLY)
      // ------------------------------
      const bankIncome = incomeSnap.docs.filter(
        (d) => d.data().paymentMethod === "BANK"
      );

      const bankExpense = expenseSnap.docs.filter(
        (d) => d.data().paymentMethod === "BANK"
      );

      const bankInTotal = bankIncome
        .map((d) => Number(d.data().amount || 0))
        .reduce((a, b) => a + b, 0);

      const bankOutTotal = bankExpense
        .map((d) => Number(d.data().amount || 0))
        .reduce((a, b) => a + b, 0);

      const bankOpeningTotal = bankAccounts.reduce(
        (sum, b) => sum + Number(b.openingBalance || 0), 0 );
      setTotalBankBalance(bankOpeningTotal + bankInTotal - bankOutTotal);


      // ------------------------------------
      // CASH FLOW CHART (DATE-WISE)
      // ------------------------------------
      const dates: any[] = [];
      const start = new Date(startDate);
      const end = new Date(endDate);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split("T")[0]);
      }

      const rows = dates.map((date) => {
        const dayIncome = incomeSnap.docs
          .filter((d) => d.data().date === date)
          .map((d) => Number(d.data().amount || 0))
          .reduce((a, b) => a + b, 0);

        const dayExpense = expenseSnap.docs
          .filter((d) => d.data().date === date)
          .map((d) => Number(d.data().amount || 0))
          .reduce((a, b) => a + b, 0);

        return {
          date,
          income: dayIncome,
          expense: dayExpense,
        };
      });

      setChartData(rows);
    };

    loadSummary();
  }, [startDate, endDate, refreshKey, bankAccounts]);

  // -------------------------------------------
  // UI STARTS HERE
  // -------------------------------------------

  return (
    <div className="p-6">

      {/*─────────────────────────*/}
      {/* DATE FILTERS            */}
      {/*─────────────────────────*/}
      <h2 className="text-xl font-bold mb-4">Dashboard Range</h2>

      <div className="flex flex-wrap gap-3 mb-6">
        <button
          className="px-3 py-1 border rounded bg-gray-100 hover:bg-gray-200"
          onClick={() => {
            const today = new Date().toISOString().split("T")[0];
            setStartDate(today);
            setEndDate(today);
          }}
        >
          Today
        </button>

        <button
          className="px-3 py-1 border rounded bg-gray-100 hover:bg-gray-200"
          onClick={() => {
            const d = new Date();
            const end = d.toISOString().split("T")[0];
            d.setDate(d.getDate() - 7);
            const start = d.toISOString().split("T")[0];
            setStartDate(start);
            setEndDate(end);
          }}
        >
          Last 7 Days
        </button>

        <button
          className="px-3 py-1 border rounded bg-gray-100 hover:bg-gray-200"
          onClick={() => {
            const d = new Date();
            const end = d.toISOString().split("T")[0];
            d.setDate(d.getDate() - 30);
            const start = d.toISOString().split("T")[0];
            setStartDate(start);
            setEndDate(end);
          }}
        >
          Last 30 Days
        </button>
      </div>

      {/* Custom Date Range */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        <div>
          <label className="block text-sm font-medium mb-1">Start Date</label>
          <input
            type="date"
            className="border p-2 rounded w-full"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">End Date</label>
          <input
            type="date"
            className="border p-2 rounded w-full"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      {/*─────────────────────────*/}
      {/* SUMMARY CARDS           */}
      {/*─────────────────────────*/}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <SummaryCard label="Petty Cash" value={pettyCash} color="yellow" />
        <SummaryCard label="Bank Balance" value={totalBankBalance} color="blue" />
        <SummaryCard label="Total Income" value={totalIncome} color="green" />
        <SummaryCard label="Total Expense" value={totalExpense} color="red" />
      </div>

      {/* NET FLOW */}
      <div className="p-5 bg-gray-100 border rounded shadow mb-10">
        <p className="text-sm text-gray-600">Net Flow (Income − Expense)</p>
        <p
          className={`text-3xl font-bold ${
            netFlow >= 0 ? "text-green-700" : "text-red-700"
          }`}
        >
          {netFlow.toLocaleString()}
        </p>
      </div>

            {/* QUICK ACTION BUTTONS    */}
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

        {/* Keep these as navigation */}
        <QuickAction title="Add Sale" url="/sales/new" color="bg-blue-600" />
        <QuickAction title="Add Purchase" url="/purchase/new" color="bg-blue-600" />
      </div>
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

      {/*─────────────────────────*/}
      {/* CASH FLOW CHART         */}
      {/*─────────────────────────*/}
      <h2 className="text-xl font-bold mb-4">Cash Flow Overview</h2>

      <div className="w-full h-80 mb-10 bg-white border rounded shadow p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid stroke="#eee" strokeDasharray="5 5" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />

            <Line
              type="monotone"
              dataKey="income"
              stroke="#16a34a"
              strokeWidth={3}
            />
            <Line
              type="monotone"
              dataKey="expense"
              stroke="#dc2626"
              strokeWidth={3}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// =================================================================
// Summary Card Component
// =================================================================
function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const bg =
    color === "yellow"
      ? "bg-yellow-50 border-yellow-200 text-yellow-800"
      : color === "blue"
      ? "bg-blue-50 border-blue-200 text-blue-800"
      : color === "green"
      ? "bg-green-50 border-green-200 text-green-800"
      : "bg-red-50 border-red-200 text-red-800";

  return (
    <div className={`p-4 rounded border shadow ${bg}`}>
      <p className="text-sm">{label}</p>
      <p className="text-2xl font-bold">{value.toLocaleString()}</p>
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
