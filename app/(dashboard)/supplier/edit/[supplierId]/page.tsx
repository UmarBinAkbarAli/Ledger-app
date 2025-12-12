"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";

export default function EditSupplierPage() {
  const router = useRouter();
  const params = useParams() as { supplierId?: string };
  const supplierId = params.supplierId ?? "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [previousBalance, setPreviousBalance] = useState("");

  /* ---------------------------------------------
      Load Supplier Data
  ----------------------------------------------*/
  useEffect(() => {
    const load = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setError("Not authenticated");
          return;
        }

        const ref = doc(db, "suppliers", supplierId);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setError("Supplier not found");
          return;
        }

        const data: any = snap.data();

        setName(data.name || "");
        setCompany(data.company || "");
        setPhone(data.phone || "");
        setAddress(data.address || "");
        setPreviousBalance(data.previousBalance || 0);
      } catch (err) {
        console.error(err);
        setError("Failed to load supplier");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [supplierId]);

  /* ---------------------------------------------
      Update Supplier
  ----------------------------------------------*/
  const handleUpdate = async (e: any) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const ref = doc(db, "suppliers", supplierId);

      await updateDoc(ref, {
        name,
        company,
        phone,
        address,
        previousBalance: Number(previousBalance) || 0,
      });

      setMessage("Supplier updated successfully!");

      setTimeout(() => {
        router.push("/supplier"); // Redirect to Supplier List
      }, 800);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    }

    setSaving(false);
  };

  /* ---------------------------------------------
      UI
  ----------------------------------------------*/
  if (loading) return <p className="p-6">Loading supplier...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;

  return (
    <div className="max-w-xl mx-auto bg-white p-6 rounded-xl shadow">
      <h1 className="text-3xl font-bold mb-2">Edit Supplier</h1>
      <p className="text-gray-600 mb-6">Update supplier details below.</p>

      {message && <p className="text-green-600 mb-4">{message}</p>}
      {error && <p className="text-red-600 mb-4">{error}</p>}

      <form onSubmit={handleUpdate} className="space-y-5">

        {/* SECTION: Basic Info */}
        <div>
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Basic Information</h2>
          <div className="space-y-4">

            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">Supplier Name *</label>
              <input
                type="text"
                className="w-full border p-2 rounded"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">Company (optional)</label>
              <input
                type="text"
                className="w-full border p-2 rounded"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>

          </div>
        </div>

        {/* SECTION: Contact */}
        <div>
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Contact Details</h2>
          <div className="space-y-4">

            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">Phone</label>
              <input
                type="text"
                className="w-full border p-2 rounded"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">Address</label>
              <input
                type="text"
                className="w-full border p-2 rounded"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

          </div>
        </div>

        {/* SECTION: Financial */}
        <div>
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Financial Settings</h2>
          <div className="space-y-4">

            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">Previous Balance</label>
              <input
                type="number"
                className="w-full border p-2 rounded"
                value={previousBalance}
                onChange={(e) => setPreviousBalance(e.target.value)}
              />
            </div>

          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 text-lg font-semibold"
        >
          {saving ? "Saving..." : "Update Supplier"}
        </button>

      </form>
    </div>
  );
}
