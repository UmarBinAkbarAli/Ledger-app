"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useParams } from "next/navigation";
import { generatePDF } from "@/app/utils/pdfGenerator";
import { useRouter } from "next/navigation";


export default function PurchaseDetailsPage() {
  const { purchaseId } = useParams();
  const [purchase, setPurchase] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();


  useEffect(() => {
    if (!purchaseId) return;

    const fetchPurchase = async () => {
      try {
        const ref = doc(db, "purchases", purchaseId as string);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setPurchase({ id: snap.id, ...snap.data() });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPurchase();
  }, [purchaseId]);

  if (loading) return <p className="p-6">Loading purchase...</p>;
  if (!purchase) return <p className="p-6">Purchase not found.</p>;

  const remaining =
    Number(purchase.total || purchase.subtotal || 0) -
    Number(purchase.paidAmount || 0);

  const items: any[] = Array.isArray(purchase.items) ? purchase.items : [];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div id="pdf-area" className="pdf-area bg-white shadow rounded">
        <div className="pdf-page p-6">

          {/* HEADER */}
          <header className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-blue-900">Purchase Invoice</h1>
              <p className="text-sm text-gray-600">{purchase.supplierName}</p>
              {purchase.supplierCompany && (
                <p className="text-sm text-gray-600">{purchase.supplierCompany}</p>
              )}
              {purchase.supplierPhone && (
                <p className="text-sm text-gray-600">Phone: {purchase.supplierPhone}</p>
              )}
              {purchase.supplierAddress && (
                <p className="text-sm text-gray-600">{purchase.supplierAddress}</p>
              )}
            </div>

            <div className="text-right text-sm text-gray-700">
              <div className="font-semibold">Bill No: {purchase.billNumber}</div>
              <div>Date: {purchase.date}</div>
              {purchase.terms && <div>Terms: {purchase.terms}</div>}
              {purchase.poNumber && <div>PO No: {purchase.poNumber}</div>}
            </div>
          </header>

          {/* TOTAL SUMMARY */}
          <section className="mb-6">
            <div className="bg-gray-50 p-4 rounded grid grid-cols-1 sm:grid-cols-3 gap-4">

              <div>
                <div className="text-sm text-gray-500">Total Bill</div>
                <div className="font-semibold">
                  {Number(purchase.total || purchase.subtotal || 0).toLocaleString()}
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Total Paid</div>
                <div className="font-semibold">
                  {Number(purchase.paidAmount || 0).toLocaleString()}
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Remaining</div>
                <div
                  className={`font-semibold ${
                    remaining > 0 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {remaining.toLocaleString()}
                </div>
              </div>

            </div>
          </section>

          {/* DETAILS FIELD (if exists) */}
          {purchase.details && (
            <section className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Details</h2>
              <div className="text-sm text-gray-700">{purchase.details}</div>
            </section>
          )}

          {/* ITEMS TABLE */}
          {items.length > 0 && (
            <section className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Items</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="p-2 text-left">Description</th>
                      <th className="p-2 text-right">Qty</th>
                      <th className="p-2 text-right">Unit Price</th>
                      <th className="p-2 text-right">Amount</th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map((it: any, idx: number) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2">{it.description}</td>
                        <td className="p-2 text-right">{it.qty}</td>
                        <td className="p-2 text-right">
                          {Number(it.unitPrice).toLocaleString()}
                        </td>
                        <td className="p-2 text-right font-semibold">
                          {Number(it.amount).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>

                </table>
              </div>
            </section>
          )}

          {/* FOOTER */}
          <footer className="mt-6 text-center text-sm text-gray-500">
            <div>Thank you</div>
          </footer>

        </div>
      </div>

      {/* ACTION BUTTONS */}
      <div className="mt-4 flex gap-3">
         <button
            onClick={() => router.push(`/purchase/new?id=${purchase.id}`)}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
            Edit Invoice
          </button>
        <button
          onClick={() => window.print()}
          className="print:hidden px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Print Invoice
        </button>

        <button
          onClick={() =>
            generatePDF(
              "pdf-area",
              `purchase-${purchase.billNumber || purchaseId}.pdf`
            )
          }
          className="print:hidden px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Download PDF
        </button>
      </div>
    </div>
  );
}
