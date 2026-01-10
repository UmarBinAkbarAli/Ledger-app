"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  DocumentData,
  QuerySnapshot,
} from "firebase/firestore";
import { generatePDF } from "@/app/utils/pdfGenerator";

/* ---------------------------------------------
   Customer Type
----------------------------------------------*/
interface CustomerType {
  id: string;
  name?: string;
  company?: string;
  phone?: string;
  address?: string;
  previousBalance?: number;
  [key: string]: any;
}

/* ---------------------------------------------
   Ledger Row Type
----------------------------------------------*/
type LedgerRow = {
  id: string;
  type: "sale" | "payment" | "previous";
  date: string;
  particular: string;
  folio: string;
  qty: number | "";
  rate: number | "";
  price: number;
  receive: number;
  highlight?: boolean;
  notes?: string; // Payment info/details
  running?: number;
};

export default function CustomerLedgerPage(): JSX.Element {
  const router = useRouter();
  const params = useParams() as { customerId?: string };
  const customerId = params.customerId ?? "";

  const [customer, setCustomer] = useState<CustomerType | null>(null);
  const [sales, setSales] = useState<DocumentData[]>([]);
  const [payments, setPayments] = useState<DocumentData[]>([]);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [openingBalance, setOpeningBalance] = useState<number>(0);

  // Filters
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  /* ---------------------------------------------
     Load Customer + Sales + Payments
  ----------------------------------------------*/
  useEffect(() => {
    let mounted = true;

    const loadAll = async () => {
      try {
        setLoading(true);
        const user = auth.currentUser;
        if (!user) {
          router.push("/login");
          return;
        }

        /* -----------------------------
           LOAD CUSTOMER
        ------------------------------*/
        const custQ = query(
          collection(db, "customers"),
          where("userId", "==", user.uid)
        );
        const custSnap: QuerySnapshot = await getDocs(custQ);

        let foundCustomer: any = null;
        custSnap.forEach((d) => {
          if (d.id === customerId) {
            foundCustomer = { id: d.id, ...d.data() };
          }
        });

        if (mounted) setCustomer(foundCustomer);
        if (!foundCustomer) {
          setSales([]);
          setPayments([]);
          setLoading(false);
          return;
        }

        // Normalize helper
        const normalize = (v: any) =>
          (v || "").toString().trim().toLowerCase();
        const custName = normalize(foundCustomer.name);

        /* -----------------------------
           LOAD SALES
        ------------------------------*/
        const salesQ = query(
          collection(db, "sales"),
          where("userId", "==", user.uid)
        );
        const sSnap = await getDocs(salesQ);

        const allSales: DocumentData[] = [];
        sSnap.forEach((d) => allSales.push({ id: d.id, ...d.data() }));

       const customerSales = allSales.filter((s) => {
        const saleName = normalize(s.customerName);
        const customerNameNormalized = normalize(foundCustomer.name);

        return (
          s.customerId === customerId ||
          saleName === customerNameNormalized
        );
      });


        if (mounted) setSales(customerSales);

        /* -----------------------------
           LOAD PAYMENTS
        ------------------------------*/
        const incQ = query(
          collection(db, "income"),
          where("userId", "==", user.uid)
        );
        const incSnap = await getDocs(incQ);

        const allPayments: DocumentData[] = [];
        incSnap.forEach((d) => allPayments.push({ id: d.id, ...d.data() }));

        const paymentsCustomerName = normalize(foundCustomer.name);

          const customerPayments = allPayments.filter((p) => {
            const pName = normalize(p.customerName);
            return pName === paymentsCustomerName;
          });


        if (mounted) setPayments(customerPayments);
      } catch (error) {
        console.error("Load Ledger Error:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadAll();

    return () => {
      mounted = false;
    };
  }, [customerId, router]);

  /* ---------------------------------------------
     Auto-refresh when page becomes visible
  ----------------------------------------------*/
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        window.location.reload(); // Full reload to refresh all data
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  /* ---------------------------------------------
     Build Ledger Rows (date filters affect visibility only — balances are continuous)
  ----------------------------------------------*/
  useEffect(() => {
    if (!customer) return;

    const built: LedgerRow[] = [];

    /* -----------------------------
       SALES → ITEM ROWS
    ------------------------------*/
    for (const s of sales) {
      const items = Array.isArray(s.items) ? s.items : [];

      const rawDate = s.date ?? s.createdAt ?? "";
      const saleDate =
        typeof rawDate === "string"
          ? rawDate.toString().slice(0, 10)
          : rawDate?.toDate
          ? rawDate.toDate().toISOString().slice(0, 10)
          : new Date(rawDate).toISOString().slice(0, 10);

      items.forEach((it: any, i: number) => {
        const qty = Number(it?.qty ?? 0);
        const rate = Number(it?.unitPrice ?? it?.rate ?? 0);
        const price = qty * rate;

        built.push({
          id: `sale-${s.id}-${i}`,
          type: "sale",
          date: saleDate,
          particular: it.description ?? "Item",
          folio: s.billNumber ?? s.id,
          qty,
          rate,
          price,
          receive: 0,
        });
      });
    }

    /* -----------------------------
       PAYMENTS
    ------------------------------*/
    for (const p of payments) {
      const rawDate = p.date ?? p.createdAt ?? "";
      const payDate =
        typeof rawDate === "string"
          ? rawDate.toString().slice(0, 10)
          : rawDate?.toDate
          ? rawDate.toDate().toISOString().slice(0, 10)
          : new Date(rawDate).toISOString().slice(0, 10);

      built.push({
        id: `pay-${p.id}`,
        type: "payment",
        date: payDate,
        particular: "Payment Received",
        folio: p.billNumber ?? "-",
        qty: "",
        rate: "",
        price: 0,
        receive: Number(p.amount ?? 0),
        highlight: true,
        notes: p.details || (p as any).note || (p as any).notes || (p as any).description || (p as any).remarks || "",
      });
    }

    /* -----------------------------
       SORT BY DATE (robust)
    ------------------------------*/
    const sorted = built.sort((a, b) => {
      const ta = a.date ? new Date(a.date).getTime() : 0;
      const tb = b.date ? new Date(b.date).getTime() : 0;
      return ta - tb;
    });

    /* -----------------------------
       OPENING BALANCE (include transactions before fromDate)
    ------------------------------*/
    const baseOpening = Number(customer.previousBalance ?? 0);
    let opening = baseOpening;

    if (fromDate) {
      const pre = sorted.filter((r) => r.date && new Date(r.date) < new Date(fromDate));
      for (const t of pre) {
        opening = opening + Number(t.price || 0) - Number(t.receive || 0);
      }
    }

    /* -----------------------------
       TRANSACTIONS IN SELECTED RANGE (these will be displayed / processed for running balance)
    ------------------------------*/
    const inRange = sorted.filter((r) => {
      if (fromDate && r.date) {
        if (new Date(r.date) < new Date(fromDate)) return false;
      }

      if (toDate && r.date) {
        const td = new Date(toDate);
        const rd = new Date(r.date);
        const end = new Date(td.getFullYear(), td.getMonth(), td.getDate(), 23, 59, 59);
        if (rd > end) return false;
      }

      return true; // NOTE: do NOT apply search here — search only affects visibility
    });

    /* -----------------------------
       Compute running balance starting from opening
    ------------------------------*/
    let bal = opening;
    const processed: LedgerRow[] = inRange.map((r) => {
      bal = bal + Number(r.price || 0) - Number(r.receive || 0);
      return { ...r, running: bal } as LedgerRow & { running: number };
    });

    setRows(processed);
    setOpeningBalance(opening);
  }, [customer, sales, payments, fromDate, toDate]);

  /* ---------------------------------------------
     Running Balance
     (already computed in build step; rows[] contains running property)
  ----------------------------------------------*/
  // rows: Ledger rows for the selected date range, each has `.running` calculated starting from `openingBalance`


  /* ---------------------------------------------
     PDF + PRINT
  ----------------------------------------------*/
  const handlePrint = () => window.print();

  const handlePDF = () => {
    const fileName = `ledger-${(customer?.name ?? "customer")
      .toString()
      .replace(/\s+/g, "_")}.pdf`;
    generatePDF("pdf-area", fileName);
  };

  /* ---------------------------------------------
     RENDER
  ----------------------------------------------*/
  if (loading) return <div className="p-6">Loading ledger...</div>;

  return (
    <div className="w-full max-w-[1200px] mx-auto p-4">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-4 print:hidden">
                    <div>
              {/* Company name = primary */}
              <h2 className="text-xl font-bold">
                {customer?.company || customer?.name || "Customer"}
              </h2>

              {/* Person name = secondary */}
              {customer?.company && (
                <p className="text-sm text-gray-600">
                  {customer?.name}
                </p>
              )}

              <p className="text-sm text-gray-600">
                Phone: {customer?.phone ?? ""}
              </p>
            </div>

        <div className="flex gap-2">
            {/* Add Sale */}
            <button
              onClick={() => router.push(`/sales/new?saleCustomerId=${customerId}`)}
              className="px-3 py-1 bg-blue-700 text-white rounded hover:bg-blue-800"
            >
              Add Sale
            </button>

            {/* Add Payment */}
            <button
              onClick={() => router.push(`/income?customerId=${customerId}`)}
              className="px-3 py-1 bg-amber-600 text-white rounded hover:bg-amber-700"
            >
              Add Payment
            </button>

            {/* Print Ledger */}
            <button
              onClick={handlePrint}
              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Print Ledger
            </button>

            {/* Download PDF */}
            <button
              onClick={handlePDF}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Download PDF
            </button>
          </div>
      </div>

      {/* FILTERS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4 print:hidden">
        <div>
          <label className="text-sm">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border p-2 rounded w-full"
          />
        </div>

        <div>
          <label className="text-sm">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border p-2 rounded w-full"
          />
        </div>

        <div className="md:col-span-2">
          <label className="text-sm">Search Particular or FOLO</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border p-2 rounded w-full"
            placeholder="Search..."
          />
        </div>
      </div>

      {/* LEDGER TABLE */}
      <div id="pdf-area" className="bg-white border border-gray-300">

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

    {/* RIGHT: Customer */}
    <div className="text-right text-sm">
      <div className="font-bold uppercase mb-1">
        Customer Statement
      </div>

      <div className="font-bold text-base">
        {customer?.company || customer?.name}
      </div>

      {customer?.company && (
        <div>
          {customer?.name}
        </div>
      )}

      <div className="mt-1">
        Date: {fromDate} → {toDate}
      </div>
    </div>
  </div>
</div>
        <div className="p-4">
          <p className="text-sm text-gray-500 mb-4">
            Ledger as of {new Date().toLocaleDateString()}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">DATE</th>
                  <th className="p-2 text-left">PARTICULAR</th>
                  <th className="p-2 text-left">FOLO</th>
                  <th className="p-2 text-right">QTY</th>
                  <th className="p-2 text-right">RATE</th>
                  <th className="p-2 text-right">PRICE</th>
                  <th className="p-2 text-right">RECEIVE PAYMENT</th>
                  <th className="p-2 text-right">BALANCE</th>
                </tr>
              </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-gray-500">
                    No transactions
                  </td>
                </tr>
              ) : (
                <>
                  {/* Optional Opening Balance row (visible when fromDate set) */}
                  {fromDate && (
                    <tr className="border-t">
                      <td className="p-2">{fromDate}</td>
                      <td className="p-2">Opening Balance</td>
                      <td className="p-2">-</td>
                      <td className="p-2 text-right"></td>
                      <td className="p-2 text-right"></td>
                      <td className="p-2 text-right"></td>
                      <td className="p-2 text-right"></td>
                      <td className="p-2 text-right font-semibold">
                        {openingBalance.toLocaleString()}
                      </td>
                    </tr>
                  )}

                  {(() => {
                    const grouped: Record<string, LedgerRow[]> = {};

                    rows.forEach((r: any) => {
                      if (r.type === "sale") {
                        if (!grouped[r.folio]) grouped[r.folio] = [];
                        grouped[r.folio].push(r);
                      }
                    });

                    const visibleMatch = (r: any) => {
                      if (!search) return true;
                      const s = search.toLowerCase();
                      const p = r.particular.toLowerCase();
                      const f = r.folio.toLowerCase();
                      const n = (r.notes || "").toString().toLowerCase();
                      return p.includes(s) || f.includes(s) || n.includes(s);
                    };

                    return rows.map((r: any) => {
                      const isLastSaleRow =
                        r.type === "sale" &&
                        grouped[r.folio] &&
                        grouped[r.folio][grouped[r.folio].length - 1].id === r.id;

                      const saleTotal =
                        isLastSaleRow
                          ? grouped[r.folio].reduce(
                              (sum: number, x: any) => sum + Number(x.price || 0),
                              0
                            )
                          : 0;

                      const rowVisible = visibleMatch(r);

                      // Only render rows that match the search (search affects visibility only)
                      if (!rowVisible) {
                        // Still keep grouping and running balances intact, but don't render this row
                        return null;
                      }

                      // Determine if invoice total row should be shown: only if at least one row in the group is visible
                      const groupHasVisible = isLastSaleRow
                        ? grouped[r.folio].some((x) => visibleMatch(x))
                        : false;

                      return (
                        <React.Fragment key={r.id}>
                          {/* NORMAL ROW */}
                          <tr
                            className={`border-t ${
                              r.type === "payment" ? "bg-yellow-100" : ""
                            }`}
                          >
                            <td className="p-2">{r.date || "-"}</td>
                            <td className="p-2">{r.particular}</td>

                            {r.type === "payment" ? (
                              <>
                                {/* PAYMENT ROW - MERGE CELLS FOR NOTES */}
                                <td colSpan={3} className="p-2 italic text-gray-600">
                                  {r.notes || "—"}
                                </td>
                              </>
                            ) : (
                              <>
                                {/* SALE/PREVIOUS ROW - NORMAL CELLS */}
                                <td className="p-2">{r.folio}</td>
                                <td className="p-2 text-right">
                                  {r.qty === "" ? "" : r.qty}
                                </td>
                                <td className="p-2 text-right">
                                  {r.rate === "" ? "" : r.rate}
                                </td>
                              </>
                            )}

                            <td className="p-2 text-right">
                              {r.price ? r.price.toLocaleString() : ""}
                            </td>
                            <td className="p-2 text-right">
                              {r.receive ? r.receive.toLocaleString() : ""}
                            </td>
                            <td className="p-2 text-right font-semibold">
                              {r.running.toLocaleString()}
                            </td>
                          </tr>

                          {/* INVOICE TOTAL ROW */}
                          {isLastSaleRow && groupHasVisible && (
                            <tr className="bg-gray-200 font-semibold border-b">
                              <td colSpan={4}></td>
                              <td className="p-2 text-right">Invoice Total:</td>
                              <td className="p-2 text-right">
                                {saleTotal.toLocaleString()}
                              </td>
                              <td colSpan={2}></td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    });
                  })()}
                </>
              )}
            </tbody>
            </table>
          </div>

          {/* FOOTER SUMMARY */}
          <div className="mt-6 flex justify-end">
            <div className="w-72">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Opening Balance</span>
                <span>
                  {fromDate ? openingBalance.toLocaleString() : Number(customer?.previousBalance ?? 0).toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between text-lg font-bold mt-2">
                <span>Closing Balance</span>
                <span>
                  {rows.length
                    ? rows[rows.length - 1].running.toLocaleString()
                    : (fromDate ? openingBalance : Number(customer?.previousBalance ?? 0)).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
