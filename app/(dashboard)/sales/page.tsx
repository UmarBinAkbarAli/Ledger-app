"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import { doc, deleteDoc } from "firebase/firestore";

type Sale = {
  id: string;
  customerId: string;
  customerName: string;
  customerCompany?: string;   // ✅ ADD
  billNumber: string;
  date: string;
  total: number;
  paidAmount: number;
  createdAt: any;
};


const ITEMS_PER_PAGE = 20; // ✅ NEW: Define page size

export default function SalesListPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false); // ✅ NEW: Loading state for "Load More" button
  const [error, setError] = useState("");

  // ✅ NEW: Track the last document to know where to start fetching the next page
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true); // ✅ NEW: Check if database has more data

  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

/* ---------------------- LOAD SALES FUNCTION ------------------------ */
  const fetchSales = async (isNextPage = false) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        setError("Not logged in");
        setLoading(false);
        return;
      }

      if (isNextPage) setLoadingMore(true);
      else setLoading(true);

      const salesRef = collection(db, "sales");

      // Construct Query with Pagination
      let q;
      if (isNextPage && lastDoc) {
        // Fetch NEXT page (start after the last document we saw)
        q = query(
          salesRef,
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc"),
          startAfter(lastDoc),
          limit(ITEMS_PER_PAGE)
        );
      } else {
        // Fetch FIRST page
        q = query(
          salesRef,
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(ITEMS_PER_PAGE)
        );
      }

      const snap = await getDocs(q);

      // Check if we have more data
      if (snap.empty) {
        setHasMore(false);
        if (isNextPage) setLoadingMore(false);
        else setLoading(false);
        return;
      }

      // Update lastDoc for next fetch
      setLastDoc(snap.docs[snap.docs.length - 1]);
      
      // If we fetched fewer than limit, it means we reached the end
      if (snap.docs.length < ITEMS_PER_PAGE) {
        setHasMore(false);
      }

      const list: Sale[] = snap.docs.map((d) => {
        const dd: any = d.data();
        return {
          id: d.id,
          customerId: dd.customerId || "",
          customerName: dd.customerName || "",
          customerCompany: dd.customerCompany || "",
          billNumber: dd.billNumber || "",
          date: dd.date || "",
          total: Number(dd.total || 0),
          paidAmount: Number(dd.paidAmount || 0),
          createdAt: dd.createdAt || null,
        };
      });

      // Append new data to existing list instead of overwriting
      if (isNextPage) {
        setSales((prev) => [...prev, ...list]);
      } else {
        setSales(list);
      }

    } catch (err) {
      console.error(err);
      setError("Failed to load sales");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  /* ---------------------- INITIAL LOAD ------------------------ */
  useEffect(() => {
    fetchSales(false);
  }, []);

  /* ---------------------- DELETE SALE ------------------------ */
  const handleDeleteSale = async (sale: Sale) => {
    if (!confirm("Delete this sale?")) return;

    if (sale.paidAmount > 0) {
      alert("Cannot delete: Payment already received. Delete income first.");
      return;
    }

    try {
      await deleteDoc(doc(db, "sales", sale.id));
      setSales((prev) => prev.filter((x) => x.id !== sale.id));
      alert("Sale deleted");
    } catch (err) {
      console.error(err);
      alert("Failed to delete");
    }
  };

  if (loading) return <p className="p-6">Loading...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;


  /* ---------------------- UI ------------------------ */
  return (
    <div className="p-6">
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
            {sales
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
                          className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                        >
                          Delete
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
            onClick={() => fetchSales(true)}
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
