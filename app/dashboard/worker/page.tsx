'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, PhoneCall, History, LogOut } from 'lucide-react';
import SosFlow from '@/components/worker/SosFlow';
import { useSocket } from '@/hooks/useSocket';
import { useProfile } from '@/hooks/useProfile';
import { getStoredUserId, storeSessionId, clearIdentity } from '@/lib/identity';

interface WorkerProfile {
  name: string;
  factory: string;
  roleLevel: string;
}

function WorkerDashboardInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const profile      = useProfile('worker');
  const { socket, isConnected } = useSocket();

  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);
  const [showSosFlow,   setShowSosFlow]   = useState(false);

  // ?sos=MACHINE_ID → auto-open SOS flow (from "Start Live SOS Call" in preview mode)
  useEffect(() => {
    if (searchParams.get('sos') && isConnected && workerProfile) {
      setShowSosFlow(true);
    }
  }, [searchParams, isConnected, workerProfile]);

  // Load profile
  useEffect(() => {
    if (profile.status !== 'ready') return;
    fetch(`/api/me?id=${profile.userId}&role=worker`)
      .then((r) => r.json())
      .then((data: WorkerProfile) => setWorkerProfile(data))
      .catch(() => {/* noop */});
  }, [profile]);

  // Handle session:join events (e.g., expert accepts from their dashboard)
  useEffect(() => {
    if (!socket) return;

    const onSessionJoin = ({ sessionId }: { sessionId: string; role: 'expert' | 'worker' }): void => {
      storeSessionId(sessionId);
      router.push('/worker');
    };

    socket.on('session:join', onSessionJoin);
    return () => { socket.off('session:join', onSessionJoin); };
  }, [socket, router]);

  if (profile.status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '12px', color: '#64748B', fontFamily: 'monospace' }}>Loading…</span>
      </div>
    );
  }

  const userId = getStoredUserId() ?? '';

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', color: '#0F172A', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1D4ED8', margin: 0 }}>
            {workerProfile?.name ?? 'Worker'}
          </h1>
          <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0' }}>
            {workerProfile?.factory ?? ''}
          </p>
          <p style={{ fontSize: '10px', color: '#94A3B8', fontFamily: 'monospace', margin: '2px 0 0', letterSpacing: '0.08em' }}>
            ID: {userId.slice(0, 8)}… · Worker View
          </p>
        </div>
        <button
          type="button"
          onClick={() => { clearIdentity(); router.push('/'); }}
          title="Switch role / log out"
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '7px 12px', borderRadius: '8px',
            border: '1px solid #E2E8F0', background: '#FFFFFF',
            color: '#64748B', fontSize: '12px', fontWeight: 500,
            cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#DC2626';
            (e.currentTarget as HTMLButtonElement).style.color = '#DC2626';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#E2E8F0';
            (e.currentTarget as HTMLButtonElement).style.color = '#64748B';
          }}
        >
          <LogOut size={13} />
          Switch Role
        </button>
      </div>

      {/* Body — vertically centered hero */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', gap: '16px' }}>
        {/* Offline warning */}
        {!isConnected && (
          <div
            style={{
              width: '100%', maxWidth: '420px', padding: '10px 14px',
              border: '1px solid #DC2626', background: '#FEE2E2',
              fontSize: '12px', color: '#DC2626',
              display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '8px',
            }}
          >
            <AlertTriangle size={14} />
            Not connected to server — SOS unavailable
          </div>
        )}

        {/* Hero SOS card */}
        <div
          style={{
            width: '100%', maxWidth: '420px', background: '#FFFFFF',
            border: '1px solid #E2E8F0', borderRadius: '16px', padding: '40px 32px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px',
            boxShadow: '0 4px 24px rgba(29,78,216,0.08)', textAlign: 'center',
          }}
        >
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PhoneCall size={36} color="#1D4ED8" />
          </div>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#0F172A', margin: '0 0 8px' }}>Need Expert Help?</h2>
            <p style={{ fontSize: '14px', color: '#64748B', margin: 0, lineHeight: '1.5' }}>
              Connect instantly with a certified expert for live 3D guidance directly on your machine.
            </p>
          </div>
          <button
            onClick={() => setShowSosFlow(true)}
            disabled={!isConnected}
            style={{
              width: '100%', padding: '16px',
              background: isConnected ? '#1D4ED8' : '#94A3B8', color: '#FFFFFF',
              border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 700,
              cursor: isConnected ? 'pointer' : 'not-allowed', letterSpacing: '0.02em', transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { if (isConnected) (e.currentTarget as HTMLButtonElement).style.background = '#1E40AF'; }}
            onMouseLeave={(e) => { if (isConnected) (e.currentTarget as HTMLButtonElement).style.background = '#1D4ED8'; }}
          >
            Open SOS Call
          </button>
          <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>Average response time: &lt; 2 minutes</p>
        </div>

        {/* History button */}
        <button
          onClick={() => router.push('/dashboard/worker/history')}
          style={{
            width: '100%', maxWidth: '420px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            padding: '12px',
            background: '#FFFFFF', color: '#475569',
            border: '1px solid #E2E8F0', borderRadius: '10px',
            fontSize: '14px', fontWeight: 500,
            cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#1D4ED8';
            (e.currentTarget as HTMLButtonElement).style.color = '#1D4ED8';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#E2E8F0';
            (e.currentTarget as HTMLButtonElement).style.color = '#475569';
          }}
        >
          <History size={16} />
          View Call History
        </button>
      </div>

      {/* SOS bottom-sheet flow */}
      {showSosFlow && workerProfile && socket && (
        <SosFlow
          profile={{ name: workerProfile.name, factory: workerProfile.factory }}
          socket={socket}
          isConnected={isConnected}
          onSessionJoined={(sessionId) => {
            storeSessionId(sessionId);
            router.push('/worker');
          }}
          onClose={() => setShowSosFlow(false)}
        />
      )}
    </div>
  );
}

export default function WorkerDashboardPage() {
  return (
    <Suspense>
      <WorkerDashboardInner />
    </Suspense>
  );
}
