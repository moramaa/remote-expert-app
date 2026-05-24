import { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
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

function broadcastCount(): void {
  const count = io.engine.clientsCount;
  io.emit('connection-count', count);
}

io.on('connection', (socket) => {
  console.log(`[socket] client connected: ${socket.id}`);
  broadcastCount();

  socket.on('expert:place-marker', (marker: Marker) => {
    socket.broadcast.emit('worker:new-marker', marker);
  });

  socket.on('expert:remove-marker', (markerId: string) => {
    socket.broadcast.emit('worker:remove-marker', markerId);
  });

  socket.on('expert:clear-markers', () => {
    socket.broadcast.emit('worker:clear-markers');
  });

  socket.on('expert:send-instruction', (instruction: Instruction) => {
    socket.broadcast.emit('worker:instruction', instruction);
  });

  socket.on('expert:laser-pointer', (position: LaserPointer | null) => {
    socket.broadcast.emit('worker:laser-pointer', position);
  });

  socket.on('expert:camera-sync', (camera: CameraState) => {
    socket.broadcast.emit('worker:camera-sync', camera);
  });

  socket.on('expert:highlight-zone', (zone: HighlightZone) => {
    socket.broadcast.emit('worker:highlight-zone', zone);
  });

  socket.on('expert:clear-zones', () => {
    socket.broadcast.emit('worker:clear-zones');
  });

  socket.on('disconnect', () => {
    console.log(`[socket] client disconnected: ${socket.id}`);
    broadcastCount();
  });
});

console.log(`[socket] server listening on :${PORT}`);
