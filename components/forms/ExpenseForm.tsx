"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  updateDoc,
  doc,
  increment,
} from "firebase/firestore";

export default function ExpenseForm({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<any[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [expenseType, setExpenseType] = useState<"SUPPLIER" | "OPERATIONAL">("SUPPLIER");
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [message, setMessage] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK">("CASH");
  const [bankName, setBankName] = useState("");
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [notes, setNotes] = useState("");


  useEffect(() => {
  const user = auth.currentUser;
  if (!user) return;

  const loadCategories = async () => {
    try {
      const snap = await getDocs(
        query(
          collection(db, "expenseCategories"),
          where("userId", "==", user.uid)
        )
      );
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error loading expense categories:", err);
    }
  };

  loadCategories();
}, []);

  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const snap = await getDocs(
          query(
            collection(db, "suppliers"),
            where("userId", "==", user.uid)
          )
        );

        setSuppliers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error loading suppliers:", err);
      }
    };

    loadSuppliers();
  }, []);

  useEffect(() => {
    if (!supplierName.trim()) {
      setFilteredSuppliers([]);
      return;
    }
    setFilteredSuppliers(
      suppliers.filter((s) =>
        (s.name || "").toLowerCase().includes(supplierName.toLowerCase())
      )
    );
  }, [supplierName, suppliers]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const loadBanks = async () => {
      const snap = await getDocs(
        collection(db, "users", user.uid, "bankAccounts")
      );
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setBankAccounts(list);
    };

    loadBanks();
  }, []);

  const getOrCreateSupplier = async (
  name: string,
  userId: string
): Promise<string> => {
  const q = query(
    collection(db, "suppliers"),
    where("userId", "==", userId),
    where("name", "==", name.trim())
  );

  const snap = await getDocs(q);
  if (!snap.empty) return snap.docs[0].id;

  const ref = await addDoc(collection(db, "suppliers"), {
    name: name.trim(),
    userId,
    createdAt: serverTimestamp(),
  });

  return ref.id;
};

  // NOTE: We don't need to manually update petty cash or bank balances
  // because the Petty Cash and Bank pages calculate balances from transactions
  // This keeps the system transaction-based and auditable


    const savePayment = async (e: any) => {
      e.preventDefault();
      const user = auth.currentUser;
      if (!user) return;

      const finalAmount = Number(amount);
      if (finalAmount <= 0) return;

    let finalSupplierId = supplierId;

  if (!finalSupplierId && supplierName.trim()) {
    finalSupplierId = await getOrCreateSupplier(
      supplierName,
      user.uid
    );
  }

  // SUPPLIER EXPENSE → expenses collection
  if (expenseType === "SUPPLIER") {
    if (!finalSupplierId) {
      alert("Supplier is required");
      return;
    }

    await addDoc(collection(db, "expenses"), {
      supplierId: finalSupplierId,
      supplierName: supplierName.trim(),

      amount: finalAmount,
      date,
      paymentMethod,
      bankName,
      notes,

      userId: user.uid,
      createdAt: serverTimestamp(),
    });
  }

// OPERATIONAL EXPENSE → operationalExpenses collection
if (expenseType === "OPERATIONAL") {
  if (!categoryId) {
    alert("Category is required");
    return;
  }

  // Save operational expense (balance is calculated from transactions)
  await addDoc(collection(db, "operationalExpenses"), {
    categoryId,
    categoryName,
    description: notes || "",
    amount: finalAmount,
    date,
    paymentMethod,
    bankName,
    userId: user.uid,
    createdAt: serverTimestamp(),
  });
}



      setSupplierId("");
      setMessage("Payment added");
      setSupplierName("");
      setSupplierId("");
      setAmount("");
      setNotes("");
      setExpenseType("SUPPLIER");
      setCategoryId("");
      setCategoryName("");



    onSuccess?.();
  }; 

  return (
    <form onSubmit={savePayment} className="space-y-4">
      {message && <p className="text-green-600">{message}</p>}

          <select
        className="w-full border p-2 rounded"
        value={expenseType}
        onChange={(e) =>
          setExpenseType(e.target.value as "SUPPLIER" | "OPERATIONAL")
        }
      >
        <option value="SUPPLIER">Supplier Expense</option>
        <option value="OPERATIONAL">Operational Expense</option>
      </select>

        {expenseType === "SUPPLIER" && (
  <>
    <input
      type="text"
      placeholder="Supplier"
      className="w-full border p-2 rounded"
      value={supplierName}
      onChange={(e) => {
        setSupplierName(e.target.value);
        setShowDropdown(true);
      }}
    />

    {showDropdown && filteredSuppliers.length > 0 && (
      <div className="border rounded">
        {filteredSuppliers.map((s) => (
          <button
            key={s.id}
            type="button"
            className="block w-full text-left p-2 hover:bg-gray-100"
            onClick={() => {
              setSupplierId(s.id);
              setSupplierName(s.name);
              setShowDropdown(false);
            }}
          >
            {s.name}
          </button>
        ))}
      </div>
    )}
  </>
)}
            {expenseType === "OPERATIONAL" && (
            <select
              className="w-full border p-2 rounded"
              value={categoryId}
              onChange={(e) => {
                const c = categories.find((x) => x.id === e.target.value);
                setCategoryId(e.target.value);
                setCategoryName(c?.name || "");
              }}
              required
            >
              <option value="">Select Expense Category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
            <input
          type="date"
          className="w-full border p-2 rounded"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
     
      <select
        className="w-full border p-2 rounded"
        value={paymentMethod}
        onChange={(e) =>
          setPaymentMethod(e.target.value as "CASH" | "BANK")
        }
      >
        <option value="CASH">Cash</option>
        <option value="BANK">Bank</option>
      </select>

      {paymentMethod === "BANK" && (
        <select
          className="w-full border p-2 rounded"
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
          required
        >
          <option value="">Select Bank</option>
          {bankAccounts.map((b) => (
            <option key={b.id} value={b.name}>
              {b.name}
            </option>
          ))}
        </select>
      )}

           <input
        type="number"
        placeholder="Amount"
        className="w-full border p-2 rounded"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />

      <textarea
        className="w-full border p-2 rounded h-24"
        placeholder="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <button className="w-full bg-red-600 text-white p-3 rounded">
        Add Expense
      </button>
    </form>
  );
}
