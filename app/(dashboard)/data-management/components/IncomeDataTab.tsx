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
  exportIncome,
  getIncomeTemplate,
  validateIncomeData,
  IncomeData,
} from "@/lib/csvUtils";
import ImportModal from "@/components/ImportModal";

export default function IncomeDataTab() {
  const [income, setIncome] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const { businessId, loading: businessLoading } = useBusiness();

  const loadIncome = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user || !businessId) return;

      const snap = await getDocs(
        query(collection(db, "income"), where("businessId", "==", businessId))
      );

      setIncome(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error loading income:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (businessLoading) return;
    loadIncome();
    loadCustomers();
  }, [businessId, businessLoading]);

  const loadCustomers = async () => {
    try {
      const user = auth.currentUser;
      if (!user || !businessId) return;

      const snap = await getDocs(
        query(collection(db, "customers"), where("businessId", "==", businessId))
      );
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) =>
        (a.name || "").localeCompare(b.name || "")
      );
      setCustomers(list);
    } catch (err) {
      console.error("Error loading customers:", err);
    }
  };

  const getCustomersForLookup = async () => {
    if (customers.length > 0) return customers;
    const user = auth.currentUser;
    if (!user || !businessId) return [];

    const snap = await getDocs(
      query(collection(db, "customers"), where("businessId", "==", businessId))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  };

  const filterIncomeForExport = () => {
    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate) : null;

    return income.filter((item) => {
      if (selectedCustomer && item.customerId !== selectedCustomer) return false;

      if (!from && !to) return true;
      if (!item.date) return false;

      const itemDate = new Date(item.date);
      if (Number.isNaN(itemDate.getTime())) return false;

      if (from && itemDate < from) return false;
      if (to && itemDate > to) return false;
      return true;
    });
  };

  const handleExport = () => {
    const filteredIncome = filterIncomeForExport();
    if (filteredIncome.length === 0) {
      alert("No income to export for selected filters");
      return;
    }
    const csv = exportIncome(filteredIncome);
    downloadCSV(csv, `income_${new Date().toISOString().split("T")[0]}.csv`);
  };

  const handleDownloadTemplate = () => {
    const template = getIncomeTemplate();
    downloadCSV(template, "income_template.csv");
  };

  const handleImport = async (newIncome: IncomeData[]) => {
    const user = auth.currentUser;
    if (!user || !businessId) {
      throw new Error("Missing business context");
    }

    const customers = await getCustomersForLookup();
    const customersList = customers.map((c: any) => ({
      id: c.id,
      name: (c.name || "").toString(),
    }));
    const nameToId = new Map(
      customersList.map((c) => [c.name.toLowerCase(), c.id])
    );
    const idToName = new Map(customersList.map((c) => [c.id, c.name]));

    const missingCustomers = new Set<string>();
    const batch = writeBatch(db);

    for (const item of newIncome) {
      let customerId = (item.customerId || "").trim();
      let customerName = (item.customerName || "").trim();

      if (!customerId && customerName) {
        const matchedId = nameToId.get(customerName.toLowerCase());
        if (matchedId) customerId = matchedId;
      }

      if (!customerId) {
        missingCustomers.add(customerName || "Unknown");
        continue;
      }

      if (!customerName) {
        customerName = idToName.get(customerId) || "";
      }

      const incomeRef = doc(collection(db, "income"));
      batch.set(incomeRef, {
        saleId: "",
        customerId,
        customerName,
        billNumber: item.billNumber || "",
        amount: Number(item.amount || 0),
        date: item.date,
        paymentMethod: item.paymentMethod || "CASH",
        bankName: item.bankName || "",
        notes: item.notes || "",
        userId: user.uid,
        businessId,
        createdAt: serverTimestamp(),
      });
    }

    if (missingCustomers.size > 0) {
      throw new Error(
        `Missing customers: ${Array.from(missingCustomers).join(", ")}`
      );
    }

    await batch.commit();
    await loadIncome();
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
          <label className="block text-sm font-semibold mb-1">Customer</label>
          <select
            className="border rounded p-2 w-full"
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
          >
            <option value="">All customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-4 mb-6 flex-wrap">
        <button
          onClick={handleExport}
          disabled={income.length === 0 || loading}
          className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          Export All ({income.length})
        </button>

        <button
          onClick={() => setIsImportOpen(true)}
          className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700"
        >
          Import Income
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
          <strong>Import Format:</strong> CSV with columns: customerId,
          customerName, billNumber, date, amount, paymentMethod, bankName, notes
        </p>
      </div>

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImport={handleImport}
        title="Import Income"
        validateData={validateIncomeData}
      />
    </div>
  );
}
