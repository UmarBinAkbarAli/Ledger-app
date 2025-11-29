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
import { doc, deleteDoc } from "firebase/firestore";

type Purchase = {
  id: string;
  supplierName: string;
  billNumber: string;
  amount: number;
  date?: string;
  paidAmount?: number;
  createdAt?: any;
};

export default function PurchaseListPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  

  useEffect(() => {
    const loadPurchases = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setError("Not logged in");
          setLoading(false);
          return;
        }

        // Fetch all purchases of logged-in user
        const q = query(
          collection(db, "purchase"),
          where("userId", "==", user.uid)
        );

        const snap = await getDocs(q);
        const data: Purchase[] = snap.docs.map((d) => {
          const dd: any = d.data();
          return {
            id: d.id,
            supplierName: dd.supplierName || "",
            billNumber: dd.billNumber || "",
            amount: Number(dd.amount || 0),
            date: dd.date || "",
            paidAmount: Number(dd.paidAmount || 0), // after expenses
            createdAt: dd.createdAt || null,
          };
        });

        // Sort by newest (createdAt or date)
        data.sort((a, b) => {
          const ta = a.createdAt?.seconds || 0;
          const tb = b.createdAt?.seconds || 0;
          if (tb !== ta) return tb - ta;
          return (b.date || "").localeCompare(a.date || "");
        });

        setPurchases(data);
      } catch (err: any) {
        console.error(err);
        setError("Failed to load purchases.");
      } finally {
        setLoading(false);
      }
    };

    loadPurchases();
  }, []);
        const handleDeletePurchase = async (purchase: any) => {
        if (!confirm("Are you sure you want to delete this purchase bill?")) return;

        // SAFETY CHECK
        if (purchase.paidAmount && purchase.paidAmount > 0) {
          alert("Cannot delete this purchase because you have already paid some amount. Delete the expense entries first.");
          return;
        }

        try {
          const purchaseRef = doc(db, "purchase", purchase.id);
          await deleteDoc(purchaseRef);

          // Update UI
          setPurchases((prev) => prev.filter((x) => x.id !== purchase.id));

          alert("Purchase deleted successfully.");
        } catch (err) {
          console.error(err);
          alert("Failed to delete purchase.");
        }
      };

  if (loading) return <p className="p-6">Loading purchases...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Purchases</h1>

        <Link href="/purchase/new" className="bg-blue-600 text-white px-4 py-2 rounded">
          + Add Purchase
        </Link>
      </div>
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
      {purchases.length === 0 ? (
        <div className="bg-white p-6 rounded shadow text-center">
          No purchases found. Add your first purchase.
        </div>
      ) : (
        <div className="bg-white rounded shadow overflow-auto">
          <table className="min-w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left">Supplier</th>
                <th className="p-3 text-left">Bill No</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3 text-right">Paid</th>
                <th className="p-3 text-right">Remaining</th>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>

            <tbody>
              {purchases
  .filter((p) => {
    // Search
    const q = search.toLowerCase();
    const matchesSearch =
      p.supplierName.toLowerCase().includes(q) ||
      p.billNumber.toLowerCase().includes(q) ||
      String(p.amount).includes(q) ||
      String(p.paidAmount).includes(q);

    // Date Handling
    const billDate = new Date(p.date ?? "");
    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate) : null;

    const matchesDate =
      (!from || billDate >= from) &&
      (!to || billDate <= to);

    return matchesSearch && matchesDate;
  })
  .map((p) => {
                const paid = Number(p.paidAmount || 0);
                const remaining = Number(p.amount || 0) - paid;

                return (
                  <tr key={p.id} className="border-t">
                    <td className="p-3">{p.supplierName}</td>
                    <td className="p-3">{p.billNumber}</td>

                    <td className="p-3 text-right">
                      {p.amount.toLocaleString()}
                    </td>

                    <td className="p-3 text-right">
                      {paid.toLocaleString()}
                    </td>

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
                          href={`/supplier/${encodeURIComponent(p.supplierName)}?name=${encodeURIComponent(p.supplierName)}`}
                          className="text-sm bg-gray-200 px-3 py-1 rounded hover:bg-gray-300"
                        >
                          Ledger
                        </Link>

                        {/* View Purchase Invoice */}
                        <Link
                          href={`/purchase/${p.id}`}
                          className="text-sm bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700"
                        >
                          View
                        </Link>

                        {/* Delete Purchase */}
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
      )}
    </div>
  );
}
