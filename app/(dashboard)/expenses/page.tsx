"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

export default function AddSupplierPayment() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<any[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [message, setMessage] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  /* Load suppliers list */
  useEffect(() => {
    const loadSuppliers = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const q1 = query(
        collection(db, "suppliers"),
        where("userId", "==", user.uid)
      );
      const snap = await getDocs(q1);

      const list: any[] = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setSuppliers(list);
    };

    loadSuppliers();
  }, []);

  /* Filter supplier dropdown */
  useEffect(() => {
    if (!supplierName.trim()) {
      setFilteredSuppliers([]);
      return;
    }

    const q = supplierName.toLowerCase();
    const f = suppliers.filter((s) =>
      (s.name || "").toLowerCase().includes(q)
    );
    setFilteredSuppliers(f);
  }, [supplierName, suppliers]);

  /* Select supplier */
  const handleSelectSupplier = (s: any) => {
    setSupplierId(s.id);
    setSupplierName(s.name || "");
    setShowDropdown(false);
  };

  /* Submit Payment */
  const savePayment = async (e: any) => {
    e.preventDefault();

    setMessage("");

    const user = auth.currentUser;
    if (!user) {
      setMessage("You must be logged in.");
      return;
    }

    if (!supplierName.trim()) {
      setMessage("Please select a supplier.");
      return;
    }

    const finalAmount = Number(amount);
    if (isNaN(finalAmount) || finalAmount <= 0) {
      setMessage("Enter a valid amount.");
      return;
    }

    // If supplier doesn't exist → allow creation
    let finalSupplierId = supplierId;
    let finalSupplierName = supplierName.trim();

    if (!finalSupplierId) {
      const newSupplier = {
        name: finalSupplierName,
        userId: user.uid,
        createdAt: serverTimestamp(),
      };

      const ref = await addDoc(collection(db, "suppliers"), newSupplier);
      finalSupplierId = ref.id;
    }

    await addDoc(collection(db, "expenses"), {
      supplierId: finalSupplierId,
      supplierName: finalSupplierName,
      amount: finalAmount,
      date,
      userId: user.uid,
      createdAt: serverTimestamp(),
    });

    setMessage("Payment recorded successfully!");

    setSupplierId("");
    setSupplierName("");
    setAmount("");
  };

  return (
    <div className="max-w-xl mx-auto bg-white p-6 rounded shadow">
      <h1 className="text-2xl font-bold mb-4">Add Supplier Payment</h1>

      {message && (
        <p className="mb-3 text-blue-600 border p-2 rounded bg-blue-50">
          {message}
        </p>
      )}

      <form onSubmit={savePayment} className="space-y-4">
        {/* Supplier Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Supplier Name"
            className="w-full border p-2 rounded"
            value={supplierName}
            onChange={(e) => {
              setSupplierName(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
          />

          {showDropdown && filteredSuppliers.length > 0 && (
            <div className="absolute bg-white border rounded shadow w-full max-h-40 overflow-y-auto z-20">
              {filteredSuppliers.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  className="block w-full text-left p-2 hover:bg-gray-100"
                  onClick={() => handleSelectSupplier(s)}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Amount */}
        <input
          type="number"
          placeholder="Amount Paid"
          className="w-full border p-2 rounded"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />

        {/* Date */}
        <input
          type="date"
          className="w-full border p-2 rounded"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />

        {/* Submit */}
        <button className="w-full bg-red-600 text-white p-3 rounded hover:bg-red-700">
          Add Payment
        </button>
      </form>
    </div>
  );
}
