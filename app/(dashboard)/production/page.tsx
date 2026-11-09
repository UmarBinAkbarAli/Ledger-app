"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useBusiness } from "@/hooks/useBusiness";
import { getPakistanDate } from "@/lib/dateUtils";
import {
  canDeliver,
  isStageComplete,
  jobRemainingQty,
  JobStatus,
  jobStatus,
  normalizeJob,
  PRODUCTION_COLLECTION,
  ProductionJob,
  STAGES,
  StageKey,
  stageMethodLabel,
  STATUS_LABELS,
  STATUS_STYLES,
} from "@/lib/production";

type Row = ProductionJob & { createdAtMs: number };
type View = "open" | "date";

const fmt = (n: number | null) => (n === null ? "" : n.toLocaleString());

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Print in the same layout as the paper "BOXILLA PACKAGES PRODUCTION SHEET". */
function printSheet(rows: Row[], title: string) {
  const w = window.open("", "_blank", "width=1200,height=800");
  if (!w) return;
  const process = (r: Row) =>
    STAGES.map((s) => {
      const done = isStageComplete(r.stages, s.key);
      const extra = stageMethodLabel(r.stages, s.key);
      return `<div class="st"><span>${s.label}</span><span class="tick">${done ? "&#10003;" : ""}</span><span class="ex">${escapeHtml(extra)}</span></div>`;
    }).join("");
  const body = rows
    .map(
      (r) => `<tr>
        <td>${escapeHtml(r.date)}</td><td>${escapeHtml(r.partyName)}</td><td>${escapeHtml(r.item)}</td>
        <td>${escapeHtml(r.size)}</td><td class="c">${fmt(r.ply)}</td><td class="c">${fmt(r.orderQty)}</td>
        <td class="c">${escapeHtml(r.roll)}</td><td class="c">${escapeHtml(r.cut)}</td><td>${escapeHtml(r.material)}</td>
        <td class="c">${fmt(r.rollQty)}</td><td class="p">${process(r)}</td>
        <td class="c">${fmt(r.finalQty)}<div class="dc">DC# ${escapeHtml(r.deliveries.map((d) => d.challanNumber).join(", "))}</div></td>
      </tr>`
    )
    .join("");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
    <style>
      @page { size: A4 landscape; margin: 8mm; }
      body { font-family: Arial, sans-serif; margin: 0; }
      h1 { text-align: center; margin: 0 0 4px; font-size: 22px; }
      h1 small { font-size: 16px; }
      .sub { text-align: center; font-size: 11px; margin-bottom: 6px; }
      table { width: 100%; border-collapse: collapse; font-size: 10px; }
      th, td { border: 1px solid #000; padding: 2px 3px; vertical-align: top; }
      th { background: #ddd; }
      tr { page-break-inside: avoid; }
      td.c { text-align: center; }
      td.p { padding: 0; width: 140px; }
      .st { display: flex; border-bottom: 1px solid #999; font-size: 8px; }
      .st:last-child { border-bottom: none; }
      .st span:first-child { width: 48px; padding-left: 2px; }
      .st .tick { width: 14px; border-left: 1px solid #999; text-align: center; }
      .st .ex { flex: 1; border-left: 1px solid #999; padding-left: 2px; }
      .dc { font-size: 8px; margin-top: 4px; text-align: left; }
    </style></head><body>
    <h1>BOXILLA PACKAGES <small>PRODUCTION SHEET</small></h1>
    <div class="sub">${escapeHtml(title)}</div>
    <table><thead><tr>
      <th>DATE</th><th>PARTY</th><th>ITEM</th><th>SIZE</th><th>PLY</th><th>ORD QTY</th><th>ROLL</th><th>CUT</th>
      <th>MATERIAL</th><th>ROLL QTY</th><th>PROCESS</th><th>FINAL QTY</th>
    </tr></thead><tbody>${body || '<tr><td colspan="12" class="c">No jobs</td></tr>'}</tbody></table>
    <script>window.onload = () => { window.print(); };</script>
    </body></html>`);
  w.document.close();
}

export default function ProductionSheetPage() {
  const router = useRouter();
  const { businessId, loading: businessLoading } = useBusiness();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const today = getPakistanDate();
  const [view, setView] = useState<View>("open");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | JobStatus>("all");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const loadJobs = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;
    const byBusiness = businessId
      ? query(collection(db, PRODUCTION_COLLECTION), where("businessId", "==", businessId))
      : null;
    const byUser = query(
      collection(db, PRODUCTION_COLLECTION),
      where("userId", "==", user.uid),
      where("businessId", "==", null)
    );
    try {
      let snap;
      try {
        snap = await getDocs(byBusiness || byUser);
      } catch (err: unknown) {
        if ((err as { code?: string })?.code === "permission-denied" && byBusiness) {
          snap = await getDocs(byUser);
        } else {
          throw err;
        }
      }
      setRows(
        snap.docs.map((d) => {
          const data = d.data();
          return { ...normalizeJob(d.id, data), createdAtMs: data.createdAt?.toMillis?.() ?? 0 };
        })
      );
      setError("");
    } catch (err) {
      console.error("Error loading production jobs:", err);
      setError("Failed to load production jobs");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (businessLoading) return;
    loadJobs();
  }, [businessLoading, loadJobs]);

  // Newest date first; within a date keep entry order (like rows on the paper).
  const visible = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows
      .filter((r) => (view === "open" ? jobStatus(r) !== "delivered" : r.date >= fromDate && r.date <= toDate))
      .filter((r) => statusFilter === "all" || jobStatus(r) === statusFilter)
      .filter(
        (r) =>
          !s ||
          [r.partyName, r.item, r.size, r.material, ...r.deliveries.map((d) => d.challanNumber)]
            .join(" ")
            .toLowerCase()
            .includes(s)
      )
      .sort((a, b) => (a.date === b.date ? a.createdAtMs - b.createdAtMs : a.date < b.date ? 1 : -1));
  }, [rows, view, fromDate, toDate, statusFilter, search]);

  const selectedRows = rows.filter((r) => selected.has(r.id));
  const selectedParties = new Set(selectedRows.map((r) => r.customerId));
  const selectionProblem =
    selectedRows.length === 0
      ? "Select ready jobs to deliver"
      : selectedParties.size > 1
        ? "Selected jobs must be for the same party"
        : "";

  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** Tick/untick a stage right on the sheet. Stages that need a method open the job if none is set. */
  const toggleStage = async (row: Row, key: StageKey) => {
    const stage = row.stages[key] as { done: boolean; method?: string };
    const def = STAGES.find((s) => s.key === key)!;
    if (key === "printing" && row.stages.printing.method === "blank") return; // not needed
    if (!stage.done && def.extra === "method" && !stage.method) {
      router.push(`/production/${row.id}`);
      return;
    }
    const done = !stage.done;
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, stages: { ...r.stages, [key]: { ...r.stages[key], done } } } : r))
    );
    try {
      await updateDoc(doc(db, PRODUCTION_COLLECTION, row.id), {
        [`stages.${key}.done`]: done,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Error updating stage:", err);
      setError("Could not update the stage. Please try again.");
      loadJobs();
    }
  };

  const title =
    view === "open" ? `Open jobs — printed ${today}` : fromDate === toDate ? `Date: ${fromDate}` : `${fromDate} to ${toDate}`;

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Production Sheet</h1>
          <p className="text-sm text-text-secondary">Each row is one job. Tick stages as they are done.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => printSheet(visible, title)}
            className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-100 flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            Print
          </button>
          <Link
            href="/production/new"
            className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add Job
          </Link>
        </div>
      </div>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4 flex flex-wrap items-end gap-3">
        <div className="flex rounded-lg border overflow-hidden">
          {(["open", "date"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-4 py-2 text-sm ${view === v ? "bg-primary text-white" : "bg-white hover:bg-gray-50"}`}
            >
              {v === "open" ? "Open jobs" : "By date"}
            </button>
          ))}
        </div>
        {view === "date" && (
          <>
            <label className="text-sm">
              From
              <input type="date" className="block border p-1.5 rounded" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </label>
            <label className="text-sm">
              To
              <input type="date" className="block border p-1.5 rounded" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </label>
          </>
        )}
        <select
          className="border p-2 rounded text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | JobStatus)}
        >
          <option value="all">All statuses</option>
          {(Object.keys(STATUS_LABELS) as JobStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <input
          className="border p-2 rounded text-sm flex-1 min-w-[12rem]"
          placeholder="Search party, item, size, DC#…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Delivery action */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <button
          type="button"
          disabled={!!selectionProblem}
          onClick={() => router.push(`/delivery-challan/new?productionJobIds=${selectedRows.map((r) => r.id).join(",")}`)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
        >
          Create Delivery Challan{selectedRows.length ? ` (${selectedRows.length})` : ""}
        </button>
        <span className="text-sm text-gray-500">{selectionProblem || `For ${selectedRows[0]?.partyName}`}</span>
        {selected.size > 0 && (
          <button type="button" className="text-sm text-blue-600 hover:underline" onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        )}
      </div>

      {/* The sheet */}
      <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[1200px]">
          <thead>
            <tr className="bg-gray-100 text-gray-700 text-xs">
              <th className="p-2 w-8"></th>
              <th className="p-2 text-left">DATE</th>
              <th className="p-2 text-left">PARTY</th>
              <th className="p-2 text-left">ITEM</th>
              <th className="p-2 text-left">SIZE</th>
              <th className="p-2">PLY</th>
              <th className="p-2 text-right">ORD QTY</th>
              <th className="p-2">ROLL</th>
              <th className="p-2">CUT</th>
              <th className="p-2 text-left">MATERIAL</th>
              <th className="p-2 text-right">ROLL QTY</th>
              <th className="p-2 text-left">PROCESS</th>
              <th className="p-2 text-right">FINAL QTY</th>
              <th className="p-2 text-left">DC#</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={15} className="p-6 text-center text-gray-500">Loading…</td></tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={15} className="p-6 text-center text-gray-500">
                  {view === "open" ? "No open production jobs." : "No jobs for these dates."}{" "}
                  <Link href="/production/new" className="text-blue-600 hover:underline">Add a job</Link>
                </td>
              </tr>
            ) : (
              visible.map((r) => {
                const status = jobStatus(r);
                const deliverable = canDeliver(r);
                return (
                  <tr key={r.id} className="border-t align-top hover:bg-gray-50">
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        className="w-4 h-4"
                        disabled={!deliverable}
                        title={deliverable ? "Select for delivery challan" : "Tick REDY before delivering"}
                        checked={selected.has(r.id)}
                        onChange={() => toggleSelected(r.id)}
                      />
                    </td>
                    <td className="p-2 whitespace-nowrap">{r.date}</td>
                    <td className="p-2 font-medium">{r.partyName}</td>
                    <td className="p-2">{r.item}</td>
                    <td className="p-2 whitespace-nowrap">{r.size}</td>
                    <td className="p-2 text-center">{fmt(r.ply)}</td>
                    <td className="p-2 text-right">{fmt(r.orderQty)}</td>
                    <td className="p-2 text-center">{r.roll}</td>
                    <td className="p-2 text-center">{r.cut}</td>
                    <td className="p-2">{r.material}</td>
                    <td className="p-2 text-right">{fmt(r.rollQty)}</td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-1 max-w-[22rem]">
                        {STAGES.map((s) => {
                          const done = isStageComplete(r.stages, s.key);
                          const extra = stageMethodLabel(r.stages, s.key);
                          return (
                            <button
                              key={s.key}
                              type="button"
                              onClick={() => toggleStage(r, s.key)}
                              title={`${s.help}${extra ? ` — ${extra}` : ""}. Click to ${done ? "untick" : "tick"}.`}
                              className={`px-1.5 py-0.5 rounded border text-[11px] leading-tight ${
                                done ? "bg-green-100 border-green-400 text-green-800" : "bg-white border-gray-300 text-gray-500"
                              }`}
                            >
                              {done ? "✓ " : ""}
                              {s.label}
                              {extra ? <span className="opacity-70"> · {extra}</span> : null}
                            </button>
                          );
                        })}
                      </div>
                      <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[11px] font-semibold ${STATUS_STYLES[status]}`}>
                        {STATUS_LABELS[status]}
                      </span>
                    </td>
                    <td className="p-2 text-right">{fmt(r.finalQty)}</td>
                    <td className="p-2 text-xs">
                      {r.deliveries.map((d) => (
                        <div key={d.challanId}>
                          <Link href={`/delivery-challan/${d.challanId}`} className="text-blue-600 hover:underline">
                            {d.challanNumber}
                          </Link>{" "}
                          <span className="text-gray-500">({d.qty.toLocaleString()})</span>
                        </div>
                      ))}
                      {r.deliveries.length > 0 && jobRemainingQty(r) > 0 && (
                        <div className="text-orange-700">Left: {jobRemainingQty(r).toLocaleString()}</div>
                      )}
                    </td>
                    <td className="p-2 whitespace-nowrap text-right">
                      <Link href={`/production/${r.id}`} className="text-blue-600 hover:underline text-xs mr-2">Edit</Link>
                      <Link
                        href={`/production/new?from=${r.id}`}
                        className="text-gray-600 hover:underline text-xs"
                        title="Same party, item, ply and material — new size"
                      >
                        Duplicate
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
