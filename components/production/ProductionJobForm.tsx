"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { getPakistanDate } from "@/lib/dateUtils";
import {
  emptyStages,
  ProductionJob,
  ProductionStages,
  STAGES,
  StageKey,
  isStageComplete,
} from "@/lib/production";

/** Editable fields of a job (everything except ids/tenant/deliveries). */
export interface JobFormValues {
  date: string;
  customerId: string;
  partyName: string;
  item: string;
  size: string;
  ply: string;
  orderQty: string;
  roll: string;
  cut: string;
  material: string;
  rollQty: string;
  stages: ProductionStages;
  finalQty: string;
  notes: string;
}

export function emptyJobForm(): JobFormValues {
  return {
    date: getPakistanDate(),
    customerId: "",
    partyName: "",
    item: "",
    size: "",
    ply: "3",
    orderQty: "",
    roll: "",
    cut: "",
    material: "",
    rollQty: "",
    stages: emptyStages(),
    finalQty: "",
    notes: "",
  };
}

export function jobToForm(job: ProductionJob): JobFormValues {
  const s = (n: number | null) => (n === null ? "" : String(n));
  return {
    date: job.date,
    customerId: job.customerId,
    partyName: job.partyName,
    item: job.item,
    size: job.size,
    ply: s(job.ply),
    orderQty: s(job.orderQty),
    roll: job.roll,
    cut: job.cut,
    material: job.material,
    rollQty: s(job.rollQty),
    stages: job.stages,
    finalQty: s(job.finalQty),
    notes: job.notes,
  };
}

/** Form values → Firestore fields (numbers parsed; blanks become null). */
export function formToFields(v: JobFormValues) {
  const num = (x: string) => {
    const t = x.trim().replace(",", ".");
    return t === "" || Number.isNaN(Number(t)) ? null : Number(t);
  };
  return {
    date: v.date,
    customerId: v.customerId,
    partyName: v.partyName.trim(),
    item: v.item.trim(),
    size: v.size.trim(),
    ply: num(v.ply),
    orderQty: num(v.orderQty),
    roll: v.roll.trim(),
    cut: v.cut.trim(),
    material: v.material.trim(),
    rollQty: num(v.rollQty),
    stages: v.stages,
    finalQty: num(v.finalQty),
    notes: v.notes.trim(),
  };
}

export function validateJobForm(v: JobFormValues): string | null {
  if (!v.date) return "Please choose a date";
  if (!v.customerId) return "Please select a party from the list";
  if (!v.item.trim()) return "Please enter the item";
  if (!v.size.trim()) return "Please enter the size";
  const bad = (x: string) => x.trim() !== "" && Number.isNaN(Number(x.trim().replace(",", ".")));
  if (bad(v.orderQty)) return "Order qty must be a number";
  if (bad(v.rollQty)) return "Roll qty must be a number";
  if (bad(v.finalQty)) return "Final qty must be a number";
  if (bad(v.ply)) return "Ply must be a number";
  return null;
}

interface Party {
  id: string;
  label: string; // company, or name when company is empty
}

/** Loads parties (customers) and supplier names for the current tenant. */
function useLookups(businessId: string | null, businessLoading: boolean) {
  const [parties, setParties] = useState<Party[]>([]);
  const [supplierNames, setSupplierNames] = useState<string[]>([]);

  useEffect(() => {
    if (businessLoading) return;
    const user = auth.currentUser;
    if (!user) return;
    let cancelled = false;
    const scope = businessId
      ? [where("businessId", "==", businessId)]
      : [where("userId", "==", user.uid), where("businessId", "==", null)];

    (async () => {
      try {
        const [c, s] = await Promise.all([
          getDocs(query(collection(db, "customers"), ...scope)),
          getDocs(query(collection(db, "suppliers"), ...scope)).catch(() => null),
        ]);
        if (cancelled) return;
        setParties(
          c.docs
            .map((d) => ({ id: d.id, label: (d.data().company || d.data().name || "").toString() }))
            .filter((p) => p.label)
            .sort((a, b) => a.label.localeCompare(b.label))
        );
        setSupplierNames(
          [...new Set((s?.docs || []).map((d) => (d.data().company || d.data().name || "").toString()).filter(Boolean))].sort()
        );
      } catch (err) {
        console.error("Error loading parties/suppliers:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId, businessLoading]);

  return { parties, supplierNames };
}

const input = "w-full border border-gray-300 p-2 rounded";
const label = "block text-xs font-semibold text-gray-600 mb-1 tracking-wide";

/** Small button that appends "½" — sizes/cuts on the paper sheet use fractions. */
function HalfButton({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="shrink-0 border border-gray-300 rounded px-2 text-sm hover:bg-gray-100"
      title="Add ½"
    >
      ½
    </button>
  );
}

export default function ProductionJobForm({
  values,
  onChange,
  businessId,
  businessLoading,
}: {
  values: JobFormValues;
  onChange: (next: JobFormValues) => void;
  businessId: string | null;
  businessLoading: boolean;
}) {
  const { parties, supplierNames } = useLookups(businessId, businessLoading);
  const [partySearch, setPartySearch] = useState("");
  const [showParties, setShowParties] = useState(false);

  const set = <K extends keyof JobFormValues>(key: K, value: JobFormValues[K]) =>
    onChange({ ...values, [key]: value });

  const setStage = (key: StageKey, patch: Record<string, unknown>) =>
    onChange({ ...values, stages: { ...values.stages, [key]: { ...values.stages[key], ...patch } } });

  const partyText = showParties ? partySearch : values.partyName;
  const filteredParties = useMemo(() => {
    const s = partySearch.trim().toLowerCase();
    return (s ? parties.filter((p) => p.label.toLowerCase().includes(s)) : parties).slice(0, 50);
  }, [partySearch, parties]);

  return (
    <div className="space-y-6">
      {/* Job details — same order as the paper sheet */}
      <section className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4 text-text-primary">Job details</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className={label}>DATE *</label>
            <input type="date" className={input} value={values.date} onChange={(e) => set("date", e.target.value)} required />
          </div>

          <div className="relative md:col-span-2">
            <label className={label}>PARTY *</label>
            <input
              type="text"
              className={input}
              placeholder="Search party (company)"
              value={partyText}
              onFocus={() => {
                setPartySearch("");
                setShowParties(true);
              }}
              onBlur={() => setTimeout(() => setShowParties(false), 150)}
              onChange={(e) => {
                setPartySearch(e.target.value);
                setShowParties(true);
              }}
            />
            {showParties && filteredParties.length > 0 && (
              <div className="absolute z-20 bg-white border border-gray-300 rounded mt-1 w-full max-h-56 overflow-y-auto shadow-lg">
                {filteredParties.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange({ ...values, customerId: p.id, partyName: p.label });
                      setShowParties(false);
                    }}
                    className="block w-full text-left px-3 py-2 hover:bg-blue-50"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
            {!values.customerId && values.partyName === "" && (
              <p className="text-xs text-gray-500 mt-1">Pick from your Customers list.</p>
            )}
          </div>

          <div>
            <label className={label}>ITEM *</label>
            <input className={input} placeholder="e.g. Perfume box" value={values.item} onChange={(e) => set("item", e.target.value)} />
          </div>

          <div className="md:col-span-2">
            <label className={label}>SIZE * (L × W × H)</label>
            <div className="flex gap-2">
              <input className={input} placeholder="e.g. 11½×9×5½" value={values.size} onChange={(e) => set("size", e.target.value)} />
              <HalfButton onAdd={() => set("size", values.size + "½")} />
              <button
                type="button"
                onClick={() => set("size", values.size + "×")}
                className="shrink-0 border border-gray-300 rounded px-2 text-sm hover:bg-gray-100"
                title="Add ×"
              >
                ×
              </button>
            </div>
          </div>

          <div>
            <label className={label}>PLY</label>
            <select className={input} value={values.ply} onChange={(e) => set("ply", e.target.value)}>
              <option value="">—</option>
              {["3", "5", "7", "9"].map((p) => (
                <option key={p} value={p}>{p} ply</option>
              ))}
            </select>
          </div>

          <div>
            <label className={label}>ORD QTY</label>
            <input className={input} inputMode="numeric" value={values.orderQty} onChange={(e) => set("orderQty", e.target.value)} />
          </div>

          <div>
            <label className={label}>ROLL</label>
            <input className={input} placeholder="e.g. 31" value={values.roll} onChange={(e) => set("roll", e.target.value)} />
          </div>

          <div>
            <label className={label}>CUT</label>
            <div className="flex gap-2">
              <input className={input} placeholder="e.g. 43½" value={values.cut} onChange={(e) => set("cut", e.target.value)} />
              <HalfButton onAdd={() => set("cut", values.cut + "½")} />
            </div>
          </div>

          <div>
            <label className={label}>MATERIAL</label>
            <input className={input} placeholder="e.g. B/S/MG" value={values.material} onChange={(e) => set("material", e.target.value)} />
          </div>

          <div>
            <label className={label}>ROLL QTY</label>
            <input className={input} inputMode="decimal" value={values.rollQty} onChange={(e) => set("rollQty", e.target.value)} />
          </div>
        </div>
      </section>

      {/* Process — one line per stage, like the PROCESS column */}
      <section className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-1 text-text-primary">Process</h2>
        <p className="text-sm text-gray-500 mb-4">Tick each stage when it is done.</p>
        <datalist id="production-sources">
          {supplierNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <div className="divide-y border rounded">
          {STAGES.map((st) => {
            const stage = values.stages[st.key] as { done: boolean; method?: string; source?: string };
            const complete = isStageComplete(values.stages, st.key);
            const notNeeded = st.key === "printing" && values.stages.printing.method === "blank";
            return (
              <div key={st.key} className={`flex flex-wrap items-center gap-3 p-3 ${complete ? "bg-green-50" : ""}`}>
                <label className="flex items-center gap-2 w-40 cursor-pointer" title={st.help}>
                  <input
                    type="checkbox"
                    className="w-5 h-5"
                    checked={notNeeded || stage.done}
                    disabled={notNeeded}
                    onChange={(e) => setStage(st.key, { done: e.target.checked })}
                  />
                  <span className="font-semibold">{st.label}</span>
                </label>
                <span className="text-sm text-gray-500 w-56">{st.help}</span>
                {st.extra === "source" && (
                  <input
                    className="border border-gray-300 p-2 rounded flex-1 min-w-[12rem]"
                    list="production-sources"
                    placeholder="From where? (supplier)"
                    value={stage.source || ""}
                    onChange={(e) => setStage(st.key, { source: e.target.value })}
                  />
                )}
                {st.extra === "method" && (
                  <select
                    className="border border-gray-300 p-2 rounded flex-1 min-w-[12rem]"
                    value={stage.method || ""}
                    onChange={(e) => setStage(st.key, { method: e.target.value })}
                  >
                    <option value="">Select…</option>
                    {st.options!.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                )}
                {notNeeded && <span className="text-xs text-gray-500">Not needed (blank)</span>}
              </div>
            );
          })}
        </div>
      </section>

      {/* Final */}
      <section className="bg-white rounded-lg shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className={label}>FINAL QTY</label>
            <input
              className={input}
              inputMode="numeric"
              placeholder="Produced qty"
              value={values.finalQty}
              onChange={(e) => set("finalQty", e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">Leave empty to deliver against ORD QTY.</p>
          </div>
          <div className="md:col-span-3">
            <label className={label}>NOTES</label>
            <input className={input} value={values.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>
      </section>
    </div>
  );
}
