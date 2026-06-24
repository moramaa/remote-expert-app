/**
 * lib/gaze-suggestions.ts — MEAS-4 Phase 1 (MVP): deterministic geometric
 * measurement suggestions based on where the user is looking.
 *
 * No computer vision. Given an auto-captured gaze *anchor* and the current
 * gaze *target* (both 3D surface hits from raycasting), we offer up to three
 * context-relevant measurements: the direct span, its horizontal (floor-plane)
 * component, and its vertical (height) component. The surface normal of the
 * gazed point classifies floor/wall/ceiling to label the suggestions.
 *
 * Phase 2 (full object detection — "measure the table") is intentionally out
 * of scope; it is a segmentation problem to evaluate separately.
 */

import { distance, type Vec3 } from '@/lib/measurement-units';

export type SurfaceClass = 'floor' | 'wall' | 'ceiling';

export type SuggestionKind = 'direct' | 'horizontal' | 'vertical';

export interface GazeSuggestion {
  id:     string;
  kind:   SuggestionKind;
  label:  string;
  a:      Vec3;
  b:      Vec3;
  meters: number;
}

/** Classify a surface by its normal so suggestions can be context-relevant. */
export function classifySurface(normal: Vec3): SurfaceClass {
  if (normal.y >  0.7) return 'floor';
  if (normal.y < -0.7) return 'ceiling';
  return 'wall';
}

/** Minimum span (meters) before a suggestion is worth offering. */
const MIN_SPAN = 0.05;

/**
 * Build up to three deterministic suggestions between the gaze anchor and the
 * current gaze target. Degenerate (near-zero) components are dropped.
 */
export function buildSuggestions(
  anchor: Vec3,
  target: Vec3,
  targetClass: SurfaceClass,
): GazeSuggestion[] {
  const out: GazeSuggestion[] = [];

  // Horizontal "elbow" point: target's X/Z at the anchor's height.
  const elbow: Vec3 = { x: target.x, y: anchor.y, z: target.z };

  const direct     = distance(anchor, target);
  const horizontal = distance(anchor, elbow);
  const vertical   = Math.abs(target.y - anchor.y);

  if (direct >= MIN_SPAN) {
    out.push({ id: 'sg-direct', kind: 'direct', label: 'Direct distance', a: anchor, b: target, meters: direct });
  }
  if (horizontal >= MIN_SPAN) {
    out.push({ id: 'sg-horizontal', kind: 'horizontal', label: 'Horizontal distance', a: anchor, b: elbow, meters: horizontal });
  }
  if (vertical >= MIN_SPAN) {
    // Height reads most naturally as the vertical leg under the target.
    const label = targetClass === 'ceiling' ? 'Ceiling height' : 'Vertical height';
    out.push({ id: 'sg-vertical', kind: 'vertical', label, a: elbow, b: target, meters: vertical });
  }

  return out;
}
