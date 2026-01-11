"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { db, auth } from "@/lib/firebase";
import { doc, deleteDoc } from "firebase/firestore";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { FormAlert } from "@/components/FormAlert";

type Sale = {
  id: string;
  customerId: string;
  customerName: string;
  customerCompany?: string;
  billNumber: string;
  date: string;
  total: number;
  paidAmount: number;
  createdAt: any;
};

// User-friendly error messages
const getErrorMessage = (error: any): string => {
  if (error?.code === "permission-denied") return "You don't have permission to delete this sale.";
  if (error?.code === "not-found") return "Sale not found. It may have been already deleted.";
  if (error?.code === "aborted") return "Operation cancelled. Please try again.";
  if (error?.message?.includes("Payment")) return error.message;
  return "Failed to delete sale. Please try again.";
};

export default function SalesListPage() {
  // Memoize transform function to prevent infinite refetches
  const dataTransform = useCallback((data: any, id: string): Sale => ({
    id,
    customerId: data.customerId || "",
    customerName: data.customerName || "",
    customerCompany: data.customerCompany,
    billNumber: data.billNumber || "",
    date: data.date || "",
    total: Number(data.total || 0),
    paidAmount: Number(data.paidAmount || 0),
    createdAt: data.createdAt,
  }), []);

  // Pagination hook
  const [{ items: sales, loading, loadingMore, hasMore, error: paginationError }, { loadMore }] = 
    usePaginatedQuery<Sale>({
      collectionName: "sales",
      orderByField: "createdAt",
      orderDirection: "desc",
      dataTransform,
    });

  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [displaySales, setDisplaySales] = useState<Sale[]>([]);

  // Sync paginated items to display on change
  useEffect(() => {
    setDisplaySales(sales);
  }, [sales]);

  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  /* ---------------------- DELETE SALE (with Optimistic Update & Rollback) ------------------------ */
  const handleDeleteSale = async (sale: Sale) => {
    if (!confirm("Delete this sale?")) return;

    if (sale.paidAmount > 0) {
      setError("Cannot delete: Payment already received. Delete income first.");
      return;
    }

    // ✅ Store the current list in case we need to rollback
    const previousSales = displaySales;
    
    try {
      // ✅ Optimistic update: remove from UI immediately
      setDeletingId(sale.id);
      setDisplaySales((prev) => prev.filter((x) => x.id !== sale.id));
      setError("");

      // ✅ Delete from Firestore
      await deleteDoc(doc(db, "sales", sale.id));
      
      setDeletingId(null);
    } catch (err: any) {
      console.error(err);
      // ✅ Rollback: restore the sale if deletion failed
      setDisplaySales(previousSales);
      setDeletingId(null);
      setError(getErrorMessage(err));
    }
  };

  if (loading) return <p className="p-6">Loading...</p>;

  /* ---------------------- UI ------------------------ */
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Sales</h1>

        <Link href="/sales/new" className="bg-blue-600 text-white px-4 py-2 rounded">
          + Add Sale
        </Link>
      </div>

      {/* Filters */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <input type="date" className="p-2 border rounded" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <input type="date" className="p-2 border rounded" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>

        <div>
          <input
            type="text"
            placeholder="Search customer, bill, amount..."
            className="w-72 p-2 border rounded"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white shadow rounded overflow-auto">
        <table className="min-w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Customer</th>
              <th className="p-3 text-left">Bill No</th>
              <th className="p-3 text-right">Bill Amount</th>
              <th className="p-3 text-right">Paid</th>
              <th className="p-3 text-right">Remaining</th>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {displaySales
              .filter((s) => {
                const q = search.toLowerCase();

                const matchSearch =
                  s.customerName.toLowerCase().includes(q) ||
                  (s.customerCompany || "").toLowerCase().includes(q) ||
                  s.billNumber.toLowerCase().includes(q) ||
                  String(s.total).includes(q);

                const billDate = new Date(s.date);
                const from = fromDate ? new Date(fromDate) : null;
                const to = toDate ? new Date(toDate) : null;

                const matchDate =
                  (!from || billDate >= from) &&
                  (!to || billDate <= to);

                return matchSearch && matchDate;
              })
              .map((s) => {
                const remaining = s.total - s.paidAmount;

                return (
                  <tr key={s.id} className="border-t">
                    <td className="p-3">{s.customerCompany || s.customerName}</td>
                    <td className="p-3">{s.billNumber}</td>
                    <td className="p-3 text-right">{s.total.toLocaleString()}</td>
                    <td className="p-3 text-right">{s.paidAmount.toLocaleString()}</td>

                    <td
                      className={`p-3 text-right ${
                        remaining > 0 ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {remaining.toLocaleString()}
                    </td>

                    <td className="p-3">{s.date || "-"}</td>

                    <td className="p-3">
                      <div className="flex gap-2">
                        <Link
                          href={`/customers/${s.customerId}`}
                          className="text-sm bg-gray-200 px-3 py-1 rounded hover:bg-gray-300"
                        >
                          Ledger
                        </Link>

                        <Link
                          href={`/sales/${s.id}`}
                          className="text-sm bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700"
                        >
                          View
                        </Link>

                        <button
                          onClick={() => handleDeleteSale(s)}
                          disabled={deletingId === s.id}
                          className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deletingId === s.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
        {/* Load More Button */}
      {hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="bg-gray-800 text-white px-6 py-2 rounded shadow hover:bg-gray-700 disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load More Sales"}
          </button>
        </div>
      )}
      </div>
    </div>
  );
}
