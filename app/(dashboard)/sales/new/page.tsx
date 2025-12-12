"use client";

import { useSearchParams } from "next/navigation";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import {
  addDoc,
  collection,
  serverTimestamp,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { persistentLocalCache } from "firebase/firestore";


type Item = {
  description: string;
  qty: number;
  unitPrice: number;
  amount: number;
};

export default function AddSalePage() {
  // Header & customer
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerCompany, setCustomerCompany] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerChNo, setCustomerChNo] = useState("");
  // Customer dropdown states
const [customers, setCustomers] = useState<any[]>([]);
const [filteredCustomers, setFilteredCustomers] = useState<any[]>([]);
const [showDropdown, setShowDropdown] = useState(false);

// If coming from customer ledger, read saleCustomerId
const searchParams = useSearchParams();
const saleCustomerId = searchParams.get("saleCustomerId");

  const router = useRouter();

  // Invoice header
  const [billNumber, setBillNumber] = useState("");
  const [autoBill, setAutoBill] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [poNumber, setPoNumber] = useState("");
  const [terms, setTerms] = useState("CASH");

  // Items & totals
  const [items, setItems] = useState<Item[]>([
    { description: "", qty: 1, unitPrice: 0, amount: 0 },
  ]);
  const [subtotal, setSubtotal] = useState(0);

  // UI
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Auto-bill generation (similar to your original)
  useEffect(() => {
    const loadLastBill = async (userId: string) => {
      try {
        const q = query(
          collection(db, "sales"),
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
          const qAll = query(collection(db, "sales"), where("userId", "==", userId));
          const snapAll = await getDocs(qAll);
          snapAll.forEach((d) => {
            const bill = (d.data() as any).billNumber || "";
            const num = parseInt(bill.replace(/\D/g, ""));
            if (!isNaN(num) && num > lastNumber) lastNumber = num;
          });
        }

        const next = lastNumber + 1;
        const formatted = String(next).padStart(4, "0");
        setAutoBill(`INV-${formatted}`);
        setBillNumber(`INV-${formatted}`);
      } catch (err) {
        console.error("Error loading last sale bill:", err);
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

  // Load customers for dropdown
useEffect(() => {
  const loadCustomers = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(collection(db, "customers"), where("userId", "==", user.uid));
    const snap = await getDocs(q);

    const list: any[] = [];
    snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
    setCustomers(list);
  };

  loadCustomers();
}, []);

// Auto-select customer when coming from ledger
useEffect(() => {
  if (!saleCustomerId) return;        // no param → do nothing
  if (customers.length === 0) return; // wait for customers to load

  const found = customers.find((c) => c.id === saleCustomerId);
  if (found) {
    setCustomerId(found.id);
    setCustomerName(found.name);
    setCustomerCompany(found.company || "");
    setCustomerAddress(found.address || "");
    setCustomerPhone(found.phone || "");
    setCustomerChNo(found.chNo || "");
    setShowDropdown(false);
  }
}, [saleCustomerId, customers]);

// Filter customers real-time
useEffect(() => {
  if (!customerName.trim()) {
    setFilteredCustomers([]);
    return;
  }

  const s = customerName.toLowerCase();
  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(s)
  );

  setFilteredCustomers(filtered);
}, [customerName, customers]);

const handleSelectCustomer = (c: any) => {
  setCustomerId(c.id); // ⭐ REQUIRED
  setCustomerName(c.name);
  setCustomerCompany(c.company || "");
  setCustomerAddress(c.address || "");
  setCustomerPhone(c.phone || "");
  setCustomerChNo(c.chNo || "");

  setShowDropdown(false);
};


  // Recalculate amounts when items change
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

  const addRow = () => {
    setItems((p) => [...p, { description: "", qty: 1, unitPrice: 0, amount: 0 }]);
  };

  const removeRow = (index: number) => {
    setItems((p) => p.filter((_, i) => i !== index));
  };

// ------------------ REPLACE handleSubmit WITH THIS ------------------
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

    const typedName = (customerName || "").trim();
    if (!typedName) {
      setMessage("Please provide a customer name.");
      setLoading(false);
      return;
    }

    // Try to find existing customer (case-insensitive)
    const exists = customers.find(
      (c) => (c.name || "").toString().trim().toLowerCase() === typedName.toLowerCase()
    );

    // finalCustomerId will be used in sale object
    let finalCustomerId = customerId || (exists ? exists.id : "");

    // If no customerId and not found, create new customer BEFORE saving sale
    if (!finalCustomerId) {
      const newCustObj = {
        name: typedName,
        company: customerCompany || "",
        address: customerAddress || "",
        phone: customerPhone || "",
        chNo: customerChNo || "",
        userId: user.uid,
        createdAt: serverTimestamp(),
      };

      const newCustRef = await addDoc(collection(db, "customers"), newCustObj);
      finalCustomerId = newCustRef.id;

      // update UI state so subsequent actions know this customer
      setCustomerId(finalCustomerId);
      // add to local customers list (so dropdown updates)
      setCustomers((prev) => [{ id: finalCustomerId, ...newCustObj }, ...prev]);
    }

    // Build sale object using finalCustomerId (guaranteed)
    const saleObj: any = {
      customerId: finalCustomerId,     // <- important
      customerName: typedName,
      customerCompany,
      customerAddress,
      customerPhone,
      customerChNo,
      billNumber,
      date,
      poNumber,
      terms,
      items: validItems,
      subtotal: Number(subtotal),
      total: Number(subtotal),
      userId: user.uid,
      paidAmount: 0,
      createdAt: serverTimestamp(),
    };

    // Save sale
    const docRef = await addDoc(collection(db, "sales"), saleObj);

    // Redirect to invoice page
    router.push(`/sales/${docRef.id}`);

    setMessage("Sale entry added successfully!");

    // reset form (optional keep autoBill)
    setCustomerId("");
    setCustomerName("");
    setCustomerCompany("");
    setCustomerAddress("");
    setCustomerPhone("");
    setCustomerChNo("");
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
// ------------------ end replacement ------------------


 return (
  <div className="max-w-5xl mx-auto bg-white p-8 rounded-xl shadow-lg border border-gray-200">
    
    {/* Page Title */}
    <h1 className="text-3xl font-bold text-blue-900 mb-6 border-b pb-3">
      Create New Invoice
    </h1>

    {message && (
      <div className="mb-4 text-blue-700 bg-blue-100 p-3 rounded border border-blue-200">
        {message}
      </div>
    )}

    <form onSubmit={handleSubmit} className="space-y-10">

      {/* ======================= INVOICE HEADER ======================= */}
      <section>
        <div className="bg-blue-900 text-white px-4 py-2 rounded-t-md font-semibold">
          Invoice Details
        </div>

        <div className="border border-gray-200 p-5 rounded-b-md bg-gray-50 grid grid-cols-1 md:grid-cols-4 gap-4">

          <input
            type="text"
            placeholder="Invoice Number"
            className="border border-gray-300 p-2 rounded"
            value={billNumber}
            onChange={(e) => setBillNumber(e.target.value)}
            required
          />

          <input
            type="date"
            className="border border-gray-300 p-2 rounded"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />

          <input
            type="text"
            placeholder="PO Number"
            className="border border-gray-300 p-2 rounded"
            value={poNumber}
            onChange={(e) => setPoNumber(e.target.value)}
          />

          <select
            className="border border-gray-300 p-2 rounded"
            value={terms}
            onChange={(e) => setTerms(e.target.value)} >
            <option value="CASH">CASH</option>
            <option value="15">15 Days</option>
            <option value="30">30 Days</option>
            <option value="45">45 Days</option>
            <option value="60">60 Days</option>
          </select>

        </div>
      </section>

{/* ======================= CUSTOMER INFO ======================= */}
          <section>
            <div className="bg-blue-900 text-white px-4 py-2 rounded-t-md font-semibold">
              Bill To (Customer Information)
            </div>

            <div className="border border-gray-200 p-5 rounded-b-md bg-gray-50 grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* Searchable Customer Dropdown */}
              <div className="md:col-span-1 relative">
                <input
                  type="text"
                  placeholder="Customer Name"
                  className="border border-gray-300 p-2 rounded w-full"
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  required
                />

                {/* Dropdown */}
                {showDropdown && filteredCustomers.length > 0 && (
                  <div className="absolute z-20 bg-white border border-gray-300 rounded mt-1 w-full max-h-40 overflow-y-auto shadow-lg">
                    {filteredCustomers.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => handleSelectCustomer(c)}
                        className="flex flex-col items-start w-full text-left px-3 py-2 hover:bg-blue-100"
                      >
                        <span className="font-semibold">{c.name}</span>
                        {c.company && (
                          <span className="text-xs text-gray-500">{c.company}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Company */}
              <input
                type="text"
                placeholder="Company Name"
                className="border border-gray-300 p-2 rounded"
                value={customerCompany}
                onChange={(e) => setCustomerCompany(e.target.value)}
              />

              {/* Phone */}
              <input
                type="text"
                placeholder="Phone"
                className="border border-gray-300 p-2 rounded"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />

              {/* Address */}
              <input
                type="text"
                placeholder="Address"
                className="border border-gray-300 p-2 rounded md:col-span-2"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
              />

              {/* CH No */}
              <input
                type="text"
                placeholder="CH No"
                className="border border-gray-300 p-2 rounded"
                value={customerChNo}
                onChange={(e) => setCustomerChNo(e.target.value)}
              />
            </div>
          </section>


      {/* ======================= ITEMS SECTION ======================= */}
      <section>
        <div className="bg-blue-900 text-white px-4 py-2 rounded-t-md font-semibold flex justify-between items-center">
          <span>Items</span>
          <button
            type="button"
            onClick={addRow}
            className="bg-white text-blue-900 px-3 py-1 rounded text-sm shadow hover:bg-blue-50"
          >
            + Add Item
          </button>
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
                    <input
                      type="text"
                      className="w-full border border-gray-300 p-1 rounded"
                      value={it.description}
                      onChange={(e) => updateItem(idx, "description", e.target.value)}
                    />
                  </td>
                  <td className="p-2 text-right">
                    <input
                      type="number"
                      className="w-20 border border-gray-300 p-1 rounded text-right"
                      value={it.qty}
                      onChange={(e) => updateItem(idx, "qty", e.target.value)}
                    />
                  </td>
                  <td className="p-2 text-right">
                    <input
                      type="number"
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

      {/* ======================= TOTAL ======================= */}
      <section className="flex justify-end">
        <div className="text-right bg-blue-50 p-5 rounded-lg border border-blue-200 w-60">
          <div className="text-sm text-gray-600">Subtotal</div>
          <div className="text-2xl font-bold text-blue-900">
            {subtotal.toLocaleString()}
          </div>
        </div>
      </section>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-900 text-white p-3 rounded-lg hover:bg-blue-800 shadow-lg"
      >
        {loading ? "Saving..." : "Create Invoice"}
      </button>
    </form>
  </div>
);

}