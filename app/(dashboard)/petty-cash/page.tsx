"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";

export default function PettyCashPage() {
  // Default date = today in yyyy-mm-dd format
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [cashIn, setCashIn] = useState(0);       
  const [cashOut, setCashOut] = useState(0);     
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);  
  const [loading, setLoading] = useState(true);

  // Opening Balance States
  const [initialOpening, setInitialOpening] = useState<number | null>(null);
  const [openingDate, setOpeningDate] = useState<string | null>(null);
  const [openingExists, setOpeningExists] = useState(false);
  const [openingInput, setOpeningInput] = useState("");
  const [openingInputDate, setOpeningInputDate] = useState("");

  // 1. CHECK IF OPENING BALANCE EXISTS
  useEffect(() => {
    const checkOpening = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const snap = await getDocs(query(collection(db, "pettyCashOpening"), where("userId", "==", user.uid)));
      if (!snap.empty) setOpeningExists(true);
    };
    checkOpening();
  }, []);

  // 2. FETCH INITIAL OPENING BALANCE ONCE
  useEffect(() => {
    const loadInitialOpening = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const snap = await getDocs(query(collection(db, "pettyCashOpening"), where("userId", "==", user.uid)));
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setInitialOpening(Number(data.openingBalance || 0));
        setOpeningDate(data.openingDate);
      }
    };
    loadInitialOpening();
  }, []);

  // 3. SAVE NEW OPENING BALANCE
  const saveOpeningBalance = async () => {
    const user = auth.currentUser;
    if (!user) return;
    if (!openingInput || !openingInputDate) {
      alert("Please enter opening balance and date");
      return;
    }
    await addDoc(collection(db, "pettyCashOpening"), {
      userId: user.uid,
      openingBalance: Number(openingInput),
      openingDate: openingInputDate,
      createdAt: serverTimestamp(),
    });
    setOpeningExists(true);
    window.location.reload(); // Reload to apply changes immediately
  };

  // 4. FETCH CASH IN / CASH OUT FOR SELECTED DATE
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) return;

      // ─── QUERY 1: INCOME (CASH) ───
      const qIncome = query(
        collection(db, "income"),
        where("userId", "==", user.uid),
        where("date", "==", selectedDate),
        where("paymentMethod", "==", "CASH")
      );

      // ─── QUERY 2: SUPPLIER EXPENSES (CASH) ───
      const qExpense = query(
        collection(db, "expenses"),
        where("userId", "==", user.uid),
        where("date", "==", selectedDate),
        where("paymentMethod", "==", "CASH")
      );

      // ─── QUERY 3: OPERATIONAL EXPENSES (CASH) ───
      const qOpExpense = query(
        collection(db, "operationalExpenses"),
        where("userId", "==", user.uid),
        where("date", "==", selectedDate),
        where("paymentMethod", "==", "CASH")
      );

      const [incomeSnap, expenseSnap, opExpenseSnap] = await Promise.all([
        getDocs(qIncome),
        getDocs(qExpense),
        getDocs(qOpExpense)
      ]);

      // Calculate Totals
      const totalIncome = incomeSnap.docs.reduce((sum, d) => sum + Number(d.data().amount || 0), 0);
      
      const supplierExpenseTotal = expenseSnap.docs.reduce((sum, d) => sum + Number(d.data().amount || 0), 0);
      const opExpenseTotal = opExpenseSnap.docs.reduce((sum, d) => sum + Number(d.data().amount || 0), 0);
      
      setCashIn(totalIncome);
      setCashOut(supplierExpenseTotal + opExpenseTotal);

      // Merge Transactions
      const tx = [
        ...incomeSnap.docs.map((d) => ({ type: "Income", ...d.data(), id: d.id })),
        ...expenseSnap.docs.map((d) => ({ type: "Expense", subType: "Supplier", ...d.data(), id: d.id })),
        ...opExpenseSnap.docs.map((d) => ({ type: "Expense", subType: "Operational", ...d.data(), id: d.id, customerName: d.data().categoryName })), // Map categoryName to customerName for display
      ];

      setTransactions(tx);
      setLoading(false);
    };

    loadData();
  }, [selectedDate]);

  // 5. CALCULATE RUNNING OPENING BALANCE
  useEffect(() => {
    const calculateOpeningBalance = async () => {
      const user = auth.currentUser;
      if (!user) return;

      if (!openingDate || initialOpening === null || selectedDate < openingDate) {
        setOpeningBalance(0);
        return;
      }

      if (selectedDate === openingDate) {
        setOpeningBalance(initialOpening);
        return;
      }

      // Fetch all past transactions up to selectedDate
      const qIncome = query(
        collection(db, "income"),
        where("userId", "==", user.uid),
        where("paymentMethod", "==", "CASH"),
        where("date", "<", selectedDate) // STRICTLY LESS THAN
      );

      const qExpense = query(
        collection(db, "expenses"),
        where("userId", "==", user.uid),
        where("paymentMethod", "==", "CASH"),
        where("date", "<", selectedDate)
      );

      const qOpExpense = query(
        collection(db, "operationalExpenses"),
        where("userId", "==", user.uid),
        where("paymentMethod", "==", "CASH"),
        where("date", "<", selectedDate)
      );

      const [incomeSnap, expenseSnap, opExpenseSnap] = await Promise.all([
        getDocs(qIncome),
        getDocs(qExpense),
        getDocs(qOpExpense)
      ]);

      const totalIncomeBefore = incomeSnap.docs.reduce((sum, d) => sum + Number(d.data().amount || 0), 0);
      const totalSupplierBefore = expenseSnap.docs.reduce((sum, d) => sum + Number(d.data().amount || 0), 0);
      const totalOpBefore = opExpenseSnap.docs.reduce((sum, d) => sum + Number(d.data().amount || 0), 0);

      // Formula: Initial + (Past Income) - (Past Supplier Exp + Past Op Exp)
      setOpeningBalance(initialOpening + totalIncomeBefore - (totalSupplierBefore + totalOpBefore));
    };

    calculateOpeningBalance();
  }, [selectedDate, openingDate, initialOpening]);


  // 6. CALCULATE CLOSING BALANCE
  useEffect(() => {
    setClosingBalance(openingBalance + cashIn - cashOut);
  }, [openingBalance, cashIn, cashOut]);


  if (loading && !transactions.length) {
    return <div className="max-w-4xl mx-auto p-6 text-center text-gray-600">Loading petty cash...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Petty Cash (Cash In Hand)</h1>

      <div className="mb-6">
        <label className="block text-sm font-medium mb-1">Select Date</label>
        <input
          type="date"
          className="border border-gray-300 p-2 rounded"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 p-4 border rounded shadow-sm">
          <p className="text-sm font-medium text-gray-600">Opening Balance</p>
          <p className="text-2xl font-bold text-gray-800">{openingBalance.toLocaleString()}</p>
        </div>
        <div className="bg-green-50 p-4 border border-green-200 rounded shadow-sm">
          <p className="text-sm font-medium text-green-700">Cash In</p>
          <p className="text-2xl font-bold text-green-800">{cashIn.toLocaleString()}</p>
        </div>
        <div className="bg-red-50 p-4 border border-red-200 rounded shadow-sm">
          <p className="text-sm font-medium text-red-700">Cash Out</p>
          <p className="text-2xl font-bold text-red-800">{cashOut.toLocaleString()}</p>
        </div>
        <div className="bg-blue-50 p-5 border border-blue-200 rounded shadow-sm mb-8 md:col-span-3">
          <p className="text-sm font-medium text-blue-700">Closing Balance</p>
          <p className="text-3xl font-bold text-blue-900">{closingBalance.toLocaleString()}</p>
        </div>
      </div>

      {!openingExists && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded mb-6">
          <h3 className="font-semibold mb-2">Set Petty Cash Opening Balance</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input type="text" inputMode="decimal" placeholder="Opening Amount" className="border p-2 rounded" value={openingInput} onChange={(e) => setOpeningInput(e.target.value)} />
            <input type="date" className="border p-2 rounded" value={openingInputDate} onChange={(e) => setOpeningInputDate(e.target.value)} />
            <button onClick={saveOpeningBalance} className="bg-black text-white rounded px-4">Save Opening</button>
          </div>
        </div>
      )}

      <div className="bg-white border rounded shadow-sm p-4">
        <h2 className="text-xl font-semibold mb-4">Cash Transactions</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-left">Name / Category</th>
              <th className="p-2 text-right">Amount</th>
              <th className="p-2 text-right">Notes</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 && (
              <tr><td colSpan={4} className="p-4 text-center text-gray-500">No cash transactions for this date.</td></tr>
            )}
            {transactions.map((t) => (
              <tr key={t.id} className="border-b">
                <td className="p-2">
                   {t.type} <span className="text-xs text-gray-500">{t.subType ? `(${t.subType})` : ""}</span>
                </td>
                <td className="p-2">{t.customerName || t.supplierName || t.categoryName}</td>
                <td className="p-2 text-right font-medium">{Number(t.amount).toLocaleString()}</td>
                <td className="p-2 text-gray-500 text-sm text-right">{t.notes || t.description || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}