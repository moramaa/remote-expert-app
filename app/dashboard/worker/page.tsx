'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, BookOpen, History, Calendar } from 'lucide-react';
import DashboardCard from '@/components/dashboard/DashboardCard';
import MachinePickerModal from '@/components/dashboard/MachinePickerModal';
import SearchingOverlay from '@/components/dashboard/SearchingOverlay';
import { useSocket } from '@/hooks/useSocket';
import { useProfile } from '@/hooks/useProfile';
import { getStoredUserId, storeSessionId } from '@/lib/identity';
import { MACHINES, MACHINE_MAP } from '@/lib/machines';
import type { SosAck } from '@/types/socket';

interface WorkerProfile {
  name: string;
  factory: string;
  roleLevel: string;
}

export default function WorkerDashboardPage() {
  const router  = useRouter();
  const profile = useProfile('worker');
  const { socket, isConnected } = useSocket();

  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);
  const [showPicker,    setShowPicker]    = useState(false);
  const [ticketId,      setTicketId]      = useState<string | null>(null);
  const [machineId,     setMachineId]     = useState<string | null>(null);
  const [searching,     setSearching]     = useState(false);

  // Load profile
  useEffect(() => {
    if (profile.status !== 'ready') return;
    fetch(`/api/me?id=${profile.userId}&role=worker`)
      .then((r) => r.json())
      .then((data: WorkerProfile) => setWorkerProfile(data))
      .catch(() => {/* noop */});
  }, [profile]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    const onTicketStatus = (payload: { ticketId: string; state: string; sessionId?: string; expertName?: string }): void => {
      if (payload.state === 'matched' && payload.sessionId) {
        storeSessionId(payload.sessionId);
        router.push('/worker');
      }
      if (payload.state === 'cancelled') {
        setSearching(false);
        setTicketId(null);
        setMachineId(null);
      }
    };

    const onSessionJoin = ({ sessionId }: { sessionId: string; role: 'expert' | 'worker' }): void => {
      storeSessionId(sessionId);
      router.push('/worker');
    };

    socket.on('worker:ticket-status', onTicketStatus);
    socket.on('session:join',         onSessionJoin);

    return () => {
      socket.off('worker:ticket-status', onTicketStatus);
      socket.off('session:join',         onSessionJoin);
    };
  }, [socket, router]);

  function handleMachineSelect(selectedMachineId: string): void {
    setShowPicker(false);

    if (!socket || !workerProfile) return;

    setMachineId(selectedMachineId);
    setSearching(true);

    socket.emit(
      'worker:sos-create',
      {
        machineId:     selectedMachineId,
        workerName:    workerProfile.name,
        workerFactory: workerProfile.factory,
      },
      (result: SosAck) => {
        if ('error' in result) {
          setSearching(false);
          setMachineId(null);
          alert(`Error: ${result.error}`);
          return;
        }
        setTicketId(result.ticketId);
      },
    );
  }

  function handleCancelSOS(): void {
    if (!socket || !ticketId) return;
    socket.emit('worker:sos-cancel', { ticketId });
    setSearching(false);
    setTicketId(null);
    setMachineId(null);
  }

  if (profile.status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0f1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '12px', color: '#475569', fontFamily: 'monospace' }}>Loading…</span>
      </div>
    );
  }

  const userId = getStoredUserId() ?? '';
  const machineName = machineId ? (MACHINE_MAP.get(machineId)?.label ?? machineId) : '';

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1e', color: '#f1f5f9', padding: '24px 16px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Header */}
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#f97316', margin: 0 }}>
            {workerProfile?.name ?? 'Worker'}
          </h1>
          <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 0' }}>
            {workerProfile?.factory ?? ''}
          </p>
          <p style={{ fontSize: '10px', color: '#475569', fontFamily: 'monospace', margin: '2px 0 0', letterSpacing: '0.08em' }}>
            ID: {userId.slice(0, 8)}… · Worker View
          </p>
        </div>

        {/* Offline warning */}
        {!isConnected && (
          <div style={{ padding: '10px 14px', border: '1px solid #f97316', background: '#f9731610', fontSize: '11px', color: '#f97316', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={14} />
            Not connected to server — SOS unavailable
          </div>
        )}

        {/* 4 main cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {/* SOS — the only active card */}
          <div
            style={{ gridColumn: '1 / -1' }}
          >
            <DashboardCard
              icon={<AlertTriangle size={36} />}
              title="Open SOS Call"
              description="Connect instantly with a certified expert for live 3D guidance."
              onClick={() => setShowPicker(true)}
              active={searching}
            />
          </div>

          <DashboardCard
            icon={<BookOpen size={28} />}
            title="Knowledge Base"
            description="Search manuals and past solutions."
            comingSoon
          />

          <DashboardCard
            icon={<History size={28} />}
            title="Session History"
            description="Review past assistance sessions."
            comingSoon
          />

          <div style={{ gridColumn: '1 / -1' }}>
            <DashboardCard
              icon={<Calendar size={28} />}
              title="Scheduled Classes"
              description="Upcoming training sessions with experts."
              comingSoon
            />
          </div>
        </div>
      </div>

      {/* Machine picker modal */}
      {showPicker && (
        <MachinePickerModal
          machines={MACHINES}
          onSelect={handleMachineSelect}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Searching overlay */}
      {searching && ticketId && (
        <SearchingOverlay
          machineName={machineName}
          ticketId={ticketId}
          onCancel={handleCancelSOS}
        />
      )}
    </div>
  );
}
