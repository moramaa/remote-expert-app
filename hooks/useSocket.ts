'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@/types/socket';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface UseSocketResult {
  socket: AppSocket | null;
  isConnected: boolean;
  connectionCount: number;
}

function getSocketUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:3001';
  return `${window.location.protocol}//${window.location.hostname}:3001`;
}

export function useSocket(): UseSocketResult {
  const [socket] = useState<AppSocket>(() =>
    io(getSocketUrl(), {
      autoConnect: false,
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    })
  );
  const [isConnected, setIsConnected] = useState(false);
  const [connectionCount, setConnectionCount] = useState(0);

  useEffect(() => {
    const handleConnect = (): void => setIsConnected(true);
    const handleDisconnect = (): void => setIsConnected(false);
    const handleCount = (count: number): void => setConnectionCount(count);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connection-count', handleCount);
    socket.connect();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
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
