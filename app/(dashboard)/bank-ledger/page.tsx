"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";


export default function BankLedgerPage() {
  const [banks, setBanks] = useState<any[]>([]);
  const [selectedBank, setSelectedBank] = useState("");
  const [startDate, setStartDate] = useState(
  new Date(new Date().setDate(new Date().getDate() - 7))
    .toISOString()
    .split("T")[0]
);

const [endDate, setEndDate] = useState(
  new Date().toISOString().split("T")[0]
);


  // Summary values (filled in next steps)
  const [openingBalance, setOpeningBalance] = useState(0);
  const [bankIn, setBankIn] = useState(0);
  const [bankOut, setBankOut] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);


  const [loading, setLoading] = useState(true);

  // Load bank accounts
  useEffect(() => {
    const loadBanks = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const ref = collection(db, "users", user.uid, "bankAccounts");
      const snap = await getDocs(ref);

      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setBanks(list);

      // Auto-select first bank if none selected
      if (list.length > 0 && !selectedBank) {
        setSelectedBank(list[0].name);
      }

      setLoading(false);
    };

    loadBanks();
  }, []);

  // Load BANK IN / BANK OUT for selected bank & date
useEffect(() => {
  const loadBankData = async () => {
    const user = auth.currentUser;
    if (!user || !selectedBank) return;

    // INCOME (BANK payments)
    const incomeQuery = query(
      collection(db, "income"),
      where("userId", "==", user.uid),
      where("paymentMethod", "==", "BANK"),
      where("bankName", "==", selectedBank),
      where("date", ">=", startDate),
      where("date", "<=", endDate)
    );

    // EXPENSE (BANK payments)
    const expenseQuery = query(
      collection(db, "expenses"),
      where("userId", "==", user.uid),
      where("paymentMethod", "==", "BANK"),
      where("bankName", "==", selectedBank),
      where("date", ">=", startDate),
      where("date", "<=", endDate)
    );

    const incomeSnap = await getDocs(incomeQuery);
    const expenseSnap = await getDocs(expenseQuery);

    const totalIn = incomeSnap.docs
      .map((d) => Number(d.data().amount || 0))
      .reduce((a, b) => a + b, 0);

    const totalOut = expenseSnap.docs
      .map((d) => Number(d.data().amount || 0))
      .reduce((a, b) => a + b, 0);

    setBankIn(totalIn);
    setBankOut(totalOut);

    // Build transaction list
    const tx = [
      ...incomeSnap.docs.map((d) => ({
        ...d.data(),
        id: d.id,
        type: "Income",
      })),
      ...expenseSnap.docs.map((d) => ({
        ...d.data(),
        id: d.id,
        type: "Expense",
      })),
    ];

    setTransactions(tx);
  };

  loadBankData();
}, [selectedBank, startDate]);

// OPENING BALANCE (YESTERDAY’S CLOSING)
useEffect(() => {
  const calcOpening = async () => {
    const user = auth.currentUser;
    if (!user || !selectedBank) return;

    // Yesterday income
    const incomeQuery = query(
      collection(db, "income"),
      where("userId", "==", user.uid),
      where("paymentMethod", "==", "BANK"),
      where("bankName", "==", selectedBank),
      where("date", "<", startDate)
    );

    // Yesterday expenses
    const expenseQuery = query(
      collection(db, "expenses"),
      where("userId", "==", user.uid),
      where("paymentMethod", "==", "BANK"),
      where("bankName", "==", selectedBank),
      where("date", "<", startDate)
    );

    const incomeSnap = await getDocs(incomeQuery);
    const expenseSnap = await getDocs(expenseQuery);

    const yIn = incomeSnap.docs
      .map((d) => Number(d.data().amount || 0))
      .reduce((a, b) => a + b, 0);

    const yOut = expenseSnap.docs
      .map((d) => Number(d.data().amount || 0))
      .reduce((a, b) => a + b, 0);

    setOpeningBalance(yIn - yOut);
  };

  calcOpening();
}, [selectedBank, startDate, endDate]);

// Closing Balance Calculation
useEffect(() => {
  setClosingBalance(openingBalance + bankIn - bankOut);
}, [openingBalance, bankIn, bankOut]);


  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center text-gray-600">
        Loading bank ledger...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Bank Ledger</h1>

      {/* BANK SELECTOR */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-1">Select Bank</label>
        <select
          className="border p-2 rounded w-full"
          value={selectedBank}
          onChange={(e) => setSelectedBank(e.target.value)}
        >
          {banks.map((b) => (
            <option key={b.id} value={b.name}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">

      {/* Start Date */}
      <div>
        <label className="block text-sm font-medium mb-1">Start Date</label>
        <input
          type="date"
          className="border p-2 rounded w-full"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </div>

      {/* End Date */}
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

   {/* preset date range buttons */}

                <div className="flex gap-3 mb-6">
        <button
          onClick={() => {
            const today = new Date().toISOString().split("T")[0];
            setStartDate(today);
            setEndDate(today);
          }}
          className="px-3 py-1 bg-gray-100 border rounded"
        >
          Today
        </button>

        <button
          onClick={() => {
            const d = new Date();
            const end = d.toISOString().split("T")[0];
            d.setDate(d.getDate() - 7);
            const start = d.toISOString().split("T")[0];
            setStartDate(start);
            setEndDate(end);
          }}
          className="px-3 py-1 bg-gray-100 border rounded"
        >
          Last 7 Days
        </button>

        <button
          onClick={() => {
            const d = new Date();
            const end = d.toISOString().split("T")[0];
            d.setMonth(d.getMonth() - 1);
            const start = d.toISOString().split("T")[0];
            setStartDate(start);
            setEndDate(end);
          }}
          className="px-3 py-1 bg-gray-100 border rounded"
        >
          Last 30 Days
        </button>
      </div>



      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

        {/* Opening Balance */}
        <div className="bg-gray-50 p-4 border rounded shadow-sm">
          <p className="text-sm text-gray-600">Opening Balance</p>
          <p className="text-2xl font-bold text-gray-800">
            {openingBalance.toLocaleString()}
          </p>
        </div>

        {/* Bank In */}
        <div className="bg-green-50 p-4 border border-green-200 rounded shadow-sm">
          <p className="text-sm text-green-700">Money In</p>
          <p className="text-2xl font-bold text-green-800">
            {bankIn.toLocaleString()}
          </p>
        </div>

        {/* Bank Out */}
        <div className="bg-red-50 p-4 border border-red-200 rounded shadow-sm">
          <p className="text-sm text-red-700">Money Out</p>
          <p className="text-2xl font-bold text-red-800">
            {bankOut.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Closing Balance */}
      <div className="bg-blue-50 p-5 border border-blue-200 rounded shadow-sm mb-8">
        <p className="text-sm text-blue-700">Closing Balance</p>
        <p className="text-3xl font-bold text-blue-900">
          {closingBalance.toLocaleString()}
        </p>
      </div>

      {/* TRANSACTION TABLE */}
<div className="bg-white border rounded shadow-sm p-4">
  <h2 className="text-xl font-semibold mb-4">Bank Transactions</h2>

  {transactions.length === 0 ? (
    <p className="text-gray-500 text-sm">
      No bank transactions found for this date.
    </p>
  ) : (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="bg-gray-100 border-b">
          <th className="p-2 text-left">Type</th>
          <th className="p-2 text-left">Name</th>
          <th className="p-2 text-right">Amount</th>
            <th className="p-2 text-right">Notes</th>
        </tr>
      </thead>

      <tbody>
        {transactions.map((t) => (
          <tr key={t.id} className="border-b">
            <td className="p-2 font-medium">
              {t.type === "Income" ? (
                <span className="text-green-700">Income</span>
              ) : (
                <span className="text-red-700">Expense</span>
              )}
            </td>

            <td className="p-2">
              {t.customerName || t.supplierName || "—"}
            </td>

            <td
              className={`p-2 text-right font-semibold ${
                t.type === "Income" ? "text-green-700" : "text-red-700"
              }`}
            >
              {t.type === "Income" ? "+" : "-"}
              {Number(t.amount).toLocaleString()}
            </td>

              <td className="p-2 text-gray-500 text-sm">
              {t.notes || ""}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )}
</div>

    </div>
  );
}
