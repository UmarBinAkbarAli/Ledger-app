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
  doc,
  deleteDoc,
} from "firebase/firestore";

type Purchase = {
  id: string;
  supplierId: string;
  supplierName: string;
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

  /* ---------------------- LOAD PURCHASES ------------------------ */
  useEffect(() => {
    const loadPurchases = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setError("Not logged in");
          setLoading(false);
          return;
        }

        const q1 = query(
          collection(db, "purchases"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );

        const snap = await getDocs(q1);

        const list: Purchase[] = snap.docs.map((d) => {
          const dd: any = d.data();

          return {
            id: d.id,
            supplierId: dd.supplierId || "",
            supplierName: dd.supplierName || "",
            billNumber: dd.billNumber || "",
            date: dd.date || "",
            total: Number(dd.total || dd.subtotal || 0),
            paidAmount: Number(dd.paidAmount || 0),
            createdAt: dd.createdAt || null,
          };
        });

        setPurchases(list);
      } catch (err) {
        console.error(err);
        setError("Failed to load purchases");
      } finally {
        setLoading(false);
      }
    };

    loadPurchases();
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
                    <td className="p-3">{p.supplierName}</td>
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
    </div>
  );
}
