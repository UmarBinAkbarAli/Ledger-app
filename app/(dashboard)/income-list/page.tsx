"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { db, auth } from "@/lib/firebase";
import { doc, runTransaction } from "firebase/firestore";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { FormAlert } from "@/components/FormAlert";

type IncomeItem = {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  date: string;
};

/* Helper: Map Firebase error codes to user-friendly messages */
const getErrorMessage = (err: any): string => {
  const code = err?.code || err?.message || "";
  if (code.includes("permission-denied")) return "You don't have permission to delete this payment.";
  if (code.includes("not-found")) return "This payment was already deleted.";
  if (code.includes("aborted")) return "Operation cancelled. Please try again.";
  return "Failed to delete this payment. Please try again.";
};

export default function IncomeListPage() {
  // Memoize transform function to prevent infinite refetches
  const dataTransform = useCallback((data: any, id: string): IncomeItem => {
    let finalDate = "";
    if (typeof data.date === "string") finalDate = data.date;
    else if (data.date?.toDate)
      finalDate = data.date.toDate().toISOString().slice(0, 10);
    else if (data.createdAt?.toDate)
      finalDate = data.createdAt.toDate().toISOString().slice(0, 10);

    return {
      id,
      customerId: data.customerId || "",
      customerName: data.customerName || "",
      amount: Number(data.amount || 0),
      date: finalDate,
    };
  }, []);

  // Pagination hook
  const [{ items: incomeList, loading, loadingMore, hasMore, error: paginationError }, { loadMore }] = 
    usePaginatedQuery<IncomeItem>({
      collectionName: "income",
      orderByField: "date",
      orderDirection: "desc",
      dataTransform,
    });

  const [displayIncomeList, setDisplayIncomeList] = useState<IncomeItem[]>([]);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Sync paginated items to display on change
  // Sync paginated items to display on change
  useEffect(() => {
    setDisplayIncomeList(incomeList);
  }, [incomeList]);

  /* ---------------------- DELETE INCOME (with Optimistic Update & Rollback) ---------------------- */
  const handleDelete = async (income: IncomeItem) => {
    if (!confirm("Are you sure you want to delete this payment?")) return;

    // ✅ Store the current list in case we need to rollback
    const previousIncomeList = displayIncomeList;

    try {
      // ✅ Optimistic update: remove from UI immediately
      setDeletingId(income.id);
      setDisplayIncomeList((prev) => prev.filter((x) => x.id !== income.id));
      setError("");

      // ✅ Delete from Firestore
      const incomeRef = doc(db, "income", income.id);
      await runTransaction(db, async (tx) => {
        tx.delete(incomeRef);
      });

      setDeletingId(null);
    } catch (err: any) {
      console.error(err);
      // ✅ Rollback: restore the payment if deletion failed
      setDisplayIncomeList(previousIncomeList);
      setDeletingId(null);
      setError(getErrorMessage(err));
    }
  };

    /* ---------------------------------------------
     DAILY TOTAL INCOME (TODAY)
  ----------------------------------------------*/
  const today = new Date().toISOString().split("T")[0];

  const todaysTotalIncome = incomeList
    .filter((i) => i.date === today)
    .reduce((sum, i) => sum + i.amount, 0);


  /* ---------------------------------------------
     RENDER
  ----------------------------------------------*/
  if (loading) return <p className="p-6">Loading income...</p>;

  return (
    <div className="p-6">

      {/* Error Display */}
      {error && (
        <FormAlert
          type="error"
          message={error}
          onClose={() => setError("")}
          closeable
        />
      )}

      {/* Filters */}
      <div className="flex justify-between items-center mb-4">
        {/* Date Filters */}
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

        {/* Search */}
        <input
          type="text"
          placeholder="Search customer, amount, date..."
          className="w-64 p-2 border rounded"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>  


      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Income (Payments Received)</h1>

        <Link
          href="/income"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          + Add Income
        </Link>
      </div>

      {/* Table */}
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
                <th className="p-3 text-right">Amount</th>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>

            <tbody>
              {displayIncomeList
                .filter((i) => {
                  const q = search.toLowerCase();

                  // Search
                  const matchesSearch =
                    i.customerName.toLowerCase().includes(q) ||
                    String(i.amount).includes(q) ||
                    (i.date || "").toLowerCase().includes(q);

                  // Date Filtering
                  const d = new Date(i.date);
                  const from = fromDate ? new Date(fromDate) : null;
                  const to = toDate ? new Date(toDate) : null;

                  const matchesDate =
                    (!from || d >= from) && (!to || d <= to);

                  return matchesSearch && matchesDate;
                })
                .map((i) => (
                  <tr key={i.id} className="border-t">
                    <td className="p-3">{i.customerName}</td>

                    <td className="p-3 text-right">
                      {i.amount.toLocaleString()}
                    </td>

                    <td className="p-3">{i.date}</td>

                    <td className="p-3 flex gap-2">
                      {/* Ledger Button */}
                      <Link
                        href={`/customers/${i.customerId}`}
                        className="text-sm bg-gray-200 px-3 py-1 rounded hover:bg-gray-300"
                      >
                        Ledger
                      </Link>

                      <button
                        onClick={() => handleDelete(i)}
                        disabled={deletingId === i.id}
                        className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deletingId === i.id ? "Deleting..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Load More Button */}
      {hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="bg-gray-800 text-white px-6 py-2 rounded shadow hover:bg-gray-700 disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load More Income"}
          </button>
        </div>
      )}
    </div>
  );
}
