"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";

type Item = {
  description: string;
  qty: number;
  unitPrice: number;
  amount: number;
};

export default function EditSalePage() {
  const { saleId } = useParams();
  const router = useRouter();

  // ================================
  // CUSTOMER STATES
  // ================================
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

  // ================================
  // INVOICE HEADER
  // ================================
  const [billNumber, setBillNumber] = useState("");
  const [date, setDate] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [terms, setTerms] = useState("CASH");

  // ================================
  // ITEMS
  // ================================
  const [items, setItems] = useState<Item[]>([]);
  const [subtotal, setSubtotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // ================================
  // 1️⃣ LOAD CUSTOMERS for DROPDOWN
  // ================================
  useEffect(() => {
    const loadCustomers = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const qCustomers = query(
        collection(db, "customers"),
        where("userId", "==", user.uid)
      );

      const snap = await getDocs(qCustomers);
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));

      setCustomers(list);
    };

    loadCustomers();
  }, []);

  // FILTER customers by typed name
  useEffect(() => {
    if (!customerName.trim()) {
      setFilteredCustomers([]);
      return;
    }

    const s = customerName.toLowerCase();
    const filtered = customers.filter((c) =>
      (c.name || "").toLowerCase().includes(s)
    );

    setFilteredCustomers(filtered);
  }, [customerName, customers]);

  const handleSelectCustomer = (c: any) => {
    setCustomerId(c.id);
    setCustomerName(c.name);
    setCustomerCompany(c.company || "");
    setCustomerAddress(c.address || "");
    setCustomerPhone(c.phone || "");
    setCustomerChNo(c.chNo || "");

    setShowDropdown(false);
  };

  // ================================
  // 2️⃣ LOAD EXISTING SALE DATA
  // ================================
  useEffect(() => {
    const loadSale = async () => {
      try {
        const snap = await getDoc(doc(db, "sales", saleId as string));
        if (!snap.exists()) {
          setMessage("Invoice not found.");
          setLoading(false);
          return;
        }

        const data: any = snap.data();

        setCustomerId(data.customerId || "");
        setCustomerName(data.customerName || "");
        setCustomerCompany(data.customerCompany || "");
        setCustomerAddress(data.customerAddress || "");
        setCustomerPhone(data.customerPhone || "");
        setCustomerChNo(data.customerChNo || "");

        setBillNumber(data.billNumber || "");
        setDate(data.date || new Date().toISOString().slice(0, 10));
        setPoNumber(data.poNumber || "");
        setTerms(data.terms || "CASH");

        setItems(data.items || []);
        setSubtotal(Number(data.subtotal || 0));
      } catch (err) {
        console.error(err);
        setMessage("Error loading invoice.");
      } finally {
        setLoading(false);
      }
    };

    loadSale();
  }, [saleId]);

  // ================================
  // 3️⃣ UPDATE SUBTOTAL
  // ================================
  useEffect(() => {
    const s = items.reduce((sum, it) => sum + Number(it.amount || 0), 0);
    setSubtotal(s);
  }, [items]);

  // ================================
  // 4️⃣ ITEM OPERATIONS
  // ================================
  const updateItem = (index: number, field: keyof Item, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[index] };

      if (field === "description") item.description = value;
      if (field === "qty") item.qty = Number(value || 0);
      if (field === "unitPrice") item.unitPrice = Number(value || 0);

      item.amount = item.qty * item.unitPrice;

      copy[index] = item;
      return copy;
    });
  };

  const addRow = () => {
    setItems((prev) => [
      ...prev,
      { description: "", qty: 1, unitPrice: 0, amount: 0 },
    ]);
  };

  const removeRow = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // ================================
  // 5️⃣ UPDATE SALE IN FIRESTORE
  // ================================
  const handleUpdate = async (e: any) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        setMessage("You must be logged in.");
        setLoading(false);
        return;
      }

      await updateDoc(doc(db, "sales", saleId as string), {
        customerId,
        customerName,
        customerCompany,
        customerAddress,
        customerPhone,
        customerChNo,
        billNumber,
        date,
        poNumber,
        terms,
        items,
        subtotal,
        total: subtotal,
        updatedAt: serverTimestamp(),
      });

      setMessage("Invoice updated successfully!");

      router.push(`/sales/${saleId}`);
    } catch (err: any) {
      setMessage("Error updating invoice: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ================================
  // UI
  // ================================
  if (loading) return <p className="p-6">Loading invoice…</p>;

  return (
    <div className="max-w-5xl mx-auto bg-white p-8 rounded-xl shadow-lg border">
      <h1 className="text-3xl font-bold text-indigo-900 mb-6 border-b pb-3">
        Edit Invoice
      </h1>

      {message && (
        <div className="mb-4 bg-indigo-100 text-indigo-700 p-3 rounded border">
          {message}
        </div>
      )}

      <form onSubmit={handleUpdate} className="space-y-10">
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
              onChange={(e) => setTerms(e.target.value)}
            >
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

            <input
              type="text"
              placeholder="Company Name"
              className="border border-gray-300 p-2 rounded"
              value={customerCompany}
              onChange={(e) => setCustomerCompany(e.target.value)}
            />

            <input
              type="text"
              placeholder="Phone"
              className="border border-gray-300 p-2 rounded"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />

            <input
              type="text"
              placeholder="Address"
              className="border border-gray-300 p-2 rounded md:col-span-2"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
            />

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
          <div className="bg-blue-900 text-white px-4 py-2 rounded-t-md font-semibold flex justify-between">
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
                        onChange={(e) =>
                          updateItem(idx, "description", e.target.value)
                        }
                      />
                    </td>

                    <td className="p-2 text-right">
                      <input
                        type="text"
                        inputMode="numeric"
                        className="w-20 border border-gray-300 p-1 rounded text-right"
                        value={it.qty}
                        onChange={(e) =>
                          updateItem(idx, "qty", e.target.value)
                        }
                      />
                    </td>

                    <td className="p-2 text-right">
                      <input
                        type="text"
                        inputMode="numeric"
                        className="w-28 border border-gray-300 p-1 rounded text-right"
                        value={it.unitPrice}
                        onChange={(e) =>
                          updateItem(idx, "unitPrice", e.target.value)
                        }
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
                {/* Total Quantity Row */}
                <tr className="bg-gray-200 font-bold border-t-2 border-gray-400">
                  <td className="p-2 text-right">Total Quantity:</td>
                  <td className="p-2 text-right">
                    {items.reduce((sum, it) => sum + Number(it.qty || 0), 0).toLocaleString()}
                  </td>
                  <td className="p-2"></td>
                  <td className="p-2"></td>
                  <td className="p-2"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ======================= TOTAL ======================= */}
        <section className="flex justify-end">
          <div className="text-right bg-blue-50 p-5 rounded-lg border border-blue-200 w-60">
            <div className="text-sm text-gray-600">total</div>
            <div className="text-2xl font-bold text-blue-900">
              {subtotal.toLocaleString()}
            </div>
          </div>
        </section>

        {/* SUBMIT */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-900 text-white p-3 rounded-lg hover:bg-indigo-800 shadow-lg"
        >
          {loading ? "Saving…" : "Update Invoice"}
        </button>
      </form>
    </div>
  );
}
