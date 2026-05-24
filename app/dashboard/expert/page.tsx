'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, History, Factory } from 'lucide-react';
import AvailabilityToggle from '@/components/dashboard/AvailabilityToggle';
import DashboardCard from '@/components/dashboard/DashboardCard';
import LiveQueuePanel from '@/components/dashboard/LiveQueuePanel';
import { useSocket } from '@/hooks/useSocket';
import { useProfile } from '@/hooks/useProfile';
import { getStoredUserId, storeSessionId } from '@/lib/identity';
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

  // Load profile from DB
  useEffect(() => {
    if (profile.status !== 'ready') return;
    fetch(`/api/me?id=${profile.userId}&role=expert`)
      .then((r) => r.json())
      .then((data: ExpertProfile) => {
        setExpertProfile(data);
        certIdsRef.current = (data.certifications ?? []).map((c) => c.machineId);
      })
      .catch(() => {/* noop */});
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
          // Ticket gone — remove from local queue
          setQueue((prev) => prev.filter((t) => t.ticketId !== ticketId));
        }
        // On success, session:join fires and we navigate
      },
    );
  }

  if (profile.status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0f1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '12px', color: '#475569', fontFamily: 'monospace' }}>Loading…</span>
      </div>
    );
  }

  const userId = getStoredUserId() ?? '';

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1e', color: '#f1f5f9', padding: '24px 16px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#f97316', margin: 0 }}>
              {expertProfile?.name ?? 'Expert'}
            </h1>
            <p style={{ fontSize: '10px', color: '#475569', fontFamily: 'monospace', margin: '4px 0 0', letterSpacing: '0.08em' }}>
              ID: {userId.slice(0, 8)}… · Expert Console
            </p>
          </div>

          <AvailabilityToggle
            online={online}
            onChange={handleToggle}
            disabled={!isConnected}
          />
        </div>

        {/* Live Queue */}
        <LiveQueuePanel
          tickets={queue}
          onAccept={handleAccept}
          accepting={accepting}
        />

        {/* Dashboard cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
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
