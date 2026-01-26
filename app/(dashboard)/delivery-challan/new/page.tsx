"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
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
  const [businessId, setBusinessId] = useState<string | null>(null);

  // Form fields
  const [challanNumber, setChallanNumber] = useState("");
  const [date, setDate] = useState(() => getPakistanDate());
  const [vehicle, setVehicle] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerCompany, setCustomerCompany] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerNote, setCustomerNote] = useState("");

  // Items
  const [items, setItems] = useState<Item[]>([
    { description: "", qty: "1" },
  ]);

  // Customers list
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<Customer[]>([]);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);

  // UI
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Load current user's businessId, then customers
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        // Fetch businessId from user profile (tenant boundary), fallback to claims
        const userDoc = await getDoc(doc(db, "users", user.uid));
        let bizId = userDoc.exists() ? userDoc.data()?.businessId ?? null : null;
        if (!bizId) {
          try {
            const tokenResult = await user.getIdTokenResult();
            bizId = (tokenResult.claims.businessId as string | undefined) || null;
          } catch (claimErr) {
            console.warn("Could not fetch businessId from claims", claimErr);
          }
        }
        setBusinessId(bizId);

        // Prefer business-scoped query; if denied, retry with user-scoped query
        const byBusiness = bizId ? query(collection(db, "customers"), where("businessId", "==", bizId)) : null;
        const byUser = query(collection(db, "customers"), where("userId", "==", user.uid), where("businessId", "==", null));

        let snap;
        try {
          snap = byBusiness ? await getDocs(byBusiness) : await getDocs(byUser);
        } catch (err: any) {
          if (err?.code === "permission-denied" && byBusiness) {
            console.warn("Business scope denied loading customers; retrying with userId scope", { authedUser: user.uid, businessId: bizId });
            snap = await getDocs(byUser);

            // Inform the user that we're showing only their personal records
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

  // Auto-generate challan number
  useEffect(() => {
    const generateChallanNumber = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        // Prefer business-scoped query; if denied, retry with user-scoped query
        const byBusiness = businessId ? query(collection(db, "deliveryChallans"), where("businessId", "==", businessId)) : null;
        const byUser = query(collection(db, "deliveryChallans"), where("userId", "==", user.uid), where("businessId", "==", null));

        let snap;
        try {
          snap = byBusiness ? await getDocs(byBusiness) : await getDocs(byUser);
        } catch (err: any) {
          if (err?.code === "permission-denied" && byBusiness) {
            console.warn("Business scope denied generating challan number; retrying with userId scope", { authedUser: user.uid, businessId });
            snap = await getDocs(byUser);

            // Communicate fallback to the user
            setMessage("Limited view: challan numbers are scoped to your account because you lack business-level read access.");
            setTimeout(() => setMessage(""), 6000);
          } else {
            throw err;
          }
        }

        const nextNumber = snap.size + 1;
        setChallanNumber(`CH-${nextNumber.toString().padStart(4, "0")}`);
      } catch (err: any) {
        if (err?.code === "permission-denied") {
          console.warn("Permission denied generating challan number; defaulting to 1", { authedUser: auth.currentUser?.uid, businessId, message: err.message });
          setChallanNumber(`CH-0001`);
          return;
        }
        console.error("Error generating challan number:", err);
      }
    };

    generateChallanNumber();
  }, [businessId]);

  // Filter companies real-time (search by company name)
  useEffect(() => {
    if (!customerCompany.trim()) {
      setFilteredCompanies([]);
      return;
    }

    const s = customerCompany.toLowerCase();
    const filtered = customers.filter((c) => {
      const company = (c.company || "").toLowerCase();
      const name = (c.name || "").toLowerCase();
      return company.includes(s) || (!company && name.includes(s));
    });
    setFilteredCompanies(filtered);
  }, [customerCompany, customers]);

  // Handle customer selection by id (used when selecting from company dropdown too)
  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const customer = customers.find((c) => c.id === customerId);
    if (customer) {
      setCustomerName(customer.name);
      setCustomerCompany(customer.company || customer.name);
      setCustomerAddress(customer.address);
    }
    // Close dropdowns when selecting
    setShowCompanyDropdown(false);
  };

  // Select customer by company
  const handleSelectCompany = (c: Customer) => {
    handleCustomerChange(c.id);
    setShowCompanyDropdown(false);
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

  // Calculate total quantity (allow decimals)
  const totalQuantity = items.reduce((sum, item) => sum + (parseFloat(item.qty as any) || 0), 0);

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    const user = auth.currentUser;
    if (!user) {
      setError("Not authenticated");
      return;
    }

    // Re-fetch current user profile early so any created records use the authoritative businessId
    const userDoc = await getDoc(doc(db, "users", user.uid));
    let userBusinessId = userDoc.exists() ? (userDoc.data()?.businessId ?? null) : null;
    if (!userBusinessId) {
      try {
        const tokenResult = await user.getIdTokenResult();
        userBusinessId = (tokenResult.claims.businessId as string | undefined) || null;
      } catch (claimErr) {
        console.warn("Could not fetch businessId from claims", claimErr);
      }
    }
    const businessIdForWrite = userBusinessId ?? null; // legacy users keep businessId null for rules

    if (!selectedCustomerId) {
      setError("Please select a company from the list");
      return;
    }

    if (!vehicle.trim()) {
      setError("Please enter vehicle details");
      return;
    }

    const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
    if (!selectedCustomer) {
      setError("Please select a valid company");
      return;
    }

    if (items.some((item) => !item.description.trim())) {
      setError("Please fill all item descriptions");
      return;
    }

    setLoading(true);

    try {
      if (!user) throw new Error("Not authenticated");

      const challanData = {
        userId: user.uid,
        businessId: businessIdForWrite,
        challanNumber,
        date,
        vehicle: vehicle.trim(),
        poNumber: poNumber.trim(),
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name || "",
        customerCompany: selectedCustomer.company || "",
        customerAddress: selectedCustomer.address || "",
        customerNote: customerNote.trim(),
        items: items.map((item) => ({
          description: item.description.trim(),
          qty: Number(item.qty || 0),
        })),
        totalQuantity,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Save challan and redirect to its preview page (so user can print/download)
      let docRef;
      try {
        docRef = await addDoc(collection(db, "deliveryChallans"), challanData);
      } catch (err: any) {
        // If Firestore denies create due to mismatched tenant, provide a clear message
        if (err?.code === "permission-denied") {
          console.error("Permission denied creating challan", {
            authedUser: user.uid,
            userBusinessId,
            businessIdForWrite,
            errorMessage: err.message,
          });
          setError("Permission denied: your account cannot create a challan for this business. Please contact your administrator.");
          return;
        }
        throw err;
      }

      router.push(`/delivery-challan/${docRef.id}`);
    } catch (err: any) {
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

        {/* Company Details */}
        <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-text-primary">Company Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Company (searchable) */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 p-2 rounded"
                placeholder="Search company (or name)"
                value={customerCompany}
                onChange={(e) => {
                  setCustomerCompany(e.target.value);
                  setCustomerName("");
                  setCustomerAddress("");
                  setSelectedCustomerId("");
                  setShowCompanyDropdown(true);
                }}
                onFocus={() => setShowCompanyDropdown(true)}
                required
              />

              {showCompanyDropdown && filteredCompanies.length > 0 && (
                <div className="absolute z-20 bg-white border border-gray-300 rounded mt-1 w-full max-h-40 overflow-y-auto shadow-lg">
                  {filteredCompanies.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectCompany(c)}
                      className="flex flex-col items-start w-full text-left px-3 py-2 hover:bg-blue-100"
                    >
                      <span className="font-semibold">{c.company || c.name || "-"}</span>
                    </button>
                  ))}
                </div>
              )}
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
              Company Note (optional)
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
