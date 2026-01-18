"use client";

import html2pdf from "html2pdf.js";

export async function generatePDF(targetId: string, fileName: string, options?: { copies?: number }) {
  const element = document.getElementById(targetId);

  if (!element) {
    alert("PDF export failed: element not found.");
    return;
  }

  const copies = options?.copies && options.copies > 1 ? options.copies : 1;
  document.body.classList.add("pdf-export");

  try {
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

    // If only 1 copy requested, behave as before
    if (copies === 1) {
      await html2pdf().from(element).set(opt).save();
      return;
    }

    // Prefer cloning the dedicated print template if present (it contains the 2-up layout)
    const printTemplate = document.getElementById("pdf-print-area");
    const wrapper = document.createElement("div");
    wrapper.style.width = "190mm";
    wrapper.style.margin = "0 auto";
    wrapper.style.background = "#fff";

    if (printTemplate) {
      const clone = printTemplate.cloneNode(true) as HTMLElement;
      // Un-hide and make printable
      clone.style.display = "block";
      clone.style.width = "190mm";
      clone.style.boxSizing = "border-box";

      // Remove any interactive elements
      const hideEls = clone.querySelectorAll(".print-hidden, .print-hide, button, input, select, textarea");
      hideEls.forEach((el) => (el as HTMLElement).style.display = "none");

      // Append and scale to fit one A4 page if needed
      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);

      // Compute scale to fit into printable A4 height (mm -> px conversion)
      const mmToPx = (mm: number) => (mm * 96) / 25.4;
      const pageInnerMm = 297 - 20; // A4 height minus 2*10mm margins
      const availablePx = mmToPx(pageInnerMm);

      const totalHeight = wrapper.scrollHeight;
      const scale = Math.min(1, availablePx / totalHeight);
      if (scale < 1) {
        wrapper.style.transform = `scale(${scale})`;
        wrapper.style.transformOrigin = "top center";
        // To avoid clipping, set wrapper height after scaling
        wrapper.style.height = `${totalHeight * scale}px`;
      }

      try {
        await html2pdf().from(wrapper).set(opt).save();
      } catch (err) {
        console.error("PDF export failed:", err);
        alert("PDF export failed. See console for details.");
      } finally {
        document.body.removeChild(wrapper);
      }

      return;
    }

    // Fallback: clone the target element multiple times
    for (let i = 0; i < copies; i++) {
      const clone = element.cloneNode(true) as HTMLElement;
      // Remove interactive controls that shouldn't appear in PDF
      const hideEls2 = clone.querySelectorAll(".print-hidden, .print-hide");
      hideEls2.forEach((el) => (el as HTMLElement).style.display = "none");

      // Some layout adjustments for PDF
      clone.style.marginBottom = i === 0 ? "6mm" : "0";
      wrapper.appendChild(clone);
    }

    document.body.appendChild(wrapper);

    try {
      await html2pdf().from(wrapper).set(opt).save();
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("PDF export failed. See console for details.");
    } finally {
      document.body.removeChild(wrapper);
    }
  } finally {
    document.body.classList.remove("pdf-export");
  }
}
