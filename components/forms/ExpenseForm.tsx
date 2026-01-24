"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import {
  addDoc,
  collection,
  getDoc,
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
  const [supplierCompany, setSupplierCompany] = useState("");
  const [expenseType, setExpenseType] = useState<"SUPPLIER" | "OPERATIONAL">("SUPPLIER");
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [businessId, setBusinessId] = useState<string | null>(null);
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
      let bizId: string | null = businessId;
      if (!bizId) {
        try {
          const userSnap = await getDoc(doc(db, "users", user.uid));
          bizId = userSnap.exists() ? userSnap.data()?.businessId ?? null : null;
          setBusinessId(bizId);
        } catch (e) {
          console.warn("Could not fetch user profile for businessId", e);
        }
      }

      const byBusiness = bizId
        ? query(collection(db, "expenseCategories"), where("businessId", "==", bizId))
        : null;
      const byUser = query(
        collection(db, "expenseCategories"),
        where("userId", "==", user.uid)
      );

      let snap;
      try {
        snap = await getDocs(byBusiness || byUser);
      } catch (err: any) {
        if (err?.code === "permission-denied" && byBusiness) {
          console.warn("Business scope denied for expense categories, falling back to userId");
          snap = await getDocs(byUser);
        } else {
          throw err;
        }
      }
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

        let bizId: string | null = businessId;
        if (!bizId) {
          try {
            const userSnap = await getDoc(doc(db, "users", user.uid));
            bizId = userSnap.exists() ? userSnap.data()?.businessId ?? null : null;
            setBusinessId(bizId);
          } catch (e) {
            console.warn("Could not fetch user profile for businessId", e);
          }
        }

        const byBusiness = bizId
          ? query(collection(db, "suppliers"), where("businessId", "==", bizId))
          : null;
        const byUser = query(
          collection(db, "suppliers"),
          where("userId", "==", user.uid)
        );

        let snap;
        try {
          snap = await getDocs(byBusiness || byUser);
        } catch (err: any) {
          if (err?.code === "permission-denied" && byBusiness) {
            console.warn("Business scope denied for suppliers, falling back to userId");
            snap = await getDocs(byUser);
          } else {
            throw err;
          }
        }

        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a: any, b: any) => {
          const aLabel = (a.company || a.name || "").toString();
          const bLabel = (b.company || b.name || "").toString();
          return aLabel.localeCompare(bLabel);
        });
        setSuppliers(list);
      } catch (err) {
        console.error("Error loading suppliers:", err);
      }
    };

    loadSuppliers();
  }, []);

  useEffect(() => {
    if (!supplierCompany.trim()) {
      setFilteredSuppliers([]);
      return;
    }
    const s = supplierCompany.toLowerCase();
    setFilteredSuppliers(
      suppliers.filter((sup) => {
        const company = (sup.company || "").toLowerCase();
        const name = (sup.name || "").toLowerCase();
        return company.includes(s) || (!company && name.includes(s));
      })
    );
  }, [supplierCompany, suppliers]);

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

  // NOTE: We don't need to manually update petty cash or bank balances
  // because the Petty Cash and Bank pages calculate balances from transactions
  // This keeps the system transaction-based and auditable


    const savePayment = async (e: any) => {
      e.preventDefault();
      setError("");
      const user = auth.currentUser;
      if (!user) return;

      const finalAmount = Number(amount);
      if (finalAmount <= 0) return;
      if (paymentMethod === "BANK" && !bankName) {
        alert("Bank is required");
        return;
      }
      const effectiveBankName = paymentMethod === "CASH" ? "" : bankName;

    let bizId: string | null = businessId;
    if (!bizId) {
      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        bizId = userSnap.exists() ? userSnap.data()?.businessId ?? null : null;
        setBusinessId(bizId);
      } catch (e) {
        console.warn("Could not fetch user profile for businessId", e);
      }
    }

  // SUPPLIER EXPENSE → expenses collection
  if (expenseType === "SUPPLIER") {
    if (!supplierId) {
      alert("Company is required");
      return;
    }

    const selectedSupplier = suppliers.find((s) => s.id === supplierId);
    if (!selectedSupplier) {
      alert("Please select a valid company");
      return;
    }

    await addDoc(collection(db, "expenses"), {
      supplierId: supplierId,
      supplierName: selectedSupplier.name || "",
      supplierCompany: selectedSupplier.company || "",

      amount: finalAmount,
      date,
      paymentMethod,
      bankName: effectiveBankName,
      notes,

      userId: user.uid,
      createdAt: serverTimestamp(),
      ...(bizId ? { businessId: bizId } : {}),
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
    bankName: effectiveBankName,
    userId: user.uid,
    createdAt: serverTimestamp(),
    ...(bizId ? { businessId: bizId } : {}),
  });
}



      setSupplierId("");
      setMessage("Payment added");
      setSupplierName("");
      setSupplierCompany("");
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
      {error && <p className="text-red-600">{error}</p>}

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
      placeholder="Company"
      className="w-full border p-2 rounded"
      value={supplierCompany}
      onChange={(e) => {
        setSupplierCompany(e.target.value);
        setSupplierName("");
        setSupplierId("");
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
              setSupplierName(s.name || "");
              setSupplierCompany(s.company || s.name || "");
              setShowDropdown(false);
            }}
          >
            {s.company || s.name || "-"}
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
          setPaymentMethod(() => {
            const next = e.target.value as "CASH" | "BANK";
            if (next === "CASH") setBankName("");
            return next;
          })
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
