"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { getPakistanDate } from "@/lib/dateUtils";

interface Item {
  description: string;
  qty: string;
}

interface Customer {
  id: string;
  name: string;
  company: string;
  address: string;
}

export default function NewDeliveryChallanPage() {
  const router = useRouter();

  // Form fields
  const [challanNumber, setChallanNumber] = useState("");
  const [date, setDate] = useState(() => getPakistanDate());
  const [vehicle, setVehicle] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerCompany, setCustomerCompany] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  // Items
  const [items, setItems] = useState<Item[]>([
    { description: "", qty: "1" },
  ]);

  // Customers list
  const [customers, setCustomers] = useState<Customer[]>([]);

  // UI
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Load customers
  useEffect(() => {
    const loadCustomers = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const q = query(
        collection(db, "customers"),
        where("userId", "==", user.uid)
      );
      const snap = await getDocs(q);

      const list: Customer[] = snap.docs.map((d) => ({
        id: d.id,
        name: d.data().name || "",
        company: d.data().company || "",
        address: d.data().address || "",
      }));

      setCustomers(list);
    };

    loadCustomers();
  }, []);

  // Auto-generate challan number
  useEffect(() => {
    const generateChallanNumber = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const q = query(
        collection(db, "deliveryChallans"),
        where("userId", "==", user.uid)
      );
      const snap = await getDocs(q);

      const nextNumber = snap.size + 1;
      setChallanNumber(`CH-${nextNumber.toString().padStart(4, "0")}`);
    };

    generateChallanNumber();
  }, []);

  // Handle customer selection
  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const customer = customers.find((c) => c.id === customerId);
    if (customer) {
      setCustomerName(customer.name);
      setCustomerCompany(customer.company);
      setCustomerAddress(customer.address);
    }
  };

  // Item operations
  const updateItem = (index: number, field: keyof Item, value: string) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const addRow = () => {
    setItems((prev) => [...prev, { description: "", qty: "1" }]);
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

    if (!selectedCustomerId) {
      setError("Please select a customer");
      return;
    }

    if (!vehicle.trim()) {
      setError("Please enter vehicle details");
      return;
    }

    if (items.some((item) => !item.description.trim())) {
      setError("Please fill all item descriptions");
      return;
    }

    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      const challanData = {
        userId: user.uid,
        challanNumber,
        date,
        vehicle: vehicle.trim(),
        poNumber: poNumber.trim(),
        customerId: selectedCustomerId,
        customerName,
        customerCompany,
        customerAddress,
        items: items.map((item) => ({
          description: item.description.trim(),
          qty: Number(item.qty || 0),
        })),
        totalQuantity,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, "deliveryChallans"), challanData);

      setMessage("Delivery challan created successfully!");
      setTimeout(() => {
        router.push("/delivery-challan");
      }, 1500);
    } catch (err) {
      console.error("Error creating challan:", err);
      setError("Failed to create challan. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Create Delivery Challan</h1>
        <p className="text-sm text-text-secondary">Create a new delivery challan for goods dispatch</p>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Challan Number <span className="text-red-500">*</span>
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
          </div>
        </section>

        {/* Customer Details */}
        <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-text-primary">Customer Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Customer <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full border border-gray-300 p-2 rounded"
                value={selectedCustomerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
                required
              >
                <option value="">-- Select Customer --</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.company || customer.name}
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
                        type="number"
                        min="0"
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
            disabled={loading}
            className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary-dark disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? "Creating..." : "Create Challan"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/delivery-challan")}
            className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

