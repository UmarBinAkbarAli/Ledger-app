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
  exportPurchases,
  getPurchaseTemplate,
  validatePurchaseData,
  PurchaseData,
} from "@/lib/csvUtils";
import ImportModal from "@/components/ImportModal";

export default function PurchaseDataTab() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const { businessId, loading: businessLoading } = useBusiness();

  const loadPurchases = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user || !businessId) return;

      const snap = await getDocs(
        query(collection(db, "purchases"), where("businessId", "==", businessId))
      );

      setPurchases(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error loading purchases:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (businessLoading) return;
    loadPurchases();
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

  const filterPurchasesForExport = () => {
    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate) : null;

    return purchases.filter((purchase) => {
      if (selectedSupplier && purchase.supplierId !== selectedSupplier) {
        return false;
      }

      if (!from && !to) return true;
      if (!purchase.date) return false;

      const purchaseDate = new Date(purchase.date);
      if (Number.isNaN(purchaseDate.getTime())) return false;

      if (from && purchaseDate < from) return false;
      if (to && purchaseDate > to) return false;
      return true;
    });
  };

  const handleExport = () => {
    const filteredPurchases = filterPurchasesForExport();
    if (filteredPurchases.length === 0) {
      alert("No purchases to export for selected filters");
      return;
    }
    const csv = exportPurchases(filteredPurchases);
    downloadCSV(
      csv,
      `purchases_${new Date().toISOString().split("T")[0]}.csv`
    );
  };

  const handleDownloadTemplate = () => {
    const template = getPurchaseTemplate();
    downloadCSV(template, "purchase_template.csv");
  };

  const handleImport = async (newPurchases: PurchaseData[]) => {
    const user = auth.currentUser;
    if (!user || !businessId) {
      throw new Error("Missing business context");
    }

    const suppliersSnap = await getDocs(
      query(collection(db, "suppliers"), where("businessId", "==", businessId))
    );
    const suppliers = suppliersSnap.docs.map((d) => ({
      id: d.id,
      name: (d.data().name || "").toString(),
    }));
    const nameToId = new Map(
      suppliers.map((s) => [s.name.toLowerCase(), s.id])
    );
    const idToName = new Map(suppliers.map((s) => [s.id, s.name]));

    const missingSuppliers = new Set<string>();
    const batch = writeBatch(db);

    for (const purchase of newPurchases) {
      let supplierId = (purchase.supplierId || "").trim();
      let supplierName = (purchase.supplierName || "").trim();

      if (!supplierId && supplierName) {
        const matchedId = nameToId.get(supplierName.toLowerCase());
        if (matchedId) supplierId = matchedId;
      }

      if (!supplierId) {
        missingSuppliers.add(supplierName || "Unknown");
        continue;
      }

      if (!supplierName) {
        supplierName = idToName.get(supplierId) || "";
      }

      const purchaseRef = doc(collection(db, "purchases"));
      batch.set(purchaseRef, {
        userId: user.uid,
        businessId,
        supplierId,
        supplierName,
        billNumber: purchase.billNumber || "",
        date: purchase.date,
        terms: purchase.terms || "CASH",
        total: Number(purchase.total || 0),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    if (missingSuppliers.size > 0) {
      throw new Error(
        `Missing suppliers: ${Array.from(missingSuppliers).join(", ")}`
      );
    }

    await batch.commit();
    await loadPurchases();
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
          disabled={purchases.length === 0 || loading}
          className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          Export All ({purchases.length})
        </button>

        <button
          onClick={() => setIsImportOpen(true)}
          className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700"
        >
          Import Purchases
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
          supplierName, billNumber, date, terms, total
        </p>
      </div>

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImport={handleImport}
        title="Import Purchases"
        validateData={validatePurchaseData}
      />
    </div>
  );
}
