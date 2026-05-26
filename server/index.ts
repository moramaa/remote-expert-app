// Load .env BEFORE any other import that reads process.env (ai.ts, prisma.ts).
// tsx does not auto-load .env files, so without this the ANTHROPIC_API_KEY
// and DATABASE_URL stay undefined and AI summaries silently fail.
//
// We load both .env and .env.local with override:true so that values defined
// in either file always win over a potentially-empty shell env var (Next.js
// projects often end up with stale empty entries in .env.local).
import dotenv from 'dotenv';
dotenv.config({ path: '.env',       override: true });
dotenv.config({ path: '.env.local', override: false }); // .env wins for shared keys

import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { MACHINE_MAP } from '../lib/machines';
import { prisma } from '../lib/prisma';
import { generateSessionSummary } from '../lib/ai';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketAuthPayload,
  SyncState,
  Marker,
  Instruction,
  PttChunk,
  PositionPing,
  LaserPointer,
  CameraState,
  HighlightZone,
  TicketSummary,
} from '../types/socket';

const PORT = 3001;

// ── Socket.io server ─────────────────────────────────────────────────────────

const io = new Server<ClientToServerEvents, ServerToClientEvents>(PORT, {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://192.168.1.178:3000',
    ],
    methods: ['GET', 'POST'],
  },
});

// ── Phase 2: availability + matching ─────────────────────────────────────────

interface OnlineExpert {
  socketId: string;
  userId: string;
  expertName: string;
  certificationIds: Set<string>;
}

interface PendingTicket {
  ticketId: string;
  workerId: string;
  workerSocketId: string;
  workerName: string;
  workerFactory: string;
  machineId: string;
  machineLabel: string;
  createdAt: number;
  // Location at time of SOS (optional)
  locationDept?:    string;
  locationLine?:    string;
  locationStation?: string;
}

const onlineExperts = new Map<string, OnlineExpert>(); // expertUserId → OnlineExpert
const pendingTickets = new Map<string, PendingTicket>(); // ticketId → ticket

function getQueueSnapshot(): TicketSummary[] {
  return Array.from(pendingTickets.values()).map((t) => ({
    ticketId:     t.ticketId,
    workerId:     t.workerId,
    workerName:   t.workerName,
    workerFactory: t.workerFactory,
    machineId:    t.machineId,
    machineLabel: t.machineLabel,
    createdAt:    t.createdAt,
  }));
}

function notifyMatchingExperts(ticket: PendingTicket): void {
  for (const expert of onlineExperts.values()) {
    if (expert.certificationIds.has(ticket.machineId)) {
      io.to(expert.socketId).emit('expert:incoming-ticket', {
        ticketId:     ticket.ticketId,
        workerId:     ticket.workerId,
        workerName:   ticket.workerName,
        workerFactory: ticket.workerFactory,
        machineId:    ticket.machineId,
        machineLabel: ticket.machineLabel,
        createdAt:    ticket.createdAt,
      });
    }
  }
}

// ── Phase 1: per-session live state ──────────────────────────────────────────

interface SessionState {
  markers:           Map<string, Marker>;
  zones:             Map<string, HighlightZone>;
  latestInstruction: Instruction | null;
  latestCamera:      CameraState | null;
  // ── Epic 5: session capture ───────────────────────────────────────────────
  safetyTriggered:   boolean;
  instructionLog:    Instruction[];
  transcriptLog:     PttChunk[];
  driver:            'expert' | 'worker' | null;  // who is driving the camera
  // ── Stage 1: worker breadcrumb trail ─────────────────────────────────────
  positionLog:       PositionPing[];
  // ── Socket ID tracking — used for direct delivery of mirror/driver events ─
  // Room-based broadcast alone can miss a peer when socket:bind-session hasn't
  // completed yet (race between navigation and useEffect firing). Storing the
  // two live socket IDs lets us deliver critical events both ways.
  expertSocketId:    string | null;
  workerSocketId:    string | null;
}

const sessions = new Map<string, SessionState>();

function getOrCreateSession(sessionId: string): SessionState {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      markers:           new Map(),
      zones:             new Map(),
      latestInstruction: null,
      latestCamera:      null,
      safetyTriggered:   false,
      instructionLog:    [],
      transcriptLog:     [],
      driver:            null,
      positionLog:       [],
      expertSocketId:    null,
      workerSocketId:    null,
    });
  }
  return sessions.get(sessionId)!;
}

/**
 * Emit an event to every socket that belongs to `sessionId`.
 * Combines room broadcast (for any sockets that are in the room) with direct
 * delivery to the two stored socket IDs (handles timing gaps where a socket
 * hasn't been room-bound yet).  Deduplication is inherent: Socket.IO won't
 * deliver twice to the same socket even if it's both in the room and targeted
 * directly.
 */
function emitToSession(
  sessionId: string,
  event: keyof ServerToClientEvents,
  payload?: unknown,
): void {
  // Cast through unknown so TypeScript accepts the generic emit call
  const emitOne = (target: ReturnType<typeof io.to>) => {
    if (payload !== undefined) {
      (target.emit as (ev: string, data: unknown) => void)(event, payload);
    } else {
      (target.emit as (ev: string) => void)(event);
    }
  };

  emitOne(io.to(sessionId));

  const st = sessions.get(sessionId);
  if (!st) return;
  // Direct delivery to the stored socket IDs as a reliable fallback
  for (const sid of [st.expertSocketId, st.workerSocketId]) {
    if (sid) emitOne(io.to(sid));
  }
}

// ── Stage 1: DB-first session capture ────────────────────────────────────────
//
// The Session DB row is the source of truth for captured content. The
// in-memory SessionState is now a cache for live broadcasts and late-joiner
// state replay only. Each event handler calls persistCapture(), which applies
// the in-memory mutation immediately (so broadcasts stay accurate) and chains
// a DB write after any previous write to the same session (coalesces rapid
// mutations into a serial sequence — no race on the JSON read-modify-write).

const pendingWrites = new Map<string, Promise<void>>();

function persistCapture(sessionId: string | null, mutate: (s: SessionState) => void): void {
  if (!sessionId || sessionId === 'demo') {
    // No DB row exists for the demo bucket — only mutate in memory
    const s = getOrCreateSession(sessionId ?? 'demo');
    mutate(s);
    return;
  }

  const s = getOrCreateSession(sessionId);
  mutate(s);

  const prev = pendingWrites.get(sessionId) ?? Promise.resolve();
  const next = prev.then(() => writeCaptureToDb(sessionId, s));
  pendingWrites.set(sessionId, next);
  void next.finally(() => {
    if (pendingWrites.get(sessionId) === next) pendingWrites.delete(sessionId);
  });
}

async function writeCaptureToDb(sessionId: string, s: SessionState): Promise<void> {
  try {
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        markerLog:       JSON.stringify(Array.from(s.markers.values())),
        instructionLog:  JSON.stringify(s.instructionLog),
        transcriptLog:   JSON.stringify(s.transcriptLog),
        positionLog:     JSON.stringify(s.positionLog),
        safetyTriggered: s.safetyTriggered,
      },
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    // P2025 = "record not found" — happens for transient/demo sessions, ignore
    if (code !== 'P2025') {
      console.warn(`[capture] persist failed session=${sessionId}:`, err);
    }
  }
}

function sessionSnapshot(s: SessionState): SyncState {
  return {
    markers: Array.from(s.markers.values()),
    zones: Array.from(s.zones.values()),
    latestInstruction: s.latestInstruction,
    camera: s.latestCamera,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function broadcastCount(): void {
  io.emit('connection-count', io.engine.clientsCount);
}

// ── Connection handler ────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  const auth = socket.handshake.auth as Partial<SocketAuthPayload>;
  const userId  = auth.userId ?? 'anonymous';
  const role    = auth.role   ?? 'worker';
  // activeSessionId is MUTABLE — gets reassigned by 'socket:bind-session'
  // when the client navigates into a live session. This prevents events from
  // accumulating in the 'demo' bucket after a session is created.
  let activeSessionId: string = auth.sessionId ?? 'demo';

  console.log(`[socket] + ${socket.id} | role=${role} userId=${userId} session=${activeSessionId}`);

  // Join the initial session room (may be 'demo' until rebound)
  void socket.join(activeSessionId);

  broadcastCount();

  // Replay current session state to late-joiners
  {
    const replay = getOrCreateSession(activeSessionId);
    const snap = sessionSnapshot(replay);
    const hasState =
      snap.markers.length > 0 ||
      snap.zones.length > 0 ||
      snap.latestInstruction !== null ||
      snap.camera !== null;
    if (hasState) socket.emit('worker:sync-state', snap);
  }

  // ── Stage 1: explicit session rebind ──────────────────────────────────────
  // Client emits this after navigating into a live session room. Re-bind the
  // socket to the new room and update activeSessionId so subsequent events
  // write to the correct DB row instead of the 'demo' bucket.
  socket.on('socket:bind-session', ({ sessionId: newId }) => {
    if (!newId) return;
    // Always record this socket's ID against its role in the session state —
    // even if the room hasn't changed — so direct delivery paths stay current.
    const st = getOrCreateSession(newId);
    if (role === 'expert') st.expertSocketId = socket.id;
    if (role === 'worker') st.workerSocketId = socket.id;

    if (newId === activeSessionId) return; // already in the right room
    void socket.leave(activeSessionId);
    void socket.join(newId);
    console.log(`[socket] ↻ rebind ${socket.id} | ${activeSessionId} → ${newId} role=${role}`);
    activeSessionId = newId;
    // Replay state if any has accumulated for the new room
    const replay = getOrCreateSession(activeSessionId);
    const snap = sessionSnapshot(replay);
    if (
      snap.markers.length > 0 || snap.zones.length > 0 ||
      snap.latestInstruction !== null || snap.camera !== null
    ) {
      socket.emit('worker:sync-state', snap);
    }
  });

  // ── Phase 2: expert comes online ──────────────────────────────────────────

  socket.on('expert:set-availability', ({ online, certificationIds }) => {
    if (online) {
      onlineExperts.set(userId, {
        socketId: socket.id,
        userId,
        expertName: 'Expert', // resolved when they accept
        certificationIds: new Set(certificationIds),
      });
      // Send current pending queue to this expert
      const myTickets = getQueueSnapshot().filter((t) =>
        certificationIds.includes(t.machineId)
      );
      if (myTickets.length > 0) {
        socket.emit('expert:queue-update', myTickets);
      }
    } else {
      onlineExperts.delete(userId);
    }
    console.log(`[match] expert ${userId} availability=${online}`);
  });

  // ── Phase 2: worker opens SOS ─────────────────────────────────────────────

  socket.on('worker:sos-create', ({ machineId, workerName, workerFactory, locationDept, locationLine, locationStation }, ack) => {
    const machine = MACHINE_MAP.get(machineId);
    if (!machine) {
      ack({ error: `Unknown machine: ${machineId}` });
      return;
    }

    const ticketId = uuidv4();
    const ticket: PendingTicket = {
      ticketId,
      workerId: userId,
      workerSocketId: socket.id,
      workerName,
      workerFactory,
      machineId,
      machineLabel: machine.label,
      createdAt: Date.now(),
      locationDept,
      locationLine,
      locationStation,
    };

    pendingTickets.set(ticketId, ticket);
    console.log(`[match] SOS ticket=${ticketId} machine=${machineId} worker=${userId}`);

    ack({ ticketId });

    // Tell worker we're searching
    socket.emit('worker:ticket-status', { ticketId, state: 'searching' });

    // Notify all matching online experts
    notifyMatchingExperts(ticket);

    // Send updated queue to all online matching experts
    const summaries = getQueueSnapshot();
    for (const expert of onlineExperts.values()) {
      if (expert.certificationIds.has(machineId)) {
        io.to(expert.socketId).emit('expert:queue-update', summaries);
      }
    }
  });

  // ── Phase 2: worker cancels SOS ───────────────────────────────────────────

  socket.on('worker:sos-cancel', ({ ticketId }) => {
    if (pendingTickets.has(ticketId)) {
      pendingTickets.delete(ticketId);
      console.log(`[match] cancelled ticket=${ticketId}`);
      // Refresh queue for all experts
      const summaries = getQueueSnapshot();
      for (const expert of onlineExperts.values()) {
        io.to(expert.socketId).emit('expert:queue-update', summaries);
      }
    }
    socket.emit('worker:ticket-status', { ticketId, state: 'cancelled' });
  });

  // ── Phase 2: expert accepts ticket ────────────────────────────────────────

  socket.on('expert:accept-ticket', ({ ticketId, expertName }, ack) => {
    const ticket = pendingTickets.get(ticketId);
    if (!ticket) {
      ack({ error: 'Ticket already taken or expired' });
      return;
    }

    // Atomic claim
    pendingTickets.delete(ticketId);

    const newSessionId = uuidv4();
    console.log(`[match] accepted ticket=${ticketId} expert=${userId} session=${newSessionId}`);

    // Update expert name now that we know it
    const expertEntry = onlineExperts.get(userId);
    if (expertEntry) {
      expertEntry.expertName = expertName;
    }

    // Persist session record to DB (include location captured at ticket creation)
    console.log(`[db] creating session ${newSessionId} location=${JSON.stringify({ dept: ticket.locationDept, line: ticket.locationLine, station: ticket.locationStation })}`);
    void prisma.session.create({
      data: {
        id:               newSessionId,
        ticketId:         ticketId,
        expertId:         userId,
        workerId:         ticket.workerId,
        machineId:        ticket.machineId,
        locationDept:     ticket.locationDept     ?? null,
        locationLine:     ticket.locationLine     ?? null,
        locationStation:  ticket.locationStation  ?? null,
      },
    }).catch((err: unknown) => console.warn('[db] session.create failed:', err));

    // Pre-populate socket IDs so direct delivery works even before bind-session
    const newSt = getOrCreateSession(newSessionId);
    newSt.expertSocketId = socket.id;
    newSt.workerSocketId = ticket.workerSocketId;

    // Move the expert's socket into the new session room immediately
    void socket.leave(activeSessionId);
    void socket.join(newSessionId);
    activeSessionId = newSessionId;

    // Also move the worker's socket into the new session room immediately
    const workerSock = io.sockets.sockets.get(ticket.workerSocketId);
    if (workerSock) void workerSock.join(newSessionId);

    // Tell expert to navigate to the live session
    io.to(socket.id).emit('session:join', { sessionId: newSessionId, role: 'expert' });

    // Tell worker to navigate to the live session
    io.to(ticket.workerSocketId).emit('worker:ticket-status', {
      ticketId,
      state: 'matched',
      sessionId: newSessionId,
      expertName,
    });
    io.to(ticket.workerSocketId).emit('session:join', { sessionId: newSessionId, role: 'worker' });

    // Refresh queue for remaining experts
    const summaries = getQueueSnapshot();
    for (const expert of onlineExperts.values()) {
      io.to(expert.socketId).emit('expert:queue-update', summaries);
    }

    ack({ sessionId: newSessionId });
  });

  // ── Phase 1: expert → session state + broadcast + DB persist ──────────────

  socket.on('expert:place-marker', (marker: Marker) => {
    persistCapture(activeSessionId, (st) => { st.markers.set(marker.id, marker); });
    socket.to(activeSessionId).emit('worker:new-marker', marker);
  });

  socket.on('expert:remove-marker', (markerId: string) => {
    persistCapture(activeSessionId, (st) => { st.markers.delete(markerId); });
    socket.to(activeSessionId).emit('worker:remove-marker', markerId);
  });

  socket.on('expert:clear-markers', () => {
    persistCapture(activeSessionId, (st) => { st.markers.clear(); });
    socket.to(activeSessionId).emit('worker:clear-markers');
  });

  socket.on('expert:send-instruction', (instruction: Instruction) => {
    persistCapture(activeSessionId, (st) => {
      st.latestInstruction = instruction;
      st.instructionLog.push(instruction);
    });
    socket.to(activeSessionId).emit('worker:instruction', instruction);
  });

  socket.on('expert:laser-pointer', (position: LaserPointer | null) => {
    // Live-only event — not persisted
    socket.to(activeSessionId).emit('worker:laser-pointer', position);
  });

  socket.on('expert:camera-sync', (camera: CameraState) => {
    const st = getOrCreateSession(activeSessionId);
    if (st.driver === null || st.driver === 'expert') {
      st.latestCamera = camera;
      socket.to(activeSessionId).emit('worker:camera-sync', camera);
    }
  });

  socket.on('expert:highlight-zone', (zone: HighlightZone) => {
    const st = getOrCreateSession(activeSessionId);
    st.zones.set(zone.id, zone);
    socket.to(activeSessionId).emit('worker:highlight-zone', zone);
  });

  socket.on('expert:clear-zones', () => {
    const st = getOrCreateSession(activeSessionId);
    st.zones.clear();
    socket.to(activeSessionId).emit('worker:clear-zones');
  });

  // ── Session lifecycle ─────────────────────────────────────────────────────

  socket.on('session:end', ({ resolved }) => {
    const isExpert = role === 'expert';
    const now = new Date();
    const endingSessionId = activeSessionId;

    // Capture state has already been persisted incrementally — at session:end
    // we only need to set endedAt, durationSeconds, and resolution flags.
    void prisma.session.findUnique({ where: { id: endingSessionId } })
      .then((existing: Awaited<ReturnType<typeof prisma.session.findUnique>>) => {
        if (!existing) return;
        const durationSeconds = existing.startedAt
          ? Math.round((now.getTime() - existing.startedAt.getTime()) / 1000)
          : undefined;
        const isFirstEnd = !existing.endedAt;
        return prisma.session.update({
          where: { id: endingSessionId },
          data: {
            ...(isExpert ? { resolvedExpert: resolved } : { resolvedWorker: resolved }),
            ...(isFirstEnd ? { endedAt: now, durationSeconds } : {}),
          },
        }).then(() => {
          if (isFirstEnd) triggerAiSummary(endingSessionId);
        });
      })
      .catch((err: unknown) => console.warn('[db] session.end update failed:', err));

    socket.to(activeSessionId).emit('session:ended', { endedBy: isExpert ? 'expert' : 'worker' });
    console.log(`[session] ${role} ended session=${activeSessionId} resolved=${resolved}`);
  });

  // ── Worker acknowledgement events ─────────────────────────────────────────

  socket.on('worker:step-done', (payload) => {
    socket.to(activeSessionId).emit('expert:step-done', payload);
  });

  socket.on('worker:needs-clarification', (payload) => {
    socket.to(activeSessionId).emit('expert:needs-clarification', payload);
  });

  // ── Emergency freeze ──────────────────────────────────────────────────────

  socket.on('expert:emergency-freeze', () => {
    persistCapture(activeSessionId, (st) => { st.safetyTriggered = true; });
    console.log(`[emergency] expert triggered freeze on session=${activeSessionId}`);
    socket.to(activeSessionId).emit('worker:emergency-freeze');
  });

  socket.on('worker:emergency-acknowledged', () => {
    console.log(`[emergency] worker acknowledged on session=${activeSessionId}`);
    socket.to(activeSessionId).emit('expert:emergency-acknowledged');
  });

  // ── PTT (Push-to-Talk) — persisted to transcriptLog ──────────────────────

  socket.on('expert:ptt-chunk', (chunk: PttChunk) => {
    persistCapture(activeSessionId, (st) => { st.transcriptLog.push(chunk); });
    socket.to(activeSessionId).emit('worker:expert-ptt', chunk);
  });

  socket.on('worker:ptt-chunk', (chunk: PttChunk) => {
    persistCapture(activeSessionId, (st) => { st.transcriptLog.push(chunk); });
    socket.to(activeSessionId).emit('expert:worker-ptt', chunk);
  });

  // ── Stage 1: worker breadcrumb trail — persisted to positionLog ──────────

  socket.on('worker:position-ping', (ping: PositionPing) => {
    if (role !== 'worker') return;
    persistCapture(activeSessionId, (st) => {
      st.positionLog.push(ping);
      // Cap at 200 entries — older sessions don't need infinite precision
      if (st.positionLog.length > 200) st.positionLog.shift();
    });
  });

  // ── Bi-directional Mirror View ────────────────────────────────────────────

  socket.on('expert:mirror-on', () => {
    const st = getOrCreateSession(activeSessionId);
    st.driver = 'expert';
    emitToSession(activeSessionId, 'session:driver-changed', { driver: 'expert' });
    emitToSession(activeSessionId, 'worker:mirror-forced-off');
    console.log(`[mirror] expert is driving session=${activeSessionId}`);
  });

  socket.on('expert:mirror-off', () => {
    const st = getOrCreateSession(activeSessionId);
    if (st.driver === 'expert') {
      st.driver = null;
      emitToSession(activeSessionId, 'session:driver-changed', { driver: null });
    }
  });

  socket.on('worker:mirror-on', () => {
    const st = getOrCreateSession(activeSessionId);
    st.driver = 'worker';
    emitToSession(activeSessionId, 'session:driver-changed', { driver: 'worker' });
    emitToSession(activeSessionId, 'expert:mirror-forced-off');
    console.log(`[mirror] worker is driving session=${activeSessionId}`);
  });

  socket.on('worker:mirror-off', () => {
    const st = getOrCreateSession(activeSessionId);
    if (st.driver === 'worker') {
      st.driver = null;
      emitToSession(activeSessionId, 'session:driver-changed', { driver: null });
    }
  });

  socket.on('worker:camera-sync', (camera: CameraState) => {
    const st = getOrCreateSession(activeSessionId);
    if (st.driver === 'worker') {
      st.latestCamera = camera;
      // Camera updates are high-frequency — emit only to the expert socket directly
      const expertSid = st.expertSocketId;
      if (expertSid) io.to(expertSid).emit('expert:worker-camera', camera);
      else socket.to(activeSessionId).emit('expert:worker-camera', camera);
    }
  });

  // ── Control-transfer handshake ────────────────────────────────────────────

  socket.on('worker:request-control', () => {
    if (role !== 'worker') return;
    // Use emitToSession so the notification reaches the expert via both the
    // room broadcast AND direct socket delivery (handles room-membership gaps).
    emitToSession(activeSessionId, 'expert:control-requested');
    console.log(`[mirror] worker requested control session=${activeSessionId}`);
  });

  socket.on('expert:grant-control', () => {
    if (role !== 'expert') return;
    const st = getOrCreateSession(activeSessionId);
    st.driver = 'worker';
    emitToSession(activeSessionId, 'session:driver-changed', { driver: 'worker' });
    emitToSession(activeSessionId, 'worker:control-granted');
    console.log(`[mirror] expert granted control to worker session=${activeSessionId}`);
  });

  socket.on('expert:deny-control', () => {
    if (role !== 'expert') return;
    emitToSession(activeSessionId, 'worker:control-denied');
    console.log(`[mirror] expert denied worker control request session=${activeSessionId}`);
  });

  // ── Disconnect ────────────────────────────────────────────────────────────

  socket.on('disconnect', () => {
    console.log(`[socket] - ${socket.id} | role=${role} userId=${userId}`);

    // Remove expert from availability map if they disconnect
    const expert = onlineExperts.get(userId);
    if (expert && expert.socketId === socket.id) {
      onlineExperts.delete(userId);
    }

    // If the disconnected party was driving, reset driver state
    const st = getOrCreateSession(activeSessionId);
    if ((role === 'expert' && st.driver === 'expert') ||
        (role === 'worker' && st.driver === 'worker')) {
      st.driver = null;
      emitToSession(activeSessionId, 'session:driver-changed', { driver: null });
    }
    // Clear the stored socket ID so stale IDs don't linger
    if (role === 'expert' && st.expertSocketId === socket.id) st.expertSocketId = null;
    if (role === 'worker' && st.workerSocketId === socket.id) st.workerSocketId = null;

    broadcastCount();
  });
});

// ── AI Summarization (post-session background job) ────────────────────────────

async function triggerAiSummary(sessionId: string): Promise<void> {
  console.log(`[ai] ▶ triggerAiSummary start session=${sessionId} keyPresent=${!!process.env['ANTHROPIC_API_KEY']}`);
  try {
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      console.warn(`[ai] ✗ session=${sessionId} not found in DB`);
      return;
    }

    const machine = MACHINE_MAP.get(session.machineId);
    const machineLabel = machine?.label ?? session.machineId;

    const instructionLog: Instruction[] = session.instructionLog
      ? (JSON.parse(session.instructionLog) as Instruction[])
      : [];
    const transcriptLog: PttChunk[] = session.transcriptLog
      ? (JSON.parse(session.transcriptLog) as PttChunk[])
      : [];

    console.log(`[ai]   session=${sessionId} machine="${machineLabel}" instructions=${instructionLog.length} transcript=${transcriptLog.length}`);

    const t0 = Date.now();
    const summary = await generateSessionSummary({
      machineLabel,
      instructionLog,
      transcriptLog,
      resolvedExpert:  session.resolvedExpert ?? null,
      resolvedWorker:  session.resolvedWorker ?? null,
      safetyTriggered: session.safetyTriggered,
    });
    const elapsed = Date.now() - t0;

    await prisma.session.update({
      where: { id: sessionId },
      data:  { summary },
    });

    console.log(`[ai] ✓ summary generated session=${sessionId} chars=${summary.length} elapsed=${elapsed}ms`);
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error(`[ai] ✗ FAILED session=${sessionId} reason="${msg}"`);
    if (err instanceof Error && err.stack) console.error(err.stack);
    // Mark as failed so the UI can offer a "Regenerate" option
    await prisma.session.update({
      where: { id: sessionId },
      data:  { summary: '__AI_FAILED__' },
    }).catch((e: unknown) => console.error('[ai] also failed to mark __AI_FAILED__:', e));
  }
}

console.log(`[socket] server listening on :${PORT}`);
