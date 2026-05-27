'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, History, Factory, LogOut } from 'lucide-react';
import AvailabilityToggle from '@/components/dashboard/AvailabilityToggle';
import DashboardCard from '@/components/dashboard/DashboardCard';
import LiveQueuePanel from '@/components/dashboard/LiveQueuePanel';
import { useSocket } from '@/hooks/useSocket';
import { useProfile } from '@/hooks/useProfile';
import { getStoredUserId, storeSessionId, clearIdentity } from '@/lib/identity';
import type { TicketSummary } from '@/types/socket';

interface ExpertProfile {
  name: string;
  certifications: Array<{ machineId: string }>;
}

export default function ExpertDashboardPage() {
  const router  = useRouter();
  const profile = useProfile('expert');
  const { socket, isConnected } = useSocket();

  const [expertProfile, setExpertProfile] = useState<ExpertProfile | null>(null);
  const [online,    setOnline]    = useState(false);
  const [queue,     setQueue]     = useState<TicketSummary[]>([]);
  const [accepting, setAccepting] = useState<string | null>(null);

  const certIdsRef = useRef<string[]>([]);

  // Load profile from DB; re-emit availability if toggle is already on when certs arrive
  useEffect(() => {
    if (profile.status !== 'ready') return;
    fetch(`/api/me?id=${profile.userId}&role=expert`)
      .then((r) => r.json())
      .then((data: ExpertProfile) => {
        setExpertProfile(data);
        const ids = (data.certifications ?? []).map((c) => c.machineId);
        certIdsRef.current = ids;
        // If the expert already toggled online before certs loaded, re-emit with correct certs
        setOnline((prev) => {
          if (prev && socket && isConnected) {
            socket.emit('expert:set-availability', { online: true, certificationIds: ids });
          }
          return prev;
        });
      })
      .catch(() => {/* noop */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    const onIncoming = (ticket: TicketSummary): void => {
      setQueue((prev) => {
        if (prev.some((t) => t.ticketId === ticket.ticketId)) return prev;
        return [...prev, ticket];
      });
    };

    const onQueueUpdate = (tickets: TicketSummary[]): void => {
      setQueue(tickets);
    };

    const onSessionJoin = ({ sessionId }: { sessionId: string; role: 'expert' | 'worker' }): void => {
      storeSessionId(sessionId);
      router.push('/expert');
    };

    socket.on('expert:incoming-ticket', onIncoming);
    socket.on('expert:queue-update',    onQueueUpdate);
    socket.on('session:join',           onSessionJoin);

    return () => {
      socket.off('expert:incoming-ticket', onIncoming);
      socket.off('expert:queue-update',    onQueueUpdate);
      socket.off('session:join',           onSessionJoin);
    };
  }, [socket, router]);

  // Emit availability whenever online state or socket changes
  const emitAvailability = useCallback(
    (nextOnline: boolean): void => {
      if (!socket || !isConnected) return;
      socket.emit('expert:set-availability', {
        online: nextOnline,
        certificationIds: certIdsRef.current,
      });
    },
    [socket, isConnected],
  );

  function handleToggle(nextOnline: boolean): void {
    setOnline(nextOnline);
    emitAvailability(nextOnline);
  }

  // Re-emit if socket reconnects while online
  useEffect(() => {
    if (isConnected && online) {
      emitAvailability(true);
    }
  }, [isConnected, online, emitAvailability]);

  function handleAccept(ticketId: string): void {
    if (!socket || !expertProfile) return;
    setAccepting(ticketId);
    socket.emit(
      'expert:accept-ticket',
      { ticketId, expertName: expertProfile.name },
      (result) => {
        if ('error' in result) {
          setAccepting(null);
          setQueue((prev) => prev.filter((t) => t.ticketId !== ticketId));
        }
      },
    );
  }

  if (profile.status === 'loading') {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#F8FAFC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: '12px', color: '#64748B', fontFamily: 'monospace' }}>Loading…</span>
      </div>
    );
  }

  const userId = getStoredUserId() ?? '';

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', color: '#0F172A', padding: '24px 16px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1D4ED8', margin: 0 }}>
              {expertProfile?.name ?? 'Expert'}
            </h1>
            <p
              style={{
                fontSize: '10px',
                color: '#64748B',
                fontFamily: 'monospace',
                margin: '4px 0 0',
                letterSpacing: '0.08em',
              }}
            >
              ID: {userId.slice(0, 8)}… · Expert Console
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AvailabilityToggle
              online={online}
              onChange={handleToggle}
              disabled={!isConnected || !expertProfile}
            />
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
        </div>

        {/* Live Queue */}
        <LiveQueuePanel
          tickets={queue}
          onAccept={handleAccept}
          accepting={accepting}
        />

        {/* Dashboard cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '12px',
          }}
        >
          <DashboardCard
            icon={<History size={32} />}
            title="Session History"
            description="Review past remote assistance sessions."
            comingSoon
          />
          <DashboardCard
            icon={<BookOpen size={32} />}
            title="My Classrooms"
            description="Manage scheduled training classes."
            comingSoon
          />
          <DashboardCard
            icon={<Factory size={32} />}
            title="Go to Live Console"
            description="Jump directly to the 3D expert console (demo mode)."
            onClick={() => {
              storeSessionId('demo');
              router.push('/expert');
            }}
          />
        </div>
      </div>
    </div>
  );
}
