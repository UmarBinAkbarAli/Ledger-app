"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { db, auth } from "@/lib/firebase";
import { useBusiness } from "@/hooks/useBusiness";
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

  // --- Pagination State ---
  const ITEMS_PER_PAGE = 20;
  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const { businessId, loading: businessLoading } = useBusiness();
  const scopeRef = useRef<{ field: "businessId" | "userId"; value: string } | null>(null);

// Defined OUTSIDE useEffect so the button can use it
  const fetchExpenses = useCallback(async (isNextPage = false) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        setError("Not logged in");
        setLoading(false);
        return;
      }
      if (businessLoading) return;

      // Set correct loading state
      if (isNextPage) setLoadingMore(true);
      else setLoading(true);

      const expensesRef = collection(db, "expenses");
      if (!isNextPage) {
        lastDocRef.current = null;
        setHasMore(true);
        scopeRef.current = null;
      }

      const desiredScope = businessId
        ? { field: "businessId" as const, value: businessId }
        : { field: "userId" as const, value: user.uid };
      let effectiveScope = isNextPage && scopeRef.current ? scopeRef.current : desiredScope;
      let appendResults = isNextPage;

      const buildQuery = (field: "businessId" | "userId", value: string, last: QueryDocumentSnapshot<DocumentData> | null) =>
        query(
          expensesRef,
          where(field, "==", value),
          orderBy("date", "desc"),
          ...(last ? [startAfter(last)] : []),
          limit(ITEMS_PER_PAGE)
        );

      let snap;
      try {
        const cursor = appendResults ? lastDocRef.current : null;
        snap = await getDocs(buildQuery(effectiveScope.field, effectiveScope.value, cursor));
      } catch (err: any) {
        if (err?.code === "permission-denied" && businessId) {
          console.warn("Business-scoped query denied; retrying with userId scope", {
            collectionName: "expenses",
            userId: user.uid,
            businessId,
          });
          effectiveScope = { field: "userId", value: user.uid };
          scopeRef.current = effectiveScope;
          lastDocRef.current = null;
          appendResults = false;
          snap = await getDocs(buildQuery(effectiveScope.field, effectiveScope.value, null));
        } else {
          throw err;
        }
      }
      scopeRef.current = effectiveScope;

      // Handle Empty / End of List
      if (snap.empty) {
        setHasMore(false);
        if (isNextPage) setLoadingMore(false);
        else setLoading(false);
        return;
      }

      // Update Cursor for next time
      lastDocRef.current = snap.docs[snap.docs.length - 1];
      
      if (snap.docs.length < ITEMS_PER_PAGE) {
        setHasMore(false);
      }

      // Map Data (Your exact mapping)
      const list: ExpenseItem[] = snap.docs.map((d) => {
        const dd: any = d.data();
        return {
          id: d.id,
          supplierId: dd.supplierId || "",
          supplierName: dd.supplierName || "",
          billNumber: dd.billNumber || "",
          amount: Number(dd.amount || 0),
          date: dd.date || "",
        };
      });

      // Update State
      if (appendResults) {
        setExpenseList((prev) => [...prev, ...list]);
      } else {
        setExpenseList(list);
      }

    } catch (err) {
      console.error(err);
      setError("Failed to load expenses");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [businessId, businessLoading]);

  // Now the useEffect is simple: just call the function above
  useEffect(() => {
    if (businessLoading) return;
    fetchExpenses(false);
  }, [businessLoading, businessId, fetchExpenses]);
  
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
      {/* Load More Button */}
      {hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={() => fetchExpenses(true)}
            disabled={loadingMore}
            className="bg-gray-800 text-white px-6 py-2 rounded shadow hover:bg-gray-700 disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load More Expenses"}
          </button>
        </div>
      )}
    </div>
  );
}
