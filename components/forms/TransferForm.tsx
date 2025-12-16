"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, getDocs, serverTimestamp } from "firebase/firestore";
import Button from "@/components/ui/Button";
import { getPakistanDate } from "@/lib/dateUtils"; // IMPORT THIS

export default function TransferForm({ onSuccess }: { onSuccess: () => void }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(getPakistanDate()); // FIX HERE
  const [fromAccount, setFromAccount] = useState("");
  const [toAccount, setToAccount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  
  // (Rest of the file logic is same, just copy previous version but change the import and useState default)
  
  // ... Paste the rest of the previous TransferForm logic ...
  // To save space, I will assume you can just update the `useState(getPakistanDate())` line.
  
  // BELOW IS THE FULL RENDER RETURN to ensure no confusion:
  const [accounts, setAccounts] = useState<string[]>(["Petty Cash"]);

  useEffect(() => {
    const fetchAccounts = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const snap = await getDocs(collection(db, "users", user.uid, "bankAccounts"));
      const bankNames = snap.docs.map((d) => d.data().name);
      setAccounts(["Petty Cash", ...bankNames]);
    };
    fetchAccounts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !fromAccount || !toAccount) { alert("Please fill in all fields"); return; }
    if (fromAccount === toAccount) { alert("Source and Destination accounts cannot be the same."); return; }

    setLoading(true);
    const user = auth.currentUser;
    if (!user) return;

    try {
      await addDoc(collection(db, "transfers"), {
        userId: user.uid,
        amount: Number(amount),
        date,
        fromAccount,
        toAccount,
        description,
        createdAt: serverTimestamp(),
      });
      onSuccess();
    } catch (error) {
      console.error("Error saving transfer:", error);
      alert("Failed to save transfer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Date</label>
        <input type="date" required className="w-full border p-2 rounded" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">From (Source)</label>
          <select required className="w-full border p-2 rounded" value={fromAccount} onChange={(e) => setFromAccount(e.target.value)}>
            <option value="">Select Account</option>
            {accounts.map((acc) => <option key={acc} value={acc}>{acc}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">To (Destination)</label>
          <select required className="w-full border p-2 rounded" value={toAccount} onChange={(e) => setToAccount(e.target.value)}>
            <option value="">Select Account</option>
            {accounts.map((acc) => <option key={acc} value={acc}>{acc}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium">Amount</label>
        <input type="number" required min="1" className="w-full border p-2 rounded" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div>
        <label className="block text-sm font-medium">Description (Optional)</label>
        <input type="text" className="w-full border p-2 rounded" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Cash Deposit, ATM Withdrawal" />
      </div>
      <Button type="submit" disabled={loading} className="w-full bg-blue-600 text-white">{loading ? "Processing..." : "Transfer Funds"}</Button>
    </form>
  );
}