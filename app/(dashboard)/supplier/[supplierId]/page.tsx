"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import { generatePDF } from "@/app/utils/pdfGenerator";

type Purchase = {
  id: string;
  amount: number | string;
  billNumber: string;
  date: string;
  supplierName: string;
};

type Expense = {
  id: string;
  amount: number | string;
  date: string;
  billNumber: string;
  supplierName: string;
};

export default function SupplierLedgerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supplierName = searchParams.get("name");

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const user = auth.currentUser;
      if (!user) {
        router.push("/login");
        return;
      }
      if (!supplierName) {
        router.push("/dashboard");
        return;
      }

      setLoading(true);
      const q1 = query(
        collection(db, "purchase"),
        where("userId", "==", user.uid),
        where("supplierName", "==", supplierName)
      );
      const snap1 = await getDocs(q1);
      const purchaseData = snap1.docs.map((d) => ({ id: d.id, ...d.data() })) as Purchase[];

      const q2 = query(
        collection(db, "expenses"),
        where("userId", "==", user.uid),
        where("supplierName", "==", supplierName)
      );
      const snap2 = await getDocs(q2);
      const expenseData = snap2.docs.map((d) => ({ id: d.id, ...d.data() })) as Expense[];

      setPurchases(purchaseData);
      setExpenses(expenseData);
      setLoading(false);
    };

    loadData();
  }, [supplierName, router]);

  if (loading) return <p className="p-6">Loading Supplier Ledger...</p>;

  const totalBill = purchases.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalPaid = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const outstanding = totalBill - totalPaid;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div id="pdf-area" className="pdf-area bg-white shadow rounded">
        <div className="pdf-page p-6">
          <header className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center">
            <div>
              <h1 className="text-2xl font-bold">{supplierName} — Supplier Ledger</h1>
            </div>
            <div className="text-sm text-gray-600 mt-2 sm:mt-0">
              <div>Generated: {new Date().toLocaleDateString()}</div>
            </div>
          </header>

          <section className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded">
              <div className="text-sm text-gray-500">Total Bill</div>
              <div className="text-lg font-semibold">{totalBill.toLocaleString()}</div>
            </div>
            <div className="p-4 bg-gray-50 rounded">
              <div className="text-sm text-gray-500">Total Paid</div>
              <div className="text-lg font-semibold">{totalPaid.toLocaleString()}</div>
            </div>
            <div className="p-4 bg-gray-50 rounded">
              <div className="text-sm text-gray-500">Outstanding</div>
              <div className="text-lg font-semibold">{outstanding.toLocaleString()}</div>
            </div>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Purchases</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-left">Bill #</th>
                    <th className="p-2 text-right">Amount</th>
                    <th className="p-2 text-left">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.length === 0 ? (
                    <tr><td colSpan={3} className="p-4 text-center text-gray-500">No purchases</td></tr>
                  ) : (
                    purchases.map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="p-2">{p.billNumber}</td>
                        <td className="p-2 text-right">{Number(p.amount).toLocaleString()}</td>
                        <td className="p-2">{p.date}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Payments</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-left">Amount</th>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Linked Bill</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr><td colSpan={3} className="p-4 text-center text-gray-500">No payments</td></tr>
                  ) : (
                    expenses.map((e) => (
                      <tr key={e.id} className="border-t">
                        <td className="p-2">{Number(e.amount).toLocaleString()}</td>
                        <td className="p-2">{e.date}</td>
                        <td className="p-2">{e.billNumber}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        <button
          onClick={() => window.print()}
          className="print:hidden px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          Print Ledger
        </button>
        <button
          onClick={() => generatePDF("pdf-area", `supplier-${supplierName || "ledger"}.pdf`)}
          className="print:hidden px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Download PDF
        </button>
      </div>
    </div>
  );
}
