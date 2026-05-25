'use client';

import type { ReactNode } from 'react';
import ComingSoonBadge from './ComingSoonBadge';

interface Props {
  icon: ReactNode;
  title: string;
  description: string;
  comingSoon?: boolean;
  onClick?: () => void;
  active?: boolean;
}

export default function DashboardCard({
  icon,
  title,
  description,
  comingSoon = false,
  onClick,
  active = false,
}: Props) {
  const clickable = !comingSoon && !!onClick;

  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        padding: '32px 24px',
        background: '#FFFFFF',
        border: `1px solid ${active ? '#1D4ED8' : '#E2E8F0'}`,
        borderRadius: '12px',
        boxShadow: active ? '0 0 0 3px #DBEAFE' : '0 1px 4px rgba(0,0,0,0.05)',
        cursor: clickable ? 'pointer' : 'not-allowed',
        opacity: comingSoon ? 0.55 : 1,
        transition: 'border-color 0.15s, box-shadow 0.15s',
        textAlign: 'center',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        if (!clickable) return;
        (e.currentTarget as HTMLDivElement).style.borderColor = '#1D4ED8';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 3px #DBEAFE';
      }}
      onMouseLeave={(e) => {
        if (!clickable || active) return;
        (e.currentTarget as HTMLDivElement).style.borderColor = '#E2E8F0';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)';
      }}
    >
      <div style={{ color: '#1D4ED8', lineHeight: 1 }}>{icon}</div>
      <div>
        <div style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A', marginBottom: '4px' }}>
          {title}
        </div>
        <div style={{ fontSize: '12px', color: '#64748B', maxWidth: '200px' }}>
          {description}
        </div>
      </div>
      {comingSoon && (
        <div style={{ marginTop: '4px' }}>
          <ComingSoonBadge />
        </div>
      )}
    </div>
  );
}
