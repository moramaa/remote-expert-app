'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, PhoneCall } from 'lucide-react';
import SosFlow from '@/components/worker/SosFlow';
import { useSocket } from '@/hooks/useSocket';
import { useProfile } from '@/hooks/useProfile';
import { getStoredUserId, storeSessionId } from '@/lib/identity';

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
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', padding: '16px 20px' }}>
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

      {/* Body — vertically centered hero */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', gap: '20px' }}>
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
