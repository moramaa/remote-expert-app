// ── Phase 1: live-session data types ─────────────────────────────────────────

// ── PTT (Push-to-Talk) voice chunk ───────────────────────────────────────────
export interface PttChunk {
  id:        string;
  text:      string;
  startTs:   number;  // ms epoch — when PTT button was pressed
  endTs:     number;  // ms epoch — when PTT button was released
  speakerId: string;  // userId of the speaker
}



export interface Marker {
  id: string;
  /** World-space anchor position (from Pointer.intersection.position) */
  x: number;
  y: number;
  z: number;
  /** Surface normal at placement point — used as Tag stemVector direction */
  nx: number;
  ny: number;
  nz: number;
  label?: string;
  timestamp: number;
}

export interface Instruction {
  id: string;
  text: string;
  timestamp: number;
  /** Set when this instruction is a playbook step */
  stepNumber?: number;
  totalSteps?: number;
}

export interface CameraState {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  /** Matterport sweep ID — used to teleport the worker to the same node */
  sweep: string;
}

export interface LaserPointer {
  x: number; // screen percentage 0-100
  y: number; // screen percentage 0-100
}

export interface HighlightZone {
  id: string;
  x: number; // 0-100
  y: number; // 0-100
  width: number; // 0-100
  height: number; // 0-100
  label?: string;
  timestamp: number;
}

/** Full session snapshot sent to every client that connects after state exists */
export interface SyncState {
  markers: Marker[];
  zones: HighlightZone[];
  latestInstruction: Instruction | null;
  camera: CameraState | null;
}

// ── Phase 2: onboarding / matching / queue types ──────────────────────────────

export interface TicketSummary {
  ticketId: string;
  workerId: string;
  workerName: string;
  workerFactory: string;
  machineId: string;
  machineLabel: string;
  createdAt: number; // Unix ms
}

export type TicketStatus = 'searching' | 'matched' | 'cancelled' | 'no_match';

// ── Ack payloads ────────────────────────────────────────────────────────────

export interface SosAckOk  { ticketId: string }
export interface SosAckErr { error: string }
export type SosAck = SosAckOk | SosAckErr;

export interface AcceptAckOk  { sessionId: string }
export interface AcceptAckErr { error: string }
export type AcceptAck = AcceptAckOk | AcceptAckErr;

// ── Socket event interfaces ───────────────────────────────────────────────────

export interface ServerToClientEvents {
  // ── Phase 1: live-session ─────────────────────────────────────────────────
  'worker:new-marker':     (marker: Marker) => void;
  'worker:remove-marker':  (markerId: string) => void;
  'worker:clear-markers':  () => void;
  'worker:instruction':    (instruction: Instruction) => void;
  'worker:laser-pointer':  (position: LaserPointer | null) => void;
  'worker:camera-sync':    (camera: CameraState) => void;
  'worker:highlight-zone': (zone: HighlightZone) => void;
  'worker:clear-zones':    () => void;
  /** Replays full session state to a freshly-connected client */
  'worker:sync-state':     (state: SyncState) => void;
  'connection-count':      (count: number) => void;

  // ── Phase 2: matching ──────────────────────────────────────────────────────
  /** Sent to a matched expert when a worker needs help */
  'expert:incoming-ticket': (ticket: TicketSummary) => void;
  /** Refreshes an expert's live-queue list */
  'expert:queue-update':    (tickets: TicketSummary[]) => void;
  /** Worker receives real-time status updates on their open ticket */
  'worker:ticket-status':   (status: { ticketId: string; state: TicketStatus; sessionId?: string; expertName?: string }) => void;
  /** Both expert + worker receive this once a match is confirmed */
  'session:join':           (payload: { sessionId: string; role: 'expert' | 'worker' }) => void;

  // ── Session lifecycle ─────────────────────────────────────────────────────
  /** Sent to the OTHER party when one side ends the session */
  'session:ended':          (payload: { endedBy: 'expert' | 'worker' }) => void;

  // ── Worker feedback to expert ─────────────────────────────────────────────
  'expert:step-done':           (payload: { instructionId: string }) => void;
  'expert:needs-clarification': (payload: { instructionId: string }) => void;

  // ── Emergency ─────────────────────────────────────────────────────────────
  'worker:emergency-freeze':      () => void;
  'expert:emergency-acknowledged': () => void;

  // ── PTT subtitles (relay to the other party) ──────────────────────────────
  /** Worker's PTT chunk relayed to expert for live subtitle display */
  'expert:worker-ptt':  (chunk: PttChunk) => void;
  /** Expert's PTT chunk relayed to worker for live subtitle display */
  'worker:expert-ptt':  (chunk: PttChunk) => void;

  // ── Bi-directional Mirror View (Epic 5) ──────────────────────────────────
  /** Worker's camera position relayed to expert when worker is driving */
  'expert:worker-camera':    (camera: CameraState) => void;
  /** Who is currently driving the shared camera view */
  'session:driver-changed':  (payload: { driver: 'expert' | 'worker' | null }) => void;
  /** Sent to expert when worker takes over driving (expert must disable their toggle) */
  'expert:mirror-forced-off': () => void;
  /** Sent to worker when expert takes over driving (worker must disable their toggle) */
  'worker:mirror-forced-off': () => void;
}

export interface ClientToServerEvents {
  // ── Phase 1: live-session ─────────────────────────────────────────────────
  'expert:place-marker':    (marker: Marker) => void;
  'expert:remove-marker':   (markerId: string) => void;
  'expert:clear-markers':   () => void;
  'expert:send-instruction':(instruction: Instruction) => void;
  'expert:laser-pointer':   (position: LaserPointer | null) => void;
  'expert:camera-sync':     (camera: CameraState) => void;
  'expert:highlight-zone':  (zone: HighlightZone) => void;
  'expert:clear-zones':     () => void;

  // ── Session lifecycle ─────────────────────────────────────────────────────
  /** Either party ends the session and records outcome */
  'session:end': (payload: { resolved: boolean }) => void;

  // ── Worker feedback ───────────────────────────────────────────────────────
  'worker:step-done':           (payload: { instructionId: string }) => void;
  'worker:needs-clarification': (payload: { instructionId: string }) => void;

  // ── Emergency ─────────────────────────────────────────────────────────────
  'expert:emergency-freeze':      () => void;
  'worker:emergency-acknowledged': () => void;

  // ── PTT (Push-to-Talk) ────────────────────────────────────────────────────
  /** Expert submits a PTT transcript chunk (logged + relayed to worker as subtitle) */
  'expert:ptt-chunk': (chunk: PttChunk) => void;
  /** Worker submits a PTT transcript chunk (logged + relayed to expert as subtitle) */
  'worker:ptt-chunk': (chunk: PttChunk) => void;

  // ── Bi-directional Mirror View (Epic 5) ──────────────────────────────────
  /** Worker emits their camera position when they are driving */
  'worker:camera-sync': (camera: CameraState) => void;
  /** Expert announces they are starting to drive */
  'expert:mirror-on':  () => void;
  /** Expert announces they are stopping driving */
  'expert:mirror-off': () => void;
  /** Worker announces they are starting to drive */
  'worker:mirror-on':  () => void;
  /** Worker announces they are stopping driving */
  'worker:mirror-off': () => void;

  // ── Phase 2: availability + matching ─────────────────────────────────────
  /** Expert toggles their availability; sends current cert list */
  'expert:set-availability': (payload: { online: boolean; certificationIds: string[] }) => void;
  /** Worker opens an emergency SOS ticket */
  'worker:sos-create': (
    payload: {
      machineId:       string;
      workerName:      string;
      workerFactory:   string;
      locationDept?:   string;
      locationLine?:   string;
      locationStation?: string;
    },
    callback: (result: SosAck) => void,
  ) => void;
  /** Worker cancels their open ticket */
  'worker:sos-cancel':       (payload: { ticketId: string }) => void;
  /** Expert accepts an incoming ticket */
  'expert:accept-ticket':    (payload: { ticketId: string; expertName: string }, callback: (result: AcceptAck) => void) => void;
}

/** Shape of socket.handshake.auth */
export interface SocketAuthPayload {
  userId: string;
  role: 'expert' | 'worker';
  sessionId?: string; // present when joining an already-matched live session
}
