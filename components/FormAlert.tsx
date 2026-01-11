"use client";

import { useEffect } from "react";

interface FormAlertProps {
  type: "success" | "error" | "warning" | "info";
  message: string;
  onClose: () => void;
  closeable?: boolean;
  autoDismissMs?: number;
}

export function FormAlert({
  type,
  message,
  onClose,
  closeable = true,
  autoDismissMs,
}: FormAlertProps) {
  useEffect(() => {
    if (!autoDismissMs) return;
    const timer = setTimeout(onClose, autoDismissMs);
    return () => clearTimeout(timer);
  }, [autoDismissMs, onClose]);

  const colorClasses = {
    error: "bg-red-50 border-red-200 text-red-700",
    success: "bg-green-50 border-green-200 text-green-700",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-700",
    info: "bg-blue-50 border-blue-200 text-blue-700",
  };

  return (
    <div className={`mb-4 p-4 border rounded ${colorClasses[type]}`}>
      <div className="flex justify-between items-center">
        <span>{message}</span>
        {closeable && (
          <button
            onClick={onClose}
            className="hover:opacity-70 font-bold"
            aria-label="Close alert"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
