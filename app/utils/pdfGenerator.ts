"use client";

import html2pdf from "html2pdf.js";

// A4 portrait inner area with 10mm margins on every side.
const A4_INNER_WIDTH_MM = 210 - 20;
const A4_INNER_HEIGHT_MM = 297 - 20;
const A4_INNER_RATIO = A4_INNER_HEIGHT_MM / A4_INNER_WIDTH_MM;

const SAFETY_PX = 3;

function makeSpacerRow(colCount: number, heightPx: number): HTMLTableRowElement {
  const spacer = document.createElement("tr");
  spacer.setAttribute("aria-hidden", "true");
  const cell = document.createElement("td");
  cell.colSpan = colCount;
  cell.style.padding = "0";
  cell.style.margin = "0";
  cell.style.border = "none";
  cell.style.background = "#fff";
  const filler = document.createElement("div");
  filler.style.height = `${heightPx}px`;
  cell.appendChild(filler);
  spacer.appendChild(cell);
  return spacer;
}

/**
 * Insert full-width spacer <tr> rows so that no data row is ever sliced across
 * a page boundary in the exported PDF.
 *
 * Two html2pdf facts drive this:
 *
 * 1. Before capture, html2pdf wraps the content in a container forced to the A4
 *    inner width (190mm ≈ 719px) — see html2pdf.js worker.js `toContainer`. So
 *    the PDF layout is NOT the element's on-screen width (which may be ~1168px);
 *    text wraps more and rows are taller. We therefore measure on a clone
 *    constrained to that same 190mm width, not on the live element.
 * 2. html2pdf then renders that container to one canvas (at `scale`x) and cuts
 *    it into page-height strips. Its built-in "avoid-all" page-break mode tries
 *    to push a straddling element down with a <div> spacer, but for a <tr> that
 *    <div> lands inside <tbody> — invalid table markup that collapses to zero
 *    height — so the row still gets sliced. We instead push the row down with a
 *    valid <tr>/<td> spacer of a fixed pixel height, which the table honors.
 *
 * Spacer heights are computed in the 190mm layout but expressed in absolute px,
 * so they transfer unchanged when applied to the live element (html2pdf re-wraps
 * it to 190mm at capture time). `scale` must match opt.html2canvas.scale.
 * Returns the spacers inserted into the live element so the caller can remove
 * them after capture.
 */
function insertLedgerPageSpacers(
  liveElement: HTMLElement,
  scale: number
): HTMLElement[] {
  const spacers: HTMLElement[] = [];

  // Measurement clone, constrained to the same 190mm width html2pdf will use.
  const clone = liveElement.cloneNode(true) as HTMLElement;
  clone.style.width = `${A4_INNER_WIDTH_MM}mm`;
  clone.style.position = "absolute";
  clone.style.left = "0";
  clone.style.top = "0";
  clone.style.zIndex = "-1";
  clone.style.visibility = "hidden";
  document.body.appendChild(clone);

  try {
    const captureWidth = clone.getBoundingClientRect().width;
    if (!captureWidth) return spacers;
    // Match html2pdf's canvas-level floor so our boundary lands on its cut.
    const pageHeight = Math.floor(captureWidth * scale * A4_INNER_RATIO) / scale;

    const cloneTables = clone.querySelectorAll("table");
    const liveTables = liveElement.querySelectorAll("table");

    cloneTables.forEach((cTable, ti) => {
      const cBody = cTable.tBodies[0];
      const lBody = liveTables[ti]?.tBodies[0];
      if (!cBody || !lBody) return;

      // Snapshot before inserting, so indices map clone rows -> live rows.
      const cRows = Array.from(cBody.rows);
      const lRows = Array.from(lBody.rows);
      const colCount = Math.max(
        1,
        ...cRows.map((r) =>
          Array.from(r.cells).reduce((n, c) => n + (c.colSpan || 1), 0)
        )
      );

      cRows.forEach((cRow, ri) => {
        const cloneTop = clone.getBoundingClientRect().top;
        const rect = cRow.getBoundingClientRect();
        const top = rect.top - cloneTop;
        const bottom = rect.bottom - cloneTop;
        const rowHeight = bottom - top;

        // Can't rescue a row taller than a full page — leave it to be sliced.
        if (rowHeight <= 0 || rowHeight > pageHeight) return;

        const startPage = Math.floor(top / pageHeight);
        const endPage = Math.floor((bottom - 0.5) / pageHeight);
        if (endPage <= startPage) return; // already fits on one page

        const spacerHeight = (startPage + 1) * pageHeight - top + SAFETY_PX;

        // Insert into the clone too, so later rows measure with this shift in.
        cRow.parentNode?.insertBefore(makeSpacerRow(colCount, spacerHeight), cRow);

        // Insert the matching spacer into the live element by row index.
        const liveRow = lRows[ri];
        if (liveRow?.parentNode) {
          const liveSpacer = makeSpacerRow(colCount, spacerHeight);
          liveRow.parentNode.insertBefore(liveSpacer, liveRow);
          spacers.push(liveSpacer);
        }
      });
    });
  } finally {
    clone.remove();
  }

  return spacers;
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

    // Multi-page ledger export: insert spacer rows into the live element so no
    // row is cut mid-height, then disable html2pdf's own (table-incompatible)
    // avoid-all so it doesn't add its collapsing <div> spacers on top of ours.
    // We operate on the live, on-screen element rather than an off-screen clone
    // because html2canvas renders detached/off-screen elements as zero height.
    // The spacers are visible for the ~1s of capture, then removed.
    if (copies === 1 && options?.paginateRows) {
      const spacers = insertLedgerPageSpacers(element, opt.html2canvas.scale);
      try {
        await html2pdf()
          .from(element)
          .set({ ...opt, pagebreak: { mode: ["legacy"] } })
          .save();
      } finally {
        spacers.forEach((s) => s.remove());
      }
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
