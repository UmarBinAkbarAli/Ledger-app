"use client";

import { useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type OperationalExpense = {
  id: string;
  categoryName: string;
  description: string;
  amount: number;
  date: string;
  paymentMethod: "CASH" | "BANK";
  bankName?: string;
};

export default function OperationalExpensesPage() {
  const [expenses, setExpenses] = useState<OperationalExpense[]>([]);
  const [loading, setLoading] = useState(true);

  const loadExpenses = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setLoading(true);

    const snap = await getDocs(
      query(
        collection(db, "operationalExpenses"),
        where("userId", "==", user.uid)
      )
    );

    setExpenses(
      snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          categoryName: data.categoryName || "",
          description: data.description || "",
          amount: Number(data.amount || 0),
          date: data.date,
          paymentMethod: data.paymentMethod,
          bankName: data.bankName,
        };
      })
    );

    setLoading(false);
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const deleteExpense = async (id: string) => {
    if (!confirm("Delete this operational expense?")) return;

    await deleteDoc(doc(db, "operationalExpenses", id));
    loadExpenses();
  };

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Operational Expenses</h1>

      {loading ? (
        <p>Loading...</p>
      ) : expenses.length === 0 ? (
        <p className="text-gray-500">No operational expenses found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">Category</th>
                <th className="p-2 text-left">Description</th>
                <th className="p-2 text-right">Amount</th>
                <th className="p-2 text-center">Paid Via</th>
                <th className="p-2 text-center">Action</th>
              </tr>
            </thead>

            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b">
                  <td className="p-2">{e.date}</td>
                  <td className="p-2 font-medium">{e.categoryName}</td>
                  <td className="p-2">{e.description}</td>
                  <td className="p-2 text-right">
                    {e.amount.toLocaleString()}
                  </td>
                  <td className="p-2 text-center">
                    {e.paymentMethod}
                    {e.paymentMethod === "BANK" && e.bankName
                      ? ` (${e.bankName})`
                      : ""}
                  </td>
                  <td className="p-2 text-center">
                    <button
                      onClick={() => deleteExpense(e.id)}
                      className="text-red-600 text-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
