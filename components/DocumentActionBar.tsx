"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import ShareButton from "./ShareButton";

interface DocumentActionBarProps {
  documentType: "invoice" | "challan" | "ledger";
  documentId: string;
  documentNumber?: string;

  actions?: {
    edit?: { href: string; label?: string };
    print?: { enabled?: boolean; label?: string };
    pdf?: {
      enabled?: boolean;
      targetId?: string;
      fileName: string;
      copies?: number;
      label?: string;
      isGenerating?: boolean;
      onGeneratePDF?: () => Promise<void>;
    };
    share?: {
      title: string;
      text: string;
      url?: string;
    };
    delete?: {
      enabled?: boolean;
      onDelete: () => Promise<void>;
      label?: string;
    };
    viewRelated?: {
      type: string;
      id: string;
      label: string;
    };
  };

  onError?: (error: Error) => void;
}

export default function DocumentActionBar({
  actions,
  onError,
}: DocumentActionBarProps) {
  const router = useRouter();

  const handlePrint = () => {
    window.print();
  };

  const handlePDF = async () => {
    try {
      if (actions?.pdf?.onGeneratePDF) {
        await actions.pdf.onGeneratePDF();
      }
    } catch (error) {
      if (onError && error instanceof Error) {
        onError(error);
      }
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this?")) return;
    try {
      if (actions?.delete?.onDelete) {
        await actions.delete.onDelete();
      }
    } catch (error) {
      if (onError && error instanceof Error) {
        onError(error);
      }
    }
  };

  return (
    <div className="print:hidden bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-end gap-3">
        {/* Edit Button */}
        {actions?.edit && (
          <Link
            href={actions.edit.href}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            {actions.edit.label || "Edit"}
          </Link>
        )}

        {/* Print Button */}
        {actions?.print?.enabled !== false && (
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            {actions?.print?.label || "Print"}
          </button>
        )}

        {/* PDF Download Button */}
        {actions?.pdf && (
          <button
            onClick={handlePDF}
            disabled={actions.pdf.isGenerating}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actions.pdf.isGenerating ? "Generating..." : (actions.pdf.label || "Download PDF")}
          </button>
        )}

        {/* Share Button */}
        {actions?.share && (
          <ShareButton
            title={actions.share.title}
            text={actions.share.text}
            url={actions.share.url}
          />
        )}

        {/* View Related Document */}
        {actions?.viewRelated && (
          <Link
            href={`/${actions.viewRelated.type}/${actions.viewRelated.id}`}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            {actions.viewRelated.label}
          </Link>
        )}

        {/* Delete Button */}
        {actions?.delete && (
          <button
            onClick={handleDelete}
            disabled={actions.delete.enabled === false}
            className={`px-4 py-2 rounded text-white ${
              actions.delete.enabled === false
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-red-600 hover:bg-red-700"
            }`}
            title={actions.delete.enabled === false ? "Cannot delete" : "Delete"}
          >
            {actions.delete.label || "Delete"}
          </button>
        )}
      </div>
    </div>
  );
}
