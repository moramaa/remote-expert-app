// Shim so bundler-mode moduleResolution accepts the import despite the package's
// exports field not including a "types" condition.
declare module '@matterport/webcomponent' {}

interface MatterportSubscription {
  cancel(): void;
}

interface MatterportVec3 {
  x: number;
  y: number;
  z: number;
}

interface MatterportIntersection {
  position: MatterportVec3;
  normal?: MatterportVec3;
  floorId?: number;
  object?: string;
}

interface MatterportPose {
  position: MatterportVec3;
  rotation: { x: number; y: number; z?: number };
  sweep?: string;
  mode?: string;
}

interface MatterportSdk {
  Pointer: {
    intersection: {
      subscribe(cb: (intersection: MatterportIntersection) => void): MatterportSubscription;
    };
  };
  Camera: {
    pose: {
      subscribe(cb: (pose: MatterportPose) => void): MatterportSubscription;
    };
    setRotation?(rotation: { x: number; y: number }, options?: unknown): Promise<void>;
    rotate?(deltaX: number, deltaY: number, options?: unknown): Promise<void>;
  };
  Sweep?: {
    moveTo?(sweepId: string, options?: unknown): Promise<string>;
  };
}

interface MatterportViewerElement extends HTMLElement {
  playingPromise: Promise<MatterportSdk>;
  sdkPromise: Promise<MatterportSdk>;
  mpSdk?: MatterportSdk;
}
