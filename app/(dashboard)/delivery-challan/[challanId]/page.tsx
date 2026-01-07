"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, deleteDoc } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

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
    window.print();
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

      {/* Challan Document - Print-friendly */}
      <div className="max-w-4xl mx-auto bg-white p-8 print:p-0 my-6 print:my-0 shadow-lg print:shadow-none">
        {/* Header */}
        <div className="border-2 border-black p-4 mb-0">
          <div className="flex items-start justify-between mb-2">
            {/* Logo placeholder */}
            <div className="w-20 h-20 border border-gray-300 flex items-center justify-center text-xs text-gray-400">
              LOGO
            </div>
            
            {/* Company Info */}
            <div className="flex-1 text-center px-4">
              <h1 className="text-3xl font-bold mb-1">BOXILLA PACKAGES</h1>
              <p className="text-sm italic mb-2">&amp; you think it, we can ink it</p>
              <p className="text-xs">Gat #470, Bhangoria Goth, Federal B Industrial Area, (75950)-Pakistan</p>
            </div>

            {/* Contact */}
            <div className="text-right text-xs">
              <p>Contact No # 0312 824 6221</p>
            </div>
          </div>

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

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          @page {
            size: A4;
            margin: 10mm;
          }
        }
      `}</style>
    </div>
  );
}

