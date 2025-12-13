"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export default function CreateUserPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"sales" | "accountant">("sales");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async (e: any) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const admin = auth.currentUser;
      if (!admin) throw new Error("Not authenticated");

      const cred = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid,
        email,
        name,
        role,
        createdAt: serverTimestamp(),
        createdBy: admin.uid,
      });

      setEmail("");
      setPassword("");
      setName("");
      setRole("sales");
      alert("User created successfully");
    } catch (err: any) {
      setError(err.message);
    }

    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded shadow">
      <h1 className="text-xl font-bold mb-4">Create User</h1>

      {error && <p className="text-red-600 mb-3">{error}</p>}

      <form onSubmit={handleCreate} className="space-y-4">
        <input
          className="w-full border p-2 rounded"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <input
          type="email"
          className="w-full border p-2 rounded"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          className="w-full border p-2 rounded"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <select
          className="w-full border p-2 rounded"
          value={role}
          onChange={(e) =>
            setRole(e.target.value as "sales" | "accountant")
          }
        >
          <option value="sales">Sales</option>
          <option value="accountant">Accountant</option>
        </select>

        <button
          disabled={loading}
          className="w-full bg-blue-600 text-white p-3 rounded"
        >
          {loading ? "Creating..." : "Create User"}
        </button>
      </form>
    </div>
  );
}
