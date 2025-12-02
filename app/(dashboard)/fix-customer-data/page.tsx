"use client";

import { useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
} from "firebase/firestore";

export default function FixCustomerData() {
  useEffect(() => {
    const fixData = async () => {
      const realId = "VXVWLmLVJzSQuR1OJ586hR5ttsM2";   // Correct ID
      const wrongId = "EvUPnAseZ5yRzKDwpHc0";           // Wrong ID

      console.log("Fixing old Sales & Income...");

      // ---- FIX SALES ----
      const salesQ = query(
        collection(db, "sales"),
        where("customerId", "==", wrongId)
      );
      const salesSnap = await getDocs(salesQ);

      for (const docSnap of salesSnap.docs) {
        console.log("Updating SALE:", docSnap.id);
        await updateDoc(docSnap.ref, {
          customerId: realId,
          customerName: "Babar Akbar",
        });
      }

      // ---- FIX INCOME ----
      const incomeQ = query(
        collection(db, "income"),
        where("customerId", "==", wrongId)
      );
      const incomeSnap = await getDocs(incomeQ);

      for (const docSnap of incomeSnap.docs) {
        console.log("Updating INCOME:", docSnap.id);
        await updateDoc(docSnap.ref, {
          customerId: realId,
          customerName: "Babar Akbar",
        });
      }

      alert("ALL DONE! 🎉 Sales + Income updated successfully.");
    };

    fixData();
  }, []);

  return (
    <div style={{ padding: 40 }}>
      <h1>Fixing customer data...</h1>
      <p>Check console logs for details.</p>
    </div>
  );
}
