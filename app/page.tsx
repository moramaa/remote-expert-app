'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Factory, HardHat, Shield, Zap } from 'lucide-react';
import { getStoredRole, getStoredUserId, storeRole, storeUserId, clearIdentity, type UserRole } from '@/lib/identity';
import {
  DEMO_WORKER_ID, DEMO_EXPERT_ID, DEMO_ADMIN_ID,
  DEMO_WORKER_NAME, DEMO_EXPERT_NAME,
} from '@/lib/demo-data';

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

  function select(role: UserRole): void {
    storeRole(role);
    router.push(`/onboarding/${role}`);
  }

  /** One-click demo entry — bypasses onboarding, lands directly on dashboard. */
  function enterDemo(role: UserRole): void {
    clearIdentity();
    const id = role === 'worker' ? DEMO_WORKER_ID
             : role === 'expert' ? DEMO_EXPERT_ID
             : DEMO_ADMIN_ID;
    storeUserId(id);
    storeRole(role);
    router.push(`/dashboard/${role}`);
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

      {/* ── Demo Mode Banner ──────────────────────────────────────────────── */}
      <div
        style={{
          width: '100%',
          maxWidth: '360px',
          background: 'linear-gradient(135deg, #EFF6FF 0%, #F0FDF4 100%)',
          border: '1.5px solid #BFDBFE',
          borderRadius: '14px',
          padding: '20px 24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <Zap size={16} color="#1D4ED8" />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#1D4ED8' }}>
            Try the demo instantly
          </span>
        </div>
        <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 16px' }}>
          No registration needed — jump straight into a pre-loaded session.
        </p>

        <div style={{ display: 'flex', gap: '10px' }}>
          {/* Demo Worker */}
          <button
            type="button"
            onClick={() => enterDemo('worker')}
            style={{
              flex: 1,
              padding: '12px 10px',
              background: '#1D4ED8',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              lineHeight: 1.3,
            }}
          >
            <HardHat size={18} style={{ display: 'block', margin: '0 auto 4px' }} />
            {DEMO_WORKER_NAME}
            <div style={{ fontSize: '10px', fontWeight: 400, opacity: 0.85, marginTop: '2px' }}>
              Field Worker
            </div>
          </button>

          {/* Demo Expert */}
          <button
            type="button"
            onClick={() => enterDemo('expert')}
            style={{
              flex: 1,
              padding: '12px 10px',
              background: '#16A34A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              lineHeight: 1.3,
            }}
          >
            <Factory size={18} style={{ display: 'block', margin: '0 auto 4px' }} />
            {DEMO_EXPERT_NAME}
            <div style={{ fontSize: '10px', fontWeight: 400, opacity: 0.85, marginTop: '2px' }}>
              Remote Expert
            </div>
          </button>

          {/* Demo Admin */}
          <button
            type="button"
            onClick={() => enterDemo('administrator')}
            style={{
              flex: 1,
              padding: '12px 10px',
              background: '#7C3AED',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              lineHeight: 1.3,
            }}
          >
            <Shield size={18} style={{ display: 'block', margin: '0 auto 4px' }} />
            Admin
            <div style={{ fontSize: '10px', fontWeight: 400, opacity: 0.85, marginTop: '2px' }}>
              Administrator
            </div>
          </button>
        </div>
      </div>

      {/* ── Manual role-select (with registration) ─────────────────────── */}
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
          Or sign in with a new account
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

          <button
            type="button"
            onClick={() => select('administrator')}
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
            <Shield size={40} color="#1D4ED8" />
            <div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A' }}>I&apos;m an Administrator</div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                Manage and audit session records
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
