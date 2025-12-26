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
import {
  updateDoc,
  increment,
  getDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";


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
  const [filter, setFilter] = useState<"1" | "7" | "30">("7");
  const router = useRouter();
  const [categorySearch, setCategorySearch] = useState("");


  const loadExpenses = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setLoading(true);

        const start = new Date();
        start.setDate(start.getDate() - Number(filter));

        const snap = await getDocs(
        query(
            collection(db, "operationalExpenses"),
            where("userId", "==", user.uid),
            where("date", ">=", start.toISOString().split("T")[0])
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
  }, [filter]);

  const filteredExpenses = expenses.filter((e) =>
  e.categoryName.toLowerCase().includes(categorySearch.toLowerCase())
);

  const rollbackPayment = async (expense: OperationalExpense) => {
  const user = auth.currentUser;
  if (!user) return;

  // Rollback PETTY CASH
  if (expense.paymentMethod === "CASH") {
    const snap = await getDocs(
      query(
        collection(db, "pettyCash"),
        where("userId", "==", user.uid)
      )
    );

    if (!snap.empty) {
      await updateDoc(doc(db, "pettyCash", snap.docs[0].id), {
        balance: increment(expense.amount),
      });
    }
  }

  // Rollback BANK
  if (expense.paymentMethod === "BANK" && expense.bankName) {
    const snap = await getDocs(
      query(
        collection(db, "bankAccounts"),
        where("userId", "==", user.uid),
        where("bankName", "==", expense.bankName)
      )
    );

    if (!snap.empty) {
      await updateDoc(doc(db, "bankAccounts", snap.docs[0].id), {
        balance: increment(expense.amount),
      });
    }
  }
};

    const deleteExpense = async (expense: OperationalExpense) => {
    if (!confirm("Delete this operational expense?")) return;

    await rollbackPayment(expense);
    await deleteDoc(doc(db, "operationalExpenses", expense.id));
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
                            <div className="flex gap-2 mb-4">
                            <div className="flex flex-wrap items-center gap-3 mb-4">
                        {/* Date Filters */}
                        {[
                          { label: "Today", value: "1" },
                          { label: "7 Days", value: "7" },
                          { label: "30 Days", value: "30" },
                        ].map((b) => (
                          <button
                            key={b.value}
                            onClick={() => setFilter(b.value as any)}
                            className={`px-3 py-1 rounded text-sm border ${
                              filter === b.value ? "bg-black text-white" : "bg-white"
                            }`}
                          >
                            {b.label}
                          </button>
                        ))}

                        {/* Category Search */}
                        <input
                          type="text"
                          placeholder="Search category..."
                          value={categorySearch}
                          onChange={(e) => setCategorySearch(e.target.value)}
                          className="border px-2 py-1 rounded text-sm ml-auto"
                        />
                      </div>

                {[
                    { label: "Today", value: "1" },
                    { label: "7 Days", value: "7" },
                    { label: "30 Days", value: "30" },
                ].map((b) => (
                    <button
                    key={b.value}
                    onClick={() => setFilter(b.value as any)}
                    className={`px-3 py-1 rounded text-sm border ${
                        filter === b.value
                        ? "bg-black text-white"
                        : "bg-white"
                    }`}
                    >
                    {b.label}
                    </button>
                ))}
                </div>

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
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-gray-500">
                    No operational expenses found.
                  </td>
                </tr>
              )}
              {filteredExpenses.map((e) => (
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
                        onClick={() =>
                            router.push(`/expense?edit=operational&id=${e.id}`)
                        }
                        className="text-blue-600 text-sm mr-3"
                        >
                        Edit
                        </button>

                        <button
                        onClick={() => deleteExpense(e)}
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
