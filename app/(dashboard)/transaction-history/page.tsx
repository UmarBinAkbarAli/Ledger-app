"use client";

import { useState, useEffect, useCallback } from "react";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { useBusiness } from "@/hooks/useBusiness";
import { getPakistanDate } from "@/lib/dateUtils";

type Transaction = {
  id: string;
  type: string;
  amount: number;
  fromAccount: string;
  toAccount: string;
  description: string;
  date: string;
  createdAt: any;
  userId: string;
  businessId?: string;
  status: "active" | "reverted";
  revertedAt?: any;
  revertedBy?: string;
  originalTransactionId?: string;
  userEmail?: string;
};

export default function TransactionHistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [reverting, setReverting] = useState<string | null>(null);
  const { businessId, loading: businessLoading } = useBusiness();

  // Filters
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState(getPakistanDate(-30)); // Last 30 days
  const [toDate, setToDate] = useState(getPakistanDate(0));
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "reverted">("all");

  const loadTransactions = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user || businessLoading) return;

      setLoading(true);

      const scopeField = businessId ? "businessId" : "userId";
      const scopeValue = businessId || user.uid;

      let q = query(
        collection(db, "transfers"),
        where(scopeField, "==", scopeValue),
        orderBy("createdAt", "desc")
      );

      let snap;
      try {
        snap = await getDocs(q);
      } catch (err: any) {
        if (err?.code === "permission-denied" && businessId) {
          console.warn("Business-scoped query denied; retrying with userId scope");
          q = query(
            collection(db, "transfers"),
            where("userId", "==", user.uid),
            orderBy("createdAt", "desc")
          );
          snap = await getDocs(q);
        } else {
          throw err;
        }
      }

      const list: Transaction[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          type: "transfer",
          amount: Number(data.amount || 0),
          fromAccount: data.fromAccount || "",
          toAccount: data.toAccount || "",
          description: data.description || "",
          date: data.date || "",
          createdAt: data.createdAt,
          userId: data.userId || "",
          businessId: data.businessId,
          status: data.status || "active",
          revertedAt: data.revertedAt,
          revertedBy: data.revertedBy,
          originalTransactionId: data.originalTransactionId,
          userEmail: data.userEmail,
        };
      });

      setTransactions(list);
    } catch (err) {
      console.error("Error loading transactions:", err);
      alert("Failed to load transaction history");
    } finally {
      setLoading(false);
    }
  }, [businessId, businessLoading]);

  useEffect(() => {
    if (!businessLoading) {
      loadTransactions();
    }
  }, [businessLoading, loadTransactions]);

  const handleRevert = async (transaction: Transaction) => {
    if (transaction.status === "reverted") {
      alert("This transaction has already been reverted");
      return;
    }

    if (transaction.originalTransactionId) {
      alert("Cannot revert a reversal transaction");
      return;
    }

    const confirmMsg = `Are you sure you want to revert this transfer?\n\nAmount: ${transaction.amount.toLocaleString()}\nFrom: ${transaction.fromAccount}\nTo: ${transaction.toAccount}\n\nThis will create a reverse transaction.`;
    
    if (!confirm(confirmMsg)) return;

    setReverting(transaction.id);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      // Get businessId
      let bizId: string | null = businessId;
      if (!bizId) {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        bizId = userSnap.exists() ? userSnap.data()?.businessId ?? null : null;
      }

      // Create reverse transaction
      await addDoc(collection(db, "transfers"), {
        userId: user.uid,
        amount: transaction.amount,
        date: getPakistanDate(0),
        fromAccount: transaction.toAccount, // Reversed
        toAccount: transaction.fromAccount, // Reversed
        description: `REVERSAL: ${transaction.description || "Fund Transfer"}`,
        createdAt: serverTimestamp(),
        status: "active",
        originalTransactionId: transaction.id,
        userEmail: user.email,
        ...(bizId ? { businessId: bizId } : {}),
      });

      // Mark original transaction as reverted
      await updateDoc(doc(db, "transfers", transaction.id), {
        status: "reverted",
        revertedAt: serverTimestamp(),
        revertedBy: user.uid,
      });

      alert("Transaction reverted successfully");
      loadTransactions();
    } catch (err: any) {
      console.error("Error reverting transaction:", err);
      alert(`Failed to revert transaction: ${err.message}`);
    } finally {
      setReverting(null);
    }
  };

  if (loading) return <p className="p-6">Loading transaction history...</p>;

  // Apply filters
  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch =
      t.fromAccount.toLowerCase().includes(search.toLowerCase()) ||
      t.toAccount.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      String(t.amount).includes(search);

    const matchesStatus = statusFilter === "all" || t.status === statusFilter;

    const transactionDate = new Date(t.date);
    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate) : null;
    const matchesDate = (!from || transactionDate >= from) && (!to || transactionDate <= to);

    return matchesSearch && matchesStatus && matchesDate;
  });

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Transaction History</h1>

      {/* Filters */}
      <div className="bg-white p-4 rounded shadow mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">From Date</label>
            <input
              type="date"
              className="w-full p-2 border rounded"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">To Date</label>
            <input
              type="date"
              className="w-full p-2 border rounded"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              className="w-full p-2 border rounded"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="all">All Transactions</option>
              <option value="active">Active Only</option>
              <option value="reverted">Reverted Only</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Search</label>
            <input
              type="text"
              placeholder="Search account, amount..."
              className="w-full p-2 border rounded"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded shadow">
          <div className="text-sm text-gray-600">Total Transactions</div>
          <div className="text-2xl font-bold">{filteredTransactions.length}</div>
        </div>

        <div className="bg-green-50 p-4 rounded shadow">
          <div className="text-sm text-gray-600">Active Transactions</div>
          <div className="text-2xl font-bold text-green-600">
            {filteredTransactions.filter((t) => t.status === "active").length}
          </div>
        </div>

        <div className="bg-red-50 p-4 rounded shadow">
          <div className="text-sm text-gray-600">Reverted Transactions</div>
          <div className="text-2xl font-bold text-red-600">
            {filteredTransactions.filter((t) => t.status === "reverted").length}
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white shadow rounded overflow-auto">
        <table className="min-w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">From Account</th>
              <th className="p-3 text-left">To Account</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3 text-left">Description</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  No transactions found
                </td>
              </tr>
            ) : (
              filteredTransactions.map((t) => (
                <tr
                  key={t.id}
                  className={`border-t ${
                    t.status === "reverted" ? "bg-red-50 opacity-60" : ""
                  } ${t.originalTransactionId ? "bg-yellow-50" : ""}`}
                >
                  <td className="p-3">{t.date}</td>
                  <td className="p-3">{t.fromAccount}</td>
                  <td className="p-3">{t.toAccount}</td>
                  <td className="p-3 text-right font-semibold">
                    {t.amount.toLocaleString()}
                  </td>
                  <td className="p-3">
                    {t.originalTransactionId && (
                      <span className="text-xs bg-yellow-200 px-2 py-1 rounded mr-2">
                        REVERSAL
                      </span>
                    )}
                    {t.description || "-"}
                  </td>
                  <td className="p-3">
                    {t.status === "active" ? (
                      <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded">
                        Active
                      </span>
                    ) : (
                      <span className="text-xs bg-red-200 text-red-800 px-2 py-1 rounded">
                        Reverted
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {t.status === "active" && !t.originalTransactionId && (
                      <button
                        onClick={() => handleRevert(t)}
                        disabled={reverting === t.id}
                        className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50"
                      >
                        {reverting === t.id ? "Reverting..." : "Revert"}
                      </button>
                    )}
                    {t.status === "reverted" && (
                      <span className="text-xs text-gray-500">
                        Reverted on {t.revertedAt?.toDate?.().toLocaleDateString() || "N/A"}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

