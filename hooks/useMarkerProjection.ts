'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Marker } from '@/types/socket';

export interface ProjectedPosition {
  /** Percentage 0-100 from left edge of the viewer container */
  x: number;
  /** Percentage 0-100 from top edge of the viewer container */
  y: number;
  /** False when the point is behind the camera — caller should hide the marker */
  visible: boolean;
}

/**
 * Subscribes to Camera.pose and re-projects every marker's world XYZ onto
 * the viewer's 2D screen on every camera update.
 *
 * Fix notes:
 *  - worldToScreen receives the FULL window dimensions so the SDK can correctly
 *    project. The raw pixel result is then offset-corrected against the
 *    container's getBoundingClientRect() to give container-relative percentages.
 *    Without this, markers shift by the container's distance from the window
 *    origin (e.g. header height, sidebar width).
 *  - When a new marker is added, the Camera.pose subscription callback hasn't
 *    fired (camera didn't move), so we store the last pose in a ref and
 *    re-project immediately in a separate markers-watching effect.
 */
export function useMarkerProjection(
  mpSdk: MatterportSdk | null,
  markers: Marker[],
  container: React.RefObject<HTMLDivElement | null>,
): Record<string, ProjectedPosition> {
  const [positions, setPositions] = useState<Record<string, ProjectedPosition>>({});

  // Refs so closures always see the latest values without extra deps
  const markersRef = useRef<Marker[]>(markers);
  const sdkRef     = useRef<MatterportSdk | null>(mpSdk);
  const poseRef    = useRef<MatterportPose | null>(null);

  useEffect(() => { markersRef.current = markers; }, [markers]);
  useEffect(() => { sdkRef.current = mpSdk; },     [mpSdk]);

  /**
   * Core projection function.
   * Passes the full window size to worldToScreen (which it needs to scale the
   * projection matrix), then subtracts the container rect's origin so the
   * returned pixel is relative to the viewer element, not the browser window.
   */
  const project = useCallback((pose: MatterportPose): void => {
    const sdk = sdkRef.current;
    const el  = container.current;
    if (!sdk || !el) return;

    const rect = el.getBoundingClientRect();
    const ww   = window.innerWidth;
    const wh   = window.innerHeight;

    const next: Record<string, ProjectedPosition> = {};
    for (const m of markersRef.current) {
      const screen = sdk.Conversion.worldToScreen(
        { x: m.x, y: m.y, z: m.z },
        pose,
        { w: ww, h: wh },
      );
      // Convert from window-absolute pixels to container-relative percentages
      next[m.id] = {
        x:       ((screen.x - rect.left) / rect.width)  * 100,
        y:       ((screen.y - rect.top)  / rect.height) * 100,
        visible: screen.z > 0,
      };
    }
    setPositions(next);
  }, [container]);

  // Subscribe to camera pose — re-project on every frame the camera changes
  useEffect(() => {
    if (!mpSdk) return;
    const sub = mpSdk.Camera.pose.subscribe((pose) => {
      poseRef.current = pose;
      project(pose);
    });
    return () => sub.cancel();
  }, [mpSdk, project]);

  // Re-project immediately when markers are added/removed using the last known
  // camera pose — fixes the case where the camera has not moved since the last
  // subscribe callback
  useEffect(() => {
    if (poseRef.current) {
      project(poseRef.current);
    }
  }, [markers, project]);

  return positions;
}
