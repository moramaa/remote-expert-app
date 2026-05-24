import { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SyncState,
  Marker,
  Instruction,
  LaserPointer,
  CameraState,
  HighlightZone,
} from '../types/socket';

const PORT = 3001;

const io = new Server<ClientToServerEvents, ServerToClientEvents>(PORT, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// ── Session state ────────────────────────────────────────────────────────────
// Kept in memory for the lifetime of the server process.
// Replayed in full to any client that connects after state was established.
const markers = new Map<string, Marker>();
const zones = new Map<string, HighlightZone>();
let latestInstruction: Instruction | null = null;
let latestCamera: CameraState | null = null;
// Laser is intentionally excluded — it is a momentary gesture, not persistent state.

function snapshot(): SyncState {
  return {
    markers: Array.from(markers.values()),
    zones: Array.from(zones.values()),
    latestInstruction,
    camera: latestCamera,
  };
}

function broadcastCount(): void {
  io.emit('connection-count', io.engine.clientsCount);
}

// ── Connection handler ───────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[socket] client connected: ${socket.id}`);
  broadcastCount();

  // Replay current state immediately so late joiners see what's already on screen
  const state = snapshot();
  const hasState =
    state.markers.length > 0 ||
    state.zones.length > 0 ||
    state.latestInstruction !== null ||
    state.camera !== null;

  if (hasState) {
    socket.emit('worker:sync-state', state);
  }

  // ── Expert → server state + broadcast ──────────────────────────────────────

  socket.on('expert:place-marker', (marker: Marker) => {
    markers.set(marker.id, marker);
    socket.broadcast.emit('worker:new-marker', marker);
  });

  socket.on('expert:remove-marker', (markerId: string) => {
    markers.delete(markerId);
    socket.broadcast.emit('worker:remove-marker', markerId);
  });

  socket.on('expert:clear-markers', () => {
    markers.clear();
    socket.broadcast.emit('worker:clear-markers');
  });

  socket.on('expert:send-instruction', (instruction: Instruction) => {
    latestInstruction = instruction;
    socket.broadcast.emit('worker:instruction', instruction);
  });

  socket.on('expert:laser-pointer', (position: LaserPointer | null) => {
    // Not persisted — laser is ephemeral mouse position
    socket.broadcast.emit('worker:laser-pointer', position);
  });

  socket.on('expert:camera-sync', (camera: CameraState) => {
    latestCamera = camera;
    socket.broadcast.emit('worker:camera-sync', camera);
  });

  socket.on('expert:highlight-zone', (zone: HighlightZone) => {
    zones.set(zone.id, zone);
    socket.broadcast.emit('worker:highlight-zone', zone);
  });

  socket.on('expert:clear-zones', () => {
    zones.clear();
    socket.broadcast.emit('worker:clear-zones');
  });

  socket.on('disconnect', () => {
    console.log(`[socket] client disconnected: ${socket.id}`);
    broadcastCount();
  });
});

console.log(`[socket] server listening on :${PORT}`);
