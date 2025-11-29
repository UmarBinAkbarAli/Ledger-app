"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  doc,
  runTransaction,
} from "firebase/firestore";

type PurchaseItem = {
  id: string;
  supplierName: string;
  billNumber: string;
  amount: number;
  paidAmount?: number;
  date?: string;
};

export default function ExpensePage() {
  const [purchaseList, setPurchaseList] = useState<PurchaseItem[]>([]);
  const [selectedPurchase, setSelectedPurchase] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Load all purchases + compute paid amounts from expenses
  useEffect(() => {
    const fetchPurchaseData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        // 1) Fetch purchases
        const q1 = query(
          collection(db, "purchase"),
          where("userId", "==", user.uid)
        );
        const purchaseSnap = await getDocs(q1);
        const purchases = purchaseSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as PurchaseItem[];

        // 2) Fetch expenses (payments TO suppliers)
        const q2 = query(
          collection(db, "expenses"),
          where("userId", "==", user.uid)
        );
        const expenseSnap = await getDocs(q2);

        const expenses: any[] = expenseSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        // 3) Calculate paidAmount for each purchase
        const paidMap: Record<string, number> = {};

        expenses.forEach((exp: any) => {
          if (!exp.purchaseId) return;
          paidMap[exp.purchaseId] =
            (paidMap[exp.purchaseId] || 0) + Number(exp.amount || 0);
        });

        // 4) Attach paid amounts
        const finalList = purchases.map((p) => {
          const paid = paidMap[p.id] || 0;
          return { ...p, paidAmount: paid };
        });

        // sort alphabetically or by date
        finalList.sort((a, b) =>
          a.supplierName.localeCompare(b.supplierName)
        );

        setPurchaseList(finalList);
      } catch (err) {
        console.error("Error loading purchases", err);
        setError("Failed to load purchase data.");
      }
    };

    fetchPurchaseData();
  }, []);

  const submitExpense = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const user = auth.currentUser;
      if (!user) return;

      if (!selectedPurchase) {
        setError("Please select a purchase bill.");
        setLoading(false);
        return;
      }

      const amt = Number(amount);
      if (!amt || amt <= 0) {
        setError("Enter a valid amount.");
        setLoading(false);
        return;
      }

      const purchaseRef = doc(db, "purchase", selectedPurchase);

      // TRANSACTION: write expense + update purchase.paidAmount
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(purchaseRef);
        if (!snap.exists()) throw new Error("Purchase not found.");

        const purchase = snap.data();
        const currentPaid = Number(purchase.paidAmount || 0);
        const newPaid = currentPaid + amt;

        // create expense doc in expenses collection
        const expRef = doc(collection(db, "expenses"));
        tx.set(expRef, {
          purchaseId: selectedPurchase,
          supplierName: purchase.supplierName,
          billNumber: purchase.billNumber,
          amount: amt,
          date: date || new Date().toISOString().slice(0, 10),
          userId: user.uid,
          createdAt: serverTimestamp(),
        });

        // update purchase doc paidAmount
        tx.update(purchaseRef, {
          paidAmount: newPaid,
        });
      });

      // update UI state
      setPurchaseList((prev) =>
        prev.map((p) =>
          p.id === selectedPurchase
            ? { ...p, paidAmount: (p.paidAmount || 0) + Number(amount) }
            : p
        )
      );

      setMessage("Expense recorded and purchase updated successfully.");
      setAmount("");
      setDate("");
      setSelectedPurchase("");

    } catch (err: any) {
      console.error("Expense error:", err);
      setError(err.message || "Failed to save expense.");
    }

    setLoading(false);
  };

  const dropdownLabel = (p: PurchaseItem) => {
    const paid = p.paidAmount || 0;
    const remaining = p.amount - paid;
    return `${p.supplierName} — ${p.billNumber} | Bill: ${p.amount.toLocaleString()} | Paid: ${paid.toLocaleString()} | Remaining: ${remaining.toLocaleString()}`;
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-6 rounded-xl shadow">
      <h1 className="text-2xl font-bold mb-4">Add Expense (Payment to Supplier)</h1>

      {message && <p className="text-green-600">{message}</p>}
      {error && <p className="text-red-600">{error}</p>}

      <form onSubmit={submitExpense} className="space-y-4">

        <select
          className="w-full border p-2 rounded"
          value={selectedPurchase}
          onChange={(e) => setSelectedPurchase(e.target.value)}
          required
        >
          <option value="">Select Purchase Bill</option>
          {purchaseList.map((p) => (
            <option key={p.id} value={p.id}>
              {dropdownLabel(p)}
            </option>
          ))}
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
          placeholder="Amount Paid"
          className="w-full border p-2 rounded"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-red-600 text-white p-3 rounded hover:bg-red-700"
        >
          {loading ? "Saving..." : "Add Expense"}
        </button>
      </form>
    </div>
  );
}
