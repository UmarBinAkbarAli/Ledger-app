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
  QueryDocumentSnapshot,
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
  details?: string;
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
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [message, setMessage] = useState("");
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

        const user = auth.currentUser;
        if (!user) {
          setError("Not authenticated.");
          setLoading(false);
          return;
        }

        const userDoc = await getDoc(doc(db, "users", user.uid));
        const bizId = userDoc.exists() ? userDoc.data()?.businessId ?? null : null;

        // load supplier doc
        let supData: any = null;
        try {
          const supRef = doc(db, "suppliers", supplierId);
          const supSnap = await getDoc(supRef);
          if (supSnap.exists()) {
            supData = { id: supSnap.id, ...supSnap.data() };
          }
        } catch (err: any) {
          if (err?.code === "permission-denied") {
            const supQ = query(
              collection(db, "suppliers"),
              where("userId", "==", user.uid)
            );
            const supSnap = await getDocs(supQ);
            supSnap.forEach((d) => {
              if (d.id === supplierId) {
                supData = { id: d.id, ...d.data() };
              }
            });

            setMessage("Limited view: you don't have business-level access for this supplier.");
            setTimeout(() => setMessage(""), 6000);
          } else {
            throw err;
          }
        }

        if (!supData) {
          setError("Supplier not found.");
          setLoading(false);
          return;
        }
        setSupplier(supData);

        // --- purchases where supplierId == supplierId
        const pQ = bizId
          ? query(
              collection(db, "purchases"),
              where("businessId", "==", bizId),
              orderBy("date", "asc")
            )
          : query(
              collection(db, "purchases"),
              where("userId", "==", user.uid),
              orderBy("date", "asc")
            );

        let pSnap: any;
        try {
          pSnap = await getDocs(pQ);
        } catch (err: any) {
          if (err?.code === "permission-denied" && bizId) {
            pSnap = await getDocs(
              query(
                collection(db, "purchases"),
                where("userId", "==", user.uid),
                orderBy("date", "asc")
              )
            );
            setMessage("Limited view: purchases are restricted to your own records.");
            setTimeout(() => setMessage(""), 6000);
          } else {
            throw err;
          }
        }

        const pList: PurchaseDoc[] = pSnap.docs.map((d: QueryDocumentSnapshot) => ({
          id: d.id,
          ...(d.data() as any),
        }));

        // purchases that match by id OR by supplierName fallback
        const supplierNameNorm = normalize(supData.name || supData.supplierName || supData.name || "");
        const matchedPurchases = pList.filter((p) => {
          if (p.supplierId && p.supplierId === supplierId) return true;
          const pn = normalize(p.supplierName);
          return pn && supplierNameNorm && pn === supplierNameNorm;
        });

        setPurchases(matchedPurchases);

        // --- payments from expenses collection (supplier payments)
        const exQ = bizId
          ? query(
              collection(db, "expenses"),
              where("businessId", "==", bizId),
              orderBy("date", "asc")
            )
          : query(
              collection(db, "expenses"),
              where("userId", "==", user.uid),
              orderBy("date", "asc")
            );

        let exSnap: any;
        try {
          exSnap = await getDocs(exQ);
        } catch (err: any) {
          if (err?.code === "permission-denied" && bizId) {
            exSnap = await getDocs(
              query(
                collection(db, "expenses"),
                where("userId", "==", user.uid),
                orderBy("date", "asc")
              )
            );
            setMessage("Limited view: payments are restricted to your own records.");
            setTimeout(() => setMessage(""), 6000);
          } else {
            throw err;
          }
        }
        const exList: ExpenseDoc[] = exSnap.docs.map((d: QueryDocumentSnapshot) => ({
          id: d.id,
          ...(d.data() as any),
        }));

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

  // Auto-refresh when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        window.location.reload(); // Full reload to refresh all data
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

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
        particular: "Payment",
        notes:
        pay.details || (pay as any).note || (pay as any).notes || (pay as any).description || (pay as any).remarks ||"",
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
      <td className="p-3">
        {r.date ? String(r.date).slice(0, 10) : ""}
      </td>

      <td className="p-3">
        {r.particular}
      </td>

      {r.type === "payment" ? (
        <>
          {/* PAYMENT ROW NOTES (MERGED CELLS)
             --------------------------------
             Payment rows do not use:
             Folio, CH No, Size, Qty, Rate
             These cells are merged to display expense notes
          */}
          <td colSpan={5} className="p-3 italic text-gray-600">
            {r.notes || "—"}
          </td>
        </>
      ) : (
        <>
          <td className="p-3">{r.folio}</td>
          <td className="p-3">{r.chNo || "-"}</td>
          <td className="p-3 text-right">{r.size || "-"}</td>
          <td className="p-3 text-right">{r.qty || "-"}</td>
          <td className="p-3 text-right">{r.rate || "-"}</td>

          {/* PRICE CELL HIDDEN (INTENTIONAL)
              Used for row-level display only.
              Balance calculations rely on `purchase` / `payment`, NOT `price`. */}
          {/*
          <td className="p-3 text-right">
            {Number(r.price || 0).toLocaleString()}
          </td>
          */}
        </>
      )}

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
        {/* Price column hidden → colSpan adjusted */}
        <td colSpan={6}></td>
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

  /* ---------------------------------------------
   PDF DOWNLOAD (MATCH CUSTOMER LEDGER)
----------------------------------------------*/
const handlePDF = async () => {
  const fileName = `ledger-${(
    supplier?.company ||
    supplier?.supplierCompany ||
    supplier?.name ||
    "supplier"
  )
    .toString()
    .replace(/\s+/g, "_")}.pdf`;

  setGeneratingPDF(true);
  try {
    await generatePDF("pdf-area", fileName);
  } finally {
    setGeneratingPDF(false);
  }
};


  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
                    <div>
              {/* Company name = primary */}
              <h2 className="text-xl font-bold">
                {supplier.company ||
                  supplier.supplierCompany ||
                  supplier.name ||
                  supplier.supplierName}
              </h2>

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

          {/* Download PDF */}
            <button
              onClick={handlePDF}
              disabled={generatingPDF}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generatingPDF ? "Generating..." : "Download PDF"}
            </button>
        </div>
      </div>

      {message && (
        <div className="mb-4 text-sm text-yellow-700 bg-yellow-100 px-3 py-2 rounded print:hidden">
          {message}
        </div>
      )}

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


      <div id="pdf-area" className="bg-white rounded shadow overflow-auto ledger-export-area">

            {/* PRINT HEADER */}
      <div className="ledger-print-header hidden print:block mb-6">
        <div className="flex justify-between items-start border-b pb-3">
          {/* LEFT: Issuer */}
          <div>
            <h2 className="text-lg font-bold uppercase">
              Boxilla Packages
            </h2>
            <div className="text-sm">
              Plot # 470, Bhangoria Goth, Federal B. Industrial Area, Karachi
            </div>
            <div className="text-sm">
              Phone: 0312-8246221
            </div>
          </div>

          {/* RIGHT: Supplier */}
          <div className="text-right text-sm">
            <div className="font-bold uppercase mb-1">
              Supplier Statement
            </div>

            <div className="font-bold text-base">
              {supplier.company ||
                supplier.supplierCompany ||
                supplier.name ||
                supplier.supplierName}
            </div>

            <div className="mt-1">
              Date: {fromDate} → {toDate}
            </div>
          </div>
        </div>
      </div>

        <table className="ledger-export-table w-full print:text-[11px] print:leading-tight">
         <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Particular</th>
                  <th className="p-2 text-left">Folio</th>
                  <th className="p-2 text-left">CH No</th>
                  <th className="p-2 text-right">Size</th>
                  <th className="p-2 text-right">Qty</th>
                  <th className="p-2 text-right">Rate</th>
                   {/*  PRICE COLUMN HIDDEN (INTENTIONAL)
                      --------------------------------
                      Price represents per-item / row-level value.
                      Currently identical to "Purchase", so hidden for UI clarity.
                      Logic is preserved for future use (tax, freight, discount, adjustments).
                    */}
                    {/* <th className="p-2 text-right">Price</th> */}
                  <th className="p-2 text-right">Purchase</th>
                  <th className="p-2 text-right">Payment</th>
                  <th className="p-2 text-right">Balance</th>
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

      {/*}      // NOTE:
      // `price` represents row-level/item value for UI breakdown.
      // It is intentionally NOT used in balance calculation.
      // Currently hidden from UI because it equals `purchase`.
      // Preserved for future needs (tax, freight, discounts, adjustments).
        */}

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
