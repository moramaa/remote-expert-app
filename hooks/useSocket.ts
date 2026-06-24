'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketAuthPayload,
} from '@/types/socket';
import {
  getStoredUserId,
  getStoredRole,
  getStoredSessionId,
} from '@/lib/identity';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface UseSocketResult {
  socket: AppSocket | null;
  isConnected: boolean;
  connectionCount: number;
}

function getSocketUrl(): string {
  // NEXT_PUBLIC_SOCKET_URL can override for any custom topology.
  if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;
  if (typeof window === 'undefined') return 'http://localhost:3001';
  // In production the custom server (server.ts) serves Socket.IO on the same
  // origin — no separate port.  In local dev it's on :3001.
  if (process.env.NODE_ENV === 'production') return window.location.origin;
  return `${window.location.protocol}//${window.location.hostname}:3001`;
}

function buildAuth(): SocketAuthPayload {
  const userId    = getStoredUserId()  ?? 'anonymous';
  const role      = getStoredRole()    ?? 'worker';
  const sessionId = getStoredSessionId() ?? undefined;
  return { userId, role, ...(sessionId ? { sessionId } : {}) };
}

export function useSocket(): UseSocketResult {
  const [socket] = useState<AppSocket>(() =>
    io(getSocketUrl(), {
      autoConnect: false,
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
      auth: buildAuth(),
    })
  );
  const [isConnected, setIsConnected] = useState(false);
  const [connectionCount, setConnectionCount] = useState(0);

  useEffect(() => {
    // Refresh auth on each mount in case localStorage changed since socket was created
    socket.auth = buildAuth();

    const handleConnect    = (): void => setIsConnected(true);
    const handleDisconnect = (): void => setIsConnected(false);
    const handleCount      = (count: number): void => setConnectionCount(count);

    socket.on('connect',          handleConnect);
    socket.on('disconnect',       handleDisconnect);
    socket.on('connection-count', handleCount);
    socket.connect();

    return () => {
      socket.off('connect',          handleConnect);
      socket.off('disconnect',       handleDisconnect);
      socket.off('connection-count', handleCount);
      socket.disconnect();
    };
  }, [socket]);

  return {
    socket,
    isConnected,
    connectionCount,
  };
}
