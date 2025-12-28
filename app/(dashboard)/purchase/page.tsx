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
  limit,                  // <--- Add this
  startAfter,             // <--- Add this
  QueryDocumentSnapshot,  // <--- Add this
  DocumentData,           // <--- Add this
  doc,
  deleteDoc,
} from "firebase/firestore";

type Purchase = {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierCompany?: string;
  billNumber: string;
  date: string;
  total: number;
  paidAmount: number; // if you add payment in future
  createdAt: any;
};

export default function PurchaseListPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // --- Pagination State ---
  const ITEMS_PER_PAGE = 20;
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

/* ---------------------- LOAD PURCHASES (PAGINATED) ------------------------ */
  const fetchPurchases = async (isNextPage = false) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        setError("Not logged in");
        setLoading(false);
        return;
      }

      if (isNextPage) setLoadingMore(true);
      else setLoading(true);

      const purchasesRef = collection(db, "purchases");
      let q;

      // Logic: If loading next page, start after the last document
      if (isNextPage && lastDoc) {
        q = query(
          purchasesRef,
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc"),
          startAfter(lastDoc),
          limit(ITEMS_PER_PAGE)
        );
      } else {
        // Otherwise, load the first page
        q = query(
          purchasesRef,
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(ITEMS_PER_PAGE)
        );
      }

      const snap = await getDocs(q);

      // Handle "No more data"
      if (snap.empty) {
        setHasMore(false);
        if (isNextPage) setLoadingMore(false);
        else setLoading(false);
        return;
      }

      // Save the last document for the next cursor
      setLastDoc(snap.docs[snap.docs.length - 1]);
      
      if (snap.docs.length < ITEMS_PER_PAGE) {
        setHasMore(false);
      }

      const list: Purchase[] = snap.docs.map((d) => {
        const dd: any = d.data();
        return {
          id: d.id,
          supplierId: dd.supplierId || "",
          supplierName: dd.supplierName || "",
          supplierCompany: dd.supplierCompany || "",
          billNumber: dd.billNumber || "",
          date: dd.date || "",
          total: Number(dd.total || 0),
          paidAmount: Number(dd.paidAmount || 0),
          createdAt: dd.createdAt || null,
        };
      });

      // If next page, add to list. If first page, replace list.
      if (isNextPage) {
        setPurchases((prev) => [...prev, ...list]);
      } else {
        setPurchases(list);
      }

    } catch (err) {
      console.error(err);
      setError("Failed to load purchases");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Initial Load
  useEffect(() => {
    fetchPurchases(false);
  }, []);

  /* ---------------------- DELETE PURCHASE ------------------------ */
  const handleDeletePurchase = async (p: Purchase) => {
    if (!confirm("Delete this purchase?")) return;

    try {
      await deleteDoc(doc(db, "purchases", p.id));
      setPurchases((prev) => prev.filter((x) => x.id !== p.id));
      alert("Purchase deleted");
    } catch (err) {
      console.error(err);
      alert("Failed to delete");
    }
  };

  if (loading) return <p className="p-6">Loading...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;

  /* ---------------------------------------------
     DAILY TOTAL PURCHASE (TODAY)
  ----------------------------------------------*/
  const today = new Date().toISOString().split("T")[0];

  const todaysTotalPurchase = purchases
    .filter((p) => p.date === today)
    .reduce((sum, p) => sum + p.total, 0);

  /* ---------------------- UI ------------------------ */
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Purchase List</h1>

        <Link href="/purchase/new" className="bg-blue-600 text-white px-4 py-2 rounded">
          + New Purchase
        </Link>
      </div>

      {/* Filters */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <input type="date" className="p-2 border rounded" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <input type="date" className="p-2 border rounded" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>

        <input
          type="text"
          placeholder="Search bill, supplier, amount..."
          className="w-72 p-2 border rounded"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-white shadow rounded overflow-auto">
        <table className="min-w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Supplier</th>
              <th className="p-3 text-left">Bill #</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3 text-right">Paid</th>
              <th className="p-3 text-right">Remaining</th>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {purchases
              .filter((p) => {
                const q = search.toLowerCase();

                const matchSearch =
                  p.supplierName.toLowerCase().includes(q) ||
                  (p.supplierCompany || "").toLowerCase().includes(q) ||
                  p.billNumber.toLowerCase().includes(q) ||
                  String(p.total).includes(q);

                const billDate = new Date(p.date);
                const from = fromDate ? new Date(fromDate) : null;
                const to = toDate ? new Date(toDate) : null;

                const matchDate =
                  (!from || billDate >= from) &&
                  (!to || billDate <= to);

                return matchSearch && matchDate;
              })
              .map((p) => {
                const remaining = p.total - p.paidAmount;

                return (
                  <tr key={p.id} className="border-t">
                    <td className="p-3">{p.supplierCompany || p.supplierName}</td>
                    <td className="p-3">{p.billNumber}</td>
                    <td className="p-3 text-right">{p.total.toLocaleString()}</td>
                    <td className="p-3 text-right">{p.paidAmount.toLocaleString()}</td>

                    <td
                      className={`p-3 text-right ${
                        remaining > 0 ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {remaining.toLocaleString()}
                    </td>

                    <td className="p-3">{p.date || "-"}</td>

                    <td className="p-3">
                      <div className="flex gap-2">
                        {/* Supplier Ledger */}
                        <Link
                          href={`/supplier/${p.supplierId}`}
                          className="text-sm bg-gray-200 px-3 py-1 rounded hover:bg-gray-300"
                        >
                          Ledger
                        </Link>

                        {/* View */}
                        <Link
                          href={`/purchase/${p.id}`}
                          className="text-sm bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700"
                        >
                          View
                        </Link>

                        {/* Delete */}
                        <button
                          onClick={() => handleDeletePurchase(p)}
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
      </div>
      {/* Load More Button - Only shows if there is more data */}
      {hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={() => fetchPurchases(true)}
            disabled={loadingMore}
            className="bg-gray-800 text-white px-6 py-2 rounded shadow hover:bg-gray-700 disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load More Purchases"}
          </button>
        </div>
      )}
    </div>
  );
}
