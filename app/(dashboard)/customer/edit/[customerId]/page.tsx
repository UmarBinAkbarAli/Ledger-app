"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import {
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";

export default function EditCustomerPage() {
  const router = useRouter();
  const params = useParams() as { customerId?: string };
  const customerId = params.customerId ?? "";

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
      Load Existing Customer Data
  ----------------------------------------------*/
  useEffect(() => {
    const load = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setError("Not authenticated");
          return;
        }

        const ref = doc(db, "customers", customerId);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setError("Customer not found");
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
        setError("Failed to load customer");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [customerId]);

  /* ---------------------------------------------
      Update Customer
  ----------------------------------------------*/
  const handleUpdate = async (e: any) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const ref = doc(db, "customers", customerId);

      await updateDoc(ref, {
        name,
        company,
        phone,
        address,
        previousBalance: Number(previousBalance) || 0,
      });

      setMessage("Customer updated successfully!");

      setTimeout(() => {
        router.push("/customers");
      }, 900);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    }

    setSaving(false);
  };

  if (loading) return <p className="p-6">Loading customer...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;

  return (
    <div className="max-w-xl mx-auto bg-white p-6 rounded-xl shadow">
      <h1 className="text-2xl font-bold mb-4">Edit Customer</h1>

      {message && <p className="text-green-600">{message}</p>}
      {error && <p className="text-red-600">{error}</p>}

      <form onSubmit={handleUpdate} className="space-y-4">

        <input
          type="text"
          placeholder="Customer Name"
          className="w-full border p-2 rounded"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <input
          type="text"
          placeholder="Company (optional)"
          className="w-full border p-2 rounded"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />

        <input
          type="text"
          placeholder="Phone (optional)"
          className="w-full border p-2 rounded"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        <input
          type="text"
          placeholder="Address (optional)"
          className="w-full border p-2 rounded"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />

        <input
          type="number"
          placeholder="Previous Balance"
          className="w-full border p-2 rounded"
          value={previousBalance}
          onChange={(e) => setPreviousBalance(e.target.value)}
        />

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 text-white p-3 rounded hover:bg-blue-700"
        >
          {saving ? "Saving..." : "Update Customer"}
        </button>

      </form>
    </div>
  );
}
