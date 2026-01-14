"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import {
  collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, getDoc
} from "firebase/firestore";
import { getPakistanDate } from "@/lib/dateUtils"; // IMPORT THIS
import { useBusiness } from "@/hooks/useBusiness";

export default function PettyCashPage() {
  // FIX: Use Pakistan Date by default
  const [selectedDate, setSelectedDate] = useState(getPakistanDate());
  const { businessId, loading: businessLoading } = useBusiness();
  
  const [cashIn, setCashIn] = useState(0);       
  const [cashOut, setCashOut] = useState(0);     
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);  
  const [loading, setLoading] = useState(true);

  // Opening Balance States
  const [initialOpening, setInitialOpening] = useState<number>(0);
  const [openingDate, setOpeningDate] = useState<string | null>(null);
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);
  const [openingExists, setOpeningExists] = useState(false);
  
  const [openingInput, setOpeningInput] = useState("");
  const [openingInputDate, setOpeningInputDate] = useState(getPakistanDate()); // FIX HERE TOO

  const buildScopeClauses = (userId: string) =>
    businessId
      ? [where("businessId", "==", businessId)]
      : [where("userId", "==", userId), where("businessId", "==", null)];

  // 1. CHECK & LOAD INITIAL OPENING BALANCE
  useEffect(() => {
    const checkOpening = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        if (businessLoading) return;
        let snap;
        try {
          snap = await getDocs(
            query(collection(db, "pettyCashOpening"), ...buildScopeClauses(user.uid))
          );
        } catch (err: any) {
          if (err?.code === "permission-denied" && businessId) {
            console.warn("Business-scoped query denied; retrying with userId scope", {
              collectionName: "pettyCashOpening",
              userId: user.uid,
              businessId,
            });
            snap = await getDocs(
              query(
                collection(db, "pettyCashOpening"),
                where("userId", "==", user.uid),
                where("businessId", "==", null)
              )
            );
          } else {
            throw err;
          }
        }
        
        if (!snap.empty) {
          setOpeningExists(true);
          const docData = snap.docs[0].data();
          setInitialOpening(Number(docData.openingBalance || 0));
          setOpeningDate(docData.openingDate);
          setOpeningDocId(snap.docs[0].id);
        }
      } catch (err) {
        console.error("Error checking opening balance:", err);
      }
    };
    checkOpening();
  }, [businessId, businessLoading]);

  // 2. SAVE OR UPDATE OPENING BALANCE
  const saveOpeningBalance = async () => {
    const user = auth.currentUser;
    if (!user) return;
    if (!openingInput || !openingInputDate) {
      alert("Please enter opening balance and date");
      return;
    }

    try {
      if (openingExists && openingDocId) {
        const docRef = doc(db, "pettyCashOpening", openingDocId);
        const updatePayload: Record<string, any> = {
          openingBalance: Number(openingInput),
          openingDate: openingInputDate,
          userId: user.uid,
          updatedAt: serverTimestamp(),
        };
        if (businessId) {
          updatePayload.businessId = businessId;
        }
        await updateDoc(docRef, updatePayload);
      } else {
        const createPayload: Record<string, any> = {
          userId: user.uid,
          openingBalance: Number(openingInput),
          openingDate: openingInputDate,
          createdAt: serverTimestamp(),
        };
        if (businessId) {
          createPayload.businessId = businessId;
        }
        await addDoc(collection(db, "pettyCashOpening"), createPayload);
      }
      window.location.reload(); 
    } catch (err) {
      console.error("Error saving opening balance:", err);
      alert("Error saving. Check console.");
    }
  };

  // 3. CALCULATE RUNNING OPENING BALANCE
  useEffect(() => {
    const calculateOpening = async () => {
      const user = auth.currentUser;
      if (!user) return;
      if (businessLoading) return;

      if (!openingDate || selectedDate < openingDate) {
        setOpeningBalance(initialOpening || 0);
        return;
      }
      
      if (selectedDate === openingDate) {
        setOpeningBalance(initialOpening);
        return;
      }

      let inSnap, expSnap, opSnap, trInSnap, trOutSnap;
      try {
        const qIncome = query(collection(db, "income"), ...buildScopeClauses(user.uid), where("paymentMethod", "==", "CASH"), where("date", "<", selectedDate));
        const qExpense = query(collection(db, "expenses"), ...buildScopeClauses(user.uid), where("paymentMethod", "==", "CASH"), where("date", "<", selectedDate));
        const qOpExpense = query(collection(db, "operationalExpenses"), ...buildScopeClauses(user.uid), where("paymentMethod", "==", "CASH"), where("date", "<", selectedDate));
        const qTransIn = query(collection(db, "transfers"), ...buildScopeClauses(user.uid), where("toAccount", "==", "Petty Cash"), where("date", "<", selectedDate));
        const qTransOut = query(collection(db, "transfers"), ...buildScopeClauses(user.uid), where("fromAccount", "==", "Petty Cash"), where("date", "<", selectedDate));

        [inSnap, expSnap, opSnap, trInSnap, trOutSnap] = await Promise.all([
          getDocs(qIncome), getDocs(qExpense), getDocs(qOpExpense), getDocs(qTransIn), getDocs(qTransOut)
        ]);
      } catch (err: any) {
        if (err?.code === "permission-denied" && businessId) {
          console.warn("Business-scoped query denied; retrying with userId scope", {
            collectionName: "pettyCashHistory",
            userId: user.uid,
            businessId,
          });
          const qIncome = query(collection(db, "income"), where("userId", "==", user.uid), where("businessId", "==", null), where("paymentMethod", "==", "CASH"), where("date", "<", selectedDate));
          const qExpense = query(collection(db, "expenses"), where("userId", "==", user.uid), where("businessId", "==", null), where("paymentMethod", "==", "CASH"), where("date", "<", selectedDate));
          const qOpExpense = query(collection(db, "operationalExpenses"), where("userId", "==", user.uid), where("businessId", "==", null), where("paymentMethod", "==", "CASH"), where("date", "<", selectedDate));
          const qTransIn = query(collection(db, "transfers"), where("userId", "==", user.uid), where("businessId", "==", null), where("toAccount", "==", "Petty Cash"), where("date", "<", selectedDate));
          const qTransOut = query(collection(db, "transfers"), where("userId", "==", user.uid), where("businessId", "==", null), where("fromAccount", "==", "Petty Cash"), where("date", "<", selectedDate));

          [inSnap, expSnap, opSnap, trInSnap, trOutSnap] = await Promise.all([
            getDocs(qIncome), getDocs(qExpense), getDocs(qOpExpense), getDocs(qTransIn), getDocs(qTransOut)
          ]);
        } else {
          throw err;
        }
      }

      const sum = (snap: any) => snap.docs.reduce((acc: number, d: any) => acc + Number((d.data() as any).amount || 0), 0);

      const netHistory = (sum(inSnap) + sum(trInSnap)) - (sum(expSnap) + sum(opSnap) + sum(trOutSnap));
      setOpeningBalance(initialOpening + netHistory);
    };
    calculateOpening();
  }, [selectedDate, openingDate, initialOpening, businessId, businessLoading]);

  // 4. LOAD TODAY'S TRANSACTIONS
  useEffect(() => {
    const loadDaily = async () => {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) return;
      if (businessLoading) return;

      let inSnap, expSnap, opSnap, trInSnap, trOutSnap;
      try {
        const qIncome = query(collection(db, "income"), ...buildScopeClauses(user.uid), where("date", "==", selectedDate), where("paymentMethod", "==", "CASH"));
        const qExpense = query(collection(db, "expenses"), ...buildScopeClauses(user.uid), where("date", "==", selectedDate), where("paymentMethod", "==", "CASH"));
        const qOpExpense = query(collection(db, "operationalExpenses"), ...buildScopeClauses(user.uid), where("date", "==", selectedDate), where("paymentMethod", "==", "CASH"));
        const qTransIn = query(collection(db, "transfers"), ...buildScopeClauses(user.uid), where("date", "==", selectedDate), where("toAccount", "==", "Petty Cash"));
        const qTransOut = query(collection(db, "transfers"), ...buildScopeClauses(user.uid), where("date", "==", selectedDate), where("fromAccount", "==", "Petty Cash"));

        [inSnap, expSnap, opSnap, trInSnap, trOutSnap] = await Promise.all([
          getDocs(qIncome), getDocs(qExpense), getDocs(qOpExpense), getDocs(qTransIn), getDocs(qTransOut)
        ]);
      } catch (err: any) {
        if (err?.code === "permission-denied" && businessId) {
          console.warn("Business-scoped query denied; retrying with userId scope", {
            collectionName: "pettyCashDaily",
            userId: user.uid,
            businessId,
          });
          const qIncome = query(collection(db, "income"), where("userId", "==", user.uid), where("businessId", "==", null), where("date", "==", selectedDate), where("paymentMethod", "==", "CASH"));
          const qExpense = query(collection(db, "expenses"), where("userId", "==", user.uid), where("businessId", "==", null), where("date", "==", selectedDate), where("paymentMethod", "==", "CASH"));
          const qOpExpense = query(collection(db, "operationalExpenses"), where("userId", "==", user.uid), where("businessId", "==", null), where("date", "==", selectedDate), where("paymentMethod", "==", "CASH"));
          const qTransIn = query(collection(db, "transfers"), where("userId", "==", user.uid), where("businessId", "==", null), where("date", "==", selectedDate), where("toAccount", "==", "Petty Cash"));
          const qTransOut = query(collection(db, "transfers"), where("userId", "==", user.uid), where("businessId", "==", null), where("date", "==", selectedDate), where("fromAccount", "==", "Petty Cash"));

          [inSnap, expSnap, opSnap, trInSnap, trOutSnap] = await Promise.all([
            getDocs(qIncome), getDocs(qExpense), getDocs(qOpExpense), getDocs(qTransIn), getDocs(qTransOut)
          ]);
        } else {
          throw err;
        }
      }

      const sum = (snap: any) => snap.docs.reduce((acc: number, d: any) => acc + Number((d.data() as any).amount || 0), 0);

      setCashIn(sum(inSnap) + sum(trInSnap));
      setCashOut(sum(expSnap) + sum(opSnap) + sum(trOutSnap));

      const tx = [
        ...inSnap.docs.map(d => ({ ...(d.data() as any), id: d.id, type: "Income" })),
        ...expSnap.docs.map(d => ({ ...(d.data() as any), id: d.id, type: "Expense", subType: "Supplier" })),
        ...opSnap.docs.map(d => ({ ...(d.data() as any), id: d.id, type: "Expense", subType: "Operational", customerName: (d.data() as any).categoryName })),
        ...trInSnap.docs.map(d => ({ ...(d.data() as any), id: d.id, type: "Transfer In", customerName: `From: ${(d.data() as any).fromAccount}` })),
        ...trOutSnap.docs.map(d => ({ ...(d.data() as any), id: d.id, type: "Transfer Out", customerName: `To: ${(d.data() as any).toAccount}` })),
      ];

      setTransactions(tx);
      setLoading(false);
    };
    loadDaily();
  }, [selectedDate, businessId, businessLoading]);

  // 5. CLOSING CALCULATION
  useEffect(() => {
    setClosingBalance(openingBalance + cashIn - cashOut);
  }, [openingBalance, cashIn, cashOut]);

  // 6. AUTO-REFRESH when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        window.location.reload(); // Full reload to refresh all data
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  if (loading && !transactions.length) return <div className="p-6 text-center">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Petty Cash</h1>
      
      <div className="mb-6 flex gap-4 items-center">
         <div>
            <label className="block text-sm font-medium">Date</label>
            <input type="date" className="border p-2 rounded" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 p-4 border rounded"><p className="text-sm">Opening Balance</p><p className="text-2xl font-bold">{openingBalance.toLocaleString()}</p></div>
        <div className="bg-green-50 p-4 border border-green-200 rounded"><p className="text-sm text-green-700">Cash In</p><p className="text-2xl font-bold text-green-800">{cashIn.toLocaleString()}</p></div>
        <div className="bg-red-50 p-4 border border-red-200 rounded"><p className="text-sm text-red-700">Cash Out</p><p className="text-2xl font-bold text-red-800">{cashOut.toLocaleString()}</p></div>
        <div className="bg-blue-50 p-5 border border-blue-200 rounded md:col-span-3"><p className="text-sm text-blue-700">Closing Balance</p><p className="text-3xl font-bold text-blue-900">{closingBalance.toLocaleString()}</p></div>
      </div>

      {!openingExists && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded mb-6">
           <h3 className="font-semibold mb-2 text-yellow-800">⚙️ Setup Petty Cash</h3>
           <div className="flex flex-wrap gap-3 items-end">
             <input type="number" placeholder="Amount" value={openingInput} onChange={e => setOpeningInput(e.target.value)} className="border p-2 rounded w-32"/>
             <input type="date" value={openingInputDate} onChange={e => setOpeningInputDate(e.target.value)} className="border p-2 rounded"/>
             <button onClick={saveOpeningBalance} className="bg-black text-white px-4 py-2 rounded">Save Setup</button>
           </div>
        </div>
      )}

      <div className="bg-white border rounded p-4 mb-8">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-100 border-b"><th className="p-2 text-left">Type</th><th className="p-2 text-left">Details</th><th className="p-2 text-right">Amount</th></tr></thead>
          <tbody>
            {transactions.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-gray-400">No transactions today</td></tr>}
            {transactions.map(t => (
              <tr key={t.id} className="border-b">
                <td className="p-2 font-medium">{t.type} <span className="text-xs text-gray-500">{t.subType}</span></td>
                <td className="p-2">{t.customerName || t.supplierName || t.categoryName}</td>
                <td className={`p-2 text-right font-bold ${t.type.includes("Out") || t.type === "Expense" ? "text-red-600" : "text-green-600"}`}>
                  {Number(t.amount).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
