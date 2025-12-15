"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function BankLedgerPage() {
  const [banks, setBanks] = useState<any[]>([]);
  const [selectedBank, setSelectedBank] = useState("");
  
  // Helper to safely get the selected bank object
  const selectedBankObj = banks.find((b) => b.name === selectedBank);

  // Default to Last 7 Days
  const [startDate, setStartDate] = useState(
    new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  // Summary values
  const [openingBalance, setOpeningBalance] = useState(0);
  const [bankIn, setBankIn] = useState(0);
  const [bankOut, setBankOut] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Load bank accounts
  useEffect(() => {
    const loadBanks = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const snap = await getDocs(collection(db, "users", user.uid, "bankAccounts"));
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setBanks(list);

      if (list.length > 0 && !selectedBank) {
        setSelectedBank(list[0].name);
      }
      setLoading(false);
    };
    loadBanks();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 2. Load BANK IN / BANK OUT for selected bank & date
  useEffect(() => {
    const loadBankData = async () => {
      const user = auth.currentUser;
      if (!user || !selectedBank) return;

      // QUERY: INCOME
      const incomeQuery = query(
        collection(db, "income"),
        where("userId", "==", user.uid),
        where("paymentMethod", "==", "BANK"),
        where("bankName", "==", selectedBank),
        where("date", ">=", startDate),
        where("date", "<=", endDate)
      );

      // QUERY: SUPPLIER EXPENSES
      const expenseQuery = query(
        collection(db, "expenses"),
        where("userId", "==", user.uid),
        where("paymentMethod", "==", "BANK"),
        where("bankName", "==", selectedBank),
        where("date", ">=", startDate),
        where("date", "<=", endDate)
      );

      // QUERY: OPERATIONAL EXPENSES
      const opExpenseQuery = query(
        collection(db, "operationalExpenses"),
        where("userId", "==", user.uid),
        where("paymentMethod", "==", "BANK"),
        where("bankName", "==", selectedBank),
        where("date", ">=", startDate),
        where("date", "<=", endDate)
      );

      const [incomeSnap, expenseSnap, opExpenseSnap] = await Promise.all([
        getDocs(incomeQuery),
        getDocs(expenseQuery),
        getDocs(opExpenseQuery)
      ]);

      // FIX: Cast d.data() as any to avoid "Property 'amount' does not exist" error
      const totalIn = incomeSnap.docs.reduce((sum, d) => sum + Number((d.data() as any).amount || 0), 0);
      
      const supplierOut = expenseSnap.docs.reduce((sum, d) => sum + Number((d.data() as any).amount || 0), 0);
      const opOut = opExpenseSnap.docs.reduce((sum, d) => sum + Number((d.data() as any).amount || 0), 0);
      
      setBankIn(totalIn);
      setBankOut(supplierOut + opOut);

      // Build Transaction List
      const tx = [
        ...incomeSnap.docs.map((d) => ({ ...(d.data() as any), id: d.id, type: "Income" })),
        ...expenseSnap.docs.map((d) => ({ ...(d.data() as any), id: d.id, type: "Expense", subType: "Supplier" })),
        ...opExpenseSnap.docs.map((d) => {
            const data = d.data() as any;
            return { 
                ...data, 
                id: d.id, 
                type: "Expense", 
                subType: "Operational", 
                customerName: data.categoryName // Map categoryName to customerName for the table
            };
        }),
      ];

      // Sort by date descending (newest first)
      setTransactions(tx.sort((a, b) => (a.date > b.date ? 1 : -1)));
    };

    loadBankData();
  }, [selectedBank, startDate, endDate]);

  // 3. OPENING BALANCE (YESTERDAY’S CLOSING)
  useEffect(() => {
    const calcOpening = async () => {
      const user = auth.currentUser;
      if (!user || !selectedBank) return;

      const incomeQuery = query(
        collection(db, "income"),
        where("userId", "==", user.uid),
        where("paymentMethod", "==", "BANK"),
        where("bankName", "==", selectedBank),
        where("date", "<", startDate)
      );

      const expenseQuery = query(
        collection(db, "expenses"),
        where("userId", "==", user.uid),
        where("paymentMethod", "==", "BANK"),
        where("bankName", "==", selectedBank),
        where("date", "<", startDate)
      );

      const opExpenseQuery = query(
        collection(db, "operationalExpenses"),
        where("userId", "==", user.uid),
        where("paymentMethod", "==", "BANK"),
        where("bankName", "==", selectedBank),
        where("date", "<", startDate)
      );

      const [incomeSnap, expenseSnap, opExpenseSnap] = await Promise.all([
        getDocs(incomeQuery),
        getDocs(expenseQuery),
        getDocs(opExpenseQuery)
      ]);

      // FIX: Cast d.data() as any here too
      const yIn = incomeSnap.docs.reduce((sum, d) => sum + Number((d.data() as any).amount || 0), 0);
      const yOut = expenseSnap.docs.reduce((sum, d) => sum + Number((d.data() as any).amount || 0), 0);
      const yOpOut = opExpenseSnap.docs.reduce((sum, d) => sum + Number((d.data() as any).amount || 0), 0);

      const baseOpening = Number(selectedBankObj?.openingBalance || 0);
      setOpeningBalance(baseOpening + yIn - (yOut + yOpOut));
    };

    calcOpening();
  }, [selectedBank, startDate, selectedBankObj]);

  // 4. Closing Balance Calculation
  useEffect(() => {
    setClosingBalance(openingBalance + bankIn - bankOut);
  }, [openingBalance, bankIn, bankOut]);

  if (loading) return <div className="max-w-4xl mx-auto p-6 text-center text-gray-600">Loading bank ledger...</div>;

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
            <option key={b.id} value={b.name}>{b.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">Start Date</label>
          <input type="date" className="border p-2 rounded w-full" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End Date</label>
          <input type="date" className="border p-2 rounded w-full" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 p-4 border border-green-200 rounded shadow-sm">
          <p className="text-sm text-green-700">Money In</p>
          <p className="text-2xl font-bold text-green-800">{bankIn.toLocaleString()}</p>
        </div>
        <div className="bg-red-50 p-4 border border-red-200 rounded shadow-sm">
          <p className="text-sm text-red-700">Money Out</p>
          <p className="text-2xl font-bold text-red-800">{bankOut.toLocaleString()}</p>
        </div>
        <div className="bg-blue-50 p-5 border border-blue-200 rounded shadow-sm">
          <p className="text-sm text-blue-700">Closing Balance</p>
          <p className="text-2xl font-bold text-blue-900">{closingBalance.toLocaleString()}</p>
        </div>
      </div>

      {/* TRANSACTION TABLE */}
      <div className="bg-white border rounded shadow-sm p-4">
        <h2 className="text-xl font-semibold mb-4">Bank Transactions</h2>
        {transactions.length === 0 ? (
          <p className="text-gray-500 text-sm">No bank transactions found for this date.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="p-2 text-left">Type</th>
                <th className="p-2 text-left">Name / Category</th>
                <th className="p-2 text-right">Amount</th>
                <th className="p-2 text-right">Notes</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b">
                  <td className="p-2 font-medium">
                    {t.type === "Income" ? <span className="text-green-700">Income</span> : <span className="text-red-700">Expense</span>}
                    <span className="text-xs text-gray-500 ml-1">{t.subType ? `(${t.subType})` : ""}</span>
                  </td>
                  <td className="p-2">{t.customerName || t.supplierName || t.categoryName || "—"}</td>
                  <td className={`p-2 text-right font-semibold ${t.type === "Income" ? "text-green-700" : "text-red-700"}`}>
                    {t.type === "Income" ? "+" : "-"}{Number(t.amount).toLocaleString()}
                  </td>
                  <td className="p-2 text-gray-500 text-sm text-right">{t.notes || t.description || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}