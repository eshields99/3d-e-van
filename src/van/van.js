import * as THREE from 'three';
import {
  DIM,
  WHEEL,
  DOOR,
  ROWS,
  COLS,
  COL,
  PROFILE,
  patch,
  ribbon,
  gridPoint,
  outlineAt,
  thetaForX,
  plan,
  planNormal,
  dAtY,
  sideZ,
} from './shape.js';
import { buildInterior } from './interior.js';
import { badgeTexture } from '../textures.js';

const T = DIM.shell;

/* ------------------------------------------------------------------ */
/* materials                                                          */
/* ------------------------------------------------------------------ */

function wheelCut(material) {
  const r2 = (WHEEL.well * WHEEL.well).toFixed(4);
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;')
      .replace(
        'void main() {',
        `void main() {
          vec2 wcut = vec2(abs(vObjPos.x) - ${WHEEL.x.toFixed(3)}, vObjPos.y - ${WHEEL.y.toFixed(3)});
          if (abs(vObjPos.z) > 0.5 && dot(wcut, wcut) < ${r2}) discard;`,
      );
  };
  material.customProgramCacheKey = () => 'wheelcut';
  return material;
}

function makeMaterials() {
  const paint = new THREE.MeshPhysicalMaterial({
    color: 0x060607,
    metalness: 0.35,
    roughness: 0.28,
    clearcoat: 1,
    clearcoatRoughness: 0.035,
    envMapIntensity: 1.6,
  });
  const paintCut = wheelCut(paint.clone());
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x7a7570,
    metalness: 0,
    roughness: 0.015,
    transmission: 1,
    thickness: 0.01,
    ior: 2.1,
    clearcoat: 1,
    clearcoatRoughness: 0.01,
    specularIntensity: 1,
    envMapIntensity: 1.8,
    side: THREE.DoubleSide,
    attenuationColor: new THREE.Color(0x4a443e),
    attenuationDistance: 0.12,
  });
  // From inside the cabin a plain tinted pane reads better (and is cheaper)
  // than the screen-space transmission used for the exterior look.
  const glassInside = new THREE.MeshPhysicalMaterial({
    color: 0x0c0b0a,
    transparent: true,
    opacity: 0.32,
    roughness: 0.03,
    metalness: 0,
    envMapIntensity: 0.5,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const satin = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.55, metalness: 0.2 });
  const gloss = new THREE.MeshPhysicalMaterial({
    color: 0x010101,
    roughness: 0.06,
    metalness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
  });
  const liner = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.95, side: THREE.DoubleSide });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x101011, roughness: 0.82, metalness: 0 });
  const bronze = new THREE.MeshStandardMaterial({ color: 0xc8955a, metalness: 1, roughness: 0.28 });
  const rim = new THREE.MeshPhysicalMaterial({
    color: 0x0c0c0d,
    metalness: 0.7,
    roughness: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
  });
  const trimInner = new THREE.MeshStandardMaterial({
    color: 0x3b3733,
    roughness: 0.8,
    side: THREE.BackSide,
    envMapIntensity: 0.35,
  });
  const ledge = new THREE.MeshStandardMaterial({
    color: 0x4a453f,
    roughness: 0.6,
    side: THREE.DoubleSide,
    envMapIntensity: 0.35,
  });
  const jamb = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.6, side: THREE.DoubleSide });

  // Emissive light materials (HDR colours drive the bloom pass).
  const lampFront = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lampRear = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lampSide = new THREE.MeshBasicMaterial({ color: 0xffffff });

  return { paint, paintCut, glass, glassInside, satin, gloss, liner, rubber, bronze, rim, trimInner, ledge, jamb, lampFront, lampRear, lampSide };
}

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

const inDoorCols = (c) => c >= COL.doorFront && c < COL.doorRear;

function rowPoints(r, cFrom, cTo, offset = 0, transform = null) {
  const pts = [];
  for (let c = cFrom; c <= cTo; c++) {
    const p = gridPoint(r, c, offset);
    if (transform) transform(p, r, ((c % COLS) + COLS) % COLS);
    pts.push(p);
  }
  return pts;
}

function colPoints(c, rFrom, rTo, offset = 0, transform = null) {
  const pts = [];
  for (let r = rFrom; r <= rTo; r++) {
    const p = gridPoint(r, c, offset);
    if (transform) transform(p, r, c);
    pts.push(p);
  }
  return pts;
}

function tube(points, radius, material, closed = false, segs = 6) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  const g = new THREE.TubeGeometry(curve, Math.max(16, points.length * 2), radius, segs, closed);
  return new THREE.Mesh(g, material);
}

function shadows(obj, cast = true, receive = true) {
  obj.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = cast;
      o.receiveShadow = receive;
    }
  });
  return obj;
}

/* ------------------------------------------------------------------ */
/* body                                                               */
/* ------------------------------------------------------------------ */

function buildBody(M) {
  const g = new THREE.Group();
  g.name = 'body';
  const { sill, belt, glassTop, last } = ROWS;
  const doorCell = (r, c) => inDoorCols(c) && r >= sill;

  const lower = new THREE.Mesh(patch(0, belt, (r, c) => !doorCell(r, c)), M.paintCut);
  const glass = new THREE.Mesh(patch(belt, glassTop, (r, c) => !inDoorCols(c)), M.glass);
  const roof = new THREE.Mesh(patch(glassTop, last), M.paint);
  lower.name = 'lowerBody';
  glass.name = 'glass';
  glass.castShadow = false;
  g.add(shadows(lower), roof, glass);
  shadows(roof);

  // interior shell
  const innerLower = new THREE.Mesh(patch(sill, belt, (r, c) => !inDoorCols(c), -T), M.trimInner);
  const innerRoof = new THREE.Mesh(patch(glassTop, last, () => true, -T), null);
  innerRoof.name = 'headliner';
  // the cabin shell is lit by the cabin lights + bounce; sun shadows on it
  // only produce grazing-angle stair steps, so it opts out of them
  innerLower.receiveShadow = false;
  innerRoof.receiveShadow = false;
  g.add(innerLower, innerRoof);

  // window sill ledge (excluding door opening) and headliner edge (full loop)
  const beltOuter = rowPoints(belt, COL.doorRear, COL.doorFront + COLS);
  const beltInner = rowPoints(belt, COL.doorRear, COL.doorFront + COLS, -T);
  g.add(new THREE.Mesh(ribbon(beltOuter, beltInner), M.ledge));
  g.add(new THREE.Mesh(ribbon(rowPoints(glassTop, 0, COLS), rowPoints(glassTop, 0, COLS, -T)), M.ledge));

  // door aperture jambs
  const j = new THREE.Group();
  j.add(new THREE.Mesh(ribbon(rowPoints(sill, COL.doorFront, COL.doorRear), rowPoints(sill, COL.doorFront, COL.doorRear, -T)), M.jamb));
  j.add(new THREE.Mesh(ribbon(colPoints(COL.doorFront, sill, belt), colPoints(COL.doorFront, sill, belt, -T)), M.jamb));
  j.add(new THREE.Mesh(ribbon(colPoints(COL.doorRear, sill, belt), colPoints(COL.doorRear, sill, belt, -T)), M.jamb));
  g.add(j);

  return { group: g, innerRoof };
}

/* ------------------------------------------------------------------ */
/* glass pillars                                                      */
/* ------------------------------------------------------------------ */

function pillar(x, side, width, material) {
  const { belt, glassTop } = ROWS;
  const theta = thetaForX(x, side);
  const v = new THREE.Vector2();
  const n = new THREE.Vector2();
  const a = [];
  const b = [];
  for (let r = belt; r <= glassTop; r++) {
    const { d, y } = PROFILE.P[r];
    plan(theta, d, v);
    planNormal(v.x, v.y, d, n);
    const tx = -n.y;
    const tz = n.x;
    const o = 0.0035;
    a.push(new THREE.Vector3(v.x - tx * width * 0.5 + n.x * o, y, v.y - tz * width * 0.5 + n.y * o));
    b.push(new THREE.Vector3(v.x + tx * width * 0.5 + n.x * o, y, v.y + tz * width * 0.5 + n.y * o));
  }
  const m = new THREE.Mesh(ribbon(a, b), material);
  m.castShadow = true;
  return m;
}

/* ------------------------------------------------------------------ */
/* doors                                                              */
/* ------------------------------------------------------------------ */

function buildDoor(M, cA, cB, dir) {
  const { sill, belt, glassTop } = ROWS;
  const gap = 0.0045;
  const xA = gridPoint(belt, cA).x;
  const xB = gridPoint(belt, cB).x;
  const transform = (v, r, c) => {
    if (c === cA) v.x += Math.sign(xB - xA) * gap;
    if (c === cB) v.x -= Math.sign(xB - xA) * gap;
    if (r === sill) v.y += gap;
    if (r === glassTop) v.y -= gap;
  };
  const inCols = (r, c) => c >= cA && c < cB;
  const g = new THREE.Group();
  g.name = 'door';
  const skin = new THREE.Mesh(patch(sill, belt, inCols, 0, transform), M.paint);
  const glass = new THREE.Mesh(patch(belt, glassTop, inCols, 0, transform), M.glass);
  const inner = new THREE.Mesh(patch(sill, belt, inCols, -T, transform), M.trimInner);
  shadows(skin);
  g.add(skin, glass, inner);
  // edges
  const e = (a, b, mat = M.jamb) => g.add(new THREE.Mesh(ribbon(a, b), mat));
  e(rowPoints(sill, cA, cB, 0, transform), rowPoints(sill, cA, cB, -T, transform));
  e(colPoints(cA, sill, belt, 0, transform), colPoints(cA, sill, belt, -T, transform));
  e(colPoints(cB, sill, belt, 0, transform), colPoints(cB, sill, belt, -T, transform));
  e(rowPoints(belt, cA, cB, 0, transform), rowPoints(belt, cA, cB, -T, transform), M.ledge);
  // glass edge pillars on the door
  const xs = [xA, xB].sort((a, b) => a - b);
  g.add(pillar(xs[0] + 0.012, 1, 0.024, M.gloss));
  g.add(pillar(xs[1] - 0.012, 1, 0.024, M.gloss));
  // flush handle light
  const hx = dir > 0 ? xs[0] + 0.07 : xs[1] - 0.07;
  const hz = sideZ(hx, 1.0);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.16, 0.01), M.lampSide);
  handle.position.set(hx, 1.0, hz + 0.002);
  handle.name = 'handleLight';
  g.add(handle);
  g.userData = { dir };
  return g;
}

/* ------------------------------------------------------------------ */
/* wheel arches                                                       */
/* ------------------------------------------------------------------ */

function archRange() {
  const s = (0.305 - WHEEL.y) / WHEEL.well;
  const a0 = Math.asin(Math.max(-1, s));
  return [a0, Math.PI - a0];
}

function buildArch(M, sx, sz) {
  const g = new THREE.Group();
  const [a0, a1] = archRange();
  const steps = 48;
  const surf = (R, out, sink = 0) => {
    const pts = [];
    const n = new THREE.Vector2();
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (a1 - a0) * (i / steps);
      const x = sx * WHEEL.x + Math.cos(a) * R;
      const y = WHEEL.y + Math.sin(a) * R;
      const yy = Math.max(y, 0.31);
      const d = dAtY(yy);
      const z = sideZ(x, yy);
      planNormal(x, z, d, n);
      pts.push(new THREE.Vector3(x + n.x * (out - sink), y, sz * (z + n.y * (out - sink))));
    }
    return pts;
  };
  // liner (wheel house)
  const lin = [];
  const linIn = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (a1 - a0) * (i / steps);
    const x = sx * WHEEL.x + Math.cos(a) * WHEEL.well;
    const y = WHEEL.y + Math.sin(a) * WHEEL.well;
    lin.push(new THREE.Vector3(x, y, sz * (sideZ(x, Math.max(y, 0.31)) - 0.004)));
    linIn.push(new THREE.Vector3(x, y, sz * 0.5));
  }
  g.add(new THREE.Mesh(ribbon(lin, linIn), M.liner));
  // sculpted flare lip
  const R = WHEEL.well;
  const L0 = surf(R, -0.004);
  const L1 = surf(R, 0.022);
  const L2 = surf(R + 0.05, 0.02);
  const L3 = surf(R + 0.085, 0.0, 0.002);
  const flare = new THREE.Group();
  flare.add(new THREE.Mesh(ribbon(L0, L1), M.satin));
  flare.add(new THREE.Mesh(ribbon(L1, L2), M.satin));
  flare.add(new THREE.Mesh(ribbon(L2, L3), M.satin));
  flare.children.forEach((m) => (m.material = M.satin));
  g.add(shadows(flare));
  M.satin.side = THREE.DoubleSide;
  return g;
}

/* ------------------------------------------------------------------ */
/* wheels                                                             */
/* ------------------------------------------------------------------ */

function buildWheel(M) {
  const g = new THREE.Group();
  const spin = new THREE.Group();
  g.add(spin);
  const w = WHEEL.width / 2;
  const R = WHEEL.r;
  const tyreProfile = [
    [0.285, -w + 0.01],
    [0.33, -w],
    [0.37, -w + 0.004],
    [0.392, -w + 0.022],
    [R, -w + 0.06],
    [R, w - 0.06],
    [0.392, w - 0.022],
    [0.37, w - 0.004],
    [0.33, w],
    [0.285, w - 0.01],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const tyre = new THREE.Mesh(new THREE.LatheGeometry(tyreProfile, 72), M.rubber);
  tyre.rotation.x = Math.PI / 2;
  spin.add(tyre);
  // tread grooves
  for (const y of [-0.06, 0, 0.06]) {
    const groove = new THREE.Mesh(new THREE.TorusGeometry(R - 0.001, 0.004, 4, 96), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 }));
    groove.position.z = y;
    spin.add(groove);
  }
  // aero disc (concave)
  const disc = [
    [0.0, w - 0.035],
    [0.06, w - 0.035],
    [0.1, w - 0.045],
    [0.2, w - 0.035],
    [0.265, w - 0.012],
    [0.288, w - 0.008],
    [0.288, -w + 0.02],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const discMesh = new THREE.Mesh(new THREE.LatheGeometry(disc, 72), M.rim);
  discMesh.rotation.x = Math.PI / 2;
  spin.add(discMesh);
  // bronze rings
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.262, 0.005, 8, 96), M.bronze);
  ring1.position.z = w - 0.012;
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.003, 8, 96), M.bronze);
  ring2.position.z = w - 0.04;
  spin.add(ring1, ring2);
  // turbine vanes
  const vaneGeo = new THREE.BoxGeometry(0.1, 0.012, 0.012);
  for (let i = 0; i < 10; i++) {
    const v = new THREE.Mesh(vaneGeo, M.satin);
    const a = (i / 10) * Math.PI * 2;
    v.position.set(Math.cos(a) * 0.215, Math.sin(a) * 0.215, w - 0.032);
    v.rotation.z = a + 0.5;
    spin.add(v);
  }
  // hub cap
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.02, 40), M.gloss);
  cap.rotation.x = Math.PI / 2;
  cap.position.z = w - 0.028;
  const capRing = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.003, 6, 48), M.bronze);
  capRing.position.z = w - 0.018;
  spin.add(cap, capRing);
  // brake disc peeking through
  const brake = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 48), new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.8, roughness: 0.4 }));
  brake.rotation.x = Math.PI / 2;
  brake.position.z = -0.02;
  g.add(brake);
  shadows(g);
  return { group: g, spin };
}

/* ------------------------------------------------------------------ */
/* lights / details                                                   */
/* ------------------------------------------------------------------ */

function buildLights(M) {
  const g = new THREE.Group();
  const tFront = thetaForX(2.12, 1);
  const tRear = thetaForX(-2.1, 1);
  // lamp bands (black glass housings)
  const band = (t0, t1, y0, y1) =>
    new THREE.Mesh(ribbon(outlineAt(y0, t0, t1, 80, 0.0025), outlineAt(y1, t0, t1, 80, 0.0025)), M.gloss);
  g.add(band(-tFront - 0.02, tFront + 0.02, 0.94, 1.04));
  g.add(band(tRear - 0.02, Math.PI * 2 - tRear + 0.02, 0.92, 1.04));
  // front: twin warm-white light lines
  g.add(tube(outlineAt(1.012, -tFront, tFront, 80, 0.008), 0.0065, M.lampFront));
  g.add(tube(outlineAt(0.982, -tFront * 0.985, tFront * 0.985, 80, 0.008), 0.0055, M.lampFront));
  // rear: twin red lines
  g.add(tube(outlineAt(1.0, tRear, Math.PI * 2 - tRear, 80, 0.008), 0.0065, M.lampRear));
  g.add(tube(outlineAt(0.972, tRear + 0.004, Math.PI * 2 - tRear - 0.004, 80, 0.008), 0.0065, M.lampRear));
  // side sill accent lines
  const s0 = thetaForX(1.2, 1);
  const s1 = thetaForX(-1.2, 1);
  g.add(tube(outlineAt(0.47, s0, s1, 60, 0.01), 0.0075, M.lampSide));
  g.add(tube(outlineAt(0.47, Math.PI * 2 - s1, Math.PI * 2 - s0, 60, 0.01), 0.0075, M.lampSide));
  // rear lower reflectors
  for (const sz of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.012, 0.16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.02, 0.01) }));
    r.position.set(-DIM.A + dAtY(0.42) - 0.006, 0.42, sz * 0.6);
    g.add(r);
  }
  return g;
}

function buildBadges() {
  const g = new THREE.Group();
  const t = badgeTexture('AURA');
  const mat = new THREE.MeshStandardMaterial({ map: t, transparent: true, metalness: 0.9, roughness: 0.25, depthWrite: false });
  const geo = new THREE.PlaneGeometry(0.34, 0.085);
  const f = new THREE.Mesh(geo, mat);
  f.position.set(DIM.A - dAtY(0.78) + 0.003, 0.78, 0);
  f.rotation.y = Math.PI / 2;
  const r = new THREE.Mesh(geo, mat);
  r.position.set(-DIM.A + dAtY(0.78) - 0.003, 0.78, 0);
  r.rotation.y = -Math.PI / 2;
  g.add(f, r);
  return g;
}

function buildRoofSensors(M) {
  const g = new THREE.Group();
  const top = PROFILE.P[ROWS.last].y;
  const pod = new THREE.Mesh(roundedSlab(0.95, 0.07, 0.9, 0.045), M.gloss);
  pod.position.set(1.15, top + 0.01, 0);
  const podBase = new THREE.Mesh(roundedSlab(0.99, 0.02, 0.94, 0.05), M.satin);
  podBase.position.set(1.15, top - 0.005, 0);
  const lidar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.07, 48), M.gloss);
  lidar.position.set(1.42, top + 0.115, 0);
  const lidarBand = new THREE.Mesh(new THREE.CylinderGeometry(0.0755, 0.0755, 0.025, 48, 1, true), M.satin);
  lidarBand.position.copy(lidar.position);
  const status = new THREE.Mesh(new THREE.TorusGeometry(0.0758, 0.0025, 6, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.6, 2.2) }));
  status.rotation.x = Math.PI / 2;
  status.position.copy(lidar.position).add(new THREE.Vector3(0, -0.03, 0));
  status.name = 'lidarStatus';
  g.add(pod, podBase, lidar, lidarBand, status);
  // corner cameras
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cam = new THREE.Mesh(new THREE.SphereGeometry(0.03, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.gloss);
      cam.position.set(sx * 2.05, top - 0.05, sz * 0.62);
      g.add(cam);
    }
  }
  return shadows(g, true, false);
}

function roundedSlab(w, h, d, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const z = -d / 2;
  s.moveTo(x + r, z);
  s.lineTo(x + w - r, z);
  s.quadraticCurveTo(x + w, z, x + w, z + r);
  s.lineTo(x + w, z + d - r);
  s.quadraticCurveTo(x + w, z + d, x + w - r, z + d);
  s.lineTo(x + r, z + d);
  s.quadraticCurveTo(x, z + d, x, z + d - r);
  s.lineTo(x, z + r);
  s.quadraticCurveTo(x, z, x + r, z);
  const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: h * 0.4, bevelSize: Math.min(r * 0.5, h * 0.4), bevelSegments: 4, curveSegments: 12 });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, h, 0);
  return geo;
}

/* ------------------------------------------------------------------ */
/* assemble                                                           */
/* ------------------------------------------------------------------ */

export function buildVan() {
  const M = makeMaterials();
  const van = new THREE.Group();
  van.name = 'van';
  const chassis = new THREE.Group(); // bounces / pitches when driving
  van.add(chassis);

  const body = buildBody(M);
  chassis.add(body.group);

  // pillars between glass panels
  for (const x of [1.78, -1.78]) {
    chassis.add(pillar(x, 1, 0.03, M.gloss));
    chassis.add(pillar(x, -1, 0.03, M.gloss));
  }
  for (const x of [DOOR.front, 0, DOOR.rear]) chassis.add(pillar(x, -1, 0.03, M.gloss));

  // doors
  const doorFront = buildDoor(M, COL.doorFront, COL.doorMid, 1);
  const doorRear = buildDoor(M, COL.doorMid, COL.doorRear, -1);
  chassis.add(doorFront, doorRear);

  // arches
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) chassis.add(buildArch(M, sx, sz));

  chassis.add(buildLights(M));
  chassis.add(buildBadges());
  chassis.add(buildRoofSensors(M));

  // interior
  const interior = buildInterior({ innerRoof: body.innerRoof });
  chassis.add(interior.group);

  // wheels (not part of the bouncing chassis)
  const wheels = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const w = buildWheel(M);
      w.group.position.set(sx * WHEEL.x, WHEEL.y, sz * WHEEL.track);
      if (sz < 0) w.group.rotation.y = Math.PI;
      w.sign = sz;
      van.add(w.group);
      wheels.push(w);
    }
  }

  // headlight beam (used at dusk / night)
  const head = new THREE.SpotLight(0xfff1dc, 0, 40, 0.55, 0.65, 1.4);
  head.position.set(2.5, 1.0, 0);
  head.target.position.set(12, 0, 0);
  van.add(head, head.target);
  const tail = new THREE.PointLight(0xff2010, 0, 4, 2);
  tail.position.set(-2.75, 0.9, 0);
  van.add(tail);

  const state = {
    doorT: 0,
    doorTarget: 0,
    lightsOn: true,
    lightLevel: 1,
    wheelAngle: 0,
    nightFactor: 0,
  };

  const lampColors = {
    front: new THREE.Color(1.0, 0.82, 0.62),
    rear: new THREE.Color(1.0, 0.04, 0.015),
    side: new THREE.Color(1.0, 0.56, 0.24),
  };

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const smooth = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  function update(dt, { speed = 0, time = 0 } = {}) {
    // doors
    const dir = Math.sign(state.doorTarget - state.doorT);
    state.doorT = THREE.MathUtils.clamp(state.doorT + dir * dt / 1.6, 0, 1);
    const t = ease(state.doorT);
    for (const d of [doorFront, doorRear]) {
      d.position.z = smooth(0, 0.28, t) * 0.07;
      d.position.x = smooth(0.22, 1, t) * 0.73 * d.userData.dir;
    }
    // lights
    const target = state.lightsOn ? 1 : 0;
    state.lightLevel += (target - state.lightLevel) * Math.min(1, dt * 6);
    const pulse = 1 + Math.sin(time * 2.2) * 0.04;
    const k = state.lightLevel;
    M.lampFront.color.copy(lampColors.front).multiplyScalar(0.05 + k * (5 + state.nightFactor * 2));
    M.lampRear.color.copy(lampColors.rear).multiplyScalar(0.04 + k * 7);
    M.lampSide.color.copy(lampColors.side).multiplyScalar(0.03 + k * 2.2 * pulse);
    head.intensity = k * state.nightFactor * 60;
    tail.intensity = k * (0.08 + state.nightFactor * 0.5);
    // wheels
    state.wheelAngle -= (speed / WHEEL.r) * dt;
    for (const w of wheels) w.spin.rotation.z = state.wheelAngle * w.sign;
    // chassis motion
    if (speed > 0.1) {
      const amp = Math.min(1, speed / 15);
      chassis.position.y = Math.sin(time * 9.1) * 0.0025 * amp + Math.sin(time * 3.3) * 0.003 * amp;
      chassis.rotation.z = Math.sin(time * 2.1) * 0.0015 * amp - 0.0015 * amp;
      chassis.rotation.x = Math.sin(time * 1.7) * 0.001 * amp;
    } else {
      chassis.position.y *= 0.9;
      chassis.rotation.z *= 0.9;
      chassis.rotation.x *= 0.9;
    }
    interior.update(dt, time);
  }

  const glassMeshes = [];
  van.traverse((o) => o.isMesh && o.material === M.glass && glassMeshes.push(o));
  let inside = false;

  return {
    group: van,
    state,
    setCameraInside(v) {
      if (v === inside) return;
      inside = v;
      glassMeshes.forEach((m) => (m.material = v ? M.glassInside : M.glass));
    },
    interior,
    materials: M,
    update,
    setDoors(open) {
      state.doorTarget = open ? 1 : 0;
    },
    toggleDoors() {
      state.doorTarget = state.doorTarget > 0.5 ? 0 : 1;
      return state.doorTarget > 0.5;
    },
    setNight(f) {
      state.nightFactor = f;
    },
  };
}
