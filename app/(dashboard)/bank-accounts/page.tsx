"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
} from "firebase/firestore";

export default function BankAccountsPage() {
  const [bankName, setBankName] = useState("");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load existing bank accounts
  const loadAccounts = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setLoading(true);
    const ref = collection(db, "users", user.uid, "bankAccounts");
    const snap = await getDocs(ref);

    const list: any[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));

    setAccounts(list);
    setLoading(false);
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  // Add new bank
  const addBank = async () => {
    const user = auth.currentUser;
    if (!user) return;
    if (!bankName.trim()) return;

    await addDoc(collection(db, "users", user.uid, "bankAccounts"), {
      name: bankName.trim(),
    });

    setBankName("");
    loadAccounts();
  };

  // Delete bank
  const removeBank = async (id: string) => {
    const user = auth.currentUser;
    if (!user) return;

    await deleteDoc(doc(db, "users", user.uid, "bankAccounts", id));
    loadAccounts();
  };

  if (loading)
    return <p className="p-6 text-gray-600">Loading bank accounts...</p>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Bank Accounts</h1>

      {/* Add new bank */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="Enter Bank Name"
          className="border p-2 rounded w-full"
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
        />
        <button
          onClick={addBank}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Add
        </button>
      </div>

      {/* List of banks */}
      <div className="bg-white border rounded shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-2 text-left">Bank Name</th>
              <th className="p-2 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 && (
              <tr>
                <td className="p-3 text-gray-500" colSpan={2}>
                  No bank accounts added yet.
                </td>
              </tr>
            )}

            {accounts.map((acc) => (
              <tr key={acc.id} className="border-b">
                <td className="p-2">{acc.name}</td>
                <td className="p-2 text-right">
                  <button
                    onClick={() => removeBank(acc.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
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
