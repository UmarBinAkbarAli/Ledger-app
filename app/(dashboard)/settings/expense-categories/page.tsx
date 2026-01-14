"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useBusiness } from "@/hooks/useBusiness";

export default function ExpenseCategoriesPage() {
  const [name, setName] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const { businessId, loading: businessLoading } = useBusiness();

  const loadCategories = async () => {
    const user = auth.currentUser;
    if (!user) return;
    if (businessLoading) return;

    const scopeField = businessId ? "businessId" : "userId";
    const scopeValue = businessId || user.uid;
    let snap;
    try {
      snap = await getDocs(
        query(
          collection(db, "expenseCategories"),
          where(scopeField, "==", scopeValue)
        )
      );
    } catch (err: any) {
      if (err?.code === "permission-denied" && businessId) {
        console.warn("Business-scoped query denied; retrying with userId scope", {
          collectionName: "expenseCategories",
          userId: user.uid,
          businessId,
        });
        snap = await getDocs(
          query(
            collection(db, "expenseCategories"),
            where("userId", "==", user.uid)
          )
        );
      } else {
        throw err;
      }
    }

    setCategories(
      snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );
  };

  useEffect(() => {
    loadCategories();
  }, [businessId, businessLoading]);

  const addCategory = async () => {
    const user = auth.currentUser;
    if (!user || !name.trim()) return;
    if (businessLoading) return;

    const createPayload: Record<string, any> = {
      userId: user.uid,
      name: name.trim(),
      createdAt: serverTimestamp(),
    };
    if (businessId) {
      createPayload.businessId = businessId;
    }
    await addDoc(collection(db, "expenseCategories"), createPayload);

    setName("");
    loadCategories();
  };

  const removeCategory = async (id: string) => {
    await deleteDoc(doc(db, "expenseCategories", id));
    loadCategories();
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold mb-4">Expense Categories</h1>

      <div className="flex gap-2 mb-4">
        <input
          className="flex-1 border p-2 rounded"
          placeholder="Category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          onClick={addCategory}
          className="bg-black text-white px-4 rounded"
        >
          Add
        </button>
      </div>

      <ul className="border rounded">
        {categories.map((c) => (
          <li
            key={c.id}
            className="flex justify-between items-center p-2 border-b last:border-b-0"
          >
            <span>{c.name}</span>
            <button
              onClick={() => removeCategory(c.id)}
              className="text-red-600 text-sm"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
