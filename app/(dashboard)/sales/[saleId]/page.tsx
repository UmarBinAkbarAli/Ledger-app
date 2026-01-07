"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { generatePDF } from "@/app/utils/pdfGenerator";
import ShareButton from "@/components/ShareButton";
import Link from "next/link";

export default function SaleInvoicePage() {
  const { saleId } = useParams();
  const [sale, setSale] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!saleId) return;
    const fetchSale = async () => {
      try {
        const ref = doc(db, "sales", saleId as string);
        const snap = await getDoc(ref);
        if (snap.exists()) setSale({ id: snap.id, ...snap.data() });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSale();
  }, [saleId]);

  if (loading) return <p className="p-6">Loading invoice...</p>;
  if (!sale) return <p className="p-6">Invoice not found.</p>;

  const items: any[] = Array.isArray(sale.items) ? sale.items : [];
  const subtotal = Number(sale.subtotal ?? items.reduce((s, it) => s + (Number(it.amount) || (Number(it.qty || 0) * Number(it.unitPrice || 0))), 0));
  const total = Number(sale.total ?? subtotal);
  const paid = Number(sale.paidAmount ?? 0);
  const remaining = total - paid;

  const fmt = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="w-full max-w-[80%] mx-auto p-4">
      {/* ACTION BAR (Print & Share)                      */}
      <div className="p-4 flex justify-end gap-3 print:hidden bg-gray-100 border-b">
        {/* SHARE BUTTON COMPONENT */}
        <ShareButton
          title={`Invoice ${sale.billNumber || saleId}`}
          text={`Hello ${sale.customerName || ""},\nHere is your invoice #${sale.billNumber || saleId} for ${fmt(total)}.\nDate: ${sale.date}`}
          url={`${typeof window !== "undefined" ? window.location.origin : ""}/sales/${saleId}`}
        />
        
        <button
          onClick={() => window.location.href = `/sales/${saleId}/edit`}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          Edit Invoice
        </button>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Print Invoice
        </button>

        <button
          onClick={() => generatePDF("pdf-area", `invoice-${sale.billNumber || saleId}.pdf`)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Download PDF
        </button>
      </div>

      {/* PDF area */}
      <div id="pdf-area" className="pdf-area bg-white border border-gray-200 w-full">
        <div className="pdf-page">

          {/* Header: logo + company */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <img src="/boxilla-logo.png" alt="Boxilla" style={{ width: 160, height: "auto" }} />
              <div className="pl-2">
                <h2 className="text-xl font-bold text-gray-800">Boxilla Packages</h2>
                <div className="text-sm text-gray-600">Plot # 470, Bhangoria Goth, Federal B. Industrial Area, Karachi (75950)-Pakistan</div>
                <div className="text-sm text-gray-600">Phone: 0312-8246221</div>
              </div>
            </div>

            <div className="w-48">
              <div className="bg-blue-900 text-Black text-sm px-3 py-2 font-semibold text-right">INVOICE</div>

              <div className="border border-t-0 border-gray-200 p-3 text-sm">
                <div className="flex justify-between pb-1"><span className="text-gray-600">INVOICE #</span><strong>{sale.billNumber}</strong></div>
                <div className="flex justify-between"><span className="text-gray-600">DATE</span><span>{sale.date}</span></div>
              </div>
            </div>
          </div>

          {/* Top info bar: Bill To / PO / Terms */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <div className="bg-blue-800 text-black px-3 py-2 leading-[1.4] text-sm font-semibold mb-2">BILL TO</div>
              {sale.customerCompany && <div className="text-sm font-semibold">{sale.customerCompany}</div>}
              <div className="text-sm">{sale.customerName}</div>
              {sale.customerAddress && <div className="text-sm">{sale.customerAddress}</div>}
              {sale.customerPhone && <div className="text-sm">Phone: {sale.customerPhone}</div>}
              {sale.customerChNo && <div className="text-sm">CH No: {sale.customerChNo}</div>}
            </div>

            <div>
              <div className="bg-blue-800 text-black px-3 py-2 leading-[1.4] text-sm font-semibold mb-2">PO NO</div>
              <div className="text-sm">{sale.poNumber || "-"}</div>
            </div>

            <div>
              <div className="bg-blue-800 text-black px-3 py-2 leading-[1.4] text-sm font-semibold mb-2">TERMS</div>
              <div className="text-sm">{sale.terms || "CASH"}</div>
            </div>
          </div>

          {/* Linked Challans Section */}
          {sale.challanNumbers && sale.challanNumbers.length > 0 && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded print:bg-white print:border-gray-300">
              <div className="font-semibold text-green-900 mb-2 text-sm print:text-black">
                📦 Linked Delivery Challans:
              </div>
              <div className="flex flex-wrap gap-2">
                {sale.challanNumbers.map((challanNum: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-sm font-medium text-green-800 print:text-black">
                      {challanNum}
                    </span>
                    {sale.challanIds && sale.challanIds[idx] && (
                      <Link
                        href={`/delivery-challan/${sale.challanIds[idx]}`}
                        className="text-xs text-blue-600 hover:underline print:hidden"
                      >
                        View
                      </Link>
                    )}
                    {idx < sale.challanNumbers.length - 1 && <span className="text-gray-400">•</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Items table */}
          <div className="mb-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-blue-900 text-white">
                  <th className="p-2 text-left">DESCRIPTION</th>
                  <th className="p-2 text-right">QTY</th>
                  <th className="p-2 text-right">UNIT PRICE</th>
                  <th className="p-2 text-right">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {items.length > 0 ? (
                  <>
                    {items.map((it, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="p-2 align-top">{it.description || "-"}</td>
                        <td className="p-2 text-right align-top">{Number(it.qty || 0).toLocaleString()}</td>
                        <td className="p-2 text-right align-top">{fmt(Number(it.unitPrice || 0))}</td>
                        <td className="p-2 text-right align-top">{fmt(Number(it.amount ?? (it.qty * it.unitPrice || 0)))} </td>
                      </tr>
                    ))}
                    {/* Total Quantity Row */}
                    <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                      <td className="p-2 text-right">Total Quantity:</td>
                      <td className="p-2 text-right">{items.reduce((sum, it) => sum + Number(it.qty || 0), 0).toLocaleString()}</td>
                      <td className="p-2"></td>
                      <td className="p-2"></td>
                    </tr>
                  </>
                ) : (
                  <tr><td colSpan={4} className="p-4 text-center text-gray-500">No items</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totals & Subtotal box */}
          <div className="flex justify-end">
            <div className="w-80">
              <div className="bg-blue-500 text-black p-4 rounded-b border border-t-0 border-gray-200">
                <div className="flex justify-between font-bold text-lg"><span>TOTAL</span><span>{fmt(total)}</span></div>
              </div>
            </div>
          </div>

          {/* Signature area */}
          <div className="mt-12 grid grid-cols-3 gap-6 text-center text-sm">
            <div>
              <div className="border-t border-gray-300 pt-6">Receiver's Name</div>
            </div>
            <div>
              <div className="border-t border-gray-300 pt-6">Receiver's Signature</div>
            </div>
            <div>
              <div className="border-t border-gray-300 pt-6">Authorize Signature</div>
            </div>
          </div>

          {/* Footer small text */}
          <div className="mt-8 text-center text-xs text-gray-500">
            If you have any questions about this invoice, please contact [babarakbar76@gmail.com]
          </div>
        </div>
      </div>
      </div>
  );
}
