"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useBusiness } from "@/hooks/useBusiness";
import { normalizeJob, PRODUCTION_COLLECTION } from "@/lib/production";
import ProductionJobForm, {
  emptyJobForm,
  formToFields,
  JobFormValues,
  validateJobForm,
} from "@/components/production/ProductionJobForm";

/** Keep what repeats down the paper sheet (the ditto rows); clear per-size fields. */
function nextSizeFrom(v: JobFormValues): JobFormValues {
  return {
    ...emptyJobForm(),
    date: v.date,
    customerId: v.customerId,
    partyName: v.partyName,
    item: v.item,
    ply: v.ply,
    material: v.material,
  };
}

export default function NewProductionJobPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromId = searchParams.get("from"); // "Duplicate" from the sheet
  const { businessId, loading: businessLoading } = useBusiness();

  const [values, setValues] = useState<JobFormValues>(emptyJobForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Pre-fill from the job being duplicated.
  useEffect(() => {
    if (!fromId) return;
    let cancelled = false;
    getDoc(doc(db, PRODUCTION_COLLECTION, fromId))
      .then((snap) => {
        if (cancelled || !snap.exists()) return;
        const j = normalizeJob(snap.id, snap.data());
        setValues(
          nextSizeFrom({
            ...emptyJobForm(),
            date: j.date,
            customerId: j.customerId,
            partyName: j.partyName,
            item: j.item,
            ply: j.ply === null ? "" : String(j.ply),
            material: j.material,
          })
        );
        setMessage(`Copied party, item, ply and material from ${j.partyName} — ${j.item} ${j.size}. Enter the new size.`);
      })
      .catch((err) => console.error("Error loading job to duplicate:", err));
    return () => {
      cancelled = true;
    };
  }, [fromId]);

  const save = async (addAnother: boolean) => {
    setError("");
    setMessage("");
    const problem = validateJobForm(values);
    if (problem) {
      setError(problem);
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      setError("Not logged in");
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, PRODUCTION_COLLECTION), {
        ...formToFields(values),
        businessId: businessId ?? null,
        userId: user.uid,
        deliveries: [],
        deliveredQty: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (addAnother) {
        setValues(nextSizeFrom(values));
        setMessage(`Saved ${values.item} ${values.size}. Enter the next size for ${values.partyName}.`);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        router.push("/production");
      }
    } catch (err: unknown) {
      console.error("Error saving production job:", err);
      const code = (err as { code?: string })?.code;
      setError(
        code === "permission-denied"
          ? "Permission denied: your account cannot add production jobs for this business. Please contact your administrator."
          : "Failed to save. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Add Production Job</h1>
        <p className="text-sm text-text-secondary">One row of the production sheet — one size of one item for one party.</p>
      </div>

      {message && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">{message}</div>}
      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(false);
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
            {saving ? "Saving..." : "Save job"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => save(true)}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
            title="Save, then keep the same party, item, ply and material for the next size"
          >
            Save &amp; add next size
          </button>
          <button
            type="button"
            onClick={() => router.push("/production")}
            className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
