/**
 * lib/object-scan.ts — MEAS-4 Phase 2 (MVP): automatic bounding-box measurement
 * of a box-shaped object (e.g. a table) the user looks at.
 *
 * How it works without object segmentation / ML:
 *  - The first stable gaze hit seeds a PLANE (point + normal) — the object's top.
 *  - As the gaze sweeps the object, every raycast hit that lies ON that plane
 *    (coplanar + matching normal) is an inlier; hits on the floor / walls /
 *    background fall outside the plane and are rejected automatically.
 *  - A bounding rectangle is fit to the inliers in the plane → width + depth.
 *  - Height is the drop from the top plane to the detected floor.
 *
 * This is robust for flat-topped box objects (the requested MVP) and needs no
 * point marking — the user just looks around the object.
 */

import type { Vec3 } from '@/lib/measurement-units';

// ── Vector helpers ────────────────────────────────────────────────────────────

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const len = (a: Vec3): number => Math.sqrt(dot(a, a));
const normalize = (a: Vec3): Vec3 => { const l = len(a) || 1; return scale(a, 1 / l); };

/** In-plane axes for a plane with the given normal, aligned to world X/Z when possible. */
export function planeBasis(normal: Vec3): { u: Vec3; v: Vec3 } {
  const n = normalize(normal);
  const ref: Vec3 = Math.abs(dot(n, { x: 1, y: 0, z: 0 })) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 0, z: 1 };
  const u = normalize(sub(ref, scale(n, dot(ref, n)))); // ref projected onto plane
  const v = normalize(cross(n, u));
  return { u, v };
}

/** Is `point` on the seed plane (within tolerance) with a matching surface normal? */
export function isInlier(
  point: Vec3, normal: Vec3,
  seedPoint: Vec3, seedNormal: Vec3,
  distTol = 0.06, normalTol = 0.85,
): boolean {
  const n = normalize(seedNormal);
  const planeDist = Math.abs(dot(sub(point, seedPoint), n));
  if (planeDist > distTol) return false;
  return dot(normalize(normal), n) > normalTol;
}

// ── Box model ─────────────────────────────────────────────────────────────────

export interface BoxParams {
  center: Vec3;      // center of the top rectangle
  u: Vec3; v: Vec3;  // in-plane axes (width along u, depth along v)
  n: Vec3;           // plane normal
  width:  number;    // extent along u
  depth:  number;    // extent along v
  height: number;    // top plane → floor (0 if floor unknown)
  topY:   number;
  floorY: number | null;
}

/** Fit an axis-aligned (in-plane) bounding box to the inlier points. */
export function computeBox(points: Vec3[], seedNormal: Vec3, floorY: number | null): BoxParams | null {
  if (points.length < 2) return null;
  const n = normalize(seedNormal);
  const { u, v } = planeBasis(n);

  // Centroid as the projection origin
  let origin: Vec3 = { x: 0, y: 0, z: 0 };
  for (const p of points) origin = add(origin, p);
  origin = scale(origin, 1 / points.length);

  let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity, ySum = 0;
  for (const p of points) {
    const d = sub(p, origin);
    const du = dot(d, u), dv = dot(d, v);
    uMin = Math.min(uMin, du); uMax = Math.max(uMax, du);
    vMin = Math.min(vMin, dv); vMax = Math.max(vMax, dv);
    ySum += p.y;
  }

  const width = uMax - uMin;
  const depth = vMax - vMin;
  const cu = (uMin + uMax) / 2, cv = (vMin + vMax) / 2;
  const center = add(origin, add(scale(u, cu), scale(v, cv)));
  const topY = ySum / points.length;
  const height = floorY != null && floorY < topY ? topY - floorY : 0;

  return { center, u, v, n, width, depth, height, topY, floorY };
}

/**
 * 8 corners of the box: indices 0–3 = top rectangle (CCW), 4–7 = bottom
 * rectangle directly below. Bottom sits `height` below the top plane, so
 * adjusting `height` moves the bottom face.
 */
export function boxCorners(b: BoxParams): Vec3[] {
  const hu = b.width / 2, hv = b.depth / 2;
  const top: Vec3[] = [
    add(b.center, add(scale(b.u, -hu), scale(b.v, -hv))),
    add(b.center, add(scale(b.u,  hu), scale(b.v, -hv))),
    add(b.center, add(scale(b.u,  hu), scale(b.v,  hv))),
    add(b.center, add(scale(b.u, -hu), scale(b.v,  hv))),
  ];
  const bottomY = b.topY - b.height;
  const bottom = top.map((c) => ({ x: c.x, y: bottomY, z: c.z }));
  return [...top, ...bottom];
}

/**
 * Segment the top face of the object from a raw point cloud (no normals needed):
 * keep points at roughly the seed's height (same horizontal plane), then grow a
 * connected region outward from the seed so far-away same-height clutter (other
 * tables, the floor beyond a gap) is excluded.
 */
export function segmentTopFace(
  points: Vec3[], seed: Vec3, yTol = 0.08,
): Vec3[] {
  // 1) coplanar-in-height candidates (same horizontal plane as the seed)
  const coplanar = points.filter((p) => Math.abs(p.y - seed.y) <= yTol);
  if (coplanar.length < 4) return coplanar.length ? coplanar : [seed];

  const horiz2 = (a: Vec3, b: Vec3) => { const dx = a.x - b.x, dz = a.z - b.z; return dx * dx + dz * dz; };

  // 2) adaptive gap: grid rays land farther apart in world space when the
  //    object is far, so size the region-grow gap from the actual point
  //    spacing (median nearest-neighbour distance) instead of a fixed value.
  const sampleN = Math.min(coplanar.length, 40);
  const nnd: number[] = [];
  for (let i = 0; i < sampleN; i++) {
    let best = Infinity;
    for (let j = 0; j < coplanar.length; j++) {
      if (i === j) continue;
      const d = horiz2(coplanar[i], coplanar[j]);
      if (d < best) best = d;
    }
    if (Number.isFinite(best)) nnd.push(Math.sqrt(best));
  }
  nnd.sort((a, b) => a - b);
  const median = nnd.length ? nnd[Math.floor(nnd.length / 2)] : 0.1;
  const gap = Math.max(0.3, median * 4);

  // 3) region-grow from the seed using the adaptive gap
  const gap2 = gap * gap;
  const used = new Array(coplanar.length).fill(false);
  const out: Vec3[] = [];
  // queue starts from the candidate nearest the seed
  let startIdx = 0, best = Infinity;
  coplanar.forEach((p, i) => { const d = horiz2(p, seed); if (d < best) { best = d; startIdx = i; } });
  const queue = [startIdx];
  used[startIdx] = true;
  while (queue.length) {
    const cur = coplanar[queue.shift()!];
    out.push(cur);
    for (let i = 0; i < coplanar.length; i++) {
      if (!used[i] && horiz2(cur, coplanar[i]) <= gap2) { used[i] = true; queue.push(i); }
    }
  }
  return out;
}

/** The 12 edges of the box as index pairs into boxCorners(). */
export const BOX_EDGES: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 0],     // top
  [4, 5], [5, 6], [6, 7], [7, 4],     // bottom
  [0, 4], [1, 5], [2, 6], [3, 7],     // verticals
];

export interface BoxDims { width: number; depth: number; height: number; volume: number; }

export function boxDims(b: BoxParams): BoxDims {
  return { width: b.width, depth: b.depth, height: b.height, volume: b.width * b.depth * b.height };
}
