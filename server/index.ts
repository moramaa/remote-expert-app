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
    });
  }
  return sessions.get(sessionId)!;
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
  const userId    = auth.userId    ?? 'anonymous';
  const role      = auth.role      ?? 'worker';
  const sessionId = auth.sessionId ?? 'demo';

  console.log(`[socket] + ${socket.id} | role=${role} userId=${userId} session=${sessionId}`);

  // Join the session room
  void socket.join(sessionId);

  broadcastCount();

  // Replay current session state to late-joiners
  const s = getOrCreateSession(sessionId);
  const snap = sessionSnapshot(s);
  const hasState =
    snap.markers.length > 0 ||
    snap.zones.length > 0 ||
    snap.latestInstruction !== null ||
    snap.camera !== null;

  if (hasState) {
    socket.emit('worker:sync-state', snap);
  }

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

  // ── Phase 1: expert → session state + broadcast ───────────────────────────

  socket.on('expert:place-marker', (marker: Marker) => {
    s.markers.set(marker.id, marker);
    socket.to(sessionId).emit('worker:new-marker', marker);
  });

  socket.on('expert:remove-marker', (markerId: string) => {
    s.markers.delete(markerId);
    socket.to(sessionId).emit('worker:remove-marker', markerId);
  });

  socket.on('expert:clear-markers', () => {
    s.markers.clear();
    socket.to(sessionId).emit('worker:clear-markers');
  });

  socket.on('expert:send-instruction', (instruction: Instruction) => {
    s.latestInstruction = instruction;
    s.instructionLog.push(instruction);  // accumulate for AI summarization
    socket.to(sessionId).emit('worker:instruction', instruction);
  });

  socket.on('expert:laser-pointer', (position: LaserPointer | null) => {
    socket.to(sessionId).emit('worker:laser-pointer', position);
  });

  socket.on('expert:camera-sync', (camera: CameraState) => {
    // Only relay if expert is currently the driver (or driver is unset / default)
    if (s.driver === null || s.driver === 'expert') {
      s.latestCamera = camera;
      socket.to(sessionId).emit('worker:camera-sync', camera);
    }
  });

  socket.on('expert:highlight-zone', (zone: HighlightZone) => {
    s.zones.set(zone.id, zone);
    socket.to(sessionId).emit('worker:highlight-zone', zone);
  });

  socket.on('expert:clear-zones', () => {
    s.zones.clear();
    socket.to(sessionId).emit('worker:clear-zones');
  });

  // ── Session lifecycle ─────────────────────────────────────────────────────

  socket.on('session:end', ({ resolved }) => {
    const isExpert = role === 'expert';
    const now = new Date();

    // Snapshot session capture data before the async chain
    const markerLog       = JSON.stringify(Array.from(s.markers.values()));
    const instructionLog  = JSON.stringify(s.instructionLog);
    const transcriptLog   = JSON.stringify(s.transcriptLog);
    const safetyTriggered = s.safetyTriggered;

    // Update the DB record (fire-and-forget; don't block the event loop)
    void prisma.session.findUnique({ where: { id: sessionId } })
      .then((existing: Awaited<ReturnType<typeof prisma.session.findUnique>>) => {
        if (!existing) return;
        const durationSeconds = existing.startedAt
          ? Math.round((now.getTime() - existing.startedAt.getTime()) / 1000)
          : undefined;
        const isFirstEnd = !existing.endedAt;
        return prisma.session.update({
          where: { id: sessionId },
          data: {
            ...(isExpert ? { resolvedExpert: resolved } : { resolvedWorker: resolved }),
            // Only write session capture data + endedAt on the FIRST end received
            ...(isFirstEnd ? {
              endedAt:        now,
              durationSeconds,
              markerLog,
              instructionLog,
              transcriptLog,
              safetyTriggered,
            } : {}),
          },
        }).then(() => {
          // Trigger AI summarization after the first end persists
          if (isFirstEnd) {
            triggerAiSummary(sessionId);
          }
        });
      })
      .catch((err: unknown) => console.warn('[db] session.end update failed:', err));

    // Notify the other party so they can show their own feedback modal
    socket.to(sessionId).emit('session:ended', { endedBy: isExpert ? 'expert' : 'worker' });

    console.log(`[session] ${role} ended session=${sessionId} resolved=${resolved}`);
  });

  // ── Worker acknowledgement events ─────────────────────────────────────────

  socket.on('worker:step-done', (payload) => {
    socket.to(sessionId).emit('expert:step-done', payload);
  });

  socket.on('worker:needs-clarification', (payload) => {
    socket.to(sessionId).emit('expert:needs-clarification', payload);
  });

  // ── Emergency freeze ──────────────────────────────────────────────────────

  socket.on('expert:emergency-freeze', () => {
    s.safetyTriggered = true;  // flag for AI summarizer
    console.log(`[emergency] expert triggered freeze on session=${sessionId}`);
    socket.to(sessionId).emit('worker:emergency-freeze');
  });

  socket.on('worker:emergency-acknowledged', () => {
    console.log(`[emergency] worker acknowledged on session=${sessionId}`);
    socket.to(sessionId).emit('expert:emergency-acknowledged');
  });

  // ── PTT (Push-to-Talk) ────────────────────────────────────────────────────

  socket.on('expert:ptt-chunk', (chunk: PttChunk) => {
    s.transcriptLog.push(chunk);
    socket.to(sessionId).emit('worker:expert-ptt', chunk);  // live subtitle for worker
  });

  socket.on('worker:ptt-chunk', (chunk: PttChunk) => {
    s.transcriptLog.push(chunk);
    socket.to(sessionId).emit('expert:worker-ptt', chunk);  // live subtitle for expert
  });

  // ── Bi-directional Mirror View ────────────────────────────────────────────

  socket.on('expert:mirror-on', () => {
    s.driver = 'expert';
    io.to(sessionId).emit('session:driver-changed', { driver: 'expert' });
    socket.to(sessionId).emit('worker:mirror-forced-off');
    console.log(`[mirror] expert is driving session=${sessionId}`);
  });

  socket.on('expert:mirror-off', () => {
    if (s.driver === 'expert') {
      s.driver = null;
      io.to(sessionId).emit('session:driver-changed', { driver: null });
    }
  });

  socket.on('worker:mirror-on', () => {
    s.driver = 'worker';
    io.to(sessionId).emit('session:driver-changed', { driver: 'worker' });
    socket.to(sessionId).emit('expert:mirror-forced-off');
    console.log(`[mirror] worker is driving session=${sessionId}`);
  });

  socket.on('worker:mirror-off', () => {
    if (s.driver === 'worker') {
      s.driver = null;
      io.to(sessionId).emit('session:driver-changed', { driver: null });
    }
  });

  socket.on('worker:camera-sync', (camera: CameraState) => {
    if (s.driver === 'worker') {
      s.latestCamera = camera;
      socket.to(sessionId).emit('expert:worker-camera', camera);
    }
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
    if ((role === 'expert' && s.driver === 'expert') ||
        (role === 'worker' && s.driver === 'worker')) {
      s.driver = null;
      io.to(sessionId).emit('session:driver-changed', { driver: null });
    }

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
