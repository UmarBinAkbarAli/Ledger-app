"use client";

import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="p-6">

      {/*─────────────────────────*/}
      {/* QUICK ACTION BUTTONS   */}
      {/*─────────────────────────*/}
      <h2 className="text-xl font-bold mb-4">Quick Actions</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <QuickAction title="Add Sale" url="/sales/new" color="bg-blue-600" />
        <QuickAction title="Add Purchase" url="/purchase/new" color="bg-orange-600" />
        <QuickAction title="Add Income" url="/income" color="bg-green-600" />
        <QuickAction title="Add Expense" url="/expenses" color="bg-red-600" />
      </div>

      {/*─────────────────────────*/}
      {/*  Simple Welcome Banner  */}
      {/*─────────────────────────*/}
      <div className="bg-gray-100 p-6 rounded-xl shadow">
        <h1 className="text-3xl font-bold mb-3">Welcome to Your Dashboard</h1>
        <p className="text-gray-600 text-lg">
          Use the quick actions above to manage your sales, purchases, income and expenses.
        </p>
      </div>
    </div>
  );
}

// ───────────────────────────────
// Quick Action Button Component
// ───────────────────────────────

function QuickAction({
  title,
  url,
  color,
}: {
  title: string;
  url: string;
  color: string;
}) {
  return (
    <Link
      href={url}
      className={`${color} text-white text-center py-4 rounded-xl shadow hover:opacity-90 font-semibold`}
    >
      {title}
    </Link>
  );
}
