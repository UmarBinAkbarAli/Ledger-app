"use client";

import ExpenseForm from "@/components/forms/ExpenseForm";

export default function ExpensePage() {
  return (
    <div className="max-w-xl mx-auto bg-white p-6 rounded shadow">
      <h1 className="text-2xl font-bold mb-4">Add Expense</h1>
      <ExpenseForm />
    </div>
  );
}
