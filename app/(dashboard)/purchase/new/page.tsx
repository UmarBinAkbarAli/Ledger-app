"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import {
  addDoc,
  collection,
  serverTimestamp,
  getDocs,
  query,
  where,
  orderBy,
  limit
} from "firebase/firestore";

import { onAuthStateChanged } from "firebase/auth";


export default function PurchasePage() {
  const [supplierName, setSupplierName] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [autoBill, setAutoBill] = useState("");

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const user = auth.currentUser;

      if (!user) {
        setMessage("You must be logged in.");
        return;
      }

      await addDoc(collection(db, "purchase"), {
        supplierName,
        billNumber,
        date,
        amount: Number(amount),
        details,
        userId: user.uid,
        createdAt: serverTimestamp(),
      });

      setMessage("Purchase entry added successfully!");

      setSupplierName("");
      setBillNumber("");
      setDate("");
      setAmount("");
      setDetails("");

    } catch (error: any) {
      setMessage("Error saving entry: " + error.message);
    }

    setLoading(false);
  };

  useEffect(() => {
  const loadLastBill = async (userId: string) => {
    try {
      // Try to get the LAST PURCHASE sorted by createdAt
      const q = query(
        collection(db, "purchase"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc"),
        limit(1)
      );

      const snap = await getDocs(q);

      let lastNumber = 0;

      if (!snap.empty) {
        const data: any = snap.docs[0].data();
        const bill = data.billNumber || "";

        // Extract digits from any bill format
        const num = parseInt(bill.replace(/\D/g, ""));
        if (!isNaN(num)) lastNumber = num;
      } else {
        // Fallback scan (only needed on first ever bill)
        const allQ = query(
          collection(db, "purchase"),
          where("userId", "==", userId)
        );
        const allSnap = await getDocs(allQ);

        allSnap.forEach((doc) => {
          const data: any = doc.data();
          const bill = data.billNumber || "";
          const num = parseInt(bill.replace(/\D/g, ""));
          if (!isNaN(num) && num > lastNumber) lastNumber = num;
        });
      }

      const next = lastNumber + 1;
      const formatted = String(next).padStart(4, "0");

      setAutoBill(`PUR-${formatted}`);
      setBillNumber(`PUR-${formatted}`);
    } catch (err) {
      console.error("Error loading last purchase bill:", err);
    }
  };

  // Wait for Firebase Auth to be ready
  const unsub = onAuthStateChanged(auth, (user) => {
    if (user) {
      loadLastBill(user.uid);
      unsub();
    }
  });

  return () => unsub();
}, []);

  return (
    <div className="max-w-xl mx-auto bg-white p-6 rounded-xl shadow">
      <h1 className="text-2xl font-bold mb-4">Add New Purchase</h1>

      {message && <p className="text-blue-600 mb-3">{message}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">

        <input
          type="text"
          placeholder="Supplier Name"
          className="w-full border p-2 rounded"
          value={supplierName}
          onChange={(e) => setSupplierName(e.target.value)}
          required
        />

        <input
          type="text"
          placeholder="Bill Number"
          className="w-full border p-2 rounded"
          value={billNumber || autoBill}
          onChange={(e) => setBillNumber(e.target.value)}
          required
        />

        <input
          type="date"
          className="w-full border p-2 rounded"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />

        <input
          type="number"
          placeholder="Amount"
          className="w-full border p-2 rounded"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />

        <textarea
          placeholder="Details"
          className="w-full border p-2 rounded"
          rows={3}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white p-3 rounded hover:bg-blue-700"
        >
          {loading ? "Saving..." : "Add Purchase"}
        </button>

      </form>
    </div>
  );
}
