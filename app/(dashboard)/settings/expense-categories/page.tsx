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

export default function ExpenseCategoriesPage() {
  const [name, setName] = useState("");
  const [categories, setCategories] = useState<any[]>([]);

  const loadCategories = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const snap = await getDocs(
      query(
        collection(db, "expenseCategories"),
        where("userId", "==", user.uid)
      )
    );

    setCategories(
      snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const addCategory = async () => {
    const user = auth.currentUser;
    if (!user || !name.trim()) return;

    await addDoc(collection(db, "expenseCategories"), {
      userId: user.uid,
      name: name.trim(),
      createdAt: serverTimestamp(),
    });

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
