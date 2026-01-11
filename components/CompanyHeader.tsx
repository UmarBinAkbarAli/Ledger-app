"use client";

import React, { useState } from "react";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";

interface CompanyHeaderProps {
  variant?: "default" | "compact" | "invoice" | "challan" | "challan-print";
  showTagline?: boolean;
  logoWidth?: number;
  showAddress?: boolean;
  showPhone?: boolean;
}

export default function CompanyHeader({
  variant = "default",
  showTagline = true,
  logoWidth = 160,
  showAddress = true,
  showPhone = true,
}: CompanyHeaderProps) {
  const { profile, loading } = useCompanyProfile();

  if (loading) {
    return <div className="h-24 bg-gray-100 rounded animate-pulse" />;
  }

  if (!profile) {
    return null;
  }

  console.log('🖼️ CompanyHeader rendering with logo:', profile.logoUrl);

  // Helpers to robustly handle Google Drive image URLs by trying multiple endpoints
  const extractDriveId = (url: string | null): string | null => {
    if (!url) return null;
    let m = url.match(/drive\.google\.com\/file\/d\/([^\/\?]+)/);
    if (!m) m = url.match(/drive\.google\.com\/open\?id=([^\&]+)/);
    if (!m) m = url.match(/id=([^\&]+)/); // generic id query fallback
    return m ? m[1] : null;
  };

  const buildImageCandidates = (url: string | null): string[] => {
    if (!url) return [];
    // If this looks like a Drive URL, construct multiple candidates
    if (/drive\.google\.com/.test(url)) {
      const id = extractDriveId(url);
      if (id) {
        return [
          // Original (view)
          `https://drive.google.com/uc?export=view&id=${id}`,
          // Thumbnail endpoint (renders as image reliably)
          `https://drive.google.com/thumbnail?id=${id}&sz=w1000`,
          // Direct download endpoint (often returns image for images)
          `https://drive.google.com/uc?export=download&id=${id}`,
          // Googleusercontent CDN variant (commonly used)
          `https://lh3.googleusercontent.com/d/${id}=s1200`
        ];
      }
    }
    // Non-Drive URL, just return the original
    return [url];
  };

  // Small internal component to render logo with automatic fallbacks
  const LogoImg = ({ style, className }: { style?: React.CSSProperties; className?: string }) => {
    const candidates = buildImageCandidates(profile.logoUrl);
    const [idx, setIdx] = useState(0);
    const src = candidates[idx] ?? "";
    if (!src) return null;
    return (
      <img
        src={src}
        alt={profile.companyName}
        style={style}
        className={className}
        onError={() => {
          // Try next candidate silently; only warn if all fail
          if (idx < candidates.length - 1) {
            setIdx(idx + 1);
          } else {
            console.warn('Logo failed for all sources:', candidates);
          }
        }}
      />
    );
  };

  if (variant === "challan-print") {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
        {profile.logoUrl ? (
          <LogoImg style={{ width: 80, height: 80, border: '1px solid #ddd', objectFit: 'contain' }} />
        ) : (
          <div style={{ width: 80, height: 80, border: '1px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#999' }}>
            LOGO
          </div>
        )}
        <div style={{ flex: 1, textAlign: 'center', padding: '0 8px' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{profile.companyName}</div>
          {showTagline && profile.tagline && (
            <div style={{ fontSize: 10, fontStyle: 'italic', marginTop: 4 }}>{profile.tagline}</div>
          )}
          {showAddress && profile.address && (
            <div style={{ fontSize: 9, marginTop: 4 }}>{profile.address}</div>
          )}
        </div>
        {showPhone && profile.phone && (
          <div style={{ textAlign: 'right', fontSize: 10 }}>
            <div>Contact No # {profile.phone}</div>
          </div>
        )}
      </div>
    );
  }

  if (variant === "challan") {
    return (
      <div className="flex items-start justify-between w-full">
        {/* Logo placeholder */}
        {profile.logoUrl ? (
          <LogoImg style={{ width: 80, height: 80 }} className="object-contain border border-gray-300" />
        ) : (
          <div className="w-20 h-20 border border-gray-300 flex items-center justify-center text-xs text-gray-400">
            LOGO
          </div>
        )}
        
        {/* Company Info */}
        <div className="flex-1 text-center px-4">
          <h1 className="text-3xl font-bold mb-1">{profile.companyName}</h1>
          {showTagline && profile.tagline && (
            <p className="text-sm italic mb-2">{profile.tagline}</p>
          )}
          {showAddress && profile.address && (
            <p className="text-xs">{profile.address}</p>
          )}
        </div>

        {/* Contact */}
        {showPhone && profile.phone && (
          <div className="text-right text-xs">
            <p>Contact No # {profile.phone}</p>
          </div>
        )}
      </div>
    );
  }

  if (variant === "invoice") {
    return (
      <div className="flex items-start gap-4 mb-6">
        {profile.logoUrl ? (
          <LogoImg style={{ width: logoWidth, height: "auto" }} className="object-contain" />
        ) : null}
        <div>
          <h2 className="text-xl font-bold text-gray-800">{profile.companyName}</h2>
          {showAddress && profile.address && (
            <div className="text-sm text-gray-600">{profile.address}</div>
          )}
          {showPhone && profile.phone && (
            <div className="text-sm text-gray-600">Phone: {profile.phone}</div>
          )}
          {profile.email && (
            <div className="text-sm text-gray-600">Email: {profile.email}</div>
          )}
          {profile.website && (
            <div className="text-sm text-gray-600">Website: {profile.website}</div>
          )}
        </div>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className="mb-4">
        <h3 className="font-bold text-sm">{profile.companyName}</h3>
        {showAddress && profile.address && (
          <p className="text-xs text-gray-600">{profile.address}</p>
        )}
        {showPhone && profile.phone && (
          <p className="text-xs text-gray-600">{profile.phone}</p>
        )}
      </div>
    );
  }

  // default variant
  return (
    <div className="bg-white rounded-lg border border-border-light p-4 mb-6">
      <div className="flex items-start gap-4">
        {profile.logoUrl ? (
          <LogoImg style={{ width: logoWidth, height: "auto" }} className="object-contain" />
        ) : null}
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text-primary">{profile.companyName}</h1>
          {profile.ownerName && (
            <p className="text-sm text-text-secondary">Owner: {profile.ownerName}</p>
          )}
          {showTagline && profile.tagline && (
            <p className="text-sm italic text-text-secondary mt-1">{profile.tagline}</p>
          )}
          <div className="mt-3 space-y-1">
            {showAddress && profile.address && (
              <p className="text-sm text-text-secondary">{profile.address}</p>
            )}
            {showPhone && profile.phone && (
              <p className="text-sm text-text-secondary">Phone: {profile.phone}</p>
            )}
            {profile.email && (
              <p className="text-sm text-text-secondary">Email: {profile.email}</p>
            )}
            {profile.website && (
              <p className="text-sm text-text-secondary">Website: {profile.website}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
