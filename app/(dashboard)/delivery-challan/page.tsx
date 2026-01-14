"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, deleteDoc, orderBy } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Challan {
  id: string;
  challanNumber: string;
  date: string;
  customerName: string;
  customerCompany: string;
  vehicle: string;
  totalQuantity: number;
  status: string;
}

export default function DeliveryChallanListPage() {
  const router = useRouter();
  const [challans, setChallans] = useState<Challan[]>([]);
  const [filteredChallans, setFilteredChallans] = useState<Challan[]>([]);
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedChallanIds, setSelectedChallanIds] = useState<string[]>([]);
  const [info, setInfo] = useState("");

  useEffect(() => {
    loadChallans();
  }, [businessId]);

  useEffect(() => {
    filterChallans();
  }, [search, statusFilter, challans]);

  useEffect(() => {
    const fetchBusiness = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        try {
          const tokenResult = await user.getIdTokenResult(true);
          console.log("Delivery challan debug:", {
            uid: user.uid,
            email: user.email,
            claims: tokenResult.claims,
            businessId,
          });
        } catch (err) {
          console.warn("Delivery challan debug failed to load token claims:", err);
        }
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const bizId = userDoc.exists() ? userDoc.data()?.businessId ?? null : null;
        setBusinessId(bizId);
      } catch (err: any) {
        // Handle permission errors gracefully and avoid uncaught rejects
        if (err?.code === "permission-denied") {
          console.warn("Permission denied reading user profile; falling back to legacy user isolation", { authedUser: auth.currentUser?.uid, message: err.message });
          setBusinessId(null);
          return;
        }
        console.error("Error fetching business profile:", err);
      }
    };
    fetchBusiness();
  }, []);

  const loadChallans = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setLoading(true);
    try {
      const byBusiness = businessId
        ? query(
            collection(db, "deliveryChallans"),
            where("businessId", "==", businessId),
            orderBy("date", "desc")
          )
        : null;
      const byUser = query(
        collection(db, "deliveryChallans"),
        where("userId", "==", user.uid),
        where("businessId", "==", null),
        orderBy("date", "desc")
      );

      // Prefer business scope; if denied (e.g., mismatched tenant), retry with userId fallback to avoid noisy errors.
      let snap;
      try {
        snap = byBusiness ? await getDocs(byBusiness) : await getDocs(byUser);
      } catch (err: any) {
        if (err?.code === "permission-denied" && byBusiness) {
          console.warn("Business scope denied; retrying with userId scope", {
            authedUser: user.uid,
            businessId,
          });
          snap = await getDocs(byUser);

          setInfo("Limited view: only your personal challans are shown because your account lacks business-level read access.");
          setTimeout(() => setInfo(""), 6000);
        } else {
          throw err;
        }
      }

      const list: Challan[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          challanNumber: data.challanNumber || "",
          date: data.date || "",
          customerName: data.customerName || "",
          customerCompany: data.customerCompany || "",
          vehicle: data.vehicle || "",
          totalQuantity: Number(data.totalQuantity || 0),
          status: data.status || "pending",
        };
      });

      setChallans(list);
    } catch (error: any) {
      // Avoid noisy empty-object logs; log only when an actual error is present
      if (!error) return;
      console.error("Error loading challans", {
        code: error?.code ?? "unknown",
        message: error?.message ?? String(error),
        authedUser: user?.uid,
        businessId,
      });
    } finally {
      setLoading(false);
    }
  };

  const filterChallans = () => {
    let filtered = [...challans];

    // Search filter
    if (search) {
      filtered = filtered.filter(
        (c) =>
          c.challanNumber.toLowerCase().includes(search.toLowerCase()) ||
          c.customerName.toLowerCase().includes(search.toLowerCase()) ||
          c.customerCompany.toLowerCase().includes(search.toLowerCase()) ||
          c.vehicle.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((c) => c.status === statusFilter);
    }

    setFilteredChallans(filtered);
  };

  const handleDelete = async (id: string, challanNumber: string) => {
    if (!confirm(`Delete challan ${challanNumber}?`)) return;

    try {
      await deleteDoc(doc(db, "deliveryChallans", id));
      loadChallans();
    } catch (error) {
      console.error("Error deleting challan:", error);
      alert("Failed to delete challan");
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: "bg-yellow-100 text-yellow-800",
      delivered: "bg-green-100 text-green-800",
      invoiced: "bg-blue-100 text-blue-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return styles[status as keyof typeof styles] || "bg-gray-100 text-gray-800";
  };

  // Bulk selection handlers
  const handleToggleSelect = (challanId: string) => {
    setSelectedChallanIds((prev) =>
      prev.includes(challanId)
        ? prev.filter((id) => id !== challanId)
        : [...prev, challanId]
    );
  };

  const handleSelectAll = () => {
    // Only select challans that can be invoiced (pending or delivered)
    const selectableChallans = filteredChallans.filter(
      (c) => c.status === "pending" || c.status === "delivered"
    );
    if (selectedChallanIds.length === selectableChallans.length) {
      setSelectedChallanIds([]);
    } else {
      setSelectedChallanIds(selectableChallans.map((c) => c.id));
    }
  };

  const handleCreateInvoiceFromSelected = () => {
    if (selectedChallanIds.length === 0) {
      alert("Please select at least one challan");
      return;
    }

    // Get the first selected challan to get customer info
    const firstChallan = challans.find((c) => c.id === selectedChallanIds[0]);
    if (!firstChallan) return;

    // Navigate to sales/new with selected challan IDs as query params
    const challanIdsParam = selectedChallanIds.join(",");
    router.push(`/sales/new?challanIds=${challanIdsParam}`);
  };

  if (loading) return <div className="p-6">Loading challans...</div>;

  const selectableChallans = filteredChallans.filter(
    (c) => c.status === "pending" || c.status === "delivered"
  );

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Delivery Challans</h1>
        {info && (
          <div className="ml-4 text-sm text-yellow-700 bg-yellow-100 px-3 py-1 rounded">{info}</div>
        )}
        <div className="flex gap-3">
          {selectedChallanIds.length > 0 && (
            <button
              onClick={handleCreateInvoiceFromSelected}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">receipt_long</span>
              Create Invoice ({selectedChallanIds.length})
            </button>
          )}
          <Link
            href="/delivery-challan/new"
            className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Create Challan
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="Search by challan no, customer, vehicle..."
          className="border border-gray-300 p-2 rounded"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="border border-gray-300 p-2 rounded"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="delivered">Delivered</option>
          <option value="invoiced">Invoiced</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Challans Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3 text-center w-12">
                  <input
                    type="checkbox"
                    checked={selectedChallanIds.length === selectableChallans.length && selectableChallans.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 cursor-pointer"
                  />
                </th>
                <th className="p-3 text-left text-sm font-semibold text-gray-700">Challan No</th>
                <th className="p-3 text-left text-sm font-semibold text-gray-700">Date</th>
                <th className="p-3 text-left text-sm font-semibold text-gray-700">Customer</th>
                <th className="p-3 text-left text-sm font-semibold text-gray-700">Vehicle</th>
                <th className="p-3 text-right text-sm font-semibold text-gray-700">Total Qty</th>
                <th className="p-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="p-3 text-center text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredChallans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-gray-500">
                    No challans found
                  </td>
                </tr>
              ) : (
                filteredChallans.map((challan) => {
                  const isSelectable = challan.status === "pending" || challan.status === "delivered";
                  return (
                    <tr key={challan.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 text-center">
                        {isSelectable ? (
                          <input
                            type="checkbox"
                            checked={selectedChallanIds.includes(challan.id)}
                            onChange={() => handleToggleSelect(challan.id)}
                            className="w-4 h-4 cursor-pointer"
                          />
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="p-3 font-medium text-primary">{challan.challanNumber}</td>
                    <td className="p-3 text-sm">{challan.date}</td>
                    <td className="p-3">
                      <div className="text-sm font-medium">{challan.customerCompany || challan.customerName}</div>
                      {challan.customerCompany && (
                        <div className="text-xs text-gray-500">{challan.customerName}</div>
                      )}
                    </td>
                    <td className="p-3 text-sm">{challan.vehicle}</td>
                    <td className="p-3 text-right font-semibold">{challan.totalQuantity.toLocaleString()}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(challan.status)}`}>
                        {challan.status.charAt(0).toUpperCase() + challan.status.slice(1)}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/delivery-challan/${challan.id}`}
                          className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                          View
                        </Link>
                        <Link
                          href={`/delivery-challan/${challan.id}/edit`}
                          className="text-green-600 hover:text-green-800 text-sm flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(challan.id, challan.challanNumber)}
                          className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
