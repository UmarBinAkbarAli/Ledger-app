"use client";

import { useState } from "react";

export default function ShareButton({ 
  title, 
  text, 
  url 
}: { 
  title: string; 
  text: string; 
  url?: string; 
}) {
  const handleShare = async () => {
    // 1. Construct the data to share
    const shareData = {
      title,
      text,
      url: url || (typeof window !== "undefined" ? window.location.href : ""),
    };

    // 2. Try Native Mobile Share (Best for Mobile Users)
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log("Share canceled", err);
      }
    } 
    // 3. Fallback to WhatsApp Web (Best for Desktop Users)
    else {
      const whatsappText = `${title}\n\n${text}\n\nView Invoice: ${shareData.url}`;
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;
      window.open(whatsappUrl, "_blank");
    }
  };

  return (
    <button
      onClick={handleShare}
      className="bg-green-600 text-white px-6 py-2 rounded shadow hover:bg-green-700 font-bold flex items-center gap-2 transition-colors"
    >
      {/* WhatsApp / Share Icon */}
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
        <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592z"/>
      </svg>
      Share to WhatsApp
    </button>
  );
}