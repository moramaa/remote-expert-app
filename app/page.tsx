'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Factory, HardHat } from 'lucide-react';
import { getStoredRole, getStoredUserId, storeRole } from '@/lib/identity';

export default function Home() {
  const router = useRouter();

  // If identity already set, redirect to the appropriate dashboard
  useEffect(() => {
    const role   = getStoredRole();
    const userId = getStoredUserId();
    if (role && userId) {
      router.replace(`/dashboard/${role}`);
    }
  }, [router]);

  function select(role: 'expert' | 'worker'): void {
    storeRole(role);
    router.push(`/onboarding/${role}`);
  }

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '32px',
        background: '#F8FAFC',
        padding: '32px',
        color: '#0F172A',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '36px',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#1D4ED8',
            margin: 0,
          }}
        >
          FieldSync
        </h1>
        <p
          style={{
            marginTop: '8px',
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.25em',
            color: '#64748B',
          }}
        >
          Remote Expert Platform
        </p>
      </div>

      <div style={{ width: '100%', maxWidth: '320px', textAlign: 'center' }}>
        <p
          style={{
            marginBottom: '24px',
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: '#94A3B8',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          Who are you?
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <button
            type="button"
            onClick={() => select('expert')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              padding: '32px 24px',
              cursor: 'pointer',
              borderRadius: '12px',
              transition: 'border-color 0.15s, box-shadow 0.15s',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#1D4ED8';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 0 3px #DBEAFE';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#E2E8F0';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)';
            }}
          >
            <Factory size={40} color="#1D4ED8" />
            <div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A' }}>I&apos;m an Expert</div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                Guide field workers remotely in live 3D sessions
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => select('worker')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              padding: '32px 24px',
              cursor: 'pointer',
              borderRadius: '12px',
              transition: 'border-color 0.15s, box-shadow 0.15s',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#1D4ED8';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 0 3px #DBEAFE';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#E2E8F0';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)';
            }}
          >
            <HardHat size={40} color="#1D4ED8" />
            <div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A' }}>I&apos;m a Field Worker</div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                Request live expert guidance on-site
              </div>
            </div>
          </button>
        </div>
      </div>

      <div
        style={{
          textAlign: 'center',
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '10px',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: '#CBD5E1',
        }}
      >
        FieldSync MVP · Phase 2
      </div>
    </div>
  );
}
