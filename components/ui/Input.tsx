// components/ui/Input.tsx
import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  className?: string;
}

export default function Input({ label, error, className = "", ...rest }: InputProps) {
  return (
    <label className="block">
      {label ? <div className="mb-1 text-sm text-slate-700">{label}</div> : null}
      <input
        {...rest}
        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-sky-300 ${className}`}
      />
      {error ? <div className="mt-1 text-xs text-red-600">{error}</div> : null}
    </label>
  );
}
