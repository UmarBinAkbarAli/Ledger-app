"use client";

import Link from "next/link";
import { useState, ReactNode, useEffect } from "react";
import IncomeForm from "@/components/forms/IncomeForm";
import ExpenseForm from "@/components/forms/ExpenseForm";
import TransferForm from "@/components/forms/TransferForm";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { getPakistanDate } from "@/lib/dateUtils";

type TimePeriod = "today" | "thisMonth" | "lastMonth" | "last7Days" | "last30Days";

interface MetricData {
  totalSales: number;
  totalPurchases: number;
  totalIncome: number;
  totalExpense: number;
  pettyCash: number;
  salesChange: number;
  purchasesChange: number;
  incomeChange: number;
  expenseChange: number;
  pettyCashChange: number;
}

interface Transaction {
  id: string;
  type: "sale" | "purchase" | "income" | "expense" | "operational-expense";
  description: string;
  date: string;
  category: string;
  amount: number;
}

export default function DashboardPage() {
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [userName, setUserName] = useState("User");
  const [companyName, setCompanyName] = useState("Your Company");
  const [ownerName, setOwnerName] = useState("Owner Name");
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("today");

  // Load showCards state from localStorage
  const [showCards, setShowCards] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dashboardShowCards');
      return saved !== null ? JSON.parse(saved) : true;
    }
    return true;
  });
  const [metrics, setMetrics] = useState<MetricData>({
    totalSales: 0,
    totalPurchases: 0,
    totalIncome: 0,
    totalExpense: 0,
    pettyCash: 0,
    salesChange: 0,
    purchasesChange: 0,
    incomeChange: 0,
    expenseChange: 0,
    pettyCashChange: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserProfile = async () => {
      const user = auth.currentUser;
      if (user) {
        setUserName(user.displayName || user.email?.split('@')[0] || "User");

        // Fetch user profile from Firestore
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setCompanyName(data.companyName || "Your Company");
            setOwnerName(data.ownerName || "Owner Name");
          }
        } catch (err) {
          console.error("Error loading user profile:", err);
        }
      }
    };

    loadUserProfile();
  }, []);

  // Load financial data when time period changes
  useEffect(() => {
    loadFinancialData();
  }, [timePeriod]);

  // Get date range based on selected time period
  const getDateRange = (period: TimePeriod) => {
    const today = getPakistanDate();
    const todayDate = new Date(today);

    switch (period) {
      case "today": {
        return {
          start: today,
          end: today,
        };
      }
      case "thisMonth": {
        const firstDay = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
        return {
          start: firstDay.toLocaleDateString("en-CA"),
          end: today,
        };
      }
      case "lastMonth": {
        const firstDayLastMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1);
        const lastDayLastMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 0);
        return {
          start: firstDayLastMonth.toLocaleDateString("en-CA"),
          end: lastDayLastMonth.toLocaleDateString("en-CA"),
        };
      }
      case "last7Days": {
        const sevenDaysAgo = new Date(todayDate);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return {
          start: sevenDaysAgo.toLocaleDateString("en-CA"),
          end: today,
        };
      }
      case "last30Days": {
        const thirtyDaysAgo = new Date(todayDate);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return {
          start: thirtyDaysAgo.toLocaleDateString("en-CA"),
          end: today,
        };
      }
    }
  };

  // Get previous period for comparison
  const getPreviousDateRange = (period: TimePeriod) => {
    const today = getPakistanDate();
    const todayDate = new Date(today);

    switch (period) {
      case "today": {
        // Yesterday
        const yesterday = new Date(todayDate);
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          start: yesterday.toLocaleDateString("en-CA"),
          end: yesterday.toLocaleDateString("en-CA"),
        };
      }
      case "thisMonth": {
        // Previous month
        const firstDayLastMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1);
        const lastDayLastMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 0);
        return {
          start: firstDayLastMonth.toLocaleDateString("en-CA"),
          end: lastDayLastMonth.toLocaleDateString("en-CA"),
        };
      }
      case "lastMonth": {
        // Month before last month
        const firstDay = new Date(todayDate.getFullYear(), todayDate.getMonth() - 2, 1);
        const lastDay = new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 0);
        return {
          start: firstDay.toLocaleDateString("en-CA"),
          end: lastDay.toLocaleDateString("en-CA"),
        };
      }
      case "last7Days": {
        // Previous 7 days
        const fourteenDaysAgo = new Date(todayDate);
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
        const sevenDaysAgo = new Date(todayDate);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return {
          start: fourteenDaysAgo.toLocaleDateString("en-CA"),
          end: sevenDaysAgo.toLocaleDateString("en-CA"),
        };
      }
      case "last30Days": {
        // Previous 30 days
        const sixtyDaysAgo = new Date(todayDate);
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        const thirtyDaysAgo = new Date(todayDate);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return {
          start: sixtyDaysAgo.toLocaleDateString("en-CA"),
          end: thirtyDaysAgo.toLocaleDateString("en-CA"),
        };
      }
    }
  };

  const loadFinancialData = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setLoading(true);

    try {
      const currentRange = getDateRange(timePeriod);
      const previousRange = getPreviousDateRange(timePeriod);

      // Get businessId from user profile for business-scoped queries
      let bizId: string | undefined;
      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) {
          bizId = userSnap.data().businessId;
        }
      } catch (e) {
        console.warn("Could not fetch user profile for businessId", e);
      }

      // Build scope field - prefer businessId, fallback to userId
      const scopeField = bizId ? "businessId" : "userId";
      const scopeValue = bizId || user.uid;
      let effectiveScopeField = scopeField;
      let effectiveScopeValue = scopeValue;

      const runScopedPeriodQueries = (field: string, value: string) =>
        Promise.all([
          getDocs(query(collection(db, "sales"), where(field, "==", value), where("date", ">=", currentRange.start), where("date", "<=", currentRange.end))),
          getDocs(query(collection(db, "purchases"), where(field, "==", value), where("date", ">=", currentRange.start), where("date", "<=", currentRange.end))),
          getDocs(query(collection(db, "income"), where(field, "==", value), where("date", ">=", currentRange.start), where("date", "<=", currentRange.end))),
          getDocs(query(collection(db, "expenses"), where(field, "==", value), where("date", ">=", currentRange.start), where("date", "<=", currentRange.end))),
          getDocs(query(collection(db, "operationalExpenses"), where(field, "==", value), where("date", ">=", currentRange.start), where("date", "<=", currentRange.end))),
          getDocs(query(collection(db, "pettyCashOpening"), where(field, "==", value))),
        ]);

      // Fetch current period data
      let salesSnap;
      let purchasesSnap;
      let incomeSnap;
      let expensesSnap;
      let opExpensesSnap;
      let pettyCashOpeningSnap;
      try {
        [salesSnap, purchasesSnap, incomeSnap, expensesSnap, opExpensesSnap, pettyCashOpeningSnap] = await runScopedPeriodQueries(scopeField, scopeValue);
      } catch (err: any) {
        // Fallback to userId if business scope fails
        if (err?.code === "permission-denied" && bizId) {
          console.warn("Business-scoped query denied in dashboard, falling back to userId");
          effectiveScopeField = "userId";
          effectiveScopeValue = user.uid;
          [salesSnap, purchasesSnap, incomeSnap, expensesSnap, opExpensesSnap, pettyCashOpeningSnap] =
            await runScopedPeriodQueries(effectiveScopeField, effectiveScopeValue);
        } else {
          throw err;
        }
      }

      // Calculate current totals
      const totalSales = salesSnap.docs.reduce((sum, doc) => sum + (Number(doc.data().total) || 0), 0);
      const totalPurchases = purchasesSnap.docs.reduce((sum, doc) => sum + (Number(doc.data().total) || 0), 0);
      const totalIncome = incomeSnap.docs.reduce((sum, doc) => sum + (Number(doc.data().amount) || 0), 0);
      const totalExpense =
        expensesSnap.docs.reduce((sum, doc) => sum + (Number(doc.data().amount) || 0), 0) +
        opExpensesSnap.docs.reduce((sum, doc) => sum + (Number(doc.data().amount) || 0), 0);

      // Calculate petty cash balance
      // Get opening balance from pettyCashOpening collection
      let pettyCashOpening = 0;
      if (!pettyCashOpeningSnap.empty) {
        const openingData = pettyCashOpeningSnap.docs[0].data();
        pettyCashOpening = Number(openingData.openingBalance || 0);
      }

      // Calculate petty cash transactions (all time, CASH payment method only)
      const [pettyCashIncomeSnap, pettyCashExpensesSnap, pettyCashOpExpensesSnap, transfersInSnap, transfersOutSnap] = await Promise.all([
        getDocs(query(collection(db, "income"), where(effectiveScopeField, "==", effectiveScopeValue), where("paymentMethod", "==", "CASH"))),
        getDocs(query(collection(db, "expenses"), where(effectiveScopeField, "==", effectiveScopeValue), where("paymentMethod", "==", "CASH"))),
        getDocs(query(collection(db, "operationalExpenses"), where(effectiveScopeField, "==", effectiveScopeValue), where("paymentMethod", "==", "CASH"))),
        getDocs(query(collection(db, "transfers"), where(effectiveScopeField, "==", effectiveScopeValue), where("toAccount", "==", "Petty Cash"))),
        getDocs(query(collection(db, "transfers"), where(effectiveScopeField, "==", effectiveScopeValue), where("fromAccount", "==", "Petty Cash"))),
      ]);

      const pettyCashIn =
        pettyCashIncomeSnap.docs.reduce((sum, doc) => sum + (Number(doc.data().amount) || 0), 0) +
        transfersInSnap.docs.reduce((sum, doc) => sum + (Number(doc.data().amount) || 0), 0);

      const pettyCashOut =
        pettyCashExpensesSnap.docs.reduce((sum, doc) => sum + (Number(doc.data().amount) || 0), 0) +
        pettyCashOpExpensesSnap.docs.reduce((sum, doc) => sum + (Number(doc.data().amount) || 0), 0) +
        transfersOutSnap.docs.reduce((sum, doc) => sum + (Number(doc.data().amount) || 0), 0);

      const pettyCashBalance = pettyCashOpening + pettyCashIn - pettyCashOut;

      // Fetch previous period data for comparison
      const [prevSalesSnap, prevPurchasesSnap, prevIncomeSnap, prevExpensesSnap, prevOpExpensesSnap] = await Promise.all([
        getDocs(query(collection(db, "sales"), where(effectiveScopeField, "==", effectiveScopeValue), where("date", ">=", previousRange.start), where("date", "<=", previousRange.end))),
        getDocs(query(collection(db, "purchases"), where(effectiveScopeField, "==", effectiveScopeValue), where("date", ">=", previousRange.start), where("date", "<=", previousRange.end))),
        getDocs(query(collection(db, "income"), where(effectiveScopeField, "==", effectiveScopeValue), where("date", ">=", previousRange.start), where("date", "<=", previousRange.end))),
        getDocs(query(collection(db, "expenses"), where(effectiveScopeField, "==", effectiveScopeValue), where("date", ">=", previousRange.start), where("date", "<=", previousRange.end))),
        getDocs(query(collection(db, "operationalExpenses"), where(effectiveScopeField, "==", effectiveScopeValue), where("date", ">=", previousRange.start), where("date", "<=", previousRange.end))),
      ]);

      const prevTotalSales = prevSalesSnap.docs.reduce((sum, doc) => sum + (Number(doc.data().total) || 0), 0);
      const prevTotalPurchases = prevPurchasesSnap.docs.reduce((sum, doc) => sum + (Number(doc.data().total) || 0), 0);
      const prevTotalIncome = prevIncomeSnap.docs.reduce((sum, doc) => sum + (Number(doc.data().amount) || 0), 0);
      const prevTotalExpense =
        prevExpensesSnap.docs.reduce((sum, doc) => sum + (Number(doc.data().amount) || 0), 0) +
        prevOpExpensesSnap.docs.reduce((sum, doc) => sum + (Number(doc.data().amount) || 0), 0);

      // Calculate percentage changes
      const calculateChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };

      setMetrics({
        totalSales,
        totalPurchases,
        totalIncome,
        totalExpense,
        pettyCash: pettyCashBalance,
        salesChange: calculateChange(totalSales, prevTotalSales),
        purchasesChange: calculateChange(totalPurchases, prevTotalPurchases),
        incomeChange: calculateChange(totalIncome, prevTotalIncome),
        expenseChange: calculateChange(totalExpense, prevTotalExpense),
        pettyCashChange: 0, // Petty cash doesn't have historical comparison
      });

      // Build recent transactions (5 most recent)
      const allTransactions: Transaction[] = [];

      salesSnap.docs.forEach((doc) => {
        const data = doc.data();
        allTransactions.push({
          id: doc.id,
          type: "sale",
          description: `Sale - Invoice #${data.invoiceNumber || doc.id.slice(0, 6)}`,
          date: data.date || "",
          category: "Sales",
          amount: Number(data.total) || 0,
        });
      });

      purchasesSnap.docs.forEach((doc) => {
        const data = doc.data();
        allTransactions.push({
          id: doc.id,
          type: "purchase",
          description: `Purchase - Bill #${data.billNumber || doc.id.slice(0, 6)}`,
          date: data.date || "",
          category: "Purchase",
          amount: -(Number(data.total) || 0),
        });
      });

      incomeSnap.docs.forEach((doc) => {
        const data = doc.data();
        allTransactions.push({
          id: doc.id,
          type: "income",
          description: data.description || "Income",
          date: data.date || "",
          category: "Income",
          amount: Number(data.amount) || 0,
        });
      });

      expensesSnap.docs.forEach((doc) => {
        const data = doc.data();
        allTransactions.push({
          id: doc.id,
          type: "expense",
          description: data.description || "Expense",
          date: data.date || "",
          category: "Expense",
          amount: -(Number(data.amount) || 0),
        });
      });

      opExpensesSnap.docs.forEach((doc) => {
        const data = doc.data();
        allTransactions.push({
          id: doc.id,
          type: "operational-expense",
          description: data.description || "Operational Expense",
          date: data.date || "",
          category: "Operational Expenses",
          amount: -(Number(data.amount) || 0),
        });
      });

      // Sort by date (newest first) and take top 5
      allTransactions.sort((a, b) => (a.date > b.date ? -1 : 1));
      setRecentTransactions(allTransactions.slice(0, 5));

    } catch (error) {
      console.error("Error loading financial data:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-light">
      {/* FINANCIAL OVERVIEW SECTION */}
      <div className="px-6 py-6 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-3">
            Financial Overview
            <span className="text-xs font-medium text-primary bg-primary-light px-2.5 py-0.5 rounded-full border border-primary/20">
              Live Updates
            </span>
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const newValue = !showCards;
                setShowCards(newValue);
                localStorage.setItem('dashboardShowCards', JSON.stringify(newValue));
              }}
              className="flex items-center gap-2 rounded-full border border-border-light bg-white px-4 py-2 text-sm font-medium text-text-primary hover:border-primary/50 hover:bg-gray-50 transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">
                {showCards ? 'visibility_off' : 'visibility'}
              </span>
              {showCards ? 'Hide Cards' : 'Show Cards'}
            </button>
            <select
              value={timePeriod}
              onChange={(e) => setTimePeriod(e.target.value as TimePeriod)}
              className="flex items-center gap-2 rounded-full border border-border-light bg-white px-4 py-2 text-sm font-bold text-text-primary hover:border-primary/50 hover:bg-gray-50 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="today">Today</option>
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
              <option value="last7Days">Last 7 Days</option>
              <option value="last30Days">Last 30 Days</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-500">Loading financial data...</div>
        ) : showCards ? (
          <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* Total Sales */}
            <MetricCard
              title="Total Sales"
              amount={metrics.totalSales}
              change={metrics.salesChange}
              icon="sell"
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            />

            {/* Total Purchases */}
            <MetricCard
              title="Total Purchases"
              amount={metrics.totalPurchases}
              change={metrics.purchasesChange}
              icon="shopping_cart"
              iconBg="bg-orange-50"
              iconColor="text-orange-500"
            />

            {/* Total Income */}
            <MetricCard
              title="Total Income"
              amount={metrics.totalIncome}
              change={metrics.incomeChange}
              icon="trending_up"
              iconBg="bg-green-50"
              iconColor="text-green-600"
              showHealthy={true}
              isHighlighted={true}
            />

            {/* Total Expense */}
            <MetricCard
              title="Total Expense"
              amount={metrics.totalExpense}
              change={metrics.expenseChange}
              icon="trending_down"
              iconBg="bg-red-50"
              iconColor="text-red-500"
            />

            {/* Petty Cash */}
            <MetricCard
              title="Petty Cash"
              amount={metrics.pettyCash}
              change={metrics.pettyCashChange}
              icon="payments"
              iconBg="bg-purple-50"
              iconColor="text-purple-500"
            />
          </section>
        ) : null}
      </div>

      {/* MAIN CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 px-6 items-center">
        {/* LEFT: BRANDING BANNER */}
        <div className="lg:col-span-2">
          <div className="w-full bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-8 shadow-sm border border-border-light text-white flex flex-col items-start justify-center min-h-[280px] relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute -right-10 -top-10 size-40 rounded-full bg-white/5 blur-3xl"></div>
            <div className="absolute -left-10 -bottom-10 size-40 rounded-full bg-primary/20 blur-3xl"></div>

            <div className="relative z-10">
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2">
                {companyName}
              </h1>
              <div className="h-1 w-20 bg-primary rounded mb-4"></div>
              <p className="text-lg md:text-xl text-gray-300 font-light">
                {ownerName}
              </p>
              <Link
                href="/settings/profile"
                className="mt-4 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">edit</span>
                Edit Profile
              </Link>
            </div>
          </div>
        </div>

        {/* RIGHT: QUICK ACTIONS */}
        <div className="flex flex-col">
          <h2 className="text-lg font-bold text-text-primary mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {/* Add Income */}
            <button
              onClick={() => setShowIncomeModal(true)}
              className="bg-white border border-border-light rounded-xl p-4 hover:border-primary hover:shadow-md transition-all flex flex-col items-center justify-center gap-2 group"
            >
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center group-hover:bg-green-100 transition-colors">
                <span className="material-symbols-outlined text-[24px] text-green-600">add_circle</span>
              </div>
              <span className="text-sm font-medium text-text-primary">Add Income</span>
            </button>

            {/* Add Expense */}
            <button
              onClick={() => setShowExpenseModal(true)}
              className="bg-white border border-border-light rounded-xl p-4 hover:border-red-500 hover:shadow-md transition-all flex flex-col items-center justify-center gap-2 group"
            >
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center group-hover:bg-red-100 transition-colors">
                <span className="material-symbols-outlined text-[24px] text-red-500">remove_circle</span>
              </div>
              <span className="text-sm font-medium text-text-primary">Add Expense</span>
            </button>

            {/* Transfer Funds */}
            <button
              onClick={() => setShowTransferModal(true)}
              className="col-span-2 bg-white border border-border-light rounded-xl p-4 hover:border-blue-500 hover:shadow-md transition-all flex items-center justify-center gap-3 group"
            >
              <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                <span className="material-symbols-outlined text-[20px] text-blue-600">swap_horiz</span>
              </div>
              <span className="text-sm font-medium text-text-primary">Transfer Funds</span>
            </button>

            {/* Add Sale */}
            <Link href="/sales/new" className="bg-white border border-border-light rounded-xl p-4 hover:border-primary hover:shadow-md transition-all flex flex-col items-center justify-center gap-2 group">
              <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                <span className="material-symbols-outlined text-[24px] text-blue-600">sell</span>
              </div>
              <span className="text-sm font-medium text-text-primary">Add Sale</span>
            </Link>

            {/* Add Purchase */}
            <Link href="/purchase/new" className="bg-white border border-border-light rounded-xl p-4 hover:border-orange-500 hover:shadow-md transition-all flex flex-col items-center justify-center gap-2 group">
              <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                <span className="material-symbols-outlined text-[24px] text-orange-500">shopping_cart</span>
              </div>
              <span className="text-sm font-medium text-text-primary">Add Purchase</span>
            </Link>
          </div>
        </div>
      </div>

      {/* RECENT TRANSACTIONS */}
      <div className="bg-white rounded-xl shadow-sm border border-border-light p-6 mx-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-text-primary">Recent Transactions</h2>
          <Link href="/sales" className="text-sm text-primary hover:text-primary-dark font-medium flex items-center gap-1">
            View All
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-6 text-text-secondary">Loading transactions...</div>
        ) : recentTransactions.length === 0 ? (
          <div className="text-center py-6 text-text-secondary">No transactions found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-light">
                  <th className="text-left py-3 px-4 text-xs font-bold text-text-secondary uppercase tracking-wider">Transaction</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-text-secondary uppercase tracking-wider">Date</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-text-secondary uppercase tracking-wider">Category</th>
                  <th className="text-right py-3 px-4 text-xs font-bold text-text-secondary uppercase tracking-wider">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center ${getTransactionIconBg(transaction.type)}`}>
                          {getTransactionIcon(transaction.type)}
                        </div>
                        <span className="text-sm font-medium text-text-primary">{transaction.description}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-text-secondary">
                      {new Date(transaction.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getCategoryBadgeColor(transaction.type)}`}>
                        {transaction.category}
                      </span>
                    </td>
                    <td className={`py-4 px-4 text-right text-sm font-bold ${transaction.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {transaction.amount >= 0 ? "+" : ""}PKR {Math.abs(transaction.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* INCOME MODAL */}
      {showIncomeModal && (
        <ModalWrapper onClose={() => setShowIncomeModal(false)} title="Add Income">
          <IncomeForm onSuccess={() => setShowIncomeModal(false)} />
        </ModalWrapper>
      )}

      {/* EXPENSE MODAL */}
      {showExpenseModal && (
        <ModalWrapper onClose={() => setShowExpenseModal(false)} title="Add Expense">
          <ExpenseForm onSuccess={() => setShowExpenseModal(false)} />
        </ModalWrapper>
      )}

      {/* TRANSFER MODAL (NEW) */}
      {showTransferModal && (
        <ModalWrapper onClose={() => setShowTransferModal(false)} title="Transfer Funds">
          <TransferForm onSuccess={() => setShowTransferModal(false)} />
        </ModalWrapper>
      )}
    </div>
  );
}

// Helper Components
function MetricCard({
  title,
  amount,
  change,
  icon,
  iconBg,
  iconColor,
  showHealthy = false,
  isHighlighted = false,
}: {
  title: string;
  amount: number;
  change: number;
  icon: string;
  iconBg: string;
  iconColor: string;
  showHealthy?: boolean;
  isHighlighted?: boolean;
}) {
  const isPositive = change >= 0;

  return (
    <div className={`flex flex-col justify-between rounded-xl bg-white p-5 shadow-sm border transition-transform hover:scale-[1.02] hover:shadow-md ${
      isHighlighted
        ? "border-green-200 ring-2 ring-green-50 relative overflow-hidden"
        : "border-border-light"
    }`}>
      {isHighlighted && (
        <div className="absolute -right-4 -top-4 size-20 rounded-full bg-green-100 blur-2xl"></div>
      )}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-medium text-text-secondary">{title}</p>
        <div className={`rounded-full ${iconBg} p-2 ${iconColor}`}>
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </div>
      </div>
      <div>
        <h3 className="text-2xl font-bold tracking-tight text-text-primary">
          PKR {amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </h3>
        {showHealthy ? (
          <p className="mt-1 text-xs font-medium text-green-600 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">check_circle</span> Healthy
          </p>
        ) : (
          <p className={`mt-1 text-xs font-medium flex items-center gap-1 ${isPositive ? "text-green-600" : "text-red-500"}`}>
            <span className="material-symbols-outlined text-[14px]">
              {isPositive ? "arrow_upward" : "arrow_downward"}
            </span>
            {Math.abs(change).toFixed(1)}% vs last period
          </p>
        )}
      </div>
    </div>
  );
}

function ModalWrapper({ children, onClose, title }: { children: ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-lg shadow-lg p-6 relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-500 hover:text-black">✕</button>
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}

// Helper functions for transaction styling
function getTransactionIcon(type: string) {
  switch (type) {
    case "sale":
      return <span className="material-symbols-outlined text-[16px]">sell</span>;
    case "purchase":
      return <span className="material-symbols-outlined text-[16px]">shopping_cart</span>;
    case "income":
      return <span className="material-symbols-outlined text-[16px]">trending_up</span>;
    case "expense":
    case "operational-expense":
      return <span className="material-symbols-outlined text-[16px]">trending_down</span>;
    default:
      return <span className="material-symbols-outlined text-[16px]">circle</span>;
  }
}

function getTransactionIconBg(type: string) {
  switch (type) {
    case "sale":
      return "bg-green-100 text-green-600";
    case "purchase":
      return "bg-orange-100 text-orange-600";
    case "income":
      return "bg-green-100 text-green-600";
    case "expense":
    case "operational-expense":
      return "bg-red-100 text-red-600";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function getCategoryBadgeColor(type: string) {
  switch (type) {
    case "sale":
      return "bg-green-100 text-green-700";
    case "purchase":
      return "bg-orange-100 text-orange-700";
    case "income":
      return "bg-green-100 text-green-700";
    case "expense":
      return "bg-red-100 text-red-700";
    case "operational-expense":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

