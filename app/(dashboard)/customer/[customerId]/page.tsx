"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { generatePDF } from "@/app/utils/pdfGenerator";

type Sale = {
  id: string;
  amount: number | string;
  billNumber: string;
  date: string;
  customerName: string;
};

type Income = {
  id: string;
  amount: number | string;
  date: string;
  billNumber: string;
  customerName: string;
};

export default function CustomerLedgerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerName = searchParams.get("name");

  const [sales, setSales] = useState<Sale[]>([]);
  const [income, setIncome] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      router.push("/login");
      return;
    }
    if (!customerName) {
      router.push("/dashboard");
      return;
    }

    const fetchData = async () => {
      setLoading(true);

      const salesQ = query(
        collection(db, "sales"),
        where("userId", "==", user.uid),
        where("customerName", "==", customerName)
      );
      const salesSnap = await getDocs(salesQ);
      const salesData = salesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Sale[];

      const incomeQ = query(
        collection(db, "income"),
        where("userId", "==", user.uid),
        where("customerName", "==", customerName)
      );
      const incomeSnap = await getDocs(incomeQ);
      const incomeData = incomeSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Income[];

      const totalBill = salesData.reduce((s, item) => s + Number(item.amount || 0), 0);
      const totalPaid = incomeData.reduce((s, item) => s + Number(item.amount || 0), 0);

      setSales(salesData);
      setIncome(incomeData);
      setLoading(false);
      // totals stored in derived UI values
    };

    fetchData();
  }, [customerName, router]);

  if (loading) return <p className="p-6">Loading...</p>;

  const totalBill = sales.reduce((s, item) => s + Number(item.amount || 0), 0);
  const totalPaid = income.reduce((s, item) => s + Number(item.amount || 0), 0);
  const outstanding = totalBill - totalPaid;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* PDF / Print Content */}
      <div id="pdf-area" className="pdf-area bg-white shadow rounded">
        <div className="pdf-page p-6">
          <header className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center">
            <div>
              <h1 className="text-2xl font-bold">Customer Ledger</h1>
              <p className="text-sm text-gray-600">{customerName}</p>
            </div>
            <div className="mt-3 sm:mt-0 text-sm text-gray-600">
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
              <div className={`text-lg font-semibold ${outstanding > 0 ? "text-red-600" : "text-green-600"}`}>
                {outstanding.toLocaleString()}
              </div>
            </div>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Sales</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-left">Bill #</th>
                    <th className="p-2 text-right">Amount</th>
                    <th className="p-2 text-left">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.length === 0 ? (
                    <tr><td colSpan={3} className="p-4 text-center text-gray-500">No sales found</td></tr>
                  ) : (
                    sales.map((s) => (
                      <tr key={s.id} className="border-t">
                        <td className="p-2">{s.billNumber}</td>
                        <td className="p-2 text-right">{Number(s.amount).toLocaleString()}</td>
                        <td className="p-2">{s.date}</td>
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
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-left">Amount</th>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Bill</th>
                  </tr>
                </thead>
                <tbody>
                  {income.length === 0 ? (
                    <tr><td colSpan={3} className="p-4 text-center text-gray-500">No payments found</td></tr>
                  ) : (
                    income.map((i) => (
                      <tr key={i.id} className="border-t">
                        <td className="p-2">{Number(i.amount).toLocaleString()}</td>
                        <td className="p-2">{i.date}</td>
                        <td className="p-2">{i.billNumber}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      {/* Actions: place after pdf-area so element exists */}
      <div className="mt-4 flex gap-3">
        <button
          onClick={() => window.print()}
          className="print:hidden px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Print Ledger
        </button>

        <button
          onClick={() => generatePDF("pdf-area", `ledger-${customerName || "customer"}.pdf`)}
          className="print:hidden px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Download PDF
        </button>
      </div>
    </div>
  );
}
