"use client";

import html2pdf from "html2pdf.js";

export function generatePDF(targetId: string, fileName: string) {
  const element = document.getElementById(targetId);

  if (!element) {
    alert("PDF export failed: element not found.");
    return;
  }

const opt: any = {
  margin: [10, 10, 10, 10],
  filename: fileName,
  image: { type: "jpeg", quality: 0.98 },
  html2canvas: {
    scale: 2,
    useCORS: true,
    letterRendering: true,
    scrollX: 0,
    scrollY: 0,
  },
  jsPDF: {
    unit: "mm",
    format: "a4",
    orientation: "portrait",
  },
  pagebreak: { mode: ["css", "legacy"] },
};


  html2pdf().from(element).set(opt).save();
}
