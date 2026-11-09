"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { deleteDoc, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useBusiness } from "@/hooks/useBusiness";
import {
  canDeliver,
  jobRemainingQty,
  jobStatus,
  jobTargetQty,
  normalizeJob,
  PRODUCTION_COLLECTION,
  ProductionJob,
  STATUS_LABELS,
  STATUS_STYLES,
} from "@/lib/production";
import ProductionJobForm, {
  formToFields,
  JobFormValues,
  jobToForm,
  validateJobForm,
} from "@/components/production/ProductionJobForm";

export default function EditProductionJobPage() {
  const router = useRouter();
  const { jobId } = useParams<{ jobId: string }>();
  const { businessId, loading: businessLoading } = useBusiness();

  const [job, setJob] = useState<ProductionJob | null>(null);
  const [values, setValues] = useState<JobFormValues | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    getDoc(doc(db, PRODUCTION_COLLECTION, jobId))
      .then((snap) => {
        if (cancelled) return;
        if (!snap.exists()) {
          setLoadError("Production job not found");
          return;
        }
        const j = normalizeJob(snap.id, snap.data());
        setJob(j);
        setValues(jobToForm(j));
      })
      .catch((err) => {
        console.error("Error loading production job:", err);
        if (!cancelled) setLoadError("Failed to load production job");
      });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const save = async () => {
    if (!values || !job) return;
    setError("");
    setMessage("");
    const problem = validateJobForm(values);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    try {
      // Only the editable fields — deliveries are maintained by challans.
      const fields = formToFields(values);
      await updateDoc(doc(db, PRODUCTION_COLLECTION, job.id), { ...fields, updatedAt: serverTimestamp() });
      setJob({ ...job, ...fields });
      setMessage("Saved");
    } catch (err) {
      console.error("Error saving production job:", err);
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!job) return;
    if (job.deliveries.length > 0) {
      setError("This job is on a delivery challan. Delete or edit the challan first.");
      return;
    }
    if (!confirm(`Delete production job ${job.partyName} — ${job.item} ${job.size}?`)) return;
    try {
      await deleteDoc(doc(db, PRODUCTION_COLLECTION, job.id));
      router.push("/production");
    } catch (err) {
      console.error("Error deleting production job:", err);
      setError("Failed to delete.");
    }
  };

  if (loadError) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">{loadError}</div>
        <Link href="/production" className="inline-block mt-4 text-blue-600 hover:underline">Back to Production Sheet</Link>
      </div>
    );
  }
  if (!job || !values) {
    return <div className="p-6 max-w-6xl mx-auto">Loading...</div>;
  }

  const status = jobStatus(job);
  const target = jobTargetQty(job);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {job.partyName} — {job.item} {job.size}
          </h1>
          <span className={`inline-block mt-2 px-2 py-1 rounded text-xs font-semibold ${STATUS_STYLES[status]}`}>
            {STATUS_LABELS[status]}
          </span>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/production/new?from=${job.id}`}
            className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-100 text-sm"
          >
            Duplicate (next size)
          </Link>
          {canDeliver(job) && (
            <Link
              href={`/delivery-challan/new?productionJobIds=${job.id}`}
              className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark text-sm"
            >
              Create Delivery Challan
            </Link>
          )}
        </div>
      </div>

      {message && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">{message}</div>}
      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

      {/* Deliveries (DC#) */}
      <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3 text-text-primary">Deliveries (DC#)</h2>
        <div className="flex flex-wrap gap-6 text-sm mb-3">
          <span>To deliver: <strong>{target.toLocaleString()}</strong>{job.finalQty === null && target > 0 ? " (ord qty)" : ""}</span>
          <span>Delivered: <strong>{job.deliveredQty.toLocaleString()}</strong></span>
          <span>Remaining: <strong>{jobRemainingQty(job).toLocaleString()}</strong></span>
        </div>
        {job.deliveries.length === 0 ? (
          <p className="text-sm text-gray-500">Not on any delivery challan yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-2">DC#</th>
                <th className="p-2">Date</th>
                <th className="p-2 text-right">Qty</th>
              </tr>
            </thead>
            <tbody>
              {job.deliveries.map((d) => (
                <tr key={d.challanId} className="border-b">
                  <td className="p-2">
                    <Link href={`/delivery-challan/${d.challanId}`} className="text-blue-600 hover:underline">
                      {d.challanNumber || d.challanId}
                    </Link>
                  </td>
                  <td className="p-2">{d.date}</td>
                  <td className="p-2 text-right">{d.qty.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <ProductionJobForm
          values={values}
          onChange={setValues}
          businessId={businessId}
          businessLoading={businessLoading}
        />
        <div className="flex flex-wrap gap-3 mt-6">
          <button
            type="submit"
            disabled={saving}
            className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary-dark disabled:bg-gray-400"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/production")}
            className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300"
          >
            Back to sheet
          </button>
          <button
            type="button"
            onClick={remove}
            className="ml-auto text-red-600 hover:text-red-800 px-4 py-2"
          >
            Delete job
          </button>
        </div>
      </form>
    </div>
  );
}
