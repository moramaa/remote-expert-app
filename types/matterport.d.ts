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
  /** Surface normal at intersection point — used to orient tag stems */
  normal: MatterportVec3;
  floorId?: number;
  /**
   * What the ray hit. Common values from the SDK:
   *   'intersectedobject.model'   — actual 3D mesh (wall, floor, machine)
   *   'intersectedobject.sweep'   — a panorama sweep node
   *   'intersectedobject.tag'     — an existing Tag
   *   'intersectedobject.none'    — nothing under the cursor
   *   'intersectedobject.unknown' — other
   */
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

/** Descriptor passed to Tag.add() */
interface MatterportTagDescriptor {
  id?: string;
  anchorPosition: MatterportVec3;
  stemVector: MatterportVec3;
  label?: string;
  description?: string;
  color?: { r: number; g: number; b: number };
  stemVisible?: boolean;
  opacity?: number;
  iconId?: string;
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
  /**
   * Native Matterport Tag API.
   * Tags are first-class 3D objects placed at an anchorPosition with a stem
   * pointing along stemVector.  The SDK handles occlusion, projection, and
   * labelling — no HTML overlay or worldToScreen needed.
   */
  Tag: {
    /**
     * Add one or more tags to the space.
     * Returns the SDK-assigned IDs (may differ from descriptor.id if the SDK
     * ignores the provided id).
     */
    add(...tags: MatterportTagDescriptor[]): Promise<string[]>;
    /** Remove tags by their SDK IDs. */
    remove(...ids: string[]): Promise<void>;
    /** Update the label / description shown in the tag's billboard. */
    editBillboard(id: string, props: { label?: string; description?: string }): Promise<void>;
    /** Change the disc colour (channels are 0–1). */
    editColor(id: string, color: { r: number; g: number; b: number }): Promise<void>;
    /** Show or hide the stem, or change its height. */
    editStem(id: string, options: { stemVisible?: boolean; stemHeight?: number }): Promise<void>;
  };
  Asset: {
    /** Register a custom texture/icon to use with Tag.editIcon(). */
    registerTexture(id: string, src: string): Promise<void>;
  };
}

interface MatterportViewerElement extends HTMLElement {
  playingPromise: Promise<MatterportSdk>;
  sdkPromise: Promise<MatterportSdk>;
  mpSdk?: MatterportSdk;
}
