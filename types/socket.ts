export interface Marker {
  id: string;
  x: number;
  y: number;
  z: number;
  screenX: number; // 0-100 percentage when placed
  screenY: number; // 0-100 percentage when placed
  label?: string;
  timestamp: number;
}

export interface Instruction {
  id: string;
  text: string;
  timestamp: number;
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

export interface ServerToClientEvents {
  'worker:new-marker': (marker: Marker) => void;
  'worker:remove-marker': (markerId: string) => void;
  'worker:clear-markers': () => void;
  'worker:instruction': (instruction: Instruction) => void;
  'worker:laser-pointer': (position: LaserPointer | null) => void;
  'worker:camera-sync': (camera: CameraState) => void;
  'worker:highlight-zone': (zone: HighlightZone) => void;
  'worker:clear-zones': () => void;
  'connection-count': (count: number) => void;
}

export interface ClientToServerEvents {
  'expert:place-marker': (marker: Marker) => void;
  'expert:remove-marker': (markerId: string) => void;
  'expert:clear-markers': () => void;
  'expert:send-instruction': (instruction: Instruction) => void;
  'expert:laser-pointer': (position: LaserPointer | null) => void;
  'expert:camera-sync': (camera: CameraState) => void;
  'expert:highlight-zone': (zone: HighlightZone) => void;
  'expert:clear-zones': () => void;
}
