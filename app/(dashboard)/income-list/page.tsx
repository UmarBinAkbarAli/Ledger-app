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
  doc,
  runTransaction,
} from "firebase/firestore";

type IncomeItem = {
  id: string;
  customerId: string;
  customerName: string;
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

  // --- Pagination State ---
  const ITEMS_PER_PAGE = 20;
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

/* ---------------------------------------------
     Load Income Records (PAGINATED)
  ----------------------------------------------*/
  const fetchIncome = async (isNextPage = false) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        setError("Not logged in");
        setLoading(false);
        return;
      }

      if (isNextPage) setLoadingMore(true);
      else setLoading(true);

      const incomeRef = collection(db, "income");
      let q;

      if (isNextPage && lastDoc) {
        q = query(
          incomeRef,
          where("userId", "==", user.uid),
          orderBy("date", "desc"), // Use 'date' field for sorting
          startAfter(lastDoc),
          limit(ITEMS_PER_PAGE)
        );
      } else {
        q = query(
          incomeRef,
          where("userId", "==", user.uid),
          orderBy("date", "desc"),
          limit(ITEMS_PER_PAGE)
        );
      }

      const snap = await getDocs(q);

      if (snap.empty) {
        setHasMore(false);
        if (isNextPage) setLoadingMore(false);
        else setLoading(false);
        return;
      }

      setLastDoc(snap.docs[snap.docs.length - 1]);
      
      if (snap.docs.length < ITEMS_PER_PAGE) {
        setHasMore(false);
      }

      const list: IncomeItem[] = snap.docs.map((d) => {
        const dd: any = d.data();
        // Normalize date
        let finalDate = "";
        if (typeof dd.date === "string") finalDate = dd.date;
        else if (dd.date?.toDate)
          finalDate = dd.date.toDate().toISOString().slice(0, 10);
        else if (dd.createdAt?.toDate)
          finalDate = dd.createdAt.toDate().toISOString().slice(0, 10);

        return {
          id: d.id,
          customerId: dd.customerId || "",
          customerName: dd.customerName || "",
          amount: Number(dd.amount || 0),
          date: finalDate,
        };
      });

      if (isNextPage) {
        setIncomeList((prev) => [...prev, ...list]);
      } else {
        setIncomeList(list);
      }

    } catch (err) {
      console.error(err);
      setError("Failed to load income data.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchIncome(false);
  }, []);

  /* ---------------------------------------------
     Delete Income (no sale linking now)
  ----------------------------------------------*/
  const handleDelete = async (income: IncomeItem) => {
    if (!confirm("Are you sure you want to delete this payment?")) return;

    try {
      const incomeRef = doc(db, "income", income.id);

      await runTransaction(db, async (tx) => {
        tx.delete(incomeRef);
      });

      setIncomeList((prev) => prev.filter((x) => x.id !== income.id));
      alert("Payment deleted successfully.");
    } catch (err) {
      console.error(err);
      alert("Failed to delete income.");
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
  if (error) return <p className="p-6 text-red-600">{error}</p>;

  return (
    <div className="p-6">

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
              {incomeList
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
      {/* Load More Button */}
      {hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={() => fetchIncome(true)}
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
