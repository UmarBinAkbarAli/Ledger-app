"use client";

interface CustomerType {
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

import { useEffect, useState } from "react";
import Link from "next/link";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        // ✅ OPTIMIZED: Load ALL data in parallel with just 3 queries instead of N*2 queries
        const [customersSnap, allSalesSnap, allPaymentsSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, "customers"),
              where("userId", "==", user.uid)
            )
          ),
          getDocs(
            query(
              collection(db, "sales"),
              where("userId", "==", user.uid)
            )
          ),
          getDocs(
            query(
              collection(db, "income"),
              where("userId", "==", user.uid)
            )
          )
        ]);

        // ✅ Group sales by customerId in memory (O(n) operation)
        const salesByCustomer: Record<string, number> = {};
        allSalesSnap.forEach((doc) => {
          const data = doc.data();
          const customerId = data.customerId;
          const amount = Number(data.total || data.subtotal || 0);

          if (customerId) {
            salesByCustomer[customerId] = (salesByCustomer[customerId] || 0) + amount;
          }
        });

        // ✅ Group payments by customerId in memory (O(n) operation)
        const paymentsByCustomer: Record<string, number> = {};
        allPaymentsSnap.forEach((doc) => {
          const data = doc.data();
          const customerId = data.customerId;
          const amount = Number(data.amount || 0);

          if (customerId) {
            paymentsByCustomer[customerId] = (paymentsByCustomer[customerId] || 0) + amount;
          }
        });

        // ✅ Build customer list with calculated balances
        const list: CustomerType[] = customersSnap.docs.map((d) => {
          const customer = d.data() as CustomerType;
          const customerId = d.id;

          const totalSales = salesByCustomer[customerId] || 0;
          const totalPayments = paymentsByCustomer[customerId] || 0;
          const opening = Number(customer.previousBalance || 0);
          const currentBalance = opening + totalSales - totalPayments;

          return {
            ...customer,
            id: customerId,
            currentBalance,
          };
        });

        // Sort alphabetically for clean UI
        list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        setCustomers(list);
      } catch (err) {
        console.error("Error loading customers:", err);
      } finally {
        setLoading(false);
      }
    };

    loadCustomers();
  }, []);

  if (loading) return <p className="p-6">Loading customers...</p>;

  return (
    <div className="p-6">

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Customers</h1>

        <Link
          href="/customers/new"
          className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
        >
          + Add Customer
        </Link>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border p-2 rounded w-full md:w-96"
        />
      </div>

      {/* Total Customers */}
      <p className="mb-4 text-gray-600">
        Total Customers: <strong>{customers.length}</strong>
      </p>

      {/* Customers Table */}
      <div className="bg-white rounded-lg shadow overflow-auto">
        <table className="min-w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Customer</th>
              <th className="p-3 text-left">Company</th>
              <th className="p-3 text-left">Phone</th>
              <th className="p-3 text-right">Current Balance</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {customers
              .filter((c) =>
                (c.name || "").toLowerCase().includes(search.toLowerCase())
              )
              .map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-3">{c.name}</td>
                  <td className="p-3">{c.company || "-"}</td>
                  <td className="p-3">{c.phone || "-"}</td>
                  <td className="p-3 text-right font-semibold"> {Number(c.currentBalance || 0).toLocaleString()} </td>

                  <td className="p-3 flex gap-2">
                    <Link
                      href={`/customers/${c.id}`}
                      className="bg-gray-200 px-3 py-1 rounded hover:bg-gray-300 text-sm"
                    >
                      Ledger
                    </Link>

                    <Link
                      href={`/customers/edit/${c.id}`}
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
