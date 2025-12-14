"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { doc, runTransaction } from "firebase/firestore";
type ExpenseItem = {
  id: string;
  supplierId: string;
  supplierName: string;
  billNumber: string;
  amount: number;
  date: string;
};

export default function ExpenseListPage() {
  const [expenseList, setExpenseList] = useState<ExpenseItem[]>([]);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadExpenses = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setError("Not logged in");
          setLoading(false);
          return;
        }

        // Fetch all expenses for this user
        const q = query(
          collection(db, "expenses"),
          where("userId", "==", user.uid)
        );

        const snap = await getDocs(q);
        const data: ExpenseItem[] = snap.docs.map((d) => {
          const dd: any = d.data();
          return {
            id: d.id,
            supplierId: dd.supplierId || "",  // ⭐ REQUIRED ⭐
            purchaseId: dd.purchaseId || "",  // ⭐ REQUIRED ⭐
            supplierName: dd.supplierName || "",
            billNumber: dd.billNumber || "",
            amount: Number(dd.amount || 0),
            date: dd.date || "",
          };
        });

        // sort by newest date
        data.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

        setExpenseList(data);
      } catch (err) {
        console.error(err);
        setError("Failed to load expense data.");
      } finally {
        setLoading(false);
      }
    };

    loadExpenses();
  }, []);
    const handleDelete = async (expense: any) => {
  if (!confirm("Are you sure you want to delete this expense?")) return;

  try {
    const expenseRef = doc(db, "expenses", expense.id);

      await runTransaction(db, async (tx) => {
        // ✅ Only rollback purchase if linked
        if (expense.purchaseId) {
          const purchaseRef = doc(db, "purchases", expense.purchaseId);
          const purchaseSnap = await tx.get(purchaseRef);

          if (purchaseSnap.exists()) {
            const purchase = purchaseSnap.data();
            const oldPaid = Number(purchase.paidAmount || 0);
            const newPaid = oldPaid - Number(expense.amount);

            tx.update(purchaseRef, {
              paidAmount: newPaid < 0 ? 0 : newPaid,
            });
          }
        }

        // ✅ Always delete expense
        tx.delete(expenseRef);
      });

    // Update UI instantly
    setExpenseList((prev) => prev.filter((x) => x.id !== expense.id));

    alert("Expense deleted successfully.");
  } catch (err) {
    console.error(err);
    alert("Failed to delete expense.");
  }
};

  if (loading) return <p className="p-6">Loading expenses...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;

    /* ---------------------------------------------
     DAILY TOTAL EXPENSE (TODAY)
  ----------------------------------------------*/
  const today = new Date().toISOString().split("T")[0];

  const todaysTotalExpense = expenseList
    .filter((e) => e.date === today)
    .reduce((sum, e) => sum + e.amount, 0);

              return (
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">

  {/* Date Range Filters */}
  <div className="flex gap-2">
    <input
      type="date"
      className="p-2 border rounded"
      value={fromDate}
      onChange={(e) => setFromDate(e.target.value)}
    />
    <input
      type="date"
      className="p-2 border rounded"
      value={toDate}
      onChange={(e) => setToDate(e.target.value)}
    />
  </div>

  {/* Search Bar */}
  <div>
    <input
      type="text"
      placeholder="Search supplier, bill, amount..."
      className="w-64 p-2 border rounded"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
    />
  </div>

</div>

            {/* TODAY'S TOTAL EXPENSE */}
      <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
        <p className="text-lg font-semibold text-red-700">
          Today’s Total Expense: {todaysTotalExpense.toLocaleString()}
        </p>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Expenses (Payments to Suppliers)</h1>

        <Link
          href="/expenses"
          className="bg-red-600 text-white px-4 py-2 rounded"
        >
          + Add Expense
        </Link>
      </div>

      {expenseList.length === 0 ? (
        <div className="bg-white p-6 rounded shadow text-center">
          No expenses found.
        </div>
      ) : (
        <div className="bg-white rounded shadow overflow-auto">
          <table className="min-w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left">Supplier</th>
                <th className="p-3 text-left">Bill No</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>

            <tbody>
             {expenseList
  .filter((e) => {
    // Search logic
    const q = search.toLowerCase();
    const matchesSearch =
      e.supplierName.toLowerCase().includes(q) ||
      e.billNumber.toLowerCase().includes(q) ||
      String(e.amount).includes(q) ||
      e.date.toLowerCase().includes(q);

    // Date logic
    const expenseDate = new Date(e.date);
    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate) : null;

    const matchesDate =
      (!from || expenseDate >= from) &&
      (!to || expenseDate <= to);

    return matchesSearch && matchesDate;
  })
              .map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="p-3">{e.supplierName}</td>
                  <td className="p-3">{e.billNumber}</td>
                  <td className="p-3 text-right">
                    {e.amount.toLocaleString()}
                  </td>
                  <td className="p-3">{e.date}</td>

                  <td className="p-3 flex gap-2">
                    <Link
                      href={`/supplier/${e.supplierId}`}
                      className="text-sm bg-gray-200 px-3 py-1 rounded hover:bg-gray-300"
                    >
                      Ledger
                    </Link>

                    <button
                      onClick={() => handleDelete(e)}
                      className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
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
