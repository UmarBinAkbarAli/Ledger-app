"use client";

import IncomeForm from "@/components/forms/IncomeForm";

export default function IncomePage() {
  return (
    <div className="max-w-xl mx-auto bg-white p-6 rounded shadow">
      <h1 className="text-2xl font-bold mb-4">Add Income</h1>
      <IncomeForm />
    </div>
  );
}
