"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";


interface SupplierType {
  id: string;
  name?: string;
  company?: string;
  phone?: string;
  address?: string;
  previousBalance?: number;
  currentBalance?: number;
  userId?: string;
  createdAt?: any;
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        console.log('🔄 Loading suppliers data...');
        const startTime = performance.now();

        // ✅ OPTIMIZED: Load ALL data in parallel with just 3 queries instead of N*2 queries
        const [suppliersSnap, allPurchasesSnap, allExpensesSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, "suppliers"),
              where("userId", "==", user.uid)
            )
          ),
          getDocs(
            query(
              collection(db, "purchases"),
              where("userId", "==", user.uid)
            )
          ),
          getDocs(
            query(
              collection(db, "expenses"),
              where("userId", "==", user.uid)
            )
          )
        ]);

        console.log(`✅ Data loaded in ${(performance.now() - startTime).toFixed(0)}ms`);
        console.log(`📊 Suppliers: ${suppliersSnap.size}, Purchases: ${allPurchasesSnap.size}, Expenses: ${allExpensesSnap.size}`);

        // ✅ Group purchases by supplierId in memory (O(n) operation)
        const purchasesBySupplier: Record<string, number> = {};
        allPurchasesSnap.forEach((doc) => {
          const data = doc.data();
          const supplierId = data.supplierId;
          const amount = Number(data.total || data.subtotal || 0);

          if (supplierId) {
            purchasesBySupplier[supplierId] = (purchasesBySupplier[supplierId] || 0) + amount;
          }
        });

        // ✅ Group expenses (payments) by supplierId in memory (O(n) operation)
        const paymentsBySupplier: Record<string, number> = {};
        allExpensesSnap.forEach((doc) => {
          const data = doc.data();
          const supplierId = data.supplierId;
          const amount = Number(data.amount || 0);

          if (supplierId) {
            paymentsBySupplier[supplierId] = (paymentsBySupplier[supplierId] || 0) + amount;
          }
        });

        // ✅ Build supplier list with calculated balances
        const list: SupplierType[] = suppliersSnap.docs.map((d) => {
          const supplier = d.data() as SupplierType;
          const supplierId = d.id;

          const totalPurchases = purchasesBySupplier[supplierId] || 0;
          const totalPayments = paymentsBySupplier[supplierId] || 0;
          const opening = Number(supplier.previousBalance || 0);
          const currentBalance = opening + totalPurchases - totalPayments;

          return {
            ...supplier,
            id: supplierId,
            currentBalance,
          };
        });

        // Sort alphabetically like customers page
        list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        setSuppliers(list);
      } catch (err) {
        console.error("Error loading suppliers:", err);
      } finally {
        setLoading(false);
      }
    };

    loadSuppliers();
  }, []);

  if (loading) return <p className="p-6">Loading suppliers...</p>;

  return (
    <div className="p-6">

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Suppliers</h1>

        <Link
          href="/supplier/new"
          className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
        >
          + Add Supplier
        </Link>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search supplier..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border p-2 rounded w-full md:w-96"
        />
      </div>

      {/* Total */}
      <p className="mb-4 text-gray-600">
        Total Suppliers: <strong>{suppliers.length}</strong>
      </p>

      {/* Suppliers Table */}
      <div className="bg-white rounded-lg shadow overflow-auto">
        <table className="min-w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Supplier</th>
              <th className="p-3 text-left">Company</th>
              <th className="p-3 text-left">Phone</th>
              <th className="p-3 text-right">Current Balance</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {suppliers
              .filter((s) =>
                (s.name || "").toLowerCase().includes(search.toLowerCase())
              )
              .map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="p-3">{s.name}</td>
                  <td className="p-3">{s.company || "-"}</td>
                  <td className="p-3">{s.phone || "-"}</td>
                  <td className="p-3 text-right font-semibold"> {Number(s.currentBalance || 0).toLocaleString()} </td>
                  <td className="p-3 flex gap-2">
                    <Link
                      href={`/supplier/${s.id}`}
                      className="bg-gray-200 px-3 py-1 rounded hover:bg-gray-300 text-sm"
                    >
                      Ledger
                    </Link>

                    <Link
                      href={`/supplier/edit/${s.id}`}
                      className="bg-blue-200 px-3 py-1 rounded hover:bg-blue-300 text-sm"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
