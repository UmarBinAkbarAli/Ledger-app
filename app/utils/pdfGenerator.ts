"use client";

import html2pdf from "html2pdf.js";

// A4 portrait inner area with 10mm margins on every side.
const A4_INNER_WIDTH_MM = 210 - 20;
const A4_INNER_HEIGHT_MM = 297 - 20;
const A4_INNER_RATIO = A4_INNER_HEIGHT_MM / A4_INNER_WIDTH_MM;

const SAFETY_PX = 3;

/**
 * Build an html2canvas `onclone` handler that inserts full-width spacer <tr>
 * rows so no data row is ever sliced across a page boundary in the exported PDF.
 *
 * Background — two html2pdf facts:
 *
 * 1. Before capture, html2pdf wraps the content in a container forced to the A4
 *    inner width (190mm ≈ 719px) — see html2pdf.js worker.js `toContainer`. So
 *    the PDF layout is NOT the element's on-screen width (~1168px); text wraps
 *    more and rows are taller.
 * 2. html2pdf then renders that container to one canvas (at `scale`x) and cuts
 *    it into page-height strips. Its built-in "avoid-all" page-break mode tries
 *    to push a straddling element down with a <div> spacer, but for a <tr> that
 *    <div> lands inside <tbody> — invalid table markup that collapses to zero
 *    height — so the row still gets sliced. We instead push the row down with a
 *    valid <tr>/<td> spacer of a fixed pixel height, which the table honors.
 *
 * Crucially we run inside `onclone`, so we measure and mutate the *exact* DOM
 * html2canvas is about to render (its own iframe clone, fonts already loaded),
 * not a separate clone of our own. Measuring a separate clone was unreliable:
 * text sitting right at a wrap boundary could wrap to a different number of
 * lines in html2canvas's clone than in ours, shifting a row across the cut and
 * re-slicing it. onclone runs before html2canvas measures the canvas size, so
 * the spacers we add are included in the render.
 */
function makeLedgerSpacerOnclone(scale: number) {
  return (clonedDoc: Document, clonedContainer: HTMLElement) => {
    if (!clonedContainer) return;
    const boundsWidth = clonedContainer.getBoundingClientRect().width;
    if (!boundsWidth) return;

    // Reproduce html2canvas + html2pdf page geometry EXACTLY. Any per-page
    // mismatch accumulates: on a 14-page ledger a 1.5px error drifts ~21px and
    // re-splits rows near the end. The chain is:
    //   html2canvas: optionsWidth = ceil(boundsWidth);
    //                canvasWidth  = floor(optionsWidth * scale)
    //   html2pdf:    pageHeightCanvasPx = floor(canvasWidth * ratio)
    // pageHeightCanvasPx is an integer, so page boundaries (k * it / scale) are
    // exact with no drift no matter how many pages.
    const canvasWidth = Math.floor(Math.ceil(boundsWidth) * scale);
    const pageHeight = Math.floor(canvasWidth * A4_INNER_RATIO) / scale;

    clonedContainer.querySelectorAll("table").forEach((table) => {
      const tbody = table.tBodies[0];
      if (!tbody) return;

      const rows = Array.from(tbody.rows);
      const colCount = Math.max(
        1,
        ...rows.map((r) =>
          Array.from(r.cells).reduce((n, c) => n + (c.colSpan || 1), 0)
        )
      );

      rows.forEach((row) => {
        const containerTop = clonedContainer.getBoundingClientRect().top;
        const rect = row.getBoundingClientRect();
        const top = rect.top - containerTop;
        const bottom = rect.bottom - containerTop;
        const rowHeight = bottom - top;

        // Can't rescue a row taller than a full page — leave it to be sliced.
        if (rowHeight <= 0 || rowHeight > pageHeight) return;

        const startPage = Math.floor(top / pageHeight);
        const endPage = Math.floor((bottom - 0.5) / pageHeight);
        if (endPage <= startPage) return; // already fits on one page

        const spacerHeight = (startPage + 1) * pageHeight - top + SAFETY_PX;
        const spacer = clonedDoc.createElement("tr");
        spacer.setAttribute("aria-hidden", "true");
        const cell = clonedDoc.createElement("td");
        cell.colSpan = colCount;
        cell.style.cssText = "padding:0;margin:0;border:none;background:#fff";
        const filler = clonedDoc.createElement("div");
        filler.style.height = `${spacerHeight}px`;
        cell.appendChild(filler);
        spacer.appendChild(cell);
        row.parentNode?.insertBefore(spacer, row);
      });
    });
  };
}

export async function generatePDF(
  targetId: string,
  fileName: string,
  options?: { copies?: number; paginateRows?: boolean }
) {
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
      // "avoid-all" + "css" keep table rows from being sliced across pages
      pagebreak: { mode: ["css", "legacy", "avoid-all"] },
    };

    // Multi-page ledger export: add spacer rows during html2canvas's onclone so
    // no row is cut mid-height, and disable html2pdf's own (table-incompatible)
    // avoid-all so it doesn't add its collapsing <div> spacers on top of ours.
    // Nothing touches the live DOM, so there is no visible flash and no cleanup.
    if (copies === 1 && options?.paginateRows) {
      await html2pdf()
        .from(element)
        .set({
          ...opt,
          pagebreak: { mode: ["legacy"] },
          html2canvas: {
            ...opt.html2canvas,
            onclone: makeLedgerSpacerOnclone(opt.html2canvas.scale),
          },
        })
        .save();
      return;
    }

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
