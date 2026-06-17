/**
 * lib/measurement-shapes.ts — geometry for multi-point paths, closed polygons
 * (triangle, square, …) and circles.
 *
 * All values are in METERS (model units). Display formatting happens in the UI
 * layer via measurement-units.format().
 */

import { distance, type Vec3 } from '@/lib/measurement-units';

export type MeasurementKind = 'path' | 'circle';

export interface Measurement {
  id:      string;
  kind:    MeasurementKind;
  /** Path: the ordered vertices. Circle: [center, radiusPoint]. */
  points:  Vec3[];
  /** Path only: whether last→first is connected (triangle/square/…). */
  closed:  boolean;
  /** Circle only: plane normal the ring lies in. */
  normal?: Vec3;
}

// ── Vector ops ────────────────────────────────────────────────────────────────

function sub(a: Vec3, b: Vec3): Vec3 { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function add(a: Vec3, b: Vec3): Vec3 { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function scale(a: Vec3, s: number): Vec3 { return { x: a.x * s, y: a.y * s, z: a.z * s }; }
function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
function len(a: Vec3): number { return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z); }
function normalize(a: Vec3): Vec3 { const l = len(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; }

// ── Path / polygon metrics ─────────────────────────────────────────────────────

/** Total length of a polyline; perimeter if closed. */
export function pathLength(points: Vec3[], closed: boolean): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i]);
  if (closed && points.length >= 3) total += distance(points[points.length - 1], points[0]);
  return total;
}

/** Planar area of a closed polygon (Newell's method — works in any plane). */
export function polygonArea(points: Vec3[]): number {
  if (points.length < 3) return 0;
  let n: Vec3 = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    n = add(n, cross(a, b));
  }
  return len(n) / 2;
}

// ── Circle ──────────────────────────────────────────────────────────────────────

export interface CircleMetrics {
  radius:        number;
  diameter:      number;
  circumference: number;
  area:          number;
}

export function circleMetrics(center: Vec3, radiusPoint: Vec3): CircleMetrics {
  const r = distance(center, radiusPoint);
  return { radius: r, diameter: r * 2, circumference: 2 * Math.PI * r, area: Math.PI * r * r };
}

/**
 * Two orthonormal vectors spanning the plane perpendicular to `normal`.
 * Used to draw a circle's ring in 3D.
 */
function basisFromNormal(normal: Vec3): { u: Vec3; v: Vec3 } {
  const n = normalize(normal);
  // Reference axis least parallel to n
  const ref: Vec3 = Math.abs(n.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const u = normalize(cross(n, ref));
  const v = normalize(cross(n, u));
  return { u, v };
}

/** N points around a circle of `radius` centered at `center`, lying in `normal`'s plane. */
export function ringPoints3D(center: Vec3, normal: Vec3, radius: number, n = 48): Vec3[] {
  const { u, v } = basisFromNormal(normal);
  const pts: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const offset = add(scale(u, Math.cos(t) * radius), scale(v, Math.sin(t) * radius));
    pts.push(add(center, offset));
  }
  return pts;
}

/** Centroid of a set of points (used to anchor labels). */
export function centroid(points: Vec3[]): Vec3 {
  if (points.length === 0) return { x: 0, y: 0, z: 0 };
  let c: Vec3 = { x: 0, y: 0, z: 0 };
  for (const p of points) c = add(c, p);
  return scale(c, 1 / points.length);
}
