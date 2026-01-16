"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, deleteDoc } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { generatePDF } from "@/app/utils/pdfGenerator";
import CompanyHeader from "@/components/CompanyHeader";
import PrintableChallanHeader from "@/components/PrintableChallanHeader";

interface ChallanItem {
  description: string;
  qty: number;
}

interface ChallanData {
  challanNumber: string;
  date: string;
  vehicle: string;
  poNumber?: string;
  customerName: string;
  customerCompany: string;
  customerAddress: string;
  customerNote?: string;
  items: ChallanItem[];
  totalQuantity: number;
  status: string;
  receiverName?: string;
  invoiceId?: string;
  invoiceNumber?: string;
}

export default function ViewChallanPage() {
  const router = useRouter();
  const params = useParams();
  const challanId = params.challanId as string;

  const [challan, setChallan] = useState<ChallanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    loadChallan();
  }, [challanId]);

  const loadChallan = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const docRef = doc(db, "deliveryChallans", challanId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setChallan({
          challanNumber: data.challanNumber || "",
          date: data.date || "",
          vehicle: data.vehicle || "",
          poNumber: data.poNumber || "",
          customerName: data.customerName || "",
          customerCompany: data.customerCompany || "",
          customerAddress: data.customerAddress || "",
          customerNote: data.customerNote || "",
          items: data.items || [],
          totalQuantity: data.totalQuantity || 0,
          status: data.status || "pending",
          receiverName: data.receiverName || "",
          invoiceId: data.invoiceId || "",
          invoiceNumber: data.invoiceNumber || "",
        });
      }
    } catch (error) {
      console.error("Error loading challan:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    // Open a new window with the printable HTML to avoid blank print preview issues.
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      window.print(); // fallback
      return;
    }

    // Grab the print-only template (if available) to ensure consistent print output
    const printTemplate = document.getElementById("pdf-print-area");
    let html = "";

    // Shared print CSS to vertically distribute content and show a tear line between copies
    const twoUpCSS = `@page{size:A4;margin:10mm;} body{margin:0;padding:0} .print-copy{box-sizing:border-box;width:190mm;margin:0 auto;border:2px solid #000;padding:6mm;box-sizing:border-box;page-break-inside:avoid;display:flex;flex-direction:column;justify-content:space-between;min-height:135mm;font-family: Arial, Helvetica, sans-serif;} .tear-line{width:190mm;margin:6mm auto;border-top:1px dashed #000;display:flex;align-items:center;justify-content:center;} .tear-line span{background:#fff;padding:0 6px;font-size:10px;} .print-copy *{font-size:11px}`;

    if (printTemplate) {
      html = `<!doctype html><html><head><title>Delivery Challan</title><meta charset='utf-8' /><style>${twoUpCSS}</style></head><body>` + printTemplate.innerHTML + `</body></html>`;
    } else {
      // fallback: use the visible PDF area
      const pdfArea = document.getElementById("pdf-area");
      html = `<!doctype html><html><head><title>Delivery Challan</title><meta charset='utf-8' /><style>${twoUpCSS}</style></head><body>` + (pdfArea ? pdfArea.innerHTML : "") + `</body></html>`;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    // Wait until the content is loaded before printing
    printWindow.onload = function () {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        // Optionally close the window after printing
        setTimeout(() => printWindow.close(), 500);
      }, 200);
    };
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this challan?")) return;

    try {
      await deleteDoc(doc(db, "deliveryChallans", challanId));
      router.push("/delivery-challan");
    } catch (error) {
      console.error("Error deleting challan:", error);
      alert("Failed to delete challan");
    }
  };

  if (loading) return <div className="p-6">Loading challan...</div>;
  if (!challan) return <div className="p-6">Challan not found</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Action Buttons - Hidden on print */}
      <div className="print:hidden bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center mb-3">
          <Link
            href="/delivery-challan"
            className="text-gray-600 hover:text-gray-800 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            Back to List
          </Link>
          <div className="flex gap-3">
            {challan.invoiceId && (
              <Link
                href={`/sales/${challan.invoiceId}`}
                className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[20px]">receipt_long</span>
                View Invoice
              </Link>
            )}
            <Link
              href={`/delivery-challan/${challanId}/edit`}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">edit</span>
              Edit
            </Link>
            <button
              onClick={handlePrint}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">print</span>
              Print
            </button>

            {/* Download 2-up PDF */}
            <button
              onClick={async () => {
                setGeneratingPDF(true);
                try {
                  await generatePDF('pdf-area', `challan-${challan.challanNumber || challanId}.pdf`, { copies: 2 });
                } finally {
                  setGeneratingPDF(false);
                }
              }}
              disabled={generatingPDF}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">download</span>
              {generatingPDF ? "Generating..." : "Download PDF"}
            </button>

            <button
              onClick={handleDelete}
              disabled={challan.status === "invoiced"}
              className={`px-4 py-2 rounded flex items-center gap-2 ${
                challan.status === "invoiced"
                  ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                  : "bg-red-600 text-white hover:bg-red-700"
              }`}
              title={challan.status === "invoiced" ? "Cannot delete invoiced challan" : "Delete challan"}
            >
              <span className="material-symbols-outlined text-[20px]">delete</span>
              Delete
            </button>
          </div>
        </div>

        {/* Linked Invoice Info */}
        {challan.invoiceNumber && (
          <div className="p-3 bg-purple-50 border border-purple-200 rounded flex items-center gap-2">
            <span className="material-symbols-outlined text-purple-700">link</span>
            <span className="text-sm text-purple-900">
              <strong>Linked to Invoice:</strong> {challan.invoiceNumber}
            </span>
          </div>
        )}
      </div>

      {/* Challan Document - Print-friendly (screen view) */}
      <div id="pdf-area" className="max-w-4xl mx-auto bg-white p-8 print:p-0 my-6 print:my-0 shadow-lg print:shadow-none print:hidden">
        {/* Header */}
        <div className="border-2 border-black p-4 mb-0">
          <CompanyHeader variant="challan" />

          {/* Title */}
          <div className="text-center border-t-2 border-black pt-2 mt-2">
            <h2 className="text-xl font-bold">DELIVERY CHALLAN</h2>
          </div>
        </div>

        {/* Challan Details */}
        <div className="border-x-2 border-black px-4 py-2 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p><strong>Invoice No:</strong> {challan.challanNumber}</p>
            <p><strong>Print Date:</strong> {challan.date}</p>
            <p><strong>Vehicle:</strong> {challan.vehicle}</p>
          </div>
          <div>
            <p><strong>M/S:</strong> {challan.customerCompany || challan.customerName}</p>
            <p><strong>ADDRESS:</strong> {challan.customerAddress || "N/A"}</p>
            <p><strong>P.O.NO.:</strong> {challan.poNumber || "N/A"}</p>
            {challan.customerNote?.trim() ? (
              <p><strong>Delivered to:</strong> {challan.customerNote.trim()}</p>
            ) : null}
          </div>
        </div>

        {/* Items Table */}
        <div className="border-2 border-black">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="border-r border-black p-2 text-left w-16">S. NO</th>
                <th className="border-r border-black p-2 text-left">DESCRIPTION</th>
                <th className="p-2 text-center w-32">QUANTITY</th>
              </tr>
            </thead>
            <tbody>
              {challan.items.map((item, idx) => (
                <tr key={idx} className="border-b border-black">
                  <td className="border-r border-black p-2 text-center">{idx + 1}</td>
                  <td className="border-r border-black p-2">{item.description}</td>
                  <td className="p-2 text-center font-semibold">{item.qty.toLocaleString()}</td>
                </tr>
              ))}
              {/* Total Row */}
              <tr className="border-t-2 border-black font-bold">
                <td className="border-r border-black p-2" colSpan={2}></td>
                <td className="p-2 text-center text-lg">{challan.totalQuantity.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer - Signatures */}
        <div className="border-x-2 border-b-2 border-black grid grid-cols-3 text-sm">
          <div className="border-r border-black p-4 text-center">
            <p className="mb-12">Receiver's Name</p>
            <div className="border-t border-black pt-1">
              <p className="text-xs">{challan.receiverName || ""}</p>
            </div>
          </div>
          <div className="border-r border-black p-4 text-center">
            <p className="mb-12">Receiver's Signature</p>
            <div className="border-t border-black pt-1">
              <p className="text-xs">&nbsp;</p>
            </div>
          </div>
          <div className="p-4 text-center">
            <p className="mb-12">Authorize Signature</p>
            <div className="border-t border-black pt-1">
              <p className="text-xs">&nbsp;</p>
            </div>
          </div>
        </div>
      </div>

      {/* Print-only: Two copies per A4 page (stacked vertically) */}
      <div id="pdf-print-area" className="hidden print:block print-only">
        <div style={{ width: '190mm', margin: '0 auto' }}>
          {[0,1].map((i) => (
            <div key={i}>
              <div className="print-copy" style={{ border: '2px solid #000', padding: '6mm', marginBottom: i === 0 ? '6mm' : '0', boxSizing: 'border-box', pageBreakInside: 'avoid', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '135mm' }}>
                {/* Header */}
                <div style={{ borderBottom: '0px solid transparent', paddingBottom: '4px', marginBottom: '4px' }}>
                  <PrintableChallanHeader />
                </div>

                {/* Details */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '6px 0' }}>
                  <div>
                    <div><strong>Invoice No:</strong> {challan.challanNumber}</div>
                    <div><strong>Print Date:</strong> {challan.date}</div>
                    <div><strong>Vehicle:</strong> {challan.vehicle}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div><strong>M/S:</strong> {challan.customerCompany || challan.customerName}</div>
                    <div><strong>ADDRESS:</strong> {challan.customerAddress || 'N/A'}</div>
                    <div><strong>P.O.NO.:</strong> {challan.poNumber || 'N/A'}</div>
                    {challan.customerNote?.trim() ? (
                      <div><strong>Delivered to:</strong> {challan.customerNote.trim()}</div>
                    ) : null}
                  </div>
                </div>

                {/* Items */}
                <div style={{ border: '1px solid #000', marginTop: 6 }}>
                  <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ borderRight: '1px solid #000', padding: 6, textAlign: 'left', width: 50 }}>S. NO</th>
                        <th style={{ borderRight: '1px solid #000', padding: 6, textAlign: 'left' }}>DESCRIPTION</th>
                        <th style={{ padding: 6, textAlign: 'center', width: 80 }}>QUANTITY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {challan.items.map((item, idx) => (
                        <tr key={idx} style={{ borderTop: '1px solid #000' }}>
                          <td style={{ borderRight: '1px solid #000', padding: 6, textAlign: 'center' }}>{idx + 1}</td>
                          <td style={{ borderRight: '1px solid #000', padding: 6 }}>{item.description}</td>
                          <td style={{ padding: 6, textAlign: 'center', fontWeight: 700 }}>{item.qty.toLocaleString()}</td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={2} style={{ padding: 6 }}></td>
                        <td style={{ padding: 6, textAlign: 'center', fontSize: 13, fontWeight: 700 }}>{challan.totalQuantity.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Footer signatures */}
                <div style={{ display: 'flex', marginTop: 8, fontSize: 11 }}>
                  <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid #000', padding: 6 }}>
                    <div style={{ marginBottom: 36 }}>Receiver's Name</div>
                    <div style={{ borderTop: '1px solid #000', paddingTop: 4 }}>{challan.receiverName || ''}</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid #000', padding: 6 }}>
                    <div style={{ marginBottom: 36 }}>Receiver's Signature</div>
                    <div style={{ borderTop: '1px solid #000', paddingTop: 4 }}>&nbsp;</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', padding: 6 }}>
                    <div style={{ marginBottom: 36 }}>Authorize Signature</div>
                    <div style={{ borderTop: '1px solid #000', paddingTop: 4 }}>&nbsp;</div>
                  </div>
                </div>

              </div>

              {i === 0 && (
                <div className="tear-line" aria-hidden>
                  <span>— Tear Here —</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
          }

          /* Enforce A4 and small margins */
          @page {
            size: A4;
            margin: 10mm;
          }

          /* Utility classes for print-only layout */
          .print-hidden { display: none !important; }
          .print-only { display: block !important; width: 190mm; margin: 0 auto; }
          .print-copy { page-break-inside: avoid; margin-bottom: 6mm; }

          /* Reduce font sizes slightly to fit two copies */
          .print-copy, .print-copy * { font-size: 11px !important; }
        }
      `}</style>
    </div>
  );
}
