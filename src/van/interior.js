import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { DIM, innerOutline } from './shape.js';
import { woodFloorTexture, fabricTexture, leatherNormal, screenTexture } from '../textures.js';

const T = DIM.shell;
export const FLOOR_Y = DIM.sill + 0.006;
const PLINTH_TOP = 0.86;
const PLINTH_X = 1.12;

export const MOODS = {
  warm: new THREE.Color(1.0, 0.55, 0.24),
  ice: new THREE.Color(0.35, 0.68, 1.0),
  violet: new THREE.Color(0.62, 0.3, 1.0),
  off: new THREE.Color(0, 0, 0),
};

function makeMaterials() {
  const leatherN = leatherNormal();
  const leather = new THREE.MeshPhysicalMaterial({
    color: 0xc9a27a,
    roughness: 0.5,
    sheen: 0.4,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(0xffe6c8),
    normalMap: leatherN,
    normalScale: new THREE.Vector2(0.25, 0.25),
    envMapIntensity: 0.4,
  });
  const leatherDark = leather.clone();
  leatherDark.color.set(0x8a6544);
  const shell = new THREE.MeshPhysicalMaterial({
    color: 0x1a1918,
    roughness: 0.35,
    metalness: 0.2,
    clearcoat: 0.6,
    envMapIntensity: 0.5,
  });
  const headliner = new THREE.MeshStandardMaterial({
    map: fabricTexture('#b9b1a5'),
    roughness: 0.95,
    side: THREE.BackSide,
    envMapIntensity: 0.25,
  });
  const floor = new THREE.MeshStandardMaterial({
    map: woodFloorTexture(),
    roughness: 0.45,
    metalness: 0,
    envMapIntensity: 0.35,
  });
  const plinth = new THREE.MeshStandardMaterial({ color: 0x2c2926, roughness: 0.7, envMapIntensity: 0.3 });
  const plinthTop = new THREE.MeshStandardMaterial({ map: fabricTexture('#3a3631'), roughness: 0.9, envMapIntensity: 0.3 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xb38a5c, metalness: 1, roughness: 0.3 });
  const tableTop = new THREE.MeshPhysicalMaterial({ color: 0x15130f, roughness: 0.15, clearcoat: 1, metalness: 0.1 });
  const mood = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const ceilingLight = new THREE.MeshBasicMaterial({ color: 0xffffff });
  return { leather, leatherDark, shell, headliner, floor, plinth, plinthTop, metal, tableTop, mood, ceilingLight };
}

function shapeFromOutline(pts) {
  const s = new THREE.Shape();
  pts.forEach((p, i) => (i ? s.lineTo(p.x, -p.y) : s.moveTo(p.x, -p.y)));
  return s;
}

/** Region of the inner outline beyond |x| > x0 on one end (sx = +1 front, -1 rear). */
function endShape(y, inset, sx, x0) {
  const out = innerOutline(y, inset, 400).filter((p) => p.x * sx > x0);
  out.sort((a, b) => Math.atan2(a.y, a.x * sx) - Math.atan2(b.y, b.x * sx));
  const s = new THREE.Shape();
  s.moveTo(sx * x0, -out[0].y);
  out.forEach((p) => s.lineTo(p.x, -p.y));
  s.lineTo(sx * x0, -out[out.length - 1].y);
  s.closePath();
  return s;
}

function seat(Mi) {
  const g = new THREE.Group();
  // shell
  const base = new THREE.Mesh(new RoundedBoxGeometry(0.52, 0.06, 0.5, 4, 0.025), Mi.shell);
  base.position.set(0, 0.03, 0);
  // cushion with channels
  const cushion = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.12, 0.48, 5, 0.05), Mi.leather);
  cushion.position.set(0.02, 0.11, 0);
  // backrest assembly (tilted)
  const back = new THREE.Group();
  back.position.set(-0.22, 0.12, 0);
  back.rotation.z = 0.2;
  const backShell = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.7, 0.52, 5, 0.035), Mi.shell);
  backShell.position.set(-0.04, 0.36, 0);
  const backPad = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.6, 0.46, 6, 0.045), Mi.leather);
  backPad.position.set(0.02, 0.36, 0);
  // stitched channels
  for (const z of [-0.08, 0.08]) {
    const ch = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.5, 0.006), Mi.leatherDark);
    ch.position.set(0.072, 0.36, z);
    back.add(ch);
  }
  const head = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.16, 0.3, 5, 0.04), Mi.leather);
  head.position.set(0.0, 0.8, 0);
  const headStem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 10), Mi.metal);
  headStem.position.set(-0.02, 0.69, 0);
  back.add(backShell, backPad, head, headStem);
  g.add(base, cushion, back);
  for (const z of [-1, 1]) {
    const cch = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.004, 0.006), Mi.leatherDark);
    cch.position.set(0.03, 0.171, z * 0.08);
    g.add(cch);
  }
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

function seatRow(Mi, sx) {
  const g = new THREE.Group();
  const zs = [-0.56, 0, 0.56];
  zs.forEach((z) => {
    const s = seat(Mi);
    s.position.set(0, 0, z);
    g.add(s);
  });
  // armrests between seats
  for (const z of [-0.28, 0.28]) {
    const arm = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.07, 0.07, 4, 0.03), Mi.shell);
    arm.position.set(-0.02, 0.32, z);
    g.add(arm);
  }
  g.position.set(sx * 1.6, PLINTH_TOP, 0);
  g.rotation.y = sx > 0 ? Math.PI : 0;
  return g;
}

export function buildInterior({ innerRoof }) {
  const Mi = makeMaterials();
  const g = new THREE.Group();
  g.name = 'interior';
  innerRoof.material = Mi.headliner;

  // floor
  const floorShape = shapeFromOutline(innerOutline(DIM.sill, T - 0.008, 240));
  const floorGeo = new THREE.ShapeGeometry(floorShape, 2);
  floorGeo.rotateX(-Math.PI / 2);
  // uv in metres
  const pos = floorGeo.getAttribute('position');
  const uv = floorGeo.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) * 0.5, pos.getZ(i) * 0.5);
  const floor = new THREE.Mesh(floorGeo, Mi.floor);
  floor.position.y = FLOOR_Y;
  floor.receiveShadow = true;
  g.add(floor);

  // seat plinths (also hide the wheel houses)
  for (const sx of [-1, 1]) {
    const shape = endShape(PLINTH_TOP - 0.06, T + 0.002, sx, PLINTH_X);
    const h = PLINTH_TOP - FLOOR_Y;
    const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 4 });
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, [Mi.plinthTop, Mi.plinth]);
    m.position.y = FLOOR_Y;
    m.receiveShadow = true;
    g.add(m);
    // toe-kick glow
    const kick = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.012, 1.6), Mi.mood);
    kick.position.set(sx * (PLINTH_X - 0.004), FLOOR_Y + 0.03, 0);
    g.add(kick);
    // lip
    const lip = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.03, 1.7, 3, 0.012), Mi.shell);
    lip.position.set(sx * (PLINTH_X + 0.005), PLINTH_TOP - 0.01, 0);
    g.add(lip);
    g.add(seatRow(Mi, sx));
  }

  // cove light ring under the headliner edge and floor wash
  const ring = (y, inset, r) => {
    const pts = innerOutline(y, inset, 160).map((p) => new THREE.Vector3(p.x, y, p.y));
    const curve = new THREE.CatmullRomCurve3(pts, true);
    return new THREE.Mesh(new THREE.TubeGeometry(curve, 320, r, 6, true), Mi.mood);
  };
  g.add(ring(DIM.glassTop - 0.014, T + 0.014, 0.0075));
  g.add(ring(FLOOR_Y + 0.014, T + 0.006, 0.0075));

  // ceiling light strips
  const roofY = 2.45 - T;
  for (const z of [-0.42, 0.42]) {
    const strip = new THREE.Mesh(new RoundedBoxGeometry(3.4, 0.012, 0.035, 2, 0.005), Mi.ceilingLight);
    strip.position.set(0, roofY - 0.012, z);
    g.add(strip);
  }

  // table
  const table = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.025, 64), Mi.tableTop);
  top.position.y = 0.72;
  const edge = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.004, 6, 96), Mi.mood);
  edge.rotation.x = Math.PI / 2;
  edge.position.y = 0.708;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.7, 24), Mi.metal);
  stem.position.y = 0.36;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.015, 48), Mi.metal);
  foot.position.y = 0.008;
  table.add(top, edge, stem, foot);
  table.position.set(0, FLOOR_Y, -0.5);
  table.traverse((o) => o.isMesh && ((o.castShadow = true), (o.receiveShadow = true)));
  g.add(table);

  // ceiling display (double sided)
  const scr = screenTexture();
  const screenMat = new THREE.MeshBasicMaterial({ map: scr.texture, toneMapped: true });
  screenMat.color.setScalar(1.25);
  const display = new THREE.Group();
  const bezel = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.34, 0.6, 3, 0.012), Mi.shell);
  display.add(bezel);
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.315), screenMat);
    p.position.x = s * 0.0155;
    p.rotation.y = s * Math.PI / 2;
    display.add(p);
  }
  const mount = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 0.06), Mi.shell);
  mount.position.y = 0.26;
  display.add(mount);
  display.position.set(0, roofY - 0.37, -0.25);
  g.add(display);

  // grab rail along the door side ceiling
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.3, 16), Mi.metal);
  rail.rotation.z = Math.PI / 2;
  rail.position.set(0, roofY - 0.1, 0.62);
  g.add(rail);
  for (const x of [-0.6, 0.6]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 10), Mi.metal);
    post.position.set(x, roofY - 0.05, 0.62);
    g.add(post);
  }

  // cabin lights
  const lights = [];
  for (const x of [-1.1, 0, 1.1]) {
    const l = new THREE.PointLight(0xffd2a0, 0, 3.6, 1.6);
    l.position.set(x, 2.15, 0);
    g.add(l);
    lights.push(l);
  }
  const moodLight = new THREE.PointLight(0xffffff, 0, 3, 1.5);
  moodLight.position.set(0, 0.8, 0);
  g.add(moodLight);

  const state = { mood: 'warm', moodColor: MOODS.warm.clone(), cabin: 1, cabinTarget: 1, eta: 6, progress: 0.35 };
  let screenTimer = 0;

  function update(dt, time) {
    state.moodColor.lerp(MOODS[state.mood], Math.min(1, dt * 4));
    state.cabin += (state.cabinTarget - state.cabin) * Math.min(1, dt * 4);
    const breathe = 1 + Math.sin(time * 1.4) * 0.05;
    Mi.mood.color.copy(state.moodColor).multiplyScalar(2.2 * breathe);
    Mi.ceilingLight.color.setRGB(1.0, 0.86, 0.68).multiplyScalar(0.3 + state.cabin * 1.6);
    lights.forEach((l) => (l.intensity = state.cabin * 0.9));
    moodLight.color.copy(state.moodColor);
    moodLight.intensity = state.mood === 'off' ? 0 : 0.6;
    screenTimer += dt;
    if (screenTimer > 0.5) {
      screenTimer = 0;
      state.progress = (state.progress + 0.004) % 1;
      state.eta = Math.max(1, Math.round(8 - state.progress * 8));
      scr.update(state.progress, state.eta);
    }
  }

  return {
    group: g,
    state,
    update,
    setMood(m) {
      state.mood = m;
    },
    setCabin(on) {
      state.cabinTarget = on ? 1 : 0;
    },
  };
}
