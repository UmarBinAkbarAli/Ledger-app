"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, query, where, } from "firebase/firestore";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);

  const [totalSales, setTotalSales] = useState(0);
  const [totalPurchases, setTotalPurchases] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [startDate, setStartDate] = useState( new Date().toISOString().split("T")[0] );
  const [endDate, setEndDate] = useState( new Date().toISOString().split("T")[0] );

  const [receivable, setReceivable] = useState(0);
  const [payable, setPayable] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      const user = auth.currentUser;
      if (!user) return;

      // ───────────────────────────────────────────
      // 1) LOAD SALES
      // ───────────────────────────────────────────
      const qSales = query(
        collection(db, "sales"),
        where("userId", "==", user.uid)
      );
      const salesSnap = await getDocs(qSales);

      let salesTotal = 0;
      let receivableTotal = 0;

      salesSnap.forEach((d) => {
        const data: any = d.data();
        const bill = Number(data.amount || 0);
        const paid = Number(data.paidAmount || 0);

        salesTotal += bill;
        receivableTotal += bill - paid; // outstanding from customers
      });

      // ───────────────────────────────────────────
      // 2) LOAD PURCHASES
      // ───────────────────────────────────────────
      const qPurchases = query(
        collection(db, "purchase"),
        where("userId", "==", user.uid)
      );
      const purchaseSnap = await getDocs(qPurchases);

      let purchaseTotal = 0;
      let payableTotal = 0;

      purchaseSnap.forEach((d) => {
        const data: any = d.data();
        const bill = Number(data.amount || 0);
        const paid = Number(data.paidAmount || 0);

        purchaseTotal += bill;
        payableTotal += bill - paid; // outstanding to suppliers
      });

      // ───────────────────────────────────────────
      // 3) LOAD INCOME (payment received)
      // ───────────────────────────────────────────
      const qIncome = query(
        collection(db, "income"),
        where("userId", "==", user.uid)
      );
      const incomeSnap = await getDocs(qIncome);

      let incomeTotal = 0;
      incomeSnap.forEach((d) => {
        incomeTotal += Number(d.data().amount || 0);
      });

      // ───────────────────────────────────────────
      // 4) LOAD EXPENSES (payment made)
      // ───────────────────────────────────────────
      const qExpenses = query(
        collection(db, "expenses"),
        where("userId", "==", user.uid)
      );
      const expenseSnap = await getDocs(qExpenses);

      let expenseTotal = 0;
      expenseSnap.forEach((d) => {
        expenseTotal += Number(d.data().amount || 0);
      });

      // ───────────────────────────────────────────
      // SET STATE
      // ───────────────────────────────────────────
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

  // Profit = income – expense
  const netBalance = totalIncome - totalExpenses;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Dashboard Summary</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* Total Sales */}
        <SummaryCard
          title="Total Sales"
          value={totalSales}
          bg="bg-blue-100"
          color="text-blue-700"
        />

        {/* Total Purchases */}
        <SummaryCard
          title="Total Purchases"
          value={totalPurchases}
          bg="bg-orange-100"
          color="text-orange-700"
        />

        {/* Total Income */}
        <SummaryCard
          title="Total Income Received"
          value={totalIncome}
          bg="bg-green-100"
          color="text-green-700"
        />

        {/* Total Expense */}
        <SummaryCard
          title="Total Expense Paid"
          value={totalExpenses}
          bg="bg-red-100"
          color="text-red-700"
        />

        {/* Receivable */}
        <SummaryCard
          title="Outstanding Receivable"
          value={receivable}
          bg="bg-purple-100"
          color="text-purple-700"
        />

        {/* Payable */}
        <SummaryCard
          title="Outstanding Payable"
          value={payable}
          bg="bg-pink-100"
          color="text-pink-700"
        />

        {/* Net Balance */}
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
// SUMMARY CARD COMPONENT
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
    <div
      className={`${bg} ${color} p-6 rounded-xl shadow font-semibold text-lg`}
    >
      <p className="mb-2">{title}</p>
      <p className="text-2xl font-bold">{value.toLocaleString()}</p>
    </div>
  );
}
