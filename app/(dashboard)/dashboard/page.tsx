"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import Link from "next/link";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);

  const [totalSales, setTotalSales] = useState(0);
  const [totalPurchases, setTotalPurchases] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);

  const [receivable, setReceivable] = useState(0);
  const [payable, setPayable] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      const user = auth.currentUser;
      if (!user) return;

      // ───────────────────────────────────────────
      const salesSnap = await getDocs(
        query(collection(db, "sales"), where("userId", "==", user.uid))
      );
      let salesTotal = 0;
      let receivableTotal = 0;
      salesSnap.forEach((d) => {
        const bill = Number(d.data().amount || 0);
        const paid = Number(d.data().paidAmount || 0);
        salesTotal += bill;
        receivableTotal += bill - paid;
      });

      // ───────────────────────────────────────────
      const purchaseSnap = await getDocs(
        query(collection(db, "purchase"), where("userId", "==", user.uid))
      );
      let purchaseTotal = 0;
      let payableTotal = 0;
      purchaseSnap.forEach((d) => {
        const bill = Number(d.data().amount || 0);
        const paid = Number(d.data().paidAmount || 0);
        purchaseTotal += bill;
        payableTotal += bill - paid;
      });

      // ───────────────────────────────────────────
      const incomeSnap = await getDocs(
        query(collection(db, "income"), where("userId", "==", user.uid))
      );
      let incomeTotal = 0;
      incomeSnap.forEach((d) => (incomeTotal += Number(d.data().amount || 0)));

      // ───────────────────────────────────────────
      const expenseSnap = await getDocs(
        query(collection(db, "expenses"), where("userId", "==", user.uid))
      );
      let expenseTotal = 0;
      expenseSnap.forEach((d) => (expenseTotal += Number(d.data().amount || 0)));

      setTotalSales(salesTotal);
      setTotalPurchases(purchaseTotal);
      setTotalIncome(incomeTotal);
      setTotalExpenses(expenseTotal);
      setReceivable(receivableTotal);
      setPayable(payableTotal);

      setLoading(false);
    };

    loadData();
  }, []);

  if (loading) return <p className="p-6">Loading dashboard...</p>;

  const netBalance = totalIncome - totalExpenses;

  return (
    <div className="p-6">

      {/*─────────────────────────*/}
      {/* QUICK ACTION BUTTONS   */}
      {/*─────────────────────────*/}
      <h2 className="text-xl font-bold mb-4">Quick Actions</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <QuickAction title="Add Sale" url="/sales/new" color="bg-blue-600" />
        <QuickAction title="Add Purchase" url="/purchase/new" color="bg-orange-600" />
        <QuickAction title="Add Income" url="/income" color="bg-green-600" />
        <QuickAction title="Add Expense" url="/expenses" color="bg-red-600" />
      </div>

      {/*─────────────────────────*/}
      {/*  DASHBOARD SUMMARY     */}
      {/*─────────────────────────*/}
      <h1 className="text-3xl font-bold mb-6">Dashboard Summary</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        <SummaryCard
          title="Total Sales"
          value={totalSales}
          bg="bg-blue-100"
          color="text-blue-700"
        />

        <SummaryCard
          title="Total Purchases"
          value={totalPurchases}
          bg="bg-orange-100"
          color="text-orange-700"
        />

        <SummaryCard
          title="Total Income Received"
          value={totalIncome}
          bg="bg-green-100"
          color="text-green-700"
        />

        <SummaryCard
          title="Total Expense Paid"
          value={totalExpenses}
          bg="bg-red-100"
          color="text-red-700"
        />

        <SummaryCard
          title="Outstanding Receivable"
          value={receivable}
          bg="bg-purple-100"
          color="text-purple-700"
        />

        <SummaryCard
          title="Outstanding Payable"
          value={payable}
          bg="bg-pink-100"
          color="text-pink-700"
        />

        <SummaryCard
          title="Net Balance"
          value={netBalance}
          bg="bg-gray-200"
          color="text-gray-800"
        />

      </div>
    </div>
  );
}

// ───────────────────────────────
// Quick Action Button Component
// ───────────────────────────────

function QuickAction({ title, url, color }: { title: string; url: string; color: string }) {
  return (
    <Link
      href={url}
      className={`${color} text-white text-center py-4 rounded-xl shadow hover:opacity-90 font-semibold`}
    >
      {title}
    </Link>
  );
}

// ───────────────────────────────
// Summary Card Component
// ───────────────────────────────

function SummaryCard({
  title,
  value,
  bg,
  color,
}: {
  title: string;
  value: number;
  bg: string;
  color: string;
}) {
  return (
    <div className={`${bg} ${color} p-6 rounded-xl shadow font-semibold text-lg`}>
      <p className="mb-2">{title}</p>
      <p className="text-2xl font-bold">{value.toLocaleString()}</p>
    </div>
  );
}
