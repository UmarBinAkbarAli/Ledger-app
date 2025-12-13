"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { generatePDF } from "@/app/utils/pdfGenerator";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  getDoc,
} from "firebase/firestore";
import { Fragment } from "react";

type PurchaseDoc = {
  id?: string;
  supplierId?: string;
  supplierName?: string;
  supplierCompany?: string;
  supplierAddress?: string;
  supplierPhone?: string;
  billNumber?: string;
  chNo?: string;
  date?: any;
  items?: any[];
  subtotal?: number;
  total?: number;
  paidAmount?: number;
  details?: string;
  userId?: string;
  createdAt?: any;
};

type ExpenseDoc = {
  id?: string;
  supplierId?: string;
  supplierName?: string;
  amount?: number;
  date?: any;
  userId?: string;
  createdAt?: any;
};

export default function SupplierLedgerPage() {
  const params = useParams() as { supplierId?: string };
  const supplierId = params.supplierId ?? "";
  const router = useRouter();

  const [supplier, setSupplier] = useState<any | null>(null);
  const [purchases, setPurchases] = useState<PurchaseDoc[]>([]);
  const [payments, setPayments] = useState<ExpenseDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  // safe normalize
  const normalize = (s?: string) => (s || "").trim().toLowerCase();

  useEffect(() => {
    const loadAll = async () => {
      try {
        setLoading(true);
        if (!supplierId) {
          setError("Supplier id is missing.");
          setLoading(false);
          return;
        }

        // load supplier doc
        const supRef = doc(db, "suppliers", supplierId);
        const supSnap = await getDoc(supRef);
        if (!supSnap.exists()) {
          setError("Supplier not found.");
          setLoading(false);
          return;
        }
        const supData: any = supSnap.data();
        setSupplier({ id: supSnap.id, ...supData });

        const user = auth.currentUser;
        if (!user) {
          setError("Not authenticated.");
          setLoading(false);
          return;
        }

        // --- purchases where supplierId == supplierId
        const pQ = query(
          collection(db, "purchases"),
          where("userId", "==", user.uid),
          orderBy("date", "asc")
        );

        const pSnap = await getDocs(pQ);
        const pList: PurchaseDoc[] = pSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

        // purchases that match by id OR by supplierName fallback
        const supplierNameNorm = normalize(supData.name || supData.supplierName || supData.name || "");
        const matchedPurchases = pList.filter((p) => {
          if (p.supplierId && p.supplierId === supplierId) return true;
          const pn = normalize(p.supplierName);
          return pn && supplierNameNorm && pn === supplierNameNorm;
        });

        setPurchases(matchedPurchases);

        // --- payments from expenses collection (supplier payments)
        const exQ = query(
          collection(db, "expenses"),
          where("userId", "==", user.uid),
          orderBy("date", "asc")
        );
        const exSnap = await getDocs(exQ);
        const exList: ExpenseDoc[] = exSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

        const matchedPayments = exList.filter((e) => {
          if (e.supplierId && e.supplierId === supplierId) return true;
          const en = normalize(e.supplierName);
          return en && supplierNameNorm && en === supplierNameNorm;
        });

        setPayments(matchedPayments);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to load ledger.");
      } finally {
        setLoading(false);
      }
    };

    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  // Build ledger rows: previous balance, purchases, payments
  const rows = useMemo(() => {
    if (!supplier) return [];

    const built: any[] = [];

    // previous balance
    const prevBal = Number(supplier.previousBalance || 0);
    built.push({
      id: `prev-${supplier.id || "0"}`,
      date: "",
      particular: "Previous Balance",
      folio: "",
      qty: "",
      rate: "",
      price: "",
      purchase: 0,
      payment: 0,
      balance: prevBal,
      type: "previous",
    });

    // purchases -> each purchase may have items[]; if items exist, list each item; else show purchase total
    purchases.forEach((p) => {
      const purchaseDate = p.date || p.createdAt || "";
      if (Array.isArray(p.items) && p.items.length > 0) {
        p.items.forEach((it: any, idx: number) => {
          built.push({
            id: `${p.id}-item-${idx}`,
            date: purchaseDate,
            particular: it.description || p.billNumber || "Purchase",
            folio: p.billNumber || "",
            size: it.size ?? "",
            qty: it.qty ?? "",
            rate: it.unitPrice ?? "",
            price: it.amount ?? (it.qty && it.unitPrice ? it.qty * it.unitPrice : p.total || 0),
            purchase: Number(it.amount ?? (it.qty && it.unitPrice ? it.qty * it.unitPrice : 0)),
            payment: 0,
            chNo: p.chNo || "",
            type: "purchase",
          });
        });
      } else {
        built.push({
            id: p.id,
            date: purchaseDate,
            particular: p.details || p.billNumber || "Purchase",
            folio: p.billNumber || "",
            qty: "",
            rate: "",
            price: p.total ?? p.subtotal ?? 0,
            purchase: Number(p.total ?? p.subtotal ?? 0),
            payment: 0,
            type: "purchase",
          });

      }
    });

    // payments
    payments.forEach((pay) => {
      built.push({
        id: `pay-${pay.id}`,
        date: pay.date || pay.createdAt || "",
        particular: `Payment - ${pay.supplierName || ""}`,
        folio: "",
        qty: "",
        rate: "",
        price: Number(pay.amount || 0),
        purchase: 0,
        payment: Number(pay.amount || 0),
        type: "payment",
      });
    });

    // Safe date parser (handles strings, timestamps)
    const parseDateSafe = (d: any): number => {
      if (!d) return Number.NEGATIVE_INFINITY;
      if (d?.toDate && typeof d.toDate === "function") {
        const t = d.toDate().getTime();
        return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
      }
      if (d instanceof Date) {
        const t = d.getTime();
        return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
      }
      if (typeof d === "number") return Number.isFinite(d) ? d : Number.NEGATIVE_INFINITY;
      if (typeof d === "string") {
        const s = d.trim();
        if (!s) return Number.NEGATIVE_INFINITY;
        const parsed = Date.parse(s);
        return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
      }
      return Number.NEGATIVE_INFINITY;
    };

    // stable sort with type tie-breaker (previous -> purchase -> payment)
    const typeOrder: Record<string, number> = { previous: 0, purchase: 1, payment: 2 };

    const sorted = built.sort((a, b) => {
      const da = parseDateSafe(a.date);
      const db = parseDateSafe(b.date);
      if (da === db) {
        const ta = typeOrder[a.type] ?? 99;
        const tb = typeOrder[b.type] ?? 99;
        if (ta !== tb) return ta - tb;
        return String(a.id || "").localeCompare(String(b.id || ""));
      }
      return da - db;
    });

    // calculate running balance
    let running = prevBal;
    const withRunning = sorted.map((r) => {
      if (r.type === "previous") {
        // previous already set
        return { ...r, balance: running };
      }
      running = running + (Number(r.purchase || 0) - Number(r.payment || 0));
      return { ...r, balance: running };
    });

    return withRunning;
  }, [supplier, purchases, payments]);

  // filteredRows MUST come AFTER rows
  const filteredRows = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate) : null;
    const q = (search || "").trim().toLowerCase();

    return rows.filter((r) => {
      // date filter
      const rDate = r.date ? new Date(String(r.date)) : null;
      if (from && rDate && rDate < from) return false;
      if (to && rDate && rDate > to) return false;

      // search filter: particular or folio
      if (q) {
        const part = (r.particular || "").toString().toLowerCase();
        const fol = (r.folio || "").toString().toLowerCase();
        return part.includes(q) || fol.includes(q);
      }
      return true;
    });
  }, [rows, fromDate, toDate, search]);

     const renderedRows = useMemo(() => {
  const grouped: Record<string, any[]> = {};

  filteredRows.forEach((r: any) => {
    if (r.type === "purchase") {
      if (!grouped[r.folio]) grouped[r.folio] = [];
      grouped[r.folio].push(r);
    }
  });

  return filteredRows.map((r: any) => {
    const isLastPurchaseRow =
      r.type === "purchase" &&
      grouped[r.folio] &&
      grouped[r.folio][grouped[r.folio].length - 1].id === r.id;

    const purchaseTotal = isLastPurchaseRow
      ? grouped[r.folio].reduce(
          (sum: number, x: any) => sum + Number(x.price || 0),
          0
        )
      : 0;

    return (
      <Fragment key={r.id}>
        <tr className={`border-t ${r.type === "payment" ? "bg-yellow-50" : ""}`}>
          <td className="p-3">{r.date ? String(r.date).slice(0, 10) : ""}</td>
          <td className="p-3">{r.particular}</td>
          <td className="p-3">{r.folio}</td>
          <td className="p-3">{r.chNo || "-"}</td>
          <td className="p-3 text-right">{r.size || "-"}</td>
          <td className="p-3 text-right">{r.qty || "-"}</td>
          <td className="p-3 text-right">{r.rate || "-"}</td>
          <td className="p-3 text-right">
            {Number(r.price || 0).toLocaleString()}
          </td>
          <td className="p-3 text-right">
            {Number(r.purchase || 0).toLocaleString()}
          </td>
          <td className="p-3 text-right">
            {Number(r.payment || 0).toLocaleString()}
          </td>
          <td className="p-3 text-right font-semibold">
            {Number(r.balance || 0).toLocaleString()}
          </td>
        </tr>

        {isLastPurchaseRow && (
          <tr className="bg-gray-200 font-semibold border-b">
            <td colSpan={7}></td>
            <td className="p-3 text-right">Bill Total:</td>
            <td className="p-3 text-right">
              {purchaseTotal.toLocaleString()}
            </td>
            <td colSpan={2}></td>
          </tr>
        )}
      </Fragment>
    );
  });
}, [filteredRows]);

  if (loading) return <p className="p-6">Loading ledger...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;
  if (!supplier) return <p className="p-6">Supplier not found</p>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">{supplier.name || supplier.supplierName}</h1>
          <p className="text-sm text-gray-600">{supplier.company || supplier.supplierCompany || ""}</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/purchase/new?supplierId=${supplier.id}`)}
            className="px-3 py-1 bg-blue-700 text-white rounded hover:bg-blue-800"
          >
            Add Purchase
          </button>

          <button
            onClick={() => router.push(`/expenses?supplierId=${supplier.id}`)}
            className="px-3 py-1 bg-amber-600 text-white rounded hover:bg-amber-700"
          >
            Add Payment
          </button>

          <button
            onClick={() => window.print()}
            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Print Ledger
          </button>

          <button
            onClick={() => {
              try {
                // generatePDF("ledger-area", `supplier-ledger-${supplier.id}.pdf`);
                window.print();
              } catch (e) {
                window.print();
              }
            }}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Download PDF
          </button>
        </div>
      </div>

      {/* Filters row (copy of customer ledger style) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div>
          <label className="text-sm block mb-1">From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full border p-2 rounded" />
        </div>

        <div>
          <label className="text-sm block mb-1">To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full border p-2 rounded" />
        </div>

        <div>
          <label className="text-sm block mb-1">Search Particular or FOLO</label>
          <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full border p-2 rounded" />
        </div>
      </div>

      <div id="ledger-area" className="bg-white rounded shadow overflow-auto">
        <table className="min-w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Particular</th>
              <th className="p-3 text-left">Folio</th>
              <th className="p-3 text-left">CH No</th>
              <th className="p-3 text-right">Size</th>
              <th className="p-3 text-right">Qty</th>
              <th className="p-3 text-right">Rate</th>
              <th className="p-3 text-right">Price</th>
              <th className="p-3 text-right">Purchase</th>
              <th className="p-3 text-right">Payment</th>
              <th className="p-3 text-right">Balance</th>
            </tr>
          </thead>

          <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-6 text-center text-gray-500">
                      No transactions
                    </td>
                  </tr>
                ) : (
                  renderedRows
                )}
              </tbody> 
        </table>
      </div>

      {/* FOOTER: Opening / Closing Balance (aligned right like customer ledger) */}
                <div className="mt-6 flex justify-end">
            <div className="w-72">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Opening Balance</span>
                <span>
                  {Number(supplier.previousBalance || 0).toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between text-lg font-bold mt-2">
                <span>Closing Balance</span>
                <span>
                  {Number(
                    filteredRows.length
                      ? filteredRows[filteredRows.length - 1].balance
                      : supplier.previousBalance || 0
                  ).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

    </div>
  );
}
