"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { getPakistanDate } from "@/lib/dateUtils"; // IMPORT THIS
import { useBusiness } from "@/hooks/useBusiness";

export default function BankLedgerPage() {
  const [banks, setBanks] = useState<any[]>([]);
  const [selectedBank, setSelectedBank] = useState("");
  const selectedBankObj = banks.find((b) => b.name === selectedBank);
  const { businessId, loading: businessLoading } = useBusiness();

  // FIX: Default dates to Pakistan Time
  const [startDate, setStartDate] = useState(getPakistanDate(-7)); // 7 Days Ago (PKT)
  const [endDate, setEndDate] = useState(getPakistanDate(0));      // Today (PKT)

  const [openingBalance, setOpeningBalance] = useState(0);
  const [bankIn, setBankIn] = useState(0);
  const [bankOut, setBankOut] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ... (Rest of the code remains exactly the same as the previous correct version)
  // Just copying the useEffects below for completeness:

  useEffect(() => {
    const loadBanks = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const snap = await getDocs(collection(db, "users", user.uid, "bankAccounts"));
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setBanks(list);
      if (list.length > 0 && !selectedBank) setSelectedBank(list[0].name);
      setLoading(false);
    };
    loadBanks();
  }, []); // eslint-disable-line

  useEffect(() => {
    const calcOpening = async () => {
      const user = auth.currentUser;
      if (!user || !selectedBank) return;
      if (businessLoading) return;

      const scopeField = businessId ? "businessId" : "userId";
      const scopeValue = businessId || user.uid;
      let inSnap, expSnap, opSnap, trInSnap, trOutSnap;
      try {
        const qIn = query(collection(db, "income"), where(scopeField, "==", scopeValue), where("bankName", "==", selectedBank), where("date", "<", startDate));
        const qExp = query(collection(db, "expenses"), where(scopeField, "==", scopeValue), where("bankName", "==", selectedBank), where("date", "<", startDate));
        const qOp = query(collection(db, "operationalExpenses"), where(scopeField, "==", scopeValue), where("bankName", "==", selectedBank), where("date", "<", startDate));
        const qTrIn = query(collection(db, "transfers"), where(scopeField, "==", scopeValue), where("toAccount", "==", selectedBank), where("date", "<", startDate));
        const qTrOut = query(collection(db, "transfers"), where(scopeField, "==", scopeValue), where("fromAccount", "==", selectedBank), where("date", "<", startDate));

        [inSnap, expSnap, opSnap, trInSnap, trOutSnap] = await Promise.all([
          getDocs(qIn), getDocs(qExp), getDocs(qOp), getDocs(qTrIn), getDocs(qTrOut)
        ]);
      } catch (err: any) {
        if (err?.code === "permission-denied" && businessId) {
          console.warn("Business-scoped query denied; retrying with userId scope", {
            collectionName: "bankLedgerOpening",
            userId: user.uid,
            businessId,
          });
          const qIn = query(collection(db, "income"), where("userId", "==", user.uid), where("bankName", "==", selectedBank), where("date", "<", startDate));
          const qExp = query(collection(db, "expenses"), where("userId", "==", user.uid), where("bankName", "==", selectedBank), where("date", "<", startDate));
          const qOp = query(collection(db, "operationalExpenses"), where("userId", "==", user.uid), where("bankName", "==", selectedBank), where("date", "<", startDate));
          const qTrIn = query(collection(db, "transfers"), where("userId", "==", user.uid), where("toAccount", "==", selectedBank), where("date", "<", startDate));
          const qTrOut = query(collection(db, "transfers"), where("userId", "==", user.uid), where("fromAccount", "==", selectedBank), where("date", "<", startDate));

          [inSnap, expSnap, opSnap, trInSnap, trOutSnap] = await Promise.all([
            getDocs(qIn), getDocs(qExp), getDocs(qOp), getDocs(qTrIn), getDocs(qTrOut)
          ]);
        } else {
          throw err;
        }
      }

      const sum = (snap: any) => snap.docs.reduce((acc: number, d: any) => acc + Number((d.data() as any).amount || 0), 0);
      
      const totalIn = sum(inSnap) + sum(trInSnap);
      const totalOut = sum(expSnap) + sum(opSnap) + sum(trOutSnap);

      setOpeningBalance(Number(selectedBankObj?.openingBalance || 0) + totalIn - totalOut);
    };
    calcOpening();
  }, [selectedBank, startDate, selectedBankObj, businessId, businessLoading]);

  useEffect(() => {
    const loadData = async () => {
      const user = auth.currentUser;
      if (!user || !selectedBank) return;
      if (businessLoading) return;

      const scopeField = businessId ? "businessId" : "userId";
      const scopeValue = businessId || user.uid;
      let inSnap, expSnap, opSnap, trInSnap, trOutSnap;
      try {
        const qIn = query(collection(db, "income"), where(scopeField, "==", scopeValue), where("bankName", "==", selectedBank), where("date", ">=", startDate), where("date", "<=", endDate));
        const qExp = query(collection(db, "expenses"), where(scopeField, "==", scopeValue), where("bankName", "==", selectedBank), where("date", ">=", startDate), where("date", "<=", endDate));
        const qOp = query(collection(db, "operationalExpenses"), where(scopeField, "==", scopeValue), where("bankName", "==", selectedBank), where("date", ">=", startDate), where("date", "<=", endDate));
        const qTrIn = query(collection(db, "transfers"), where(scopeField, "==", scopeValue), where("toAccount", "==", selectedBank), where("date", ">=", startDate), where("date", "<=", endDate));
        const qTrOut = query(collection(db, "transfers"), where(scopeField, "==", scopeValue), where("fromAccount", "==", selectedBank), where("date", ">=", startDate), where("date", "<=", endDate));

        [inSnap, expSnap, opSnap, trInSnap, trOutSnap] = await Promise.all([
          getDocs(qIn), getDocs(qExp), getDocs(qOp), getDocs(qTrIn), getDocs(qTrOut)
        ]);
      } catch (err: any) {
        if (err?.code === "permission-denied" && businessId) {
          console.warn("Business-scoped query denied; retrying with userId scope", {
            collectionName: "bankLedgerRange",
            userId: user.uid,
            businessId,
          });
          const qIn = query(collection(db, "income"), where("userId", "==", user.uid), where("bankName", "==", selectedBank), where("date", ">=", startDate), where("date", "<=", endDate));
          const qExp = query(collection(db, "expenses"), where("userId", "==", user.uid), where("bankName", "==", selectedBank), where("date", ">=", startDate), where("date", "<=", endDate));
          const qOp = query(collection(db, "operationalExpenses"), where("userId", "==", user.uid), where("bankName", "==", selectedBank), where("date", ">=", startDate), where("date", "<=", endDate));
          const qTrIn = query(collection(db, "transfers"), where("userId", "==", user.uid), where("toAccount", "==", selectedBank), where("date", ">=", startDate), where("date", "<=", endDate));
          const qTrOut = query(collection(db, "transfers"), where("userId", "==", user.uid), where("fromAccount", "==", selectedBank), where("date", ">=", startDate), where("date", "<=", endDate));

          [inSnap, expSnap, opSnap, trInSnap, trOutSnap] = await Promise.all([
            getDocs(qIn), getDocs(qExp), getDocs(qOp), getDocs(qTrIn), getDocs(qTrOut)
          ]);
        } else {
          throw err;
        }
      }

      const sum = (snap: any) => snap.docs.reduce((acc: number, d: any) => acc + Number((d.data() as any).amount || 0), 0);

      setBankIn(sum(inSnap) + sum(trInSnap));
      setBankOut(sum(expSnap) + sum(opSnap) + sum(trOutSnap));

      const tx = [
        ...inSnap.docs.map(d => ({ ...(d.data() as any), id: d.id, type: "Income" })),
        ...expSnap.docs.map(d => ({ ...(d.data() as any), id: d.id, type: "Expense", subType: "Supplier" })),
        ...opSnap.docs.map(d => ({ ...(d.data() as any), id: d.id, type: "Expense", subType: "Operational", customerName: (d.data() as any).categoryName })),
        ...trInSnap.docs.map(d => ({ ...(d.data() as any), id: d.id, type: "Transfer In", customerName: `From: ${(d.data() as any).fromAccount}` })),
        ...trOutSnap.docs.map(d => ({ ...(d.data() as any), id: d.id, type: "Transfer Out", customerName: `To: ${(d.data() as any).toAccount}` })),
      ];

      setTransactions(tx.sort((a, b) => (a.date > b.date ? 1 : -1)));
    };
    loadData();
  }, [selectedBank, startDate, endDate, businessId, businessLoading]);

  useEffect(() => {
    setClosingBalance(openingBalance + bankIn - bankOut);
  }, [openingBalance, bankIn, bankOut]);

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

  if (loading) return <div className="p-6 text-center">Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Bank Ledger</h1>
      
      <div className="mb-6">
        <label className="block text-sm font-medium mb-1">Select Bank</label>
        <select className="border p-2 rounded w-full" value={selectedBank} onChange={e => setSelectedBank(e.target.value)}>
          {banks.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div><label className="block text-sm">Start Date</label><input type="date" className="border w-full p-2" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
        <div><label className="block text-sm">End Date</label><input type="date" className="border w-full p-2" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 p-4 border border-green-200 rounded"><p className="text-sm text-green-700">Money In</p><p className="text-2xl font-bold text-green-800">{bankIn.toLocaleString()}</p></div>
        <div className="bg-red-50 p-4 border border-red-200 rounded"><p className="text-sm text-red-700">Money Out</p><p className="text-2xl font-bold text-red-800">{bankOut.toLocaleString()}</p></div>
        <div className="bg-blue-50 p-5 border border-blue-200 rounded"><p className="text-sm text-blue-700">Closing Balance</p><p className="text-2xl font-bold text-blue-900">{closingBalance.toLocaleString()}</p></div>
      </div>

      <div className="bg-white border rounded p-4">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-100 border-b"><th className="p-2 text-left">Type</th><th className="p-2 text-left">Details</th><th className="p-2 text-right">Amount</th></tr></thead>
          <tbody>
            {transactions.map(t => (
              <tr key={t.id} className="border-b">
                <td className="p-2 font-medium">{t.type} <span className="text-xs text-gray-500">{t.subType}</span></td>
                <td className="p-2">{t.customerName || t.supplierName || t.categoryName} <br/><span className="text-xs text-gray-400">{t.description}</span></td>
                <td className={`p-2 text-right font-bold ${t.type.includes("Out") || t.type === "Expense" ? "text-red-600" : "text-green-600"}`}>
                  {t.type.includes("In") || t.type === "Income" ? "+" : "-"}{Number(t.amount).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
