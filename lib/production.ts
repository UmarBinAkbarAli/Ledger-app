/**
 * Production jobs — the digital version of the paper
 * "BOXILLA PACKAGES PRODUCTION SHEET".
 *
 * One job = one row on the paper sheet (one size of one item for one party).
 * Jobs flow: production stages → Delivery Challan(s) → Invoice.
 * Partial deliveries are tracked: a job keeps one entry per challan that
 * delivered some of it (deliveries[]), plus the running total (deliveredQty).
 */

import { deleteDoc, doc, getDoc, runTransaction, serverTimestamp, Transaction } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const PRODUCTION_COLLECTION = "productionJobs";

/* ------------------------------------------------------------------ */
/* Stages                                                              */
/* ------------------------------------------------------------------ */

export type StageKey = "roll" | "paper" | "cutting" | "printing" | "joining" | "ready";

export type CuttingMethod = "" | "die" | "manual";
export type PrintingMethod = "" | "flexo" | "professional" | "blank";
export type JoiningMethod = "" | "tar" | "zp";

export interface ProductionStages {
  roll: { done: boolean; source: string };
  paper: { done: boolean; source: string };
  cutting: { done: boolean; method: CuttingMethod };
  printing: { done: boolean; method: PrintingMethod };
  joining: { done: boolean; method: JoiningMethod };
  ready: { done: boolean };
}

interface StageOption {
  value: string;
  label: string;
}

interface StageDef {
  key: StageKey;
  /** Label as printed on the paper sheet */
  label: string;
  /** Plain-language meaning, shown as a tooltip/help text */
  help: string;
  /** "source" = free text (where the material came from); "method" = dropdown */
  extra?: "source" | "method";
  options?: StageOption[];
}

/** In the same order as the PROCESS column on the paper sheet. */
export const STAGES: StageDef[] = [
  { key: "roll", label: "ROLL", help: "Roll (reel) issued", extra: "source" },
  { key: "paper", label: "PAPER", help: "Paper issued", extra: "source" },
  {
    key: "cutting",
    label: "DAI/MUN",
    help: "Cutting — die-cutting or manual",
    extra: "method",
    options: [
      { value: "die", label: "Die-cutting" },
      { value: "manual", label: "Manual" },
    ],
  },
  {
    key: "printing",
    label: "PRIN",
    help: "Printing — Flexo, Professional, or Blank (no printing)",
    extra: "method",
    options: [
      { value: "flexo", label: "Flexo" },
      { value: "professional", label: "Professional" },
      { value: "blank", label: "Blank (no printing)" },
    ],
  },
  {
    key: "joining",
    label: "TAR/Z-P",
    help: "Joining — TAR (pins) or Z-P (glue)",
    extra: "method",
    options: [
      { value: "tar", label: "TAR (pins)" },
      { value: "zp", label: "Z-P (glue)" },
    ],
  },
  { key: "ready", label: "REDY", help: "Ready for delivery" },
];

export function emptyStages(): ProductionStages {
  return {
    roll: { done: false, source: "" },
    paper: { done: false, source: "" },
    cutting: { done: false, method: "" },
    printing: { done: false, method: "" },
    joining: { done: false, method: "" },
    ready: { done: false },
  };
}

/** Short label for a stage's chosen option, e.g. "Die", "Flexo", "TAR". */
export function stageMethodLabel(stages: ProductionStages, key: StageKey): string {
  const s = stages[key] as { method?: string; source?: string };
  if (s.method) {
    const opt = STAGES.find((d) => d.key === key)?.options?.find((o) => o.value === s.method);
    return opt ? opt.label.replace(/ \(.*\)$/, "") : s.method;
  }
  return s.source || "";
}

/** A stage counts as complete when ticked, or when printing is "Blank" (not needed). */
export function isStageComplete(stages: ProductionStages, key: StageKey): boolean {
  if (key === "printing" && stages.printing.method === "blank") return true;
  return !!stages[key].done;
}

export function stageProgress(stages: ProductionStages): { done: number; total: number } {
  return { done: STAGES.filter((s) => isStageComplete(stages, s.key)).length, total: STAGES.length };
}

/* ------------------------------------------------------------------ */
/* Job                                                                 */
/* ------------------------------------------------------------------ */

export interface ProductionDelivery {
  challanId: string;
  challanNumber: string;
  date: string;
  qty: number;
}

export interface ProductionJob {
  id: string;
  businessId: string | null;
  userId: string;
  date: string; // YYYY-MM-DD (Pakistan time)
  customerId: string;
  partyName: string;
  item: string;
  size: string; // free text so fractions like 11½ work
  ply: number | null;
  orderQty: number | null;
  roll: string;
  cut: string;
  material: string;
  rollQty: number | null;
  stages: ProductionStages;
  finalQty: number | null;
  deliveries: ProductionDelivery[];
  deliveredQty: number;
  notes: string;
}

/** Firestore data → ProductionJob, tolerating missing/old fields. */
export function normalizeJob(id: string, d: Record<string, unknown>): ProductionJob {
  const num = (v: unknown): number | null =>
    v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v);
  const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
  const base = emptyStages();
  const s = (d.stages || {}) as Partial<Record<StageKey, Record<string, unknown>>>;
  const stages: ProductionStages = {
    roll: { done: !!s.roll?.done, source: str(s.roll?.source) },
    paper: { done: !!s.paper?.done, source: str(s.paper?.source) },
    cutting: { done: !!s.cutting?.done, method: (str(s.cutting?.method) as CuttingMethod) || base.cutting.method },
    printing: { done: !!s.printing?.done, method: (str(s.printing?.method) as PrintingMethod) || base.printing.method },
    joining: { done: !!s.joining?.done, method: (str(s.joining?.method) as JoiningMethod) || base.joining.method },
    ready: { done: !!s.ready?.done },
  };
  const deliveries = Array.isArray(d.deliveries)
    ? (d.deliveries as Record<string, unknown>[]).map((x) => ({
        challanId: str(x.challanId),
        challanNumber: str(x.challanNumber),
        date: str(x.date),
        qty: Number(x.qty) || 0,
      }))
    : [];
  return {
    id,
    businessId: (d.businessId as string | null) ?? null,
    userId: str(d.userId),
    date: str(d.date),
    customerId: str(d.customerId),
    partyName: str(d.partyName),
    item: str(d.item),
    size: str(d.size),
    ply: num(d.ply),
    orderQty: num(d.orderQty),
    roll: str(d.roll),
    cut: str(d.cut),
    material: str(d.material),
    rollQty: num(d.rollQty),
    stages,
    finalQty: num(d.finalQty),
    deliveries,
    deliveredQty: deliveries.reduce((sum, x) => sum + x.qty, 0),
    notes: str(d.notes),
  };
}

/** Quantity to deliver: the final produced qty once known, else the ordered qty. */
export function jobTargetQty(job: ProductionJob): number {
  return job.finalQty ?? job.orderQty ?? 0;
}

export function jobRemainingQty(job: ProductionJob): number {
  return Math.max(0, jobTargetQty(job) - job.deliveredQty);
}

export type JobStatus = "pending" | "in_production" | "ready" | "partial" | "delivered";

export function jobStatus(job: ProductionJob): JobStatus {
  const target = jobTargetQty(job);
  if (target > 0 && job.deliveredQty >= target) return "delivered";
  if (job.deliveredQty > 0) return "partial";
  if (job.stages.ready.done) return "ready";
  if (STAGES.some((s) => job.stages[s.key].done)) return "in_production";
  return "pending";
}

export const STATUS_LABELS: Record<JobStatus, string> = {
  pending: "Pending",
  in_production: "In production",
  ready: "Ready",
  partial: "Partly delivered",
  delivered: "Delivered",
};

export const STATUS_STYLES: Record<JobStatus, string> = {
  pending: "bg-gray-100 text-gray-700",
  in_production: "bg-yellow-100 text-yellow-800",
  ready: "bg-green-100 text-green-800",
  partial: "bg-blue-100 text-blue-800",
  delivered: "bg-slate-200 text-slate-700",
};

/** Can (more of) this job go on a delivery challan? */
export function canDeliver(job: ProductionJob): boolean {
  return jobRemainingQty(job) > 0 && (job.stages.ready.done || job.deliveredQty > 0);
}

/** Item line for the delivery challan, e.g. "Perfume box 11½×9×5½ 3-ply". */
export function challanDescription(job: ProductionJob): string {
  return [job.item, job.size, job.ply ? `${job.ply}-ply` : ""].filter(Boolean).join(" ").trim();
}

/* ------------------------------------------------------------------ */
/* Challan ↔ job sync                                                  */
/* ------------------------------------------------------------------ */

export interface ChallanItemLike {
  description?: string;
  qty: number | string;
  productionJobId?: string | null;
}

/** True if any item is linked to a production job. */
export function hasProductionLinks(...itemLists: (ChallanItemLike[] | undefined)[]): boolean {
  return itemLists.some((list) => (list || []).some((it) => !!it.productionJobId));
}

/**
 * Inside a Firestore transaction: make every affected job's deliveries reflect
 * this challan's current items. Pass previousItems when editing (and [] as
 * newItems when deleting) so jobs that were removed from the challan are
 * cleaned up too. Performs all reads first, then writes, so callers may add
 * their own writes (e.g. the challan itself) after awaiting this.
 */
export async function syncJobDeliveriesInTx(
  tx: Transaction,
  params: {
    challanId: string;
    challanNumber: string;
    date: string;
    newItems: ChallanItemLike[];
    previousItems?: ChallanItemLike[];
  }
): Promise<void> {
  const { challanId, challanNumber, date, newItems, previousItems = [] } = params;

  const qtyByJob = new Map<string, number>();
  for (const it of newItems) {
    if (!it.productionJobId) continue;
    qtyByJob.set(it.productionJobId, (qtyByJob.get(it.productionJobId) || 0) + (Number(it.qty) || 0));
  }
  const jobIds = new Set<string>([
    ...qtyByJob.keys(),
    ...previousItems.map((it) => it.productionJobId).filter((x): x is string => !!x),
  ]);

  // Reads first (transaction rule)
  const snaps = await Promise.all(
    [...jobIds].map(async (id) => ({ id, snap: await tx.get(doc(db, PRODUCTION_COLLECTION, id)) }))
  );

  for (const { id, snap } of snaps) {
    if (!snap.exists()) continue; // job deleted meanwhile — nothing to update
    const job = normalizeJob(id, snap.data());
    const deliveries = job.deliveries.filter((x) => x.challanId !== challanId);
    const qty = qtyByJob.get(id) || 0;
    if (qty > 0) deliveries.push({ challanId, challanNumber, date, qty });
    tx.update(snap.ref, {
      deliveries,
      deliveredQty: deliveries.reduce((sum, x) => sum + x.qty, 0),
      updatedAt: serverTimestamp(),
    });
  }
}

/**
 * Delete a delivery challan. If any of its items came from production jobs,
 * the delete runs in a transaction that also removes those deliveries from the
 * jobs. Challans without production links keep the plain (offline-friendly) delete.
 */
export async function deleteChallanWithProductionSync(challanId: string): Promise<void> {
  const challanRef = doc(db, "deliveryChallans", challanId);
  const snap = await getDoc(challanRef);
  const items = ((snap.exists() ? snap.data().items : []) || []) as ChallanItemLike[];
  if (!hasProductionLinks(items)) {
    await deleteDoc(challanRef);
    return;
  }
  await runTransaction(db, async (tx) => {
    const fresh = await tx.get(challanRef);
    if (!fresh.exists()) return;
    const data = fresh.data();
    await syncJobDeliveriesInTx(tx, {
      challanId,
      challanNumber: data.challanNumber || "",
      date: data.date || "",
      newItems: [],
      previousItems: (data.items || []) as ChallanItemLike[],
    });
    tx.delete(challanRef);
  });
}
