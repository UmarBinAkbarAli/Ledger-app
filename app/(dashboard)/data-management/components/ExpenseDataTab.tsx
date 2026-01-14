"use client";

import React, { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { useBusiness } from "@/hooks/useBusiness";
import {
  downloadCSV,
  exportExpenses,
  getExpenseTemplate,
  validateExpenseData,
  ExpenseData,
} from "@/lib/csvUtils";
import ImportModal from "@/components/ImportModal";

export default function ExpenseDataTab() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const { businessId, loading: businessLoading } = useBusiness();

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user || !businessId) return;

      const snap = await getDocs(
        query(collection(db, "expenses"), where("businessId", "==", businessId))
      );

      setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error loading expenses:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (businessLoading) return;
    loadExpenses();
    loadSuppliers();
  }, [businessId, businessLoading]);

  const loadSuppliers = async () => {
    try {
      const user = auth.currentUser;
      if (!user || !businessId) return;

      const snap = await getDocs(
        query(collection(db, "suppliers"), where("businessId", "==", businessId))
      );
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) =>
        (a.name || "").localeCompare(b.name || "")
      );
      setSuppliers(list);
    } catch (err) {
      console.error("Error loading suppliers:", err);
    }
  };

  const getSuppliersForLookup = async () => {
    if (suppliers.length > 0) return suppliers;
    const user = auth.currentUser;
    if (!user || !businessId) return [];

    const snap = await getDocs(
      query(collection(db, "suppliers"), where("businessId", "==", businessId))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  };

  const filterExpensesForExport = () => {
    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate) : null;

    return expenses.filter((expense) => {
      if (selectedSupplier && expense.supplierId !== selectedSupplier) {
        return false;
      }

      if (!from && !to) return true;
      if (!expense.date) return false;

      const expenseDate = new Date(expense.date);
      if (Number.isNaN(expenseDate.getTime())) return false;

      if (from && expenseDate < from) return false;
      if (to && expenseDate > to) return false;
      return true;
    });
  };

  const handleExport = () => {
    const filteredExpenses = filterExpensesForExport();
    if (filteredExpenses.length === 0) {
      alert("No expenses to export for selected filters");
      return;
    }
    const csv = exportExpenses(filteredExpenses);
    downloadCSV(csv, `expenses_${new Date().toISOString().split("T")[0]}.csv`);
  };

  const handleDownloadTemplate = () => {
    const template = getExpenseTemplate();
    downloadCSV(template, "expense_template.csv");
  };

  const handleImport = async (newExpenses: ExpenseData[]) => {
    const user = auth.currentUser;
    if (!user || !businessId) {
      throw new Error("Missing business context");
    }

    const suppliers = await getSuppliersForLookup();
    const suppliersList = suppliers.map((s: any) => ({
      id: s.id,
      name: (s.name || "").toString(),
    }));
    const nameToId = new Map(
      suppliersList.map((s) => [s.name.toLowerCase(), s.id])
    );
    const idToName = new Map(suppliersList.map((s) => [s.id, s.name]));

    const missingSuppliers = new Set<string>();
    const batch = writeBatch(db);

    for (const expense of newExpenses) {
      let supplierId = (expense.supplierId || "").trim();
      let supplierName = (expense.supplierName || "").trim();

      if (!supplierId && supplierName) {
        const matchedId = nameToId.get(supplierName.toLowerCase());
        if (matchedId) {
          supplierId = matchedId;
        } else {
          const supplierRef = doc(collection(db, "suppliers"));
          supplierId = supplierRef.id;
          batch.set(supplierRef, {
            userId: user.uid,
            businessId,
            name: supplierName,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          nameToId.set(supplierName.toLowerCase(), supplierId);
          idToName.set(supplierId, supplierName);
        }
      }

      if (!supplierId) {
        missingSuppliers.add(supplierName || "Unknown");
        continue;
      }

      if (!supplierName) {
        supplierName = idToName.get(supplierId) || "";
      }

      const expenseRef = doc(collection(db, "expenses"));
      batch.set(expenseRef, {
        supplierId,
        supplierName,
        amount: Number(expense.amount || 0),
        date: expense.date,
        paymentMethod: expense.paymentMethod || "CASH",
        bankName: expense.bankName || "",
        notes: expense.notes || "",
        userId: user.uid,
        businessId,
        createdAt: serverTimestamp(),
      });
    }

    if (missingSuppliers.size > 0) {
      throw new Error(
        `Missing suppliers: ${Array.from(missingSuppliers).join(", ")}`
      );
    }

    await batch.commit();
    await loadExpenses();
  };

  return (
    <div>
      <div className="flex flex-wrap gap-4 mb-4 items-end">
        <div>
          <label className="block text-sm font-semibold mb-1">From</label>
          <input
            type="date"
            className="border rounded p-2"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">To</label>
          <input
            type="date"
            className="border rounded p-2"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>

        <div className="min-w-[220px]">
          <label className="block text-sm font-semibold mb-1">Supplier</label>
          <select
            className="border rounded p-2 w-full"
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
          >
            <option value="">All suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-4 mb-6 flex-wrap">
        <button
          onClick={handleExport}
          disabled={expenses.length === 0 || loading}
          className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          Export All ({expenses.length})
        </button>

        <button
          onClick={() => setIsImportOpen(true)}
          className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700"
        >
          Import Expenses
        </button>

        <button
          onClick={handleDownloadTemplate}
          className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700"
        >
          Download Template
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
        <p className="text-sm text-gray-700 mb-2">
          <strong>Import Format:</strong> CSV with columns: supplierId,
          supplierName, date, amount, paymentMethod, bankName, notes
        </p>
      </div>

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImport={handleImport}
        title="Import Expenses"
        validateData={validateExpenseData}
      />
    </div>
  );
}
