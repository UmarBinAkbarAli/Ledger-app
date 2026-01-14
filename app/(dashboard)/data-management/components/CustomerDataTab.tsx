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
  exportCustomers,
  validateCustomerData,
  getCustomerTemplate,
  CustomerData,
} from "@/lib/csvUtils";
import ImportModal from "@/components/ImportModal";

export default function CustomerDataTab() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const { businessId, loading: businessLoading } = useBusiness();

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user || !businessId) return;

      const snap = await getDocs(
        query(collection(db, "customers"), where("businessId", "==", businessId))
      );

      setCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error loading customers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (businessLoading) return;
    loadCustomers();
  }, [businessId, businessLoading]);

  const handleExport = () => {
    if (customers.length === 0) {
      alert("No customers to export");
      return;
    }
    const csv = exportCustomers(customers);
    downloadCSV(csv, `customers_${new Date().toISOString().split("T")[0]}.csv`);
  };

  const handleDownloadTemplate = () => {
    const template = getCustomerTemplate();
    downloadCSV(template, "customer_template.csv");
  };

  const handleImport = async (newCustomers: CustomerData[]) => {
    const user = auth.currentUser;
    if (!user || !businessId) {
      throw new Error("Missing business context");
    }

    try {
      const batch = writeBatch(db);
      for (const customer of newCustomers) {
        const customerRef = doc(collection(db, "customers"));
        batch.set(customerRef, {
          userId: user.uid,
          businessId,
          name: customer.name,
          company: customer.company || "",
          phone: customer.phone || "",
          address: customer.address || "",
          previousBalance: customer.previousBalance || 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      await loadCustomers();
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
          disabled={customers.length === 0 || loading}
          className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          Export All ({customers.length})
        </button>

        <button
          onClick={() => setIsImportOpen(true)}
          className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700"
        >
          Import Customers
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
          address, previousBalance
        </p>
      </div>

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImport={handleImport}
        title="Import Customers"
        validateData={validateCustomerData}
      />
    </div>
  );
}
