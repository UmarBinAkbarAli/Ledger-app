"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";

interface Item {
  description: string;
  qty: number;
}

interface Customer {
  id: string;
  name: string;
  company: string;
  address: string;
}

export default function EditDeliveryChallanPage() {
  const router = useRouter();
  const params = useParams();
  const challanId = params.challanId as string;

  // Form fields
  const [challanNumber, setChallanNumber] = useState("");
  const [date, setDate] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerCompany, setCustomerCompany] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [status, setStatus] = useState("pending");
  const [businessId, setBusinessId] = useState<string | null>(null);

  // Items
  const [items, setItems] = useState<Item[]>([
    { description: "", qty: 1 },
  ]);

  // Customers list
  const [customers, setCustomers] = useState<Customer[]>([]);

  // UI
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Load customers
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const userDoc = await getDoc(doc(db, "users", user.uid));
        const bizId = userDoc.exists() ? userDoc.data()?.businessId ?? null : null;
        setBusinessId(bizId);

        const byBusiness = bizId
          ? query(collection(db, "customers"), where("businessId", "==", bizId))
          : null;
        const byUser = query(collection(db, "customers"), where("userId", "==", user.uid));

        let snap;
        try {
          snap = byBusiness ? await getDocs(byBusiness) : await getDocs(byUser);
        } catch (err: any) {
          if (err?.code === "permission-denied" && byBusiness) {
            console.warn("Business scope denied loading customers; retrying with userId scope", { authedUser: user.uid, businessId: bizId });
            snap = await getDocs(byUser);
            setMessage("Limited view: only your personal customers are shown because your account lacks business-level read access.");
            setTimeout(() => setMessage(""), 6000);
          } else {
            throw err;
          }
        }

        const list: Customer[] = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || "",
          company: d.data().company || "",
          address: d.data().address || "",
        }));

        setCustomers(list);
      } catch (err: any) {
        if (err?.code === "permission-denied") {
          console.warn("Permission denied loading customers; falling back to empty list", { authedUser: auth.currentUser?.uid, message: err.message });
          setCustomers([]);
          return;
        }
        console.error("Error loading customers:", err);
      }
    };

    loadCustomers();
  }, []);

  // Load challan data
  useEffect(() => {
    const loadChallan = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const docRef = doc(db, "deliveryChallans", challanId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setChallanNumber(data.challanNumber || "");
          setDate(data.date || "");
          setVehicle(data.vehicle || "");
          setPoNumber(data.poNumber || "");
          setSelectedCustomerId(data.customerId || "");
          setCustomerName(data.customerName || "");
          setCustomerCompany(data.customerCompany || data.customerName || "");
          setCustomerAddress(data.customerAddress || "");
          setCustomerNote(data.customerNote || "");
          setStatus(data.status || "pending");
          setItems(data.items || [{ description: "", qty: 1 }]);
        }
      } catch (error) {
        console.error("Error loading challan:", error);
        setError("Failed to load challan");
      } finally {
        setLoading(false);
      }
    };

    loadChallan();
  }, [challanId]);

  // Auto-resolve customerId for legacy challans that only stored name/company
  useEffect(() => {
    if (selectedCustomerId || customers.length === 0) return;
    const normalize = (v: string) => v.trim().toLowerCase();
    const targetCompany = normalize(customerCompany);
    const targetName = normalize(customerName);
    if (!targetCompany && !targetName) return;

    const matched = customers.find((c) => {
      const company = normalize(c.company || "");
      const name = normalize(c.name || "");
      return (targetCompany && company === targetCompany) || (!targetCompany && targetName && name === targetName);
    });

    if (matched) {
      setSelectedCustomerId(matched.id);
      setCustomerName(matched.name);
      setCustomerCompany(matched.company || matched.name || "");
      setCustomerAddress(matched.address || "");
    }
  }, [selectedCustomerId, customers, customerCompany, customerName]);

  // Handle customer selection
  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const customer = customers.find((c) => c.id === customerId);
    if (customer) {
      setCustomerName(customer.name);
      setCustomerCompany(customer.company || customer.name || "");
      setCustomerAddress(customer.address);
    }
  };

  // Item operations
  const updateItem = (index: number, field: keyof Item, value: string | number) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: field === "qty" ? Number(value) : value };
      return copy;
    });
  };

  const addRow = () => {
    setItems((prev) => [...prev, { description: "", qty: 1 }]);
  };

  const removeRow = (index: number) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculate total quantity
  const totalQuantity = items.reduce((sum, item) => sum + Number(item.qty || 0), 0);

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!vehicle.trim()) {
      setError("Please enter vehicle details");
      return;
    }

    if (items.some((item) => !item.description.trim())) {
      setError("Please fill all item descriptions");
      return;
    }

    setSaving(true);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      const normalize = (v: string) => v.trim().toLowerCase();
      let selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
      if (!selectedCustomer) {
        const targetCompany = normalize(customerCompany);
        const targetName = normalize(customerName);
        selectedCustomer = customers.find((c) => {
          const company = normalize(c.company || "");
          const name = normalize(c.name || "");
          return (targetCompany && company === targetCompany) || (!targetCompany && targetName && name === targetName);
        });
      }

      if (!selectedCustomer) {
        setError("Please select a company");
        setSaving(false);
        return;
      }

      const effectiveName = selectedCustomer.name || customerName || "";
      const effectiveCompany = selectedCustomer.company || customerCompany || "";
      const effectiveAddress = selectedCustomer.address || customerAddress || "";

      const challanData = {
        challanNumber,
        date,
        vehicle: vehicle.trim(),
        poNumber: poNumber.trim(),
        customerId: selectedCustomer.id,
        customerName: effectiveName,
        customerCompany: effectiveCompany,
        customerAddress: effectiveAddress,
        customerNote: customerNote.trim(),
        items: items.map((item) => ({
          description: item.description.trim(),
          qty: Number(item.qty || 0),
        })),
        totalQuantity,
        status,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, "deliveryChallans", challanId), challanData);

      setMessage("Delivery challan updated successfully!");
      setTimeout(() => {
        router.push(`/delivery-challan/${challanId}`);
      }, 1500);
    } catch (err) {
      console.error("Error updating challan:", err);
      setError("Failed to update challan. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Edit Delivery Challan</h1>
        <p className="text-sm text-text-secondary">Update delivery challan details</p>
      </div>

      {message && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {message}
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Challan Details */}
        <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-text-primary">Challan Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Challan Number
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 p-2 rounded bg-gray-50"
                value={challanNumber}
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                className="w-full border border-gray-300 p-2 rounded"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vehicle <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 p-2 rounded"
                placeholder="e.g., HAROON"
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                className="w-full border border-gray-300 p-2 rounded"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="pending">Pending</option>
                <option value="delivered">Delivered</option>
                <option value="invoiced">Invoiced</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </section>

        {/* Company Details */}
        <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-text-primary">Company Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Company <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full border border-gray-300 p-2 rounded"
                value={selectedCustomerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
                required
              >
                <option value="">-- Select Company --</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.company || customer.name || "-"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PO Number
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 p-2 rounded"
                placeholder="Purchase Order Number"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Special Note (optional)
            </label>
            <input
              type="text"
              className="w-full border border-gray-300 p-2 rounded"
              placeholder="Note to show on challan print"
              value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value)}
            />
          </div>

          {selectedCustomerId && (
            <div className="mt-4 p-4 bg-gray-50 rounded border border-gray-200">
              <p className="text-sm"><strong>M/S:</strong> {customerCompany || customerName}</p>
              <p className="text-sm"><strong>Address:</strong> {customerAddress || "N/A"}</p>
            </div>
          )}
        </section>

        {/* Items */}
        <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-text-primary">Items</h2>
            <button
              type="button"
              onClick={addRow}
              className="bg-primary text-white px-3 py-1 rounded text-sm hover:bg-primary-dark flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add Item
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-200 text-gray-700">
                  <th className="p-2 text-left">S. No</th>
                  <th className="p-2 text-left">Description</th>
                  <th className="p-2 text-right">Quantity</th>
                  <th className="p-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="p-2 text-center">{idx + 1}</td>
                    <td className="p-2">
                      <input
                        type="text"
                        className="w-full border border-gray-300 p-1 rounded"
                        placeholder="Item description"
                        value={item.description}
                        onChange={(e) => updateItem(idx, "description", e.target.value)}
                        required
                      />
                    </td>
                    <td className="p-2 text-right">
                      <input
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9]*[.,]?[0-9]*"
                        className="w-24 border border-gray-300 p-1 rounded text-right"
                        value={item.qty}
                        onChange={(e) => updateItem(idx, "qty", e.target.value)}
                        required
                      />
                    </td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        className="text-red-600 hover:text-red-800 text-sm"
                        disabled={items.length === 1}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr className="bg-gray-100 font-bold border-t-2">
                  <td className="p-2" colSpan={2}>Total Quantity:</td>
                  <td className="p-2 text-right">{totalQuantity.toLocaleString()}</td>
                  <td className="p-2"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={saving}
            className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary-dark disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/delivery-challan/${challanId}`)}
            className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
