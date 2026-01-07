"use client";
import { useEffect, useState } from "react";

export default function useOnlineStatus() {
  // Start with true to avoid hydration mismatch (server always renders as online)
  const [online, setOnline] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setOnline(navigator.onLine);

    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Don't show offline banner until mounted (prevents hydration mismatch)
  if (!mounted) return true;

  return online;
}
