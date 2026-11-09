"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function BackButton({ className = "" }: { className?: string }) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      // If there is no history, send user to home as a sensible fallback
      router.push("/");
    }
  };

  // Use same spacing/shape as LogoutButton but with a light gray background
  return (
    <div className={`${className}`}>
      <button
        onClick={handleBack}
        aria-label="Go back"
        className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 flex items-center gap-2"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        <span className="hidden sm:inline">Back</span>
      </button>
    </div>
  );
}
