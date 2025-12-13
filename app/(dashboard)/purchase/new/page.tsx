"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import {
  addDoc,
  updateDoc,
  collection,
  serverTimestamp,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  doc,
  getDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

type Item = {
  description: string;
  qty: number;
  unitPrice: number;
  amount: number;
};

export default function AddPurchasePage() {
  // Supplier header fields (mirror sale invoice fields but for supplier)
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierCompany, setSupplierCompany] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [chNo, setChNo] = useState("");
  

  // Supplier dropdown
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // Query param (auto-select)
  const searchParams = useSearchParams();
  const preSupplierId = searchParams.get("supplierId");

  // Router
  const router = useRouter();

  // Invoice header
  const [billNumber, setBillNumber] = useState("");
  const [autoBill, setAutoBill] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [poNumber, setPoNumber] = useState("");
  const [terms, setTerms] = useState("CASH");

  // Items & totals (same as sale invoice)
  const [items, setItems] = useState<Item[]>([{ description: "", qty: 1, unitPrice: 0, amount: 0 }]);
  const [subtotal, setSubtotal] = useState(0);

  // UI
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const purchaseId = searchParams.get("id");
  const isEdit = Boolean(purchaseId);


  // ------------ Edited Bill Functionality ------------ //

  useEffect(() => {
  if (!purchaseId) return;

  const loadPurchase = async () => {
    const ref = doc(db, "purchases", purchaseId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const d: any = snap.data();

    setSupplierId(d.supplierId || "");
    setSupplierName(d.supplierName || "");
    setSupplierCompany(d.supplierCompany || "");
    setSupplierAddress(d.supplierAddress || "");
    setSupplierPhone(d.supplierPhone || "");
    setBillNumber(d.billNumber || "");
    setDate(d.date || "");
    setPoNumber(d.poNumber || "");
    setChNo(d.chNo || ""); // ✅ FIX
    setTerms(d.terms || "CASH");
    setItems(d.items || []);
    setSubtotal(d.subtotal || 0);
  };

  loadPurchase();
}, [purchaseId]);


  // ---------------- Auto bill generation (PUR-0001 style) ---------------- //
  useEffect(() => {
    const loadLastBill = async (userId: string) => {
      try {
        const q = query(
          collection(db, "purchase"),
          where("userId", "==", userId),
          orderBy("createdAt", "desc"),
          limit(1)
        );
        const snap = await getDocs(q);

        let lastNumber = 0;
        if (!snap.empty) {
          const data: any = snap.docs[0].data();
          const bill = data.billNumber || "";
          const num = parseInt(bill.replace(/\D/g, ""));
          if (!isNaN(num)) lastNumber = num;
        } else {
          // fallback scan
          const qAll = query(collection(db, "purchase"), where("userId", "==", userId));
          const snapAll = await getDocs(qAll);
          snapAll.forEach((d) => {
            const bill = (d.data() as any).billNumber || "";
            const num = parseInt(bill.replace(/\D/g, ""));
            if (!isNaN(num) && num > lastNumber) lastNumber = num;
          });
        }

        const next = lastNumber + 1;
        const formatted = String(next).padStart(4, "0");
        setAutoBill(`PUR-${formatted}`);
        setBillNumber((prev) => prev || `PUR-${formatted}`);
      } catch (err) {
        console.error("Error loading last purchase bill:", err);
      }
    };

    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        loadLastBill(user.uid);
        unsub();
      }
    });

    return () => unsub();
  }, []);

  // ---------------- Load suppliers for dropdown ----------------
  useEffect(() => {
    const loadSuppliers = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const q = query(collection(db, "suppliers"), where("userId", "==", user.uid));
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
      setSuppliers(list);
    };
    loadSuppliers();
  }, []);

  // Auto-select supplier when coming from ledger (query param)
  useEffect(() => {
    if (!preSupplierId) return;
    if (suppliers.length === 0) return;

    const found = suppliers.find((s) => s.id === preSupplierId);
    if (found) {
      setSupplierId(found.id);
      setSupplierName(found.name || found.supplierName || "");
      setSupplierCompany(found.company || found.supplierCompany || "");
      setSupplierAddress(found.address || found.supplierAddress || "");
      setSupplierPhone(found.phone || found.supplierPhone || "");
      setShowDropdown(false);
    }
  }, [preSupplierId, suppliers]);

  // Supplier dropdown filter
  useEffect(() => {
    if (!supplierName.trim()) {
      setFilteredSuppliers([]);
      return;
    }
    const s = supplierName.toLowerCase();
    const filtered = suppliers.filter((c) => (c.name || "").toLowerCase().includes(s));
    setFilteredSuppliers(filtered);
  }, [supplierName, suppliers]);

  const handleSelectSupplier = (c: any) => {
    setSupplierId(c.id);
    setSupplierName(c.name || c.supplierName || "");
    setSupplierCompany(c.company || c.supplierCompany || "");
    setSupplierAddress(c.address || c.supplierAddress || "");
    setSupplierPhone(c.phone || c.supplierPhone || "");
    setShowDropdown(false);
  };

  // ---------------- Items calculations ----------------
  useEffect(() => {
    const s = items.reduce((sum, it) => sum + Number(it.amount || 0), 0);
    setSubtotal(s);
  }, [items]);

  const updateItem = (index: number, field: keyof Item, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[index] };
      if (field === "description") item.description = value;
      if (field === "qty") item.qty = Number(value || 0);
      if (field === "unitPrice") item.unitPrice = Number(value || 0);
      item.amount = Number((item.qty * item.unitPrice) || 0);
      copy[index] = item;
      return copy;
    });
  };

  const addRow = () => setItems((p) => [...p, { description: "", qty: 1, unitPrice: 0, amount: 0 }]);
  const removeRow = (index: number) => setItems((p) => p.filter((_, i) => i !== index));

  // ---------------- Submit (save purchase) ----------------
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const user = auth.currentUser;
      if (!user) {
        setMessage("You must be logged in.");
        setLoading(false);
        return;
      }

      // Validate items
      const validItems = items.filter((it) => it.description.trim() || it.amount > 0);
      if (validItems.length === 0) {
        setMessage("Add at least one item.");
        setLoading(false);
        return;
      }

      const typedName = (supplierName || "").trim();
      if (!typedName) {
        setMessage("Please provide a supplier name.");
        setLoading(false);
        return;
      }

      // Try to find an existing supplier (case-insensitive)
      const exists = suppliers.find(
        (c) => (c.name || c.supplierName || "").toString().trim().toLowerCase() === typedName.toLowerCase()
      );

      // finalSupplierId will be used in purchase object
      let finalSupplierId = supplierId || (exists ? exists.id : "");

      // If no supplierId and not found => create new supplier doc BEFORE saving purchase
      if (!finalSupplierId) {
        const newSuppObj = {
          name: typedName,
          company: supplierCompany || "",
          address: supplierAddress || "",
          phone: supplierPhone || "",
          userId: user.uid,
          createdAt: serverTimestamp(),
        };

        const newRef = await addDoc(collection(db, "suppliers"), newSuppObj);
        finalSupplierId = newRef.id;

        setSupplierId(finalSupplierId);
        setSuppliers((prev) => [{ id: finalSupplierId, ...newSuppObj }, ...prev]);
      }

      // Build purchase object
      const purchaseObj: any = {
        supplierId: finalSupplierId,
        supplierName: typedName,
        supplierCompany,
        supplierAddress,
        supplierPhone,
        billNumber,
        date,
        poNumber,
        chNo,
        terms,
        items: validItems,
        subtotal: Number(subtotal),
        total: Number(subtotal),
        userId: user.uid,
        paidAmount: 0,
        createdAt: serverTimestamp(),
      };

     if (isEdit && purchaseId) {
  await updateDoc(doc(db, "purchases", purchaseId), purchaseObj);
  router.push(`/purchase/${purchaseId}`);
  } else {
    const docRef = await addDoc(collection(db, "purchases"), purchaseObj);
    router.push(`/purchase/${docRef.id}`);
  }


      setMessage("Purchase added successfully!");

      // reset form (keep autoBill)
      setSupplierId("");
      setSupplierName("");
      setSupplierCompany("");
      setSupplierAddress("");
      setSupplierPhone("");
      setBillNumber(autoBill);
      setDate(new Date().toISOString().slice(0, 10));
      setPoNumber("");
      setTerms("CASH");
      setItems([{ description: "", qty: 1, unitPrice: 0, amount: 0 }]);
      setSubtotal(0);
    } catch (error: any) {
      setMessage("Error saving entry: " + (error?.message || error));
    } finally {
      setLoading(false);
    }
  };

  // ---------------- UI render (mirrors Sale invoice layout) ----------------
  return (
    <div className="max-w-5xl mx-auto bg-white p-8 rounded-xl shadow-lg border border-gray-200">
      <h1 className="text-3xl font-bold text-blue-900 mb-6 border-b pb-3">Create New Purchase</h1>

      {message && <div className="mb-4 text-blue-700 bg-blue-100 p-3 rounded border border-blue-200">{message}</div>}

      <form onSubmit={handleSubmit} className="space-y-10">
        {/* HEADER */}
        <section>
          <div className="bg-blue-900 text-white px-4 py-2 rounded-t-md font-semibold">Purchase Details</div>
          <div className="border border-gray-200 p-5 rounded-b-md bg-gray-50 grid grid-cols-1 md:grid-cols-4 gap-4">
            <input type="text" placeholder="Purchase Number" className="border border-gray-300 p-2 rounded" value={billNumber} onChange={(e) => setBillNumber(e.target.value)} required />
            <input type="date" className="border border-gray-300 p-2 rounded" value={date} onChange={(e) => setDate(e.target.value)} required />
            <input type="text" placeholder="PO Number" className="border border-gray-300 p-2 rounded" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
            <select className="border border-gray-300 p-2 rounded" value={terms} onChange={(e) => setTerms(e.target.value)}>
              <option value="CASH">CASH</option>
              <option value="CREDIT">CREDIT</option>
              <option value="15">15 Days</option>
              <option value="30">30 Days</option>
              <option value="45">45 Days</option>
              <option value="60">60 Days</option> 
            </select>
          </div>
        </section>

        {/* SUPPLIER INFO */}
        <section>
          <div className="bg-blue-900 text-white px-4 py-2 rounded-t-md font-semibold">Supplier Information</div>
          <div className="border border-gray-200 p-5 rounded-b-md bg-gray-50 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Searchable Supplier Dropdown */}
            <div className="md:col-span-1 relative">
              <input
                type="text"
                placeholder="Supplier Name"
                className="border border-gray-300 p-2 rounded w-full"
                value={supplierName}
                onChange={(e) => {
                  setSupplierName(e.target.value);
                  setShowDropdown(true);
                  setSupplierId(""); // clear id if user types manually
                }}
                onFocus={() => setShowDropdown(true)}
                required
              />
              {showDropdown && filteredSuppliers.length > 0 && (
                <div className="absolute z-20 bg-white border border-gray-300 rounded mt-1 w-full max-h-40 overflow-y-auto shadow-lg">
                  {filteredSuppliers.map((c) => (
                    <button key={c.id} type="button" onClick={() => handleSelectSupplier(c)} className="flex flex-col items-start w-full text-left px-3 py-2 hover:bg-blue-100">
                      <span className="font-semibold">{c.name}</span>
                      {c.company && <span className="text-xs text-gray-500">{c.company}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <input type="text" placeholder="Company Name" className="border border-gray-300 p-2 rounded" value={supplierCompany} onChange={(e) => setSupplierCompany(e.target.value)} />
            <input type="text" placeholder="Phone" className="border border-gray-300 p-2 rounded" value={supplierPhone} onChange={(e) => setSupplierPhone(e.target.value)} />
            <input type="text" placeholder="Address" className="border border-gray-300 p-2 rounded md:col-span-2" value={supplierAddress} onChange={(e) => setSupplierAddress(e.target.value)} />
            <input type="text" placeholder="CH No" className="border border-gray-300 p-2 rounded" value={chNo} onChange={(e) => setChNo(e.target.value)}
/>
          </div>
        </section>

        {/* ITEMS */}
        <section>
          <div className="bg-blue-900 text-white px-4 py-2 rounded-t-md font-semibold flex justify-between items-center">
            <span>Items</span>
            <button type="button" onClick={addRow} className="bg-white text-blue-900 px-3 py-1 rounded text-sm shadow hover:bg-blue-50">+ Add Item</button>
          </div>

          <div className="border border-gray-200 rounded-b-md bg-gray-50 p-3 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-200 text-gray-700">
                  <th className="p-2 text-left">Description</th>
                  <th className="p-2 text-right">Qty</th>
                  <th className="p-2 text-right">Unit Price</th>
                  <th className="p-2 text-right">Amount</th>
                  <th className="p-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="p-2">
                      <input type="text" className="w-full border border-gray-300 p-1 rounded" value={it.description} onChange={(e) => updateItem(idx, "description", e.target.value)} />
                    </td>
                    <td className="p-2 text-right">
                      <input type="number" className="w-20 border border-gray-300 p-1 rounded text-right" value={it.qty} onChange={(e) => updateItem(idx, "qty", e.target.value)} />
                    </td>
                    <td className="p-2 text-right">
                      <input type="number" className="w-28 border border-gray-300 p-1 rounded text-right" value={it.unitPrice} onChange={(e) => updateItem(idx, "unitPrice", e.target.value)} />
                    </td>
                    <td className="p-2 text-right font-semibold text-blue-900">{Number(it.amount).toLocaleString()}</td>
                    <td className="p-2 text-center"><button type="button" onClick={() => removeRow(idx)} className="text-red-600 hover:text-red-800 text-sm">Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* TOTAL */}
        <section className="flex justify-end">
          <div className="text-right bg-blue-50 p-5 rounded-lg border border-blue-200 w-60">
            <div className="text-sm text-gray-600">Subtotal</div>
            <div className="text-2xl font-bold text-blue-900">{subtotal.toLocaleString()}</div>
          </div>
        </section>

        <button type="submit" disabled={loading} className="w-full bg-blue-900 text-white p-3 rounded-lg hover:bg-blue-800 shadow-lg">
          {loading ? "Saving..." : "Add Purchase"}
        </button>
      </form>
    </div>
  );
}
