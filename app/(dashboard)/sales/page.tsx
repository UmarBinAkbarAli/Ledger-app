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
  serverTimestamp,
} from "firebase/firestore";
import { doc, deleteDoc } from "firebase/firestore";
type Sale = {
  id: string;
  customerName: string;
  billNumber: string;
  date?: string;
  amount: number;
  paidAmount?: number;
  createdAt?: any;
};

export default function SalesListPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    const loadSales = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setError("Not logged in");
          setLoading(false);
          return;
        }

        // get sales by user, ordered by createdAt desc if available
        const q = query(
          collection(db, "sales"),
          where("userId", "==", user.uid),
          // if you have a createdAt timestamp, ordering by it is better:
          // orderBy("createdAt", "desc")
        );

        const snap = await getDocs(q);
        const data: Sale[] = snap.docs.map((d) => {
          const dd: any = d.data();
          return {
            id: d.id,
            customerName: dd.customerName || "",
            billNumber: dd.billNumber || "",
            date: dd.date || "",
            amount: Number(dd.amount || 0),
            paidAmount: Number(dd.paidAmount || 0),
            createdAt: dd.createdAt || null,
          };
        });

        // sort: newest first (by createdAt or by date)
        data.sort((a, b) => {
          // try createdAt, fallback to date string
          const ta = a.createdAt ? a.createdAt.seconds || 0 : 0;
          const tb = b.createdAt ? b.createdAt.seconds || 0 : 0;
          if (tb !== ta) return tb - ta;
          return (b.date || "").localeCompare(a.date || "");
        });

        setSales(data);
      } catch (err: any) {
        console.error("Failed to load sales:", err);
        setError("Failed to load sales. See console.");
      } finally {
        setLoading(false);
      }
    };

    loadSales();
  }, []);

  const handleDeleteSale = async (sale: any) => {
  if (!confirm("Are you sure you want to delete this sale bill?")) return;

  // SAFETY CHECK
  if (sale.paidAmount && sale.paidAmount > 0) {
    alert("Cannot delete this sale because it has payments received. Delete the income entries first.");
    return;
  }

  try {
    await deleteDoc(doc(db, "sales", sale.id));

    // update UI instantly
    setSales((prev) => prev.filter((x) => x.id !== sale.id));

    alert("Sale deleted successfully.");
  } catch (err) {
    console.error(err);
    alert("Failed to delete sale.");
  }
};

  if (loading) return <p className="p-6">Loading sales...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Sales</h1>
        <Link href="/sales/new" className="bg-blue-600 text-white px-4 py-2 rounded">
          + Add Sale
        </Link>
      </div>
   
      <div className="flex justify-between items-center mb-4">

        {/* Left side: Date filters */}
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

        {/* Right side: Search input */}
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
      {sales.length === 0 ? (
        <div className="bg-white p-6 rounded shadow text-center">
          No sales found. Add your first sale.
        </div>
      ) : (
        <div className="bg-white rounded shadow overflow-auto">
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

                  // Search filter
                  const q = search.toLowerCase();
                  const matchesSearch =
                    s.customerName.toLowerCase().includes(q) ||
                    s.billNumber.toLowerCase().includes(q) ||
                    String(s.amount).includes(q) ||
                    String(s.paidAmount).includes(q);

                  // Date filter
                  const billDate = new Date(s.date ?? "");

                  const from = fromDate ? new Date(fromDate) : null;
                  const to = toDate ? new Date(toDate) : null;

                  const matchesDate =
                    (!from || billDate >= from) &&
                    (!to || billDate <= to);

                  return matchesSearch && matchesDate;
                })
                .map((s) => {
                const paid = Number(s.paidAmount || 0);
                const remaining = Number(s.amount || 0) - paid;
                return (
                  <tr key={s.id} className="border-t">
                    <td className="p-3">{s.customerName}</td>
                    <td className="p-3">{s.billNumber}</td>
                    <td className="p-3 text-right">{s.amount.toLocaleString()}</td>
                    <td className="p-3 text-right">{paid.toLocaleString()}</td>
                    <td className={`p-3 text-right ${remaining > 0 ? "text-red-600" : "text-green-600"}`}>
                      {remaining.toLocaleString()}
                    </td>
                    <td className="p-3">{s.date || "-"}</td>
                    <td className="p-3">
                     <div className="flex gap-2">
                      <Link
                        href={`/customer/${encodeURIComponent(
                          s.customerName
                        )}?name=${encodeURIComponent(s.customerName)}`}
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
        </div>
      )}
    </div>
  );
}
