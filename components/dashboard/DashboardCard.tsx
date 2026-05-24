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
        background: '#0d1b2a',
        border: `1px solid ${active ? '#f97316' : '#27272a'}`,
        boxShadow: active ? '0 0 24px rgba(249,115,22,0.25)' : 'none',
        cursor: clickable ? 'pointer' : 'not-allowed',
        opacity: comingSoon ? 0.55 : 1,
        transition: 'border-color 0.15s, box-shadow 0.15s',
        textAlign: 'center',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        if (!clickable) return;
        (e.currentTarget as HTMLDivElement).style.borderColor = '#f97316';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 24px rgba(249,115,22,0.3)';
      }}
      onMouseLeave={(e) => {
        if (!clickable || active) return;
        (e.currentTarget as HTMLDivElement).style.borderColor = '#27272a';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      }}
    >
      <div style={{ color: '#f97316', lineHeight: 1 }}>{icon}</div>
      <div>
        <div style={{ fontSize: '15px', fontWeight: 600, color: '#f1f5f9', marginBottom: '4px' }}>
          {title}
        </div>
        <div style={{ fontSize: '12px', color: '#64748b', maxWidth: '200px' }}>
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
