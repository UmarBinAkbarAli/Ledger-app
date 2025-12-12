"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  doc,
  setDoc,
} from "firebase/firestore";

export default function IncomeForm({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const [customerList, setCustomerList] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const searchParams = useSearchParams();
  const preSelectedCustomerId = searchParams.get("customerId");

  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK">("CASH");
  const [bankName, setBankName] = useState("");
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [notes, setNotes] = useState("");

  /* Load customers */
  useEffect(() => {
    const fetchCustomers = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const q = query(
        collection(db, "customers"),
        where("userId", "==", user.uid)
      );
      const snap = await getDocs(q);

      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) =>
        (a.name || "").localeCompare(b.name || "")
      );

      setCustomerList(list);
    };

    fetchCustomers();
  }, []);

  /* Auto select customer from URL */
  useEffect(() => {
    if (preSelectedCustomerId && customerList.length > 0) {
      setSelectedCustomer(preSelectedCustomerId);
    }
  }, [preSelectedCustomerId, customerList]);

  /* Load banks */
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const loadBanks = async () => {
      const snap = await getDocs(
        collection(db, "users", user.uid, "bankAccounts")
      );
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setBankAccounts(list);
    };

    loadBanks();
  }, []);

  /* Submit */
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      const customer = customerList.find((c) => c.id === selectedCustomer);
      if (!customer) throw new Error("Invalid customer");

      const payAmount = Number(amount);
      if (payAmount <= 0) throw new Error("Invalid amount");

      const finalDate = date
        ? new Date(date).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);

      await setDoc(doc(collection(db, "income")), {
        saleId: "",
        customerId: customer.id,
        customerName: customer.name,
        billNumber: "",
        amount: payAmount,
        date: finalDate,
        paymentMethod,
        bankName,
        notes,
        userId: user.uid,
        createdAt: serverTimestamp(),
      });

      setMessage("Payment added successfully");
      setSelectedCustomer("");
      setAmount("");
      setDate("");
      setNotes("");

      onSuccess?.();
    } catch (err: any) {
      setError(err.message);
    }

    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {message && <p className="text-green-600">{message}</p>}
      {error && <p className="text-red-600">{error}</p>}

      <select
        className="w-full border p-2 rounded"
        value={selectedCustomer}
        onChange={(e) => setSelectedCustomer(e.target.value)}
        required
      >
        <option value="">Select Customer</option>
        {customerList.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
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
        placeholder="Amount"
        className="w-full border p-2 rounded"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />

      <select
        className="w-full border p-2 rounded"
        value={paymentMethod}
        onChange={(e) =>
          setPaymentMethod(e.target.value as "CASH" | "BANK")
        }
      >
        <option value="CASH">Cash</option>
        <option value="BANK">Bank</option>
      </select>

      {paymentMethod === "BANK" && (
        <select
          className="w-full border p-2 rounded"
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
          required
        >
          <option value="">Select Bank</option>
          {bankAccounts.map((b) => (
            <option key={b.id} value={b.name}>
              {b.name}
            </option>
          ))}
        </select>
      )}

      <textarea
        className="w-full border p-2 rounded h-24"
        placeholder="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <button
        disabled={loading}
        className="w-full bg-green-600 text-white p-3 rounded"
      >
        {loading ? "Saving..." : "Add Income"}
      </button>
    </form>
  );
}
