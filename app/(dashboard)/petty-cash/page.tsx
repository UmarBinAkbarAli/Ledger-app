"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { auth } from "@/lib/firebase";


export default function PettyCashPage() {
  // Default date = today in yyyy-mm-dd format
  const [selectedDate, setSelectedDate] = useState( new Date().toISOString().split("T")[0]);
  const [cashIn, setCashIn] = useState(0);       // Income (Cash)
  const [cashOut, setCashOut] = useState(0);     // Expense (Cash)
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);  
  const [loading, setLoading] = useState(true);

  const cashInList = transactions.filter((t) => t.type === "Income");
  const cashOutList = transactions.filter((t) => t.type === "Expense");
  const [initialOpening, setInitialOpening] = useState<number | null>(null);
  const [openingDate, setOpeningDate] = useState<string | null>(null);
  const [openingExists, setOpeningExists] = useState(false);
  const [openingInput, setOpeningInput] = useState("");
  const [openingInputDate, setOpeningInputDate] = useState("");

  // CHECK IF OPENING BALANCE EXISTS
  useEffect(() => {
  const checkOpening = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const snap = await getDocs(
      query(
        collection(db, "pettyCashOpening"),
        where("userId", "==", user.uid)
      )
    );

    if (!snap.empty) {
      setOpeningExists(true);
    }
  };

  checkOpening();
}, []);


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
};

  
  // FETCH INITIAL OPENING BALANCE ONCE
  useEffect(() => {
  const loadInitialOpening = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const snap = await getDocs(
      query(
        collection(db, "pettyCashOpening"),
        where("userId", "==", user.uid)
      )
    );

    if (!snap.empty) {
      const data = snap.docs[0].data();
      setInitialOpening(Number(data.openingBalance || 0));
      setOpeningDate(data.openingDate);
    }
  };

  loadInitialOpening();
}, []);



      // FETCH CASH IN / CASH OUT FOR SELECTED DATE
  useEffect(() => {
    const loadData = async () => {
    setLoading(true); // ← START SPINNER
      const user = auth.currentUser;
      if (!user) return;

      const incomeRef = collection(db, "income");
      const expenseRef = collection(db, "expenses");

      // FILTER for selected date
      const qIncome = query(
        incomeRef,
        where("userId", "==", user.uid),
        where("date", "==", selectedDate),
        where("paymentMethod", "==", "CASH")
      );

      const qExpense = query(
        expenseRef,
        where("userId", "==", user.uid),
        where("date", "==", selectedDate),
        where("paymentMethod", "==", "CASH")
      );

      // Fetch snapshots
      const incomeSnap = await getDocs(qIncome);
      const expenseSnap = await getDocs(qExpense);

      // SUM CASH INCOME
      const totalIncome = incomeSnap.docs
        .map((d) => Number(d.data().amount || 0))
        .reduce((a, b) => a + b, 0);

      // SUM CASH EXPENSE
      const totalExpense = expenseSnap.docs
        .map((d) => Number(d.data().amount || 0))
        .reduce((a, b) => a + b, 0);

      // SET STATE
      setCashIn(totalIncome);
      setCashOut(totalExpense);

      // TRANSACTION TABLE
      const tx = [
        ...incomeSnap.docs.map((d) => ({ type: "Income", ...d.data(), id: d.id })),
        ...expenseSnap.docs.map((d) => ({ type: "Expense", ...d.data(), id: d.id })),
      ];

      setTransactions(tx);
      setLoading(false); // ← STOP SPINNER
    };

    loadData();
  }, [selectedDate]);

      // CALCULATE OPENING BALANCE (CORRECT – CUMULATIVE)
      useEffect(() => {
        const calculateOpeningBalance = async () => {
          const user = auth.currentUser;
          if (!user) return;

          // If no opening exists yet
          if (!openingDate || initialOpening === null) {
            setOpeningBalance(0);
            return;
          }

          // If selected date is BEFORE opening date
          if (selectedDate < openingDate) {
            setOpeningBalance(0);
            return;
          }

          // If selected date IS opening date
          if (selectedDate === openingDate) {
            setOpeningBalance(initialOpening);
            return;
          }

          // Otherwise: cumulative calculation
          const incomeRef = collection(db, "income");
          const expenseRef = collection(db, "expenses");

          const qIncome = query(
            incomeRef,
            where("userId", "==", user.uid),
            where("paymentMethod", "==", "CASH"),
            where("date", "<", selectedDate)
          );

          const qExpense = query(
            expenseRef,
            where("userId", "==", user.uid),
            where("paymentMethod", "==", "CASH"),
            where("date", "<", selectedDate)
          );

          const incomeSnap = await getDocs(qIncome);
          const expenseSnap = await getDocs(qExpense);

          const totalIncomeBefore = incomeSnap.docs
            .map((d) => Number(d.data().amount || 0))
            .reduce((a, b) => a + b, 0);

          const totalExpenseBefore = expenseSnap.docs
            .map((d) => Number(d.data().amount || 0))
            .reduce((a, b) => a + b, 0);

          setOpeningBalance(
            initialOpening + totalIncomeBefore - totalExpenseBefore
          );
        };

        calculateOpeningBalance();
      }, [selectedDate, openingDate, initialOpening]);


   
  // CALCULATE CLOSING BALANCE
    useEffect(() => {
    setClosingBalance(openingBalance + cashIn - cashOut);
  }, [openingBalance, cashIn, cashOut]);

    const netCashFlow = cashIn - cashOut;

    // spinner UI
        if (loading) {
        return (
            <div className="max-w-4xl mx-auto p-6 text-center text-gray-600">
            Loading petty cash...
            </div>
        );
        }


  return (
    <div className="max-w-4xl mx-auto p-6">
      
      {/* PAGE TITLE */}
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        Petty Cash (Cash In Hand)
      </h1>

      {/* DATE PICKER */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-1">
          Select Date
        </label>
        <input
          type="date"
          className="border border-gray-300 p-2 rounded"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      {/* SUMMARY BOX (EMPTY FOR NOW) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        
        {/* Opening Balance */}
            <div className="bg-gray-50 p-4 border rounded shadow-sm">
            <p className="text-sm font-medium text-gray-600">Opening Balance</p>
            <p className="text-2xl font-bold text-gray-800">
                {openingBalance.toLocaleString()}
            </p>
            </div>


        {/* Cash In */}
            <div className="bg-green-50 p-4 border border-green-200 rounded shadow-sm">
            <p className="text-sm font-medium text-green-700">Cash In (Income)</p>
            <p className="text-2xl font-bold text-green-800">
                {cashIn.toLocaleString()}
            </p>
            </div>


       {/* Cash Out */}
            <div className="bg-red-50 p-4 border border-red-200 rounded shadow-sm">
            <p className="text-sm font-medium text-red-700">Cash Out (Expense)</p>
            <p className="text-2xl font-bold text-red-800">
                {cashOut.toLocaleString()}
            </p>
            </div>


      {/* Closing Balance */}
        <div className="bg-blue-50 p-5 border border-blue-200 rounded shadow-sm mb-8">
        <p className="text-sm font-medium text-blue-700">Closing Balance</p>
        <p className="text-3xl font-bold text-blue-900">
            {closingBalance.toLocaleString()}
        </p>
        </div>
  </div>

      {/* OPENING BALANCE SETUP */}
    {!openingExists && (
  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded mb-6">
    <h3 className="font-semibold mb-2">
      Set Petty Cash Opening Balance
    </h3>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <input
        type="text"
        inputMode="decimal"
        placeholder="Opening Amount"
        className="border p-2 rounded"
        value={openingInput}
        onChange={(e) => setOpeningInput(e.target.value)}
      />

      <input
        type="date"
        className="border p-2 rounded"
        value={openingInputDate}
        onChange={(e) => setOpeningInputDate(e.target.value)}
      />

      <button
        onClick={saveOpeningBalance}
        className="bg-black text-white rounded px-4"
      >
        Save Opening
      </button>
    </div>

    <p className="text-xs text-gray-600 mt-2">
      This can only be set once.
    </p>
  </div>
)}


      {/* Transactions Table (Empty For Now) */}
      <div className="bg-white border rounded shadow-sm p-4">
        <h2 className="text-xl font-semibold mb-4">Cash Transactions</h2>
        <table className="w-full text-sm">
  <thead>
    <tr className="bg-gray-100 border-b">
      <th className="p-2 text-left">Type</th>
      <th className="p-2 text-left">Name</th>
      <th className="p-2 text-right">Amount</th>
      <th className="p-2 text-right">Notes</th>
    </tr>
  </thead>

  <tbody>
    {transactions.length === 0 && (
      <tr>
        <td colSpan={3} className="p-4 text-center text-gray-500">
          No cash transactions for this date.
        </td>
      </tr>
    )}

    {transactions.map((t) => (
      <tr key={t.id} className="border-b">
        <td className="p-2">{t.type}</td>
        <td className="p-2">{t.customerName || t.supplierName}</td>
        <td className="p-2 text-right">{Number(t.amount).toLocaleString()}</td>
        <td className="p-2 text-gray-500 text-sm"> {t.notes || "—"} </td>
      </tr>
    ))}
  </tbody>
</table>

      </div>
    </div>
  );
}
