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

/** Matches Camera.Pose from the SDK — projection is required by Conversion.worldToScreen */
interface MatterportPose {
  position: MatterportVec3;
  rotation: { x: number; y: number };
  projection: Float32Array;
  sweep: string;
  mode: string;
}

interface MatterportSize {
  w: number;
  h: number;
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
  Conversion: {
    /**
     * Projects a 3D world position onto the screen.
     * Returns a Vector3 where x/y are pixel coords and z is depth
     * (z < 0 means the point is behind the camera).
     */
    worldToScreen(
      worldPos: MatterportVec3,
      cameraPose: MatterportPose,
      windowSize: MatterportSize,
      result?: MatterportVec3,
    ): MatterportVec3;
  };
  Sweep: {
    moveTo(
      sweep: string,
      options: {
        rotation?: { x: number; y: number };
        /** Use 'transition.instant' for mirror-view sync — no animation lag */
        transition?: 'transition.instant' | 'transition.fly' | 'transition.fade';
        transitionTime?: number;
      },
    ): Promise<string>;
  };
}

interface MatterportViewerElement extends HTMLElement {
  playingPromise: Promise<MatterportSdk>;
  sdkPromise: Promise<MatterportSdk>;
  mpSdk?: MatterportSdk;
}
