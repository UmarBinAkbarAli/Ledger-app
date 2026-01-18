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
  size: string;
  qty: string;
  unitPrice: string;
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
  const [items, setItems] = useState<Item[]>([{ description: "", size: "1", qty: "1", unitPrice: "0", amount: 0 }
]);
  const [subtotal, setSubtotal] = useState(0);

  // UI
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [businessId, setBusinessId] = useState<string | null>(null);
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
    setSupplierCompany(d.supplierCompany || d.supplierName || "");
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
        let bizId: string | null = businessId;
        if (!bizId) {
          try {
            const userSnap = await getDoc(doc(db, "users", userId));
            bizId = userSnap.exists() ? userSnap.data()?.businessId ?? null : null;
            setBusinessId(bizId);
          } catch (e) {
            console.warn("Could not fetch user profile for businessId", e);
          }
        }

        const byBusiness = bizId
          ? query(
              collection(db, "purchases"),
              where("businessId", "==", bizId),
              orderBy("createdAt", "desc"),
              limit(1)
            )
          : null;
        const byUser = query(
          collection(db, "purchases"),
          where("userId", "==", userId),
          orderBy("createdAt", "desc"),
          limit(1)
        );

        let snap;
        try {
          snap = await getDocs(byBusiness || byUser);
        } catch (err: any) {
          if (err?.code === "permission-denied" && byBusiness) {
            console.warn("Business scope denied for purchases, falling back to userId");
            snap = await getDocs(byUser);
          } else {
            throw err;
          }
        }

        let lastNumber = 0;
        if (!snap.empty) {
          const data: any = snap.docs[0].data();
          const bill = data.billNumber || "";
          const num = parseInt(bill.replace(/\D/g, ""));
          if (!isNaN(num)) lastNumber = num;
        } else {
          // fallback scan
          const qAll = bizId
            ? query(collection(db, "purchases"), where("businessId", "==", bizId))
            : query(collection(db, "purchases"), where("userId", "==", userId));

          let snapAll;
          try {
            snapAll = await getDocs(qAll);
          } catch (err: any) {
            if (err?.code === "permission-denied" && bizId) {
              snapAll = await getDocs(
                query(collection(db, "purchases"), where("userId", "==", userId))
              );
            } else {
              throw err;
            }
          }
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

      try {
        // Get businessId from user profile
        let bizId: string | undefined;
        try {
          const userSnap = await getDoc(doc(db, "users", user.uid));
          if (userSnap.exists()) {
            bizId = userSnap.data().businessId;
          }
        } catch (e) {
          console.warn("Could not fetch user profile for businessId", e);
        }

        const byBusiness = bizId ? query(collection(db, "suppliers"), where("businessId", "==", bizId)) : null;
        const byUser = query(collection(db, "suppliers"), where("userId", "==", user.uid));

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

        const list: any[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
        setSuppliers(list);
      } catch (err) {
        console.error("Error loading suppliers:", err);
      }
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
      setSupplierCompany(found.company || found.supplierCompany || found.name || found.supplierName || "");
      setSupplierAddress(found.address || found.supplierAddress || "");
      setSupplierPhone(found.phone || found.supplierPhone || "");
      setShowDropdown(false);
    }
  }, [preSupplierId, suppliers]);

  // Supplier dropdown filter
  useEffect(() => {
    if (!supplierCompany.trim()) {
      setFilteredSuppliers([]);
      return;
    }
    const s = supplierCompany.toLowerCase();
    const filtered = suppliers.filter((c) => {
      const company = (c.company || c.supplierCompany || "").toLowerCase();
      const name = (c.name || c.supplierName || "").toLowerCase();
      return company.includes(s) || (!company && name.includes(s));
    });
    setFilteredSuppliers(filtered);
  }, [supplierCompany, suppliers]);

  const handleSelectSupplier = (c: any) => {
    setSupplierId(c.id);
    setSupplierName(c.name || c.supplierName || "");
    setSupplierCompany(c.company || c.supplierCompany || c.name || c.supplierName || "");
    setSupplierAddress(c.address || c.supplierAddress || "");
    setSupplierPhone(c.phone || c.supplierPhone || "");
    setShowDropdown(false);
  };

  // ---------------- Items calculations ----------------
  useEffect(() => {
    const s = items.reduce((sum, it) => sum + Number(it.amount || 0), 0);
    setSubtotal(s);
  }, [items]);

const updateItem = (index: number, field: keyof Item, value: string) => {
  setItems((prev) => {
    const copy = [...prev];
    const item = { ...copy[index] };

    if (field === "description") item.description = value;
    if (field === "size") item.size = value;
    if (field === "qty") item.qty = value;
    if (field === "unitPrice") item.unitPrice = value;

    const size = parseFloat(item.size || "0");
    const qty = parseFloat(item.qty || "0");
    const price = parseFloat(item.unitPrice || "0");

    item.amount = size * qty * price;

    copy[index] = item;
    return copy;
  });
};


  const addRow = () => setItems((p) => [...p, { description: "", size: "1",qty: "1", unitPrice: "0", amount: 0 }]);
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

      // Validate items
      const validItems = items.filter((it) => it.description.trim() || it.amount > 0);
      if (validItems.length === 0) {
        setMessage("Add at least one item.");
        setLoading(false);
        return;
      }

      const typedCompany = (supplierCompany || "").trim();
      if (!typedCompany) {
        setMessage("Please select a company.");
        setLoading(false);
        return;
      }

      if (!supplierId) {
        setMessage("Please select a company from the list.");
        setLoading(false);
        return;
      }

      const selectedSupplier = suppliers.find((s) => s.id === supplierId);
      if (!selectedSupplier) {
        setMessage("Please select a valid company.");
        setLoading(false);
        return;
      }

      // Build purchase object
      const purchaseObj: any = {
        supplierId: selectedSupplier.id,
        supplierName: selectedSupplier.name || selectedSupplier.supplierName || "",
        supplierCompany: selectedSupplier.company || selectedSupplier.supplierCompany || "",
        supplierAddress: selectedSupplier.address || selectedSupplier.supplierAddress || supplierAddress,
        supplierPhone: selectedSupplier.phone || selectedSupplier.supplierPhone || supplierPhone,
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
        ...(bizId ? { businessId: bizId } : {}),
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
      setItems([{ description: "", size: "1", qty: "1", unitPrice: "0" , amount: 0 }]);
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

        {/* COMPANY INFO */}
        <section>
          <div className="bg-blue-900 text-white px-4 py-2 rounded-t-md font-semibold">Company Information</div>
          <div className="border border-gray-200 p-5 rounded-b-md bg-gray-50 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Searchable Company Dropdown */}
            <div className="md:col-span-1 relative">
              <input
                type="text"
                placeholder="Company"
                className="border border-gray-300 p-2 rounded w-full"
                value={supplierCompany}
                onChange={(e) => {
                  setSupplierCompany(e.target.value);
                  setSupplierName("");
                  setSupplierAddress("");
                  setSupplierPhone("");
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
                      <span className="font-semibold">{c.company || c.supplierCompany || c.name || c.supplierName || "-"}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

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
                  <th className="p-2 text-right">Size</th>
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
                  <input
                    type="text"
                    className="w-full border border-gray-300 p-1 rounded"
                    value={it.description}
                    onChange={(e) => updateItem(idx, "description", e.target.value)}
                  />
                </td>

                <td className="p-2 text-right">
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*[.,]?[0-9]*"
                    className="w-20 border border-gray-300 p-1 rounded text-right"
                    value={it.size}
                    onChange={(e) => updateItem(idx, "size", e.target.value)}
                  />
                </td>

                <td className="p-2 text-right">
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="-?[0-9]*[.,]?[0-9]*"
                    className="w-20 border border-gray-300 p-1 rounded text-right"
                    placeholder="0 or -0"
                    value={it.qty}
                    onChange={(e) => updateItem(idx, "qty", e.target.value)}
                  />
                </td>

                <td className="p-2 text-right">
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*[.,]?[0-9]*"
                    className="w-28 border border-gray-300 p-1 rounded text-right"
                    value={it.unitPrice}
                    onChange={(e) => updateItem(idx, "unitPrice", e.target.value)}
                  />
                </td>

                <td className="p-2 text-right font-semibold text-blue-900">
                  {Number(it.amount).toLocaleString()}
                </td>

                <td className="p-2 text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                </td>
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
