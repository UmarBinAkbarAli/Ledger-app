"use client";

import { useSearchParams } from "next/navigation";

import { useEffect, useState } from "react";
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

export default function IncomePage() {
  const [customerList, setCustomerList] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  // Get customerId from URL if coming from Ledger
  const searchParams = useSearchParams();
  const preSelectedCustomerId = searchParams.get("customerId");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  

  /* ---------------------------------------------
      LOAD CUSTOMERS ONLY
  ----------------------------------------------*/
  useEffect(() => {
    const fetchCustomers = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const q = query(
        collection(db, "customers"),
        where("userId", "==", user.uid)
      );
      const snap = await getDocs(q);

      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // Sort alphabetically for easy selection
      list.sort((a: any, b: any) =>
        (a.name || "").localeCompare(b.name || "")
      );

      setCustomerList(list);
    };

    fetchCustomers();
  }, []);

      // Auto-select customer ONLY if coming from Ledger page
    useEffect(() => {
      if (preSelectedCustomerId && customerList.length > 0) {
        setSelectedCustomer(preSelectedCustomerId);
      }
    }, [preSelectedCustomerId, customerList]);

  /* ---------------------------------------------
      ADD PAYMENT (INCOME)
  ----------------------------------------------*/
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        setError("You must be logged in.");
        return;
      }

      const customer = customerList.find((c) => c.id === selectedCustomer);
      if (!customer) {
        setError("Invalid customer selection.");
        return;
      }

      const payAmount = Number(amount);
      if (payAmount <= 0) {
        setError("Amount must be greater than 0.");
        return;
      }

      // Normalize date
      const finalDate = date
        ? new Date(date).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);

      // Create income record
      const incomeRef = doc(collection(db, "income"));
      await setDoc(incomeRef, {
        saleId: "", // no sale binding now
        customerId: customer.id,
        customerName: customer.name,
        billNumber: "",
        amount: payAmount,
        date: finalDate,
        userId: user.uid,
        createdAt: serverTimestamp(),
      });

      setMessage("Payment added successfully!");
      setSelectedCustomer("");
      setAmount("");
      setDate("");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong.");
    }

    setLoading(false);
  };

  return (
    <div className="max-w-xl mx-auto bg-white p-6 rounded-xl shadow">
      <h1 className="text-2xl font-bold mb-4">Add Income (Payment)</h1>

      {message && <p className="text-green-600">{message}</p>}
      {error && <p className="text-red-600">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Customer Dropdown */}
        <select
          className="w-full border p-2 rounded"
          value={selectedCustomer}
          onChange={(e) => setSelectedCustomer(e.target.value)}
          required
        >
          <option value="">Select Customer</option>

          {customerList.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {c.company || ""}
            </option>
          ))}
        </select>

        {/* Date */}
        <input
          type="date"
          className="w-full border p-2 rounded"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />

        {/* Amount */}
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
          {loading ? "Saving..." : "Add Payment"}
        </button>
      </form>
    </div>
  );
}
