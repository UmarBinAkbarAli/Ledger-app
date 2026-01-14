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
  exportSales,
  getSalesTemplate,
  validateSalesData,
  SalesData,
} from "@/lib/csvUtils";
import ImportModal from "@/components/ImportModal";

export default function SalesDataTab() {
  const [sales, setSales] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const { businessId, loading: businessLoading } = useBusiness();

  const loadSales = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user || !businessId) return;

      const snap = await getDocs(
        query(collection(db, "sales"), where("businessId", "==", businessId))
      );

      setSales(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error loading sales:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (businessLoading) return;
    loadSales();
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

  const filterSalesForExport = () => {
    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate) : null;

    return sales.filter((sale) => {
      if (selectedCustomer && sale.customerId !== selectedCustomer) return false;

      if (!from && !to) return true;
      if (!sale.date) return false;

      const saleDate = new Date(sale.date);
      if (Number.isNaN(saleDate.getTime())) return false;

      if (from && saleDate < from) return false;
      if (to && saleDate > to) return false;
      return true;
    });
  };

  const handleExport = () => {
    const filteredSales = filterSalesForExport();
    if (filteredSales.length === 0) {
      alert("No sales to export for selected filters");
      return;
    }
    const csv = exportSales(filteredSales);
    downloadCSV(csv, `sales_${new Date().toISOString().split("T")[0]}.csv`);
  };

  const handleDownloadTemplate = () => {
    const template = getSalesTemplate();
    downloadCSV(template, "sales_template.csv");
  };

  const handleImport = async (newSales: SalesData[]) => {
    const user = auth.currentUser;
    if (!user || !businessId) {
      throw new Error("Missing business context");
    }

    const customersSnap = await getDocs(
      query(collection(db, "customers"), where("businessId", "==", businessId))
    );
    const customers = customersSnap.docs.map((d) => ({
      id: d.id,
      name: (d.data().name || "").toString(),
    }));
    const nameToId = new Map(
      customers.map((c) => [c.name.toLowerCase(), c.id])
    );
    const idToName = new Map(customers.map((c) => [c.id, c.name]));

    const missingCustomers = new Set<string>();
    const batch = writeBatch(db);

    for (const sale of newSales) {
      let customerId = (sale.customerId || "").trim();
      let customerName = (sale.customerName || "").trim();

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

      const saleRef = doc(collection(db, "sales"));
      batch.set(saleRef, {
        userId: user.uid,
        businessId,
        customerId,
        customerName,
        billNumber: sale.billNumber || "",
        date: sale.date,
        terms: sale.terms || "CASH",
        total: Number(sale.total || 0),
        paidAmount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    if (missingCustomers.size > 0) {
      throw new Error(
        `Missing customers: ${Array.from(missingCustomers).join(", ")}`
      );
    }

    await batch.commit();
    await loadSales();
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
          disabled={sales.length === 0 || loading}
          className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          Export All ({sales.length})
        </button>

        <button
          onClick={() => setIsImportOpen(true)}
          className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700"
        >
          Import Sales
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
          customerName, billNumber, date, terms, total
        </p>
      </div>

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImport={handleImport}
        title="Import Sales"
        validateData={validateSalesData}
      />
    </div>
  );
}
