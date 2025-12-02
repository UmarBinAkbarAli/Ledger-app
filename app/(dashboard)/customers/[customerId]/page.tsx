"use client";

export const revalidate = 0;
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
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
  tCtn: number | "";
  rate: number | "";
  price: number;
  receive: number;
  highlight?: boolean;
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
          where("userId", "==", user.uid),
          orderBy("date", "asc")
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
          where("userId", "==", user.uid),
          orderBy("date", "asc")
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
     Build Ledger Rows
  ----------------------------------------------*/
  useEffect(() => {
    if (!customer) return;

    const built: LedgerRow[] = [];

    /* -----------------------------
       PREVIOUS BALANCE
    ------------------------------*/
    const opening = Number(customer.previousBalance ?? 0);
    if (opening !== 0) {
      built.push({
        id: "previous",
        type: "previous",
        date: "",
        particular: "Previous Balance",
        folio: "-",
        qty: "",
        tCtn: "",
        rate: "",
        price: 0,
        receive: 0,
      });
    }

    /* -----------------------------
       SALES → ITEM ROWS
    ------------------------------*/
    for (const s of sales) {
      const items = Array.isArray(s.items) ? s.items : [];

      const totalQty = items.reduce(
        (acc: number, it: any) => acc + Number(it?.qty ?? 0),
        0
      );

      const rawDate = s.date ?? s.createdAt ?? "";
      const saleDate =
        typeof rawDate === "string"
          ? rawDate
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
          tCtn: totalQty,
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
          ? rawDate
          : rawDate?.toDate
          ? rawDate.toDate().toISOString().slice(0, 10)
          : new Date(rawDate).toISOString().slice(0, 10);

      built.push({
        id: `pay-${p.id}`,
        type: "payment",
        date: payDate,
        particular: p.details ?? "Payment Received",
        folio: p.billNumber ?? "-",
        qty: "",
        tCtn: "",
        rate: "",
        price: 0,
        receive: Number(p.amount ?? 0),
        highlight: true,
      });
    }

    /* -----------------------------
       SORT BY DATE
    ------------------------------*/
    const sorted = built.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    /* -----------------------------
       FILTERING
    ------------------------------*/
    const filtered = sorted.filter((r) => {
      if (fromDate && r.date) {
        if (new Date(r.date) < new Date(fromDate)) return false;
      }

      if (toDate && r.date) {
        const td = new Date(toDate);
        const rd = new Date(r.date);
        const end = new Date(td.getFullYear(), td.getMonth(), td.getDate(), 23, 59, 59);
        if (rd > end) return false;
      }

      if (search) {
        const s = search.toLowerCase();
        const p = r.particular.toLowerCase();
        const f = r.folio.toLowerCase();
        if (!p.includes(s) && !f.includes(s)) return false;
      }

      return true;
    });

    setRows(filtered);
  }, [customer, sales, payments, fromDate, toDate, search]);

  /* ---------------------------------------------
     Running Balance Calculation
  ----------------------------------------------*/
  const rowsWithBalance = useMemo(() => {
    let balance = Number(customer?.previousBalance ?? 0);
    return rows.map((r) => {
      balance = balance + Number(r.price) - Number(r.receive);
      return { ...r, running: balance };
    });
  }, [rows, customer]);

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
          <h2 className="text-xl font-bold">{customer?.name ?? "Customer"}</h2>
          <p className="text-sm text-gray-600">{customer?.company ?? ""}</p>
          <p className="text-sm text-gray-600">
            Phone: {customer?.phone ?? ""}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="px-3 py-1 bg-green-600 text-white rounded"
          >
            Print Ledger
          </button>
          <button
            onClick={handlePDF}
            className="px-3 py-1 bg-blue-600 text-white rounded"
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
                  <th className="p-2 text-right">T CTN</th>
                  <th className="p-2 text-right">RATE</th>
                  <th className="p-2 text-right">PRICE</th>
                  <th className="p-2 text-right">RECEIVE PAYMENT</th>
                  <th className="p-2 text-right">BALANCE</th>
                </tr>
              </thead>

              <tbody>
                {rowsWithBalance.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="p-4 text-center text-gray-500"
                    >
                      No transactions
                    </td>
                  </tr>
                ) : (
                  rowsWithBalance.map((r) => (
                    <tr
                      key={r.id}
                      className={`border-t ${
                        r.type === "payment" ? "bg-yellow-100" : ""
                      }`}
                    >
                      <td className="p-2">{r.date || "-"}</td>
                      <td className="p-2">{r.particular}</td>
                      <td className="p-2">{r.folio}</td>
                      <td className="p-2 text-right">
                        {r.qty === "" ? "" : r.qty}
                      </td>
                      <td className="p-2 text-right">
                        {r.tCtn === "" ? "" : r.tCtn}
                      </td>
                      <td className="p-2 text-right">
                        {r.rate === "" ? "" : r.rate}
                      </td>
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
                  ))
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
                  {Number(customer?.previousBalance ?? 0).toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between text-lg font-bold mt-2">
                <span>Closing Balance</span>
                <span>
                  {rowsWithBalance.length
                    ? rowsWithBalance[
                        rowsWithBalance.length - 1
                      ].running.toLocaleString()
                    : Number(
                        customer?.previousBalance ?? 0
                      ).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
