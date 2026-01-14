"use client";

import React, { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { downloadCSV, downloadZip, exportLedger } from "@/lib/csvUtils";
import { useBusiness } from "@/hooks/useBusiness";

interface LedgerRow {
  id: string;
  name: string;
}

export default function LedgerExportTab() {
  const [customers, setCustomers] = useState<LedgerRow[]>([]);
  const [suppliers, setSuppliers] = useState<LedgerRow[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [exportingAllCustomers, setExportingAllCustomers] = useState(false);
  const [exportingAllSuppliers, setExportingAllSuppliers] = useState(false);
  const { businessId, loading: businessLoading } = useBusiness();

  useEffect(() => {
    if (businessLoading) return;
    loadData();
  }, [businessId, businessLoading]);

  const loadData = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user || !businessId) return;

      const [custSnap, suppSnap] = await Promise.all([
        getDocs(
          query(collection(db, "customers"), where("businessId", "==", businessId))
        ),
        getDocs(
          query(collection(db, "suppliers"), where("businessId", "==", businessId))
        ),
      ]);

      setCustomers(
        custSnap.docs.map((d) => ({
          id: d.id,
          name: d.data().name,
        }))
      );

      setSuppliers(
        suppSnap.docs.map((d) => ({
          id: d.id,
          name: d.data().name,
        }))
      );
    } catch (err) {
      console.error("Error loading:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCustomerLedger = async () => {
    if (!selectedCustomer) {
      alert("Please select a customer");
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user || !businessId) return;

      const [salesSnap, incomeSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, "sales"),
            where("businessId", "==", businessId),
            where("customerId", "==", selectedCustomer)
          )
        ),
        getDocs(
          query(
            collection(db, "income"),
            where("businessId", "==", businessId),
            where("customerId", "==", selectedCustomer)
          )
        ),
      ]);

      const ledgerRows: any[] = [];

      salesSnap.docs.forEach((doc) => {
        const data = doc.data();
        ledgerRows.push({
          date: data.date || "",
          type: "Sale",
          particular: data.billNumber || "",
          folio: "",
          debit: String(data.total || 0),
          credit: "0",
          balance: "",
        });
      });

      incomeSnap.docs.forEach((doc) => {
        const data = doc.data();
        ledgerRows.push({
          date: data.date || "",
          type: "Payment",
          particular: data.billNumber || "Payment",
          folio: "",
          debit: "0",
          credit: String(data.amount || 0),
          balance: "",
        });
      });

      ledgerRows.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const customerName =
        customers.find((c) => c.id === selectedCustomer)?.name || "Customer";
      const csv = exportLedger(ledgerRows, customerName);
      downloadCSV(
        csv,
        `ledger_${customerName}_${new Date().toISOString().split("T")[0]}.csv`
      );
    } catch (err) {
      console.error("Error exporting ledger:", err);
      alert("Error exporting ledger");
    }
  };

  const downloadLedgerZip = async (type: "customers" | "suppliers") => {
    const user = auth.currentUser;
    if (!user) {
      alert("Not authenticated");
      return;
    }

    const idToken = await user.getIdToken();
    const response = await fetch(`/api/exports/ledger?type=${type}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (!response.ok) {
      let message = "Failed to export ledgers";
      try {
        const data = await response.json();
        message = data.message || message;
      } catch (err) {
        // Ignore JSON parse errors
      }
      throw new Error(message);
    }

    const buffer = await response.arrayBuffer();
    const filename = `${type}_ledgers_${new Date().toISOString().split("T")[0]}.zip`;
    downloadZip(new Uint8Array(buffer), filename);
  };

  const handleExportAllCustomerLedgers = async () => {
    setExportingAllCustomers(true);
    try {
      await downloadLedgerZip("customers");
    } catch (err) {
      console.error("Error exporting customer ledgers:", err);
      alert("Error exporting customer ledgers");
    } finally {
      setExportingAllCustomers(false);
    }
  };

  const handleExportSupplierLedger = async () => {
    if (!selectedSupplier) {
      alert("Please select a supplier");
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user || !businessId) return;

      const [purSnap, expSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, "purchases"),
            where("businessId", "==", businessId),
            where("supplierId", "==", selectedSupplier)
          )
        ),
        getDocs(
          query(
            collection(db, "expenses"),
            where("businessId", "==", businessId),
            where("supplierId", "==", selectedSupplier)
          )
        ),
      ]);

      const ledgerRows: any[] = [];

      purSnap.docs.forEach((doc) => {
        const data = doc.data();
        ledgerRows.push({
          date: data.date || "",
          type: "Purchase",
          particular: data.billNumber || "",
          folio: "",
          debit: "0",
          credit: String(data.total || 0),
          balance: "",
        });
      });

      expSnap.docs.forEach((doc) => {
        const data = doc.data();
        ledgerRows.push({
          date: data.date || "",
          type: "Payment",
          particular: data.billNumber || "Payment",
          folio: "",
          debit: String(data.amount || 0),
          credit: "0",
          balance: "",
        });
      });

      ledgerRows.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const supplierName =
        suppliers.find((s) => s.id === selectedSupplier)?.name || "Supplier";
      const csv = exportLedger(ledgerRows, supplierName);
      downloadCSV(
        csv,
        `ledger_${supplierName}_${new Date().toISOString().split("T")[0]}.csv`
      );
    } catch (err) {
      console.error("Error exporting ledger:", err);
      alert("Error exporting ledger");
    }
  };

  const handleExportAllSupplierLedgers = async () => {
    setExportingAllSuppliers(true);
    try {
      await downloadLedgerZip("suppliers");
    } catch (err) {
      console.error("Error exporting supplier ledgers:", err);
      alert("Error exporting supplier ledgers");
    } finally {
      setExportingAllSuppliers(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-bold mb-4">Customer Ledger Export</h3>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-semibold mb-2">
              Select Customer
            </label>
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="w-full border rounded p-2"
              disabled={loading}
            >
              <option value="">-- Choose a customer --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleExportCustomerLedger}
            disabled={!selectedCustomer || loading}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
          >
            Export Ledger
          </button>
        </div>
      </div>

      <hr />

      <div>
        <h3 className="text-xl font-bold mb-4">Supplier Ledger Export</h3>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-semibold mb-2">
              Select Supplier
            </label>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full border rounded p-2"
              disabled={loading}
            >
              <option value="">-- Choose a supplier --</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleExportSupplierLedger}
            disabled={!selectedSupplier || loading}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
          >
            Export Ledger
          </button>
        </div>
      </div>

      <div className="border rounded p-4 bg-gray-50">
        <h3 className="text-lg font-semibold mb-3">Bulk Ledger Export</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExportAllCustomerLedgers}
            disabled={exportingAllCustomers || loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {exportingAllCustomers
              ? "Exporting..."
              : "Export All Customer Ledgers (ZIP)"}
          </button>
          <button
            onClick={handleExportAllSupplierLedgers}
            disabled={exportingAllSuppliers || loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {exportingAllSuppliers
              ? "Exporting..."
              : "Export All Supplier Ledgers (ZIP)"}
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-3">
          Each ledger is exported as its own CSV inside the ZIP.
        </p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mt-4">
        <p className="text-sm text-gray-700">
          <strong>Info:</strong> Downloads complete transaction history (sales,
          payments, purchases, expenses) for selected customer or supplier as CSV
        </p>
      </div>
    </div>
  );
}
