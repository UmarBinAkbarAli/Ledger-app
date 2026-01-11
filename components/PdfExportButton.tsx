"use client";

import { useState } from "react";
import { generatePDF } from "@/app/utils/pdfGenerator";

interface Props {
  targetId: string;
  fileName: string;
}

export default function PdfExportButton({ targetId, fileName }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      await generatePDF(targetId, fileName);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={isGenerating}
      className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isGenerating ? "Generating..." : "Download PDF"}
    </button>
  );
}
