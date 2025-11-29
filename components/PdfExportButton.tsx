"use client";

import { generatePDF } from "@/app/utils/pdfGenerator";

interface Props {
  targetId: string;
  fileName: string;
}

export default function PdfExportButton({ targetId, fileName }: Props) {
  return (
    <button
      onClick={() => generatePDF(targetId, fileName)}
      className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
    >
      Download PDF
    </button>
  );
}
