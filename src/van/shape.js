import * as THREE from 'three';

/*
 * Parametric body of the shuttle.
 *
 * In plan view (looking down Y) the body is a superellipse with half-length A
 * and half-width B. A vertical "profile" describes how far each horizontal
 * slice is inset (d) at height y, from the under-floor centre, around the
 * bottom corner, up the side, across the glasshouse and over the roof to the
 * roof centre. Every surface on the van (paint, glass, door skins, trims,
 * light bars, interior shell) is cut from this one surface so they all fit.
 */

export const DIM = {
  A: 2.55, // half length
  B: 1.0, // half width
  N: 5.0, // superellipse exponent (higher = boxier)
  bottom: 0.3,
  sill: 0.52,
  belt: 1.08,
  glassTop: 2.02,
  roof: 2.45,
  shell: 0.05, // body thickness (outer skin -> interior trim)
};

export const WHEEL = { x: 1.78, y: 0.4, r: 0.4, well: 0.47, width: 0.27, track: 0.83 };

// Doors: double sliding doors on the +Z (kerb) side.
export const DOOR = { front: 0.72, mid: 0.0, rear: -0.72 };

const { A, B, N } = DIM;
const E = 2 / N;
export const COLS = 360;

const sideD = (y) => 0.012 * Math.pow((y - 0.85) / 0.35, 2);

function buildProfile() {
  const P = [];
  const push = (d, y) => P.push({ d, y });
  const r = 0.2;
  const c0 = sideD(0.5);
  // underside, centre -> edge
  for (let i = 0; i <= 5; i++) push(B - (B - (c0 + r)) * (i / 5), DIM.bottom);
  // bottom corner
  for (let i = 1; i <= 9; i++) {
    const p = (i / 9) * Math.PI * 0.5;
    push(c0 + r - r * Math.sin(p), 0.5 - r * Math.cos(p));
  }
  const rows = {};
  rows.sill = P.length;
  push(sideD(DIM.sill), DIM.sill);
  // lower side
  for (let i = 1; i <= 14; i++) {
    const y = DIM.sill + (DIM.belt - DIM.sill) * (i / 14);
    push(sideD(y), y);
  }
  rows.belt = P.length - 1;
  // glasshouse with tumblehome
  const dBelt = sideD(DIM.belt);
  for (let i = 1; i <= 18; i++) {
    const t = i / 18;
    push(dBelt + 0.075 * Math.pow(t, 1.5), DIM.belt + (DIM.glassTop - DIM.belt) * t);
  }
  rows.glassTop = P.length - 1;
  const dG = P[rows.glassTop].d;
  // roof corner (elliptical)
  const rh = 0.4;
  const rv = 0.4;
  for (let i = 1; i <= 14; i++) {
    const p = (i / 14) * Math.PI * 0.5;
    push(dG + rh - rh * Math.cos(p), DIM.glassTop + rv * Math.sin(p));
  }
  // roof crown
  const dR = dG + rh;
  for (let i = 1; i <= 7; i++) {
    const t = i / 7;
    push(dR + (B - dR) * t, DIM.glassTop + rv + 0.03 * Math.sin((t * Math.PI) / 2));
  }
  rows.last = P.length - 1;
  return { P, rows };
}

export const PROFILE = buildProfile();
export const ROWS = PROFILE.rows;

/** Inset d of the side surface at height y (valid from the bottom corner to glass top). */
export function dAtY(y) {
  const P = PROFILE.P;
  const start = 5;
  for (let i = start; i < ROWS.glassTop; i++) {
    const a = P[i];
    const b = P[i + 1];
    if (y >= a.y && y <= b.y) {
      const t = (y - a.y) / (b.y - a.y || 1);
      return a.d + (b.d - a.d) * t;
    }
  }
  return y < P[start].y ? P[start].d : P[ROWS.glassTop].d;
}

export function plan(theta, d, out = new THREE.Vector2()) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  out.x = (A - d) * Math.sign(c) * Math.pow(Math.abs(c), E);
  out.y = (B - d) * Math.sign(s) * Math.pow(Math.abs(s), E);
  return out;
}

/** Outward unit normal of the plan outline at (x, z) for inset d. */
export function planNormal(x, z, d, out = new THREE.Vector2()) {
  const a = A - d;
  const b = B - d;
  const gx = (Math.sign(x) * Math.pow(Math.abs(x / a), N - 1)) / a;
  const gz = (Math.sign(z) * Math.pow(Math.abs(z / b), N - 1)) / b;
  out.set(gx, gz).normalize();
  return out;
}

/** Side z of the outer skin at given x / y. */
export function sideZ(x, y) {
  const d = dAtY(y);
  const a = A - d;
  const b = B - d;
  const t = Math.min(1, Math.pow(Math.abs(x) / a, N));
  return b * Math.pow(1 - t, 1 / N);
}

export function thetaForX(x, side = 1) {
  const c = Math.sign(x) * Math.pow(Math.min(1, Math.abs(x) / A), N / 2);
  const t = Math.acos(c);
  return side > 0 ? t : Math.PI * 2 - t;
}

function buildThetas() {
  const D = 8192;
  const pts = [];
  const v = new THREE.Vector2();
  for (let i = 0; i <= D; i++) pts.push(plan((i / D) * Math.PI * 2, 0, v).clone());
  const cum = [0];
  for (let i = 1; i <= D; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const L = cum[D];
  const th = [];
  let j = 0;
  for (let c = 0; c < COLS; c++) {
    const target = (c / COLS) * L;
    while (cum[j + 1] < target) j++;
    const t = (target - cum[j]) / (cum[j + 1] - cum[j]);
    th.push(((j + t) / D) * Math.PI * 2);
  }
  // Snap columns onto the door seams and pillar lines so cut lines are clean.
  const snaps = {};
  const snap = (key, x, side) => {
    const t = thetaForX(x, side);
    let best = 0;
    let bd = Infinity;
    for (let c = 0; c < COLS; c++) {
      let dd = Math.abs(th[c] - t);
      dd = Math.min(dd, Math.PI * 2 - dd);
      if (dd < bd) {
        bd = dd;
        best = c;
      }
    }
    th[best] = t;
    snaps[key] = best;
  };
  snap('doorFront', DOOR.front, 1);
  snap('doorMid', DOOR.mid, 1);
  snap('doorRear', DOOR.rear, 1);
  return { th, snaps };
}

const THETAS = buildThetas();
export const COL = THETAS.snaps;

/* ---------- full surface grid ---------- */

const NR = PROFILE.P.length;
const grid = new Float32Array(NR * COLS * 3);
const gridN = new Float32Array(NR * COLS * 3);
{
  const v = new THREE.Vector2();
  for (let r = 0; r < NR; r++) {
    const { d, y } = PROFILE.P[r];
    for (let c = 0; c < COLS; c++) {
      plan(THETAS.th[c], d, v);
      const k = (r * COLS + c) * 3;
      grid[k] = v.x;
      grid[k + 1] = y;
      grid[k + 2] = v.y;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(grid, 3));
  const idx = [];
  for (let r = 0; r < NR - 1; r++) {
    for (let c = 0; c < COLS; c++) {
      const c1 = (c + 1) % COLS;
      const a = r * COLS + c;
      const b = r * COLS + c1;
      const cc = (r + 1) * COLS + c1;
      const dd = (r + 1) * COLS + c;
      idx.push(a, dd, b, b, dd, cc);
    }
  }
  g.setIndex(idx);
  g.computeVertexNormals();
  gridN.set(g.getAttribute('normal').array);
  // Degenerate centre rows: force straight down / up.
  for (let c = 0; c < COLS; c++) {
    gridN.set([0, -1, 0], c * 3);
    gridN.set([0, 1, 0], ((NR - 1) * COLS + c) * 3);
  }
  g.dispose();
}

export function gridPoint(r, c, offset = 0, out = new THREE.Vector3()) {
  const k = (r * COLS + (((c % COLS) + COLS) % COLS)) * 3;
  return out.set(
    grid[k] + gridN[k] * offset,
    grid[k + 1] + gridN[k + 1] * offset,
    grid[k + 2] + gridN[k + 2] * offset,
  );
}

export function gridNormal(r, c, out = new THREE.Vector3()) {
  const k = (r * COLS + (((c % COLS) + COLS) % COLS)) * 3;
  return out.set(gridN[k], gridN[k + 1], gridN[k + 2]);
}

/**
 * Build a surface patch over rows [r0, r1] including only cells for which
 * include(r, c) is true. offset moves along the normal (negative = inward).
 * transform(v, r, c) may tweak each vertex (used for door shut-line gaps).
 */
export function patch(r0, r1, include = () => true, offset = 0, transform = null) {
  const rows = r1 - r0 + 1;
  const pos = new Float32Array(rows * COLS * 3);
  const nor = new Float32Array(rows * COLS * 3);
  const uv = new Float32Array(rows * COLS * 2);
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let r = r0; r <= r1; r++) {
    for (let c = 0; c < COLS; c++) {
      gridPoint(r, c, offset, v);
      gridNormal(r, c, n);
      if (transform) transform(v, r, c);
      const k = ((r - r0) * COLS + c) * 3;
      pos[k] = v.x;
      pos[k + 1] = v.y;
      pos[k + 2] = v.z;
      nor[k] = n.x;
      nor[k + 1] = n.y;
      nor[k + 2] = n.z;
      const ku = ((r - r0) * COLS + c) * 2;
      uv[ku] = c / COLS;
      uv[ku + 1] = PROFILE.P[r].y;
    }
  }
  const idx = [];
  for (let r = r0; r < r1; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!include(r, c)) continue;
      const c1 = (c + 1) % COLS;
      const a = (r - r0) * COLS + c;
      const b = (r - r0) * COLS + c1;
      const cc = (r - r0 + 1) * COLS + c1;
      const dd = (r - r0 + 1) * COLS + c;
      idx.push(a, dd, b, b, dd, cc);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Quad strip between two equal-length point lists. */
export function ribbon(a, b) {
  const pos = [];
  for (let i = 0; i < a.length; i++) pos.push(a[i].x, a[i].y, a[i].z, b[i].x, b[i].y, b[i].z);
  const idx = [];
  for (let i = 0; i < a.length - 1; i++) {
    const p = i * 2;
    idx.push(p, p + 1, p + 2, p + 2, p + 1, p + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Points along the outline at height y, offset outward, for theta in [t0, t1]. */
export function outlineAt(y, t0, t1, steps, outward = 0) {
  const d = dAtY(y);
  const v = new THREE.Vector2();
  const n = new THREE.Vector2();
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = t0 + (t1 - t0) * (i / steps);
    plan(t, d, v);
    planNormal(v.x, v.y, d, n);
    pts.push(new THREE.Vector3(v.x + n.x * outward, y, v.y + n.y * outward));
  }
  return pts;
}

/** Closed inner outline (plan) at height y inset by `inset` from the skin. */
export function innerOutline(y, inset, steps = 200) {
  const d = dAtY(y) + inset;
  const v = new THREE.Vector2();
  const pts = [];
  for (let i = 0; i < steps; i++) {
    plan((i / steps) * Math.PI * 2, d, v);
    pts.push(v.clone());
  }
  return pts;
}
