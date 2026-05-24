'use client';

import { useEffect, useRef, useState } from 'react';
import type { Marker } from '@/types/socket';

export interface ProjectedPosition {
  /** Percentage 0-100 from left edge of the viewer */
  x: number;
  /** Percentage 0-100 from top edge of the viewer */
  y: number;
  /** False when the point is behind the camera — caller should hide the marker */
  visible: boolean;
}

/**
 * Subscribes to Camera.pose and re-projects every marker's world XYZ onto
 * the viewer's 2D screen on every camera update.
 *
 * @param mpSdk     Live SDK instance (null until the viewer is ready)
 * @param markers   Markers with world-space x/y/z coordinates
 * @param container Ref to the DOM element whose pixel dimensions match the
 *                  Matterport canvas (used as the windowSize argument)
 */
export function useMarkerProjection(
  mpSdk: MatterportSdk | null,
  markers: Marker[],
  container: React.RefObject<HTMLDivElement | null>,
): Record<string, ProjectedPosition> {
  const [positions, setPositions] = useState<Record<string, ProjectedPosition>>({});
  // Keep a stable ref to markers so the subscription closure always sees latest
  const markersRef = useRef<Marker[]>(markers);
  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  useEffect(() => {
    if (!mpSdk) return;

    const sub = mpSdk.Camera.pose.subscribe((pose) => {
      const el = container.current;
      if (!el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w === 0 || h === 0) return;

      const next: Record<string, ProjectedPosition> = {};
      for (const m of markersRef.current) {
        const screen = mpSdk.Conversion.worldToScreen(
          { x: m.x, y: m.y, z: m.z },
          pose,
          { w, h },
        );
        next[m.id] = {
          x: (screen.x / w) * 100,
          y: (screen.y / h) * 100,
          visible: screen.z > 0,
        };
      }
      setPositions(next);
    });

    return () => sub.cancel();
  }, [mpSdk, container]);

  return positions;
}
