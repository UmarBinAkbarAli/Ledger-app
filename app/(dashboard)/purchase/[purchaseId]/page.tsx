"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useParams } from "next/navigation";
import { generatePDF } from "@/app/utils/pdfGenerator";

export default function PurchaseDetailsPage() {
  const { purchaseId } = useParams();
  const [purchase, setPurchase] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!purchaseId) return;

    const fetchPurchase = async () => {
      try {
        const ref = doc(db, "purchase", purchaseId as string);
        const snap = await getDoc(ref);
        if (snap.exists()) setPurchase({ id: snap.id, ...snap.data() });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPurchase();
  }, [purchaseId]);

  if (loading) return <p className="p-6">Loading invoice...</p>;
  if (!purchase) return <p className="p-6">Purchase not found.</p>;

  const remaining = Number(purchase.amount) - Number(purchase.paidAmount || 0);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div id="pdf-area" className="pdf-area bg-white shadow rounded">
        <div className="pdf-page p-6">
          <header className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">Purchase Invoice</h1>
              <p className="text-sm text-gray-600">{purchase.supplierName}</p>
            </div>
            <div className="text-sm text-gray-600 text-right">
              <div>Bill No: {purchase.billNumber}</div>
              <div>Date: {purchase.date}</div>
            </div>
          </header>

          <section className="mb-6">
            <div className="bg-gray-50 p-4 rounded grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-500">Total Bill</div>
                <div className="font-semibold">{Number(purchase.amount).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Total Paid</div>
                <div className="font-semibold">{Number(purchase.paidAmount || 0).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Remaining</div>
                <div className={`font-semibold ${remaining > 0 ? "text-red-600" : "text-green-600"}`}>{remaining.toLocaleString()}</div>
              </div>
            </div>
          </section>

          {purchase.details && (
            <section className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Details</h2>
              <div className="text-sm text-gray-700">{purchase.details}</div>
            </section>
          )}

          {/* Example items table if present */}
          {Array.isArray(purchase.items) && purchase.items.length > 0 && (
            <section className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Items</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-2 text-left">Item</th>
                      <th className="p-2 text-right">Qty</th>
                      <th className="p-2 text-right">Rate</th>
                      <th className="p-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchase.items.map((it: any, idx: number) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2">{it.name}</td>
                        <td className="p-2 text-right">{it.qty}</td>
                        <td className="p-2 text-right">{Number(it.rate || 0).toLocaleString()}</td>
                        <td className="p-2 text-right">{(Number(it.qty || 0) * Number(it.rate || 0)).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <footer className="mt-6 text-sm text-gray-500 text-center">
            <div>Thank you for your business</div>
          </footer>
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        <button
          onClick={() => window.print()}
          className="print:hidden px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Print Invoice
        </button>
        <button
          onClick={() => generatePDF("pdf-area", `purchase-${purchase.billNumber || purchaseId}.pdf`)}
          className="print:hidden px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Download PDF
        </button>
      </div>
    </div>
  );
}
