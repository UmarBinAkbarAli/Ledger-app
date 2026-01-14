"use client";

import React, { useEffect, useState } from "react";
import CustomerDataTab from "./components/CustomerDataTab";
import SupplierDataTab from "./components/SupplierDataTab";
import SalesDataTab from "./components/SalesDataTab";
import PurchaseDataTab from "./components/PurchaseDataTab";
import IncomeDataTab from "./components/IncomeDataTab";
import ExpenseDataTab from "./components/ExpenseDataTab";
import LedgerExportTab from "./components/LedgerExportTab";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { zipSync, strToU8 } from "fflate";
import { useBusiness } from "@/hooks/useBusiness";
import {
  downloadZip,
  exportCustomers,
  exportSuppliers,
  exportSales,
  exportPurchases,
  exportIncome,
  exportExpenses,
} from "@/lib/csvUtils";

type Tab =
  | "customers"
  | "suppliers"
  | "sales"
  | "purchases"
  | "income"
  | "expenses"
  | "ledgers";

export default function DataManagementPage() {
  const [activeTab, setActiveTab] = useState<Tab>("customers");
  const [exportingAll, setExportingAll] = useState(false);
  const { businessId } = useBusiness();

  useEffect(() => {
    const logClaims = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const tokenResult = await user.getIdTokenResult(true);
        console.log("Data Management debug:", {
          uid: user.uid,
          email: user.email,
          businessId,
          claims: tokenResult.claims,
        });
      } catch (err) {
        console.warn("Data Management debug failed to load token claims:", err);
      }
    };
    logClaims();
  }, [businessId]);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "customers", label: "Customers" },
    { id: "suppliers", label: "Suppliers" },
    { id: "sales", label: "Sales" },
    { id: "purchases", label: "Purchases" },
    { id: "income", label: "Income" },
    { id: "expenses", label: "Expenses" },
    { id: "ledgers", label: "Ledger Export" },
  ];

  const handleExportAll = async () => {
    setExportingAll(true);
    try {
      const user = auth.currentUser;
      if (!user || !businessId) {
        alert("Not authenticated");
        return;
      }

      const [
        customersSnap,
        suppliersSnap,
        salesSnap,
        purchasesSnap,
        incomeSnap,
        expensesSnap,
      ] = await Promise.all([
        getDocs(query(collection(db, "customers"), where("businessId", "==", businessId))),
        getDocs(query(collection(db, "suppliers"), where("businessId", "==", businessId))),
        getDocs(query(collection(db, "sales"), where("businessId", "==", businessId))),
        getDocs(query(collection(db, "purchases"), where("businessId", "==", businessId))),
        getDocs(query(collection(db, "income"), where("businessId", "==", businessId))),
        getDocs(query(collection(db, "expenses"), where("businessId", "==", businessId))),
      ]);

      const customers = customersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const suppliers = suppliersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const sales = salesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const purchases = purchasesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const income = incomeSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const expenses = expensesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const files: Record<string, string> = {
        "customers.csv": exportCustomers(customers),
        "suppliers.csv": exportSuppliers(suppliers),
        "sales.csv": exportSales(sales),
        "purchases.csv": exportPurchases(purchases),
        "income.csv": exportIncome(income),
        "expenses.csv": exportExpenses(expenses),
      };

      const zipData = zipSync(
        Object.fromEntries(
          Object.entries(files).map(([name, content]) => [name, strToU8(content)])
        )
      );

      downloadZip(
        zipData,
        `data_export_${new Date().toISOString().split("T")[0]}.zip`
      );
    } catch (err) {
      console.error("Error exporting all data:", err);
      alert("Error exporting all data");
    } finally {
      setExportingAll(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold mb-2">Data Management</h1>
          <p className="text-gray-600">
            Import/Export data, manage templates, and export ledgers in one place
          </p>
        </div>
        <button
          onClick={handleExportAll}
          disabled={exportingAll}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {exportingAll ? "Exporting..." : "Export All (ZIP)"}
        </button>
      </div>

      <div className="flex gap-2 mb-6 border-b overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 whitespace-nowrap border-b-2 transition font-semibold ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        {activeTab === "customers" && <CustomerDataTab />}
        {activeTab === "suppliers" && <SupplierDataTab />}
        {activeTab === "sales" && <SalesDataTab />}
        {activeTab === "purchases" && <PurchaseDataTab />}
        {activeTab === "income" && <IncomeDataTab />}
        {activeTab === "expenses" && <ExpenseDataTab />}
        {activeTab === "ledgers" && <LedgerExportTab />}
      </div>
    </div>
  );
}
