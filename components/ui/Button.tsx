// components/ui/Button.tsx
import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger";
  loading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export default function Button({
  variant = "primary",
  loading = false,
  icon,
  children,
  className = "",
  disabled,
  ...rest
}: ButtonProps) {
  const base =
  "inline-flex items-center justify-center gap-2 font-medium transition-all rounded-md active:scale-95 disabled:opacity-60 disabled:pointer-events-none";

const sizeClasses = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-3 text-base",
};

const variants = {
  primary:
    "bg-grey-600 text-white shadow-sm hover:bg-blue-800 focus:ring-2 focus:ring-blue-300",
  ghost:
    "bg-transparent border border-slate-300 text-slate-700 hover:bg-slate-100",
  danger:
    "bg-red-600 text-white shadow-sm hover:bg-red-700 focus:ring-2 focus:ring-red-300",
  subtle:
    "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300",
};

  const classes = `${base} ${variants[variant] ?? variants.primary} ${className}`;

  return (
    <button
      className={classes}
      disabled={loading || disabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      ) : null}

      {icon ? <span className="inline-flex items-center">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}
