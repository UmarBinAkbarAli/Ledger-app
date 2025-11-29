"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  doc,
  runTransaction,
} from "firebase/firestore";

export default function IncomePage() {
  const [salesList, setSalesList] = useState<any[]>([]);
  const [selectedSale, setSelectedSale] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Load Sales and Income Data
  useEffect(() => {
    const fetchSales = async () => {
      const user = auth.currentUser;
      if (!user) return;

      // Load sales
      const q1 = query(collection(db, "sales"), where("userId", "==", user.uid));
      const salesSnap = await getDocs(q1);
      const sales = salesSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Load income
      const q2 = query(collection(db, "income"), where("userId", "==", user.uid));
      const incomeSnap = await getDocs(q2);
      const incomeList = incomeSnap.docs.map((d) => d.data());

      // Summarize paid amounts
      const paidMap: Record<string, number> = {};
      incomeList.forEach((i: any) => {
        if (!i.saleId) return;
        paidMap[i.saleId] = (paidMap[i.saleId] || 0) + Number(i.amount || 0);
      });

      // Merge into sales
      const finalSales = sales.map((s: any) => ({
        ...s,
        paidAmount: paidMap[s.id] || 0,
      }));

      setSalesList(finalSales);
    };

    fetchSales();
  }, []);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const user = auth.currentUser;
      if (!user) {
        setError("You must be logged in.");
        return;
      }

      const saleItem = salesList.find((s) => s.id === selectedSale);
      if (!saleItem) {
        setError("Invalid sale selection.");
        return;
      }

      // Firestore Transaction
      const saleRef = doc(db, "sales", selectedSale);
      await runTransaction(db, async (tx) => {
        const saleSnap = await tx.get(saleRef);
        if (!saleSnap.exists()) throw new Error("Sale not found");

        const oldPaid = Number(saleSnap.data().paidAmount || 0);
        const newPaid = oldPaid + Number(amount);

        // Add income record
        const incomeRef = doc(collection(db, "income"));
        tx.set(incomeRef, {
          saleId: selectedSale,   // ⭐ IMPORTANT ⭐
          customerName: saleItem.customerName,
          billNumber: saleItem.billNumber,
          amount: Number(amount),
          date,
          userId: user.uid,
          createdAt: serverTimestamp(),
        });

        // Update sale document
        tx.update(saleRef, {
          paidAmount: newPaid,
        });
      });

      setMessage("Income added successfully!");
      setAmount("");
      setDate("");
      setSelectedSale("");

    } catch (err: any) {
      console.error(err);
      setError(err.message);
    }

    setLoading(false);
  };

  return (
    <div className="max-w-xl mx-auto bg-white p-6 rounded-xl shadow">
      <h1 className="text-2xl font-bold mb-4">Add Income</h1>

      {message && <p className="text-green-600">{message}</p>}
      {error && <p className="text-red-600">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Dropdown */}
        <select
          className="w-full border p-2 rounded"
          value={selectedSale}
          onChange={(e) => setSelectedSale(e.target.value)}
          required
        >
          <option value="">Select Sale Bill</option>
          {salesList.map((s) => {
            const paid = Number(s.paidAmount || 0);
            const remaining = s.amount - paid;

            return (
              <option key={s.id} value={s.id}>
                {s.customerName} — {s.billNumber} | Bill: {s.amount} | Paid: {paid} | Remaining: {remaining}
              </option>
            );
          })}
        </select>

        <input
          type="date"
          className="w-full border p-2 rounded"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />

        <input
          type="number"
          placeholder="Amount Received"
          className="w-full border p-2 rounded"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 text-white p-3 rounded hover:bg-green-700"
        >
          {loading ? "Saving..." : "Add Income"}
        </button>
      </form>
    </div>
  );
}
