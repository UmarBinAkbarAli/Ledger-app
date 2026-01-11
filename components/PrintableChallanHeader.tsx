"use client";

import { useCompanyProfile } from "@/hooks/useCompanyProfile";

export default function PrintableChallanHeader() {
  const { profile, loading } = useCompanyProfile();

  if (loading || !profile) {
    return null;
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
        {profile.logoUrl ? (
          <img
            src={profile.logoUrl}
            alt={profile.companyName}
            style={{ width: 80, height: 80, border: '1px solid #ddd', objectFit: 'contain' }}
          />
        ) : (
          <div style={{ width: 80, height: 80, border: '1px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#999' }}>
            LOGO
          </div>
        )}
        <div style={{ flex: 1, textAlign: 'center', padding: '0 8px' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{profile.companyName}</div>
          {profile.tagline && (
            <div style={{ fontSize: 10, fontStyle: 'italic', marginTop: 4 }}>{profile.tagline}</div>
          )}
          {profile.address && (
            <div style={{ fontSize: 9, marginTop: 4 }}>{profile.address}</div>
          )}
        </div>
        {profile.phone && (
          <div style={{ textAlign: 'right', fontSize: 10 }}>
            <div>Contact No # {profile.phone}</div>
          </div>
        )}
      </div>
      <div style={{ textAlign: 'center', borderTop: '2px solid #000', paddingTop: '6px', marginTop: '6px' }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>DELIVERY CHALLAN</div>
      </div>
    </>
  );
}
