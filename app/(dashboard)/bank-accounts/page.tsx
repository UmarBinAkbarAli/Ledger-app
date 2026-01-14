"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

export default function BankAccountsPage() {
  const [bankName, setBankName] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [openingDate, setOpeningDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadAccounts = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setLoading(true);
    try {
      const ref = collection(db, "users", user.uid, "bankAccounts");
      const snap = await getDocs(ref);

      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));

      setAccounts(list);
    } catch (err) {
      console.error("Error loading bank accounts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const addBank = async () => {
    const user = auth.currentUser;
    if (!user || !bankName.trim()) return;

    try {
      await addDoc(collection(db, "users", user.uid, "bankAccounts"), {
        userId: user.uid,
        name: bankName.trim(),
        openingBalance: Number(openingBalance || 0),
        openingDate,
        createdAt: serverTimestamp(),
      });

      setBankName("");
      setOpeningBalance("");
      setOpeningDate(new Date().toISOString().slice(0, 10));
      loadAccounts();
    } catch (err) {
      console.error("Error adding bank account:", err);
    }
  };

  const updateBalance = async (id: string, balance: number) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      await updateDoc(doc(db, "users", user.uid, "bankAccounts", id), {
        openingBalance: balance,
      });

      setEditingId(null);
      loadAccounts();
    } catch (err) {
      console.error("Error updating bank balance:", err);
    }
  };

  const removeBank = async (id: string) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      await deleteDoc(doc(db, "users", user.uid, "bankAccounts", id));
      loadAccounts();
    } catch (err) {
      console.error("Error removing bank account:", err);
    }
  };

  if (loading)
    return <p className="p-6 text-gray-600">Loading bank accounts...</p>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Bank Accounts</h1>

      {/* Add Bank */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <input
          type="text"
          placeholder="Bank Name"
          className="border p-2 rounded"
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
        />

        <input
          type="number"
          placeholder="Opening Balance"
          className="border p-2 rounded"
          value={openingBalance}
          onChange={(e) => setOpeningBalance(e.target.value)}
        />

        <input
          type="date"
          className="border p-2 rounded"
          value={openingDate}
          onChange={(e) => setOpeningDate(e.target.value)}
        />

        <button
          onClick={addBank}
          className="bg-blue-600 text-white px-4 py-2 rounded md:col-span-3"
        >
          Add Bank Account
        </button>
      </div>

      {/* Banks List */}
      <div className="bg-white border rounded shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-2 text-left">Bank</th>
              <th className="p-2 text-right">Opening Balance</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 && (
              <tr>
                <td colSpan={3} className="p-3 text-gray-500">
                  No bank accounts added yet.
                </td>
              </tr>
            )}

            {accounts.map((acc) => (
              <tr key={acc.id} className="border-b">
                <td className="p-2">{acc.name}</td>

                <td className="p-2 text-right">
                  {editingId === acc.id ? (
                    <input
                      type="number"
                      defaultValue={acc.openingBalance}
                      className="border p-1 rounded w-24 text-right"
                      onBlur={(e) =>
                        updateBalance(acc.id, Number(e.target.value || 0))
                      }
                    />
                  ) : (
                    Number(acc.openingBalance || 0).toLocaleString()
                  )}
                </td>

                <td className="p-2 text-right space-x-2">
                  <button
                    onClick={() => setEditingId(acc.id)}
                    className="text-blue-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => removeBank(acc.id)}
                    className="text-red-600"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
