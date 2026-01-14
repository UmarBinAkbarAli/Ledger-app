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
  exportSuppliers,
  validateSupplierData,
  getSupplierTemplate,
  SupplierData,
} from "@/lib/csvUtils";
import ImportModal from "@/components/ImportModal";

export default function SupplierDataTab() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const { businessId, loading: businessLoading } = useBusiness();

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user || !businessId) return;

      const snap = await getDocs(
        query(collection(db, "suppliers"), where("businessId", "==", businessId))
      );

      setSuppliers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error loading suppliers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (businessLoading) return;
    loadSuppliers();
  }, [businessId, businessLoading]);

  const handleExport = () => {
    if (suppliers.length === 0) {
      alert("No suppliers to export");
      return;
    }
    const csv = exportSuppliers(suppliers);
    downloadCSV(csv, `suppliers_${new Date().toISOString().split("T")[0]}.csv`);
  };

  const handleDownloadTemplate = () => {
    const template = getSupplierTemplate();
    downloadCSV(template, "supplier_template.csv");
  };

  const handleImport = async (newSuppliers: SupplierData[]) => {
    const user = auth.currentUser;
    if (!user || !businessId) {
      throw new Error("Missing business context");
    }

    try {
      const batch = writeBatch(db);
      for (const supplier of newSuppliers) {
        const supplierRef = doc(collection(db, "suppliers"));
        batch.set(supplierRef, {
          userId: user.uid,
          businessId,
          name: supplier.name,
          company: supplier.company || "",
          phone: supplier.phone || "",
          address: supplier.address || "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      await loadSuppliers();
    } catch (err) {
      console.error("Error importing:", err);
      throw err;
    }
  };

  return (
    <div>
      <div className="flex gap-4 mb-6 flex-wrap">
        <button
          onClick={handleExport}
          disabled={suppliers.length === 0 || loading}
          className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          Export All ({suppliers.length})
        </button>

        <button
          onClick={() => setIsImportOpen(true)}
          className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700"
        >
          Import Suppliers
        </button>

        <button
          onClick={handleDownloadTemplate}
          className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700"
        >
          Download Template
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <p className="text-sm text-gray-700">
          <strong>Import Format:</strong> CSV with columns: name, company, phone,
          address
        </p>
      </div>

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImport={handleImport}
        title="Import Suppliers"
        validateData={validateSupplierData}
      />
    </div>
  );
}
