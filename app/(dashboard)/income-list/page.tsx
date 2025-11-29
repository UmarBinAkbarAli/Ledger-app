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
import { doc, runTransaction, deleteDoc } from "firebase/firestore";

type IncomeItem = {
  id: string;
  customerName: string;
  billNumber: string;
  amount: number;
  date: string;
};

export default function IncomeListPage() {
  const [incomeList, setIncomeList] = useState<IncomeItem[]>([]);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadIncome = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setError("Not logged in");
          setLoading(false);
          return;
        }

        // Fetch all income for this user
        const q = query(
          collection(db, "income"),
          where("userId", "==", user.uid)
        );

        const snap = await getDocs(q);
        const data: IncomeItem[] = snap.docs.map((d) => {
          const dd: any = d.data();
          return {
            id: d.id,
            saleId: dd.saleId || "",    // ⭐ IMPORTANT ⭐
            customerName: dd.customerName || "",
            billNumber: dd.billNumber || "",
            amount: Number(dd.amount || 0),
            date: dd.date || "",
          };
        });

        // sort latest first by date
        data.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

        setIncomeList(data);
      } catch (err) {
        console.error(err);
        setError("Failed to load income data.");
      } finally {
        setLoading(false);
      }
    };

    loadIncome();
  }, []);
const handleDelete = async (income: any) => {
  if (!confirm("Are you sure you want to delete this payment?")) return;

  try {
    const incomeRef = doc(db, "income", income.id);
    const saleRef = doc(db, "sales", income.saleId);

    await runTransaction(db, async (tx) => {
      // get sale data
      const saleSnap = await tx.get(saleRef);
      if (!saleSnap.exists()) return;

      const sale = saleSnap.data();
      const oldPaid = Number(sale.paidAmount || 0);
      const newPaid = oldPaid - Number(income.amount);

      // update sale
      tx.update(saleRef, {
        paidAmount: newPaid < 0 ? 0 : newPaid,
      });

      // delete income record
      tx.delete(incomeRef);
    });

    // update UI instantly
    setIncomeList((prev) => prev.filter((x) => x.id !== income.id));

    alert("Payment deleted successfully.");
  } catch (err) {
    console.error(err);
    alert("Failed to delete income.");
  }
};

  if (loading) return <p className="p-6">Loading income...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;

  return (
          <div className="p-6">
          <div className="flex justify-between items-center mb-4">

  {/* Date Range Inputs */}
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

  {/* Search input */}
  <div>
    <input
      type="text"
      placeholder="Search customer, bill, amount..."
      className="w-64 p-2 border rounded"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
    />
  </div>
</div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Income (Payments Received)</h1>
        <Link
          href="/income"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          + Add Income
        </Link>
      </div>

      {incomeList.length === 0 ? (
        <div className="bg-white p-6 rounded shadow text-center">
          No income records found.
        </div>
      ) : (
        <div className="bg-white rounded shadow overflow-auto">
          <table className="min-w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left">Customer</th>
                <th className="p-3 text-left">Bill No</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>

            <tbody>
             {incomeList
                    .filter((i) => {

                      // SEARCH FILTER
                      const q = search.toLowerCase();
                      const matchesSearch =
                        i.customerName.toLowerCase().includes(q) ||
                        i.billNumber.toLowerCase().includes(q) ||
                        String(i.amount).includes(q) ||
                        i.date.toLowerCase().includes(q);

                      // DATE RANGE FILTER
                      const incomeDate = new Date(i.date);
                      const from = fromDate ? new Date(fromDate) : null;
                      const to = toDate ? new Date(toDate) : null;

                      const matchesDate =
                        (!from || incomeDate >= from) &&
                        (!to || incomeDate <= to);

                      return matchesSearch && matchesDate;
                    })
              .map((i) => (
                <tr key={i.id} className="border-t">
                  <td className="p-3">{i.customerName}</td>
                  <td className="p-3">{i.billNumber}</td>
                  <td className="p-3 text-right">
                    {i.amount.toLocaleString()}
                  </td>
                  <td className="p-3">{i.date}</td>
                  <td className="p-3 flex gap-2">
                    <Link
                      href={`/customer/${encodeURIComponent(
                        i.customerName
                      )}?name=${encodeURIComponent(i.customerName)}`}
                      className="text-sm bg-gray-200 px-3 py-1 rounded hover:bg-gray-300"
                    >
                      Ledger
                    </Link>

                    <button
                      onClick={() => handleDelete(i)}
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
