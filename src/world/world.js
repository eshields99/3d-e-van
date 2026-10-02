import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { asphaltTextures, concreteTexture, grassTexture, buildingTexture, rng } from '../textures.js';

const LOOP = 360; // length of the repeating street segment (m)

export const PRESETS = {
  golden: {
    label: 'Golden hour',
    elevation: 3.2,
    azimuth: 250,
    turbidity: 9,
    rayleigh: 2.4,
    mie: 0.006,
    mieG: 0.86,
    sun: 0xffa45c,
    sunIntensity: 3.4,
    hemiSky: 0xffd2a6,
    hemiGround: 0x2a1d14,
    hemi: 0.55,
    fill: 0.6,
    exposure: 1.25,
    skyGain: 0.42,
    fog: 0xa47f68,
    fogDensity: 0.0022,
    mountains: [0x6e5a63, 0x4a3c44],
    windows: 0.22,
    street: 0,
    night: 0.15,
    stars: 0,
    clouds: 0.45,
  },
  blue: {
    label: 'Blue hour',
    elevation: -2.2,
    azimuth: 250,
    turbidity: 3,
    rayleigh: 3.2,
    mie: 0.004,
    mieG: 0.8,
    sun: 0x9db4ff,
    sunIntensity: 0.35,
    hemiSky: 0x6f84c4,
    hemiGround: 0x15161c,
    hemi: 0.75,
    fill: 0.35,
    exposure: 1.6,
    fog: 0x3f4b66,
    fogDensity: 0.005,
    mountains: [0x2c3550, 0x1c2238],
    windows: 0.7,
    street: 1,
    night: 0.65,
    stars: 0.25,
    clouds: 0.3,
  },
  night: {
    label: 'Night',
    elevation: -14,
    azimuth: 250,
    turbidity: 2,
    rayleigh: 1,
    mie: 0.003,
    mieG: 0.8,
    sun: 0x8ea6ff,
    sunIntensity: 0.28,
    hemiSky: 0x2a3560,
    hemiGround: 0x07080c,
    hemi: 0.45,
    fill: 0.18,
    exposure: 2.2,
    fog: 0x0b1020,
    fogDensity: 0.0055,
    mountains: [0x0d1222, 0x080b16],
    windows: 0.9,
    street: 1.6,
    night: 1,
    stars: 1,
    clouds: 0.15,
  },
};

/* ------------------------------------------------------------------ */
/* geometry builders                                                  */
/* ------------------------------------------------------------------ */

function leafTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const r = rng(99);
  for (let i = 0; i < 70; i++) {
    const x = 30 + r() * (S - 60);
    const y = 30 + r() * (S - 60);
    const a = r() * Math.PI * 2;
    const l = 14 + r() * 16;
    g.save();
    g.translate(x, y);
    g.rotate(a);
    const v = 0.55 + r() * 0.45;
    g.fillStyle = `rgb(${Math.round(120 * v)},${Math.round(150 * v)},${Math.round(90 * v)})`;
    g.beginPath();
    g.ellipse(0, 0, l, l * 0.45, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  // solid texel used by the crown core
  g.fillStyle = 'rgb(100,125,75)';
  g.fillRect(0, 0, 8, 8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Stylised tree crown: leaf cards scattered over a few volumes, with radial normals for soft lighting. */
function foliage(seed, columnar = false) {
  const r = rng(seed);
  const volumes = [];
  const blobs = columnar ? 6 : 7;
  for (let i = 0; i < blobs; i++) {
    if (columnar) {
      const t = i / (blobs - 1);
      const s = 1.2 - t * 0.6;
      volumes.push({ c: new THREE.Vector3((r() - 0.5) * 0.4, 2.6 + t * 5.0, (r() - 0.5) * 0.4), s: new THREE.Vector3(s, s * 1.5, s) });
    } else {
      const s = 1.3 + r() * 0.9;
      const a = r() * Math.PI * 2;
      const rad = i === 0 ? 0 : 1.1 + r() * 1.2;
      volumes.push({ c: new THREE.Vector3(Math.cos(a) * rad, 4.8 + r() * 2.0, Math.sin(a) * rad), s: new THREE.Vector3(s, s * 0.85, s) });
    }
  }
  const crownC = new THREE.Vector3();
  volumes.forEach((v) => crownC.add(v.c));
  crownC.divideScalar(volumes.length);
  let minY = Infinity;
  let maxY = -Infinity;
  volumes.forEach((v) => {
    minY = Math.min(minY, v.c.y - v.s.y);
    maxY = Math.max(maxY, v.c.y + v.s.y);
  });

  const pos = [];
  const nor = [];
  const uv = [];
  const col = [];
  const base = new THREE.Color().setHSL(0.22 + r() * 0.05, 0.35 + r() * 0.15, 0.2 + r() * 0.05);
  const cards = columnar ? 320 : 420;
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const corners = [
    [-0.5, -0.5, 0, 0],
    [0.5, -0.5, 1, 0],
    [0.5, 0.5, 1, 1],
    [-0.5, 0.5, 0, 1],
  ];
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  for (let k = 0; k < cards; k++) {
    const v = volumes[Math.floor(r() * volumes.length)];
    // point near the surface of the ellipsoid
    n.set(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize();
    const depth = 0.75 + r() * 0.3;
    p.set(n.x * v.s.x, n.y * v.s.y, n.z * v.s.z).multiplyScalar(depth).add(v.c);
    const size = 0.9 + r() * 0.8;
    e.set(r() * Math.PI, r() * Math.PI, r() * Math.PI);
    q.setFromEuler(e);
    const radial = p.clone().sub(crownC).normalize();
    const t = (p.y - minY) / (maxY - minY);
    const shade = 0.45 + t * 0.6 + (depth - 0.9) * 0.6;
    const c = base.clone().multiplyScalar(shade);
    const quad = corners.map(([x, y, u, w]) => {
      tmp.set(x * size, y * size, 0).applyQuaternion(q).add(p);
      return [tmp.x, tmp.y, tmp.z, u, w];
    });
    for (const idx of [0, 1, 2, 0, 2, 3]) {
      const [x, y, z, u, w] = quad[idx];
      pos.push(x, y, z);
      nor.push(radial.x, radial.y, radial.z);
      uv.push(u, w);
      col.push(c.r, c.g, c.b);
    }
  }
  // dense core so the crown never looks hollow
  const coreParts = volumes.map((v) => {
    const g = new THREE.IcosahedronGeometry(1, 2);
    g.scale(v.s.x * 0.78, v.s.y * 0.78, v.s.z * 0.78);
    g.translate(v.c.x, v.c.y, v.c.z);
    return g;
  });
  for (const g of coreParts) {
    const gp = g.getAttribute('position');
    for (let k = 0; k < gp.count; k++) {
      p.fromBufferAttribute(gp, k);
      const radial = p.clone().sub(crownC).normalize();
      pos.push(p.x, p.y, p.z);
      nor.push(radial.x, radial.y, radial.z);
      uv.push(0.01, 0.99); // solid texel
      const t = (p.y - minY) / (maxY - minY);
      const c = base.clone().multiplyScalar(0.3 + t * 0.3);
      col.push(c.r, c.g, c.b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

function mountainRing(radius, minH, maxH, seed, color) {
  const r = rng(seed);
  const N = 320;
  const heights = [];
  let h = (minH + maxH) / 2;
  for (let i = 0; i < N; i++) {
    h += (r() - 0.5) * (maxH - minH) * 0.18;
    h = THREE.MathUtils.clamp(h, minH, maxH);
    heights.push(h);
  }
  // smooth + close the loop
  const sm = heights.map((_, i) => {
    let s = 0;
    for (let k = -3; k <= 3; k++) s += heights[(i + k + N) % N];
    return s / 7;
  });
  const pos = [];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    pos.push(x, -20, z, x, sm[i % N], z);
  }
  const idx = [];
  for (let i = 0; i < N; i++) {
    const p = i * 2;
    idx.push(p, p + 2, p + 1, p + 1, p + 2, p + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, fog: false, side: THREE.DoubleSide }));
  return m;
}

function lightPoolTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

/* ------------------------------------------------------------------ */
/* world                                                              */
/* ------------------------------------------------------------------ */

export function buildWorld(scene, renderer) {
  const world = new THREE.Group();
  world.name = 'world';
  scene.add(world);
  const movers = []; // { obj, baseX }
  const instMovers = []; // { mesh, items:[{x,y,z,rot,s}] }

  /* sky */
  const sky = new Sky();
  sky.scale.setScalar(2600);
  scene.add(sky);
  const U = sky.material.uniforms;
  // keep the HDR sky (and sun disc) in a range the bloom pass can live with
  U.skyGain = { value: 1 };
  U.skyClamp = { value: 4 };
  sky.material.fragmentShader = sky.material.fragmentShader
    .replace('uniform float showSunDisc;', 'uniform float showSunDisc;\nuniform float skyGain;\nuniform float skyClamp;')
    .replace('gl_FragColor = vec4( texColor, 1.0 );', 'gl_FragColor = vec4( min( texColor * skyGain, vec3( skyClamp ) ), 1.0 );');

  /* lights */
  const hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 0.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera;
  sc.left = -16;
  sc.right = 16;
  sc.top = 16;
  sc.bottom = -16;
  sc.near = 1;
  sc.far = 120;
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  // soft key/fill from the viewer's side so the black body reads in silhouette
  const fill = new THREE.DirectionalLight(0xbcd0ff, 0.5);
  fill.position.set(30, 18, 40);
  scene.add(fill);

  /* ground */
  const grassTex = grassTexture();
  grassTex.repeat.set(160, 160);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 1600),
    new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1, color: 0x9aa088 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  world.add(ground);

  /* road */
  const asphalt = asphaltTextures();
  const roadLen = 1600;
  const roadW = 10.5;
  asphalt.map.repeat.set(roadLen / 9, roadW / 9);
  asphalt.roughnessMap.repeat.copy(asphalt.map.repeat);
  const roadMat = new THREE.MeshStandardMaterial({
    map: asphalt.map,
    roughnessMap: asphalt.roughnessMap,
    roughness: 0.78,
    metalness: 0.0,
    envMapIntensity: 1.4,
  });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, roadW), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.receiveShadow = true;
  world.add(road);

  // lane paint
  const paintMat = new THREE.MeshStandardMaterial({ color: 0xdad6cc, roughness: 0.55, envMapIntensity: 0.6, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const z of [-4.95, 4.95]) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, 0.15), paintMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.002, z);
    line.receiveShadow = true;
    world.add(line);
  }
  const dashGeo = new THREE.PlaneGeometry(3, 0.13);
  dashGeo.rotateX(-Math.PI / 2);
  const dashCount = Math.floor(LOOP / 9) * 2;
  const dashes = new THREE.InstancedMesh(dashGeo, paintMat, dashCount);
  dashes.receiveShadow = true;
  const dashItems = [];
  for (let i = 0; i < dashCount / 2; i++) {
    for (const z of [-1.75, 1.75]) dashItems.push({ x: -LOOP / 2 + i * 9, y: 0.003, z, rot: 0, s: 1 });
  }
  world.add(dashes);
  instMovers.push({ mesh: dashes, items: dashItems });

  /* curbs + sidewalks */
  const conc = concreteTexture();
  conc.repeat.set(roadLen / 3, 1);
  const walkMat = new THREE.MeshStandardMaterial({ map: conc, roughness: 0.85, color: 0x9a948a });
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x8c877e, roughness: 0.7 });
  for (const s of [-1, 1]) {
    const walk = new THREE.Mesh(new THREE.BoxGeometry(roadLen, 0.14, 3.2), [walkMat, walkMat, walkMat, walkMat, walkMat, walkMat]);
    walk.position.set(0, 0.07, s * (roadW / 2 + 0.2 + 1.6));
    walk.receiveShadow = true;
    world.add(walk);
    const curb = new THREE.Mesh(new THREE.BoxGeometry(roadLen, 0.16, 0.2), curbMat);
    curb.position.set(0, 0.08, s * (roadW / 2 + 0.1));
    curb.receiveShadow = true;
    curb.castShadow = true;
    world.add(curb);
  }

  /* trees */
  const r = rng(42);
  const trunkGeo = new THREE.CylinderGeometry(0.13, 0.22, 5, 8);
  trunkGeo.translate(0, 2.5, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2b2119, roughness: 1 });
  const leafTex = leafTexture();
  const leafMat = new THREE.MeshStandardMaterial({ map: leafTex, vertexColors: true, roughness: 0.85, alphaTest: 0.45, side: THREE.DoubleSide });
  const treeTypes = [foliage(3), foliage(9), foliage(14, true)];
  const treeItems = [[], [], []];
  for (let i = 0; i < 70; i++) {
    for (const side of [-1, 1]) {
      const x = -LOOP / 2 + (i / 70) * LOOP + (r() - 0.5) * 3;
      // the far (sunset) side stays open so the sky glow reads through
      if (side < 0 && r() < 0.55) continue;
      const near = r() < 0.55;
      const z = side * (near ? 11 + r() * 3 : 15 + r() * 9);
      const type = r() < 0.3 ? 2 : r() < 0.5 ? 1 : 0;
      treeItems[type].push({ x, y: 0, z, rot: r() * Math.PI * 2, s: 0.75 + r() * 0.6 });
    }
  }
  treeTypes.forEach((geo, i) => {
    const n = treeItems[i].length;
    const leaves = new THREE.InstancedMesh(geo, leafMat, n);
    leaves.castShadow = true;
    leaves.receiveShadow = true;
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, n);
    trunks.castShadow = true;
    world.add(leaves, trunks);
    instMovers.push({ mesh: leaves, items: treeItems[i] }, { mesh: trunks, items: treeItems[i] });
  });

  /* hedges */
  const hedgeGeo = new THREE.BoxGeometry(LOOP / 12 - 1.5, 0.9, 1.2, 8, 2, 2);
  {
    const p = hedgeGeo.getAttribute('position');
    for (let k = 0; k < p.count; k++) {
      const y = p.getY(k);
      if (y > 0) p.setY(k, y + Math.sin(p.getX(k) * 2.1) * 0.06);
    }
    hedgeGeo.computeVertexNormals();
    hedgeGeo.translate(0, 0.45, 0);
  }
  const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x1d2a14, roughness: 0.95 });
  const hedgeItems = [];
  for (let i = 0; i < 12; i++) for (const s of [-1, 1]) hedgeItems.push({ x: -LOOP / 2 + i * (LOOP / 12), y: 0.14, z: s * 8.9, rot: 0, s: 1 });
  const hedges = new THREE.InstancedMesh(hedgeGeo, hedgeMat, hedgeItems.length);
  hedges.castShadow = true;
  hedges.receiveShadow = true;
  world.add(hedges);
  instMovers.push({ mesh: hedges, items: hedgeItems });

  /* buildings */
  const buildingMats = [];
  const bAt = (x, z, w, h, d, seed) => {
    const t = buildingTexture(seed, Math.max(6, Math.round(w / 1.6)), Math.max(3, Math.round(h / 3.6)));
    t.map.repeat.set(1, 1);
    const facade = new THREE.MeshStandardMaterial({
      map: t.map,
      emissiveMap: t.emissiveMap,
      emissive: 0xffffff,
      emissiveIntensity: 0.6,
      roughness: 0.25,
      metalness: 0.4,
    });
    const roofM = new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.9 });
    buildingMats.push(facade);
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [facade, facade, roofM, roofM, facade, facade]);
    b.position.set(x, h / 2, z);
    b.castShadow = true;
    b.receiveShadow = true;
    world.add(b);
    movers.push({ obj: b, baseX: x });
    // light rooftop trim
    const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.4, d + 0.3), new THREE.MeshStandardMaterial({ color: 0xc9c4ba, roughness: 0.5 }));
    trim.position.set(x, h + 0.2, z);
    world.add(trim);
    movers.push({ obj: trim, baseX: x });
  };
  let seed = 100;
  for (let x = -LOOP / 2; x < LOOP / 2; x += 34 + rng(seed)() * 20) {
    const rr = rng(seed++);
    if (rr() < 0.55) bAt(x, -36 - rr() * 14, 18 + rr() * 16, 7 + rr() * 12, 14 + rr() * 8, seed);
    const rr2 = rng(seed++);
    if (rr2() < 0.7) bAt(x + 15, 30 + rr2() * 12, 20 + rr2() * 14, 8 + rr2() * 14, 14, seed);
  }

  /* street lights */
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2b2e, roughness: 0.5, metalness: 0.6 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const poolTex = lightPoolTexture();
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, color: 0xffb46a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.1, 7, 12);
  poleGeo.translate(0, 3.5, 0);
  const armGeo = new THREE.BoxGeometry(0.08, 0.08, 1.6);
  const headGeo = new THREE.BoxGeometry(0.5, 0.08, 0.22);
  const lensGeo = new THREE.PlaneGeometry(0.44, 0.16);
  lensGeo.rotateX(Math.PI / 2);
  const poolGeo = new THREE.PlaneGeometry(11, 11);
  poolGeo.rotateX(-Math.PI / 2);
  for (let x = -LOOP / 2; x < LOOP / 2; x += 30) {
    for (const s of [-1, 1]) {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.castShadow = true;
      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.position.set(0, 6.95, -s * 0.8);
      const head = new THREE.Mesh(headGeo, poleMat);
      head.position.set(0, 6.9, -s * 1.5);
      const lens = new THREE.Mesh(lensGeo, lampMat);
      lens.position.set(0, 6.855, -s * 1.5);
      const pool = new THREE.Mesh(poolGeo, poolMat);
      pool.position.set(0, 0.012, -s * 2.4);
      pool.renderOrder = 2;
      g.add(pole, arm, head, lens, pool);
      const bx = x + (s > 0 ? 15 : 0);
      g.position.set(bx, 0.14, s * (roadW / 2 + 0.7));
      pool.position.y = -0.125;
      world.add(g);
      movers.push({ obj: g, baseX: bx, prop: true });
    }
  }

  /* far landscape */
  const m1 = mountainRing(1450, 40, 190, 3, 0x555555);
  const m2 = mountainRing(1150, 10, 80, 8, 0x333333);
  scene.add(m1, m2);

  /* stars */
  const starGeo = new THREE.BufferGeometry();
  const sp = [];
  const sr = rng(77);
  for (let i = 0; i < 2500; i++) {
    const u = sr();
    const v = sr() * 0.95 + 0.05;
    const th = u * Math.PI * 2;
    const ph = Math.acos(v);
    sp.push(Math.sin(ph) * Math.cos(th) * 2000, Math.cos(ph) * 2000, Math.sin(ph) * Math.sin(th) * 2000);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  /* layout of moving instances */
  const dummy = new THREE.Object3D();
  const wrap = (x) => ((((x + LOOP / 2) % LOOP) + LOOP) % LOOP) - LOOP / 2;
  let offset = 0;
  function layout() {
    for (const { mesh, items } of instMovers) {
      items.forEach((it, i) => {
        dummy.position.set(wrap(it.x - offset), it.y, it.z);
        dummy.rotation.set(0, it.rot, 0);
        dummy.scale.setScalar(it.s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    for (const m of movers) m.obj.position.x = wrap(m.baseX - offset);
    const repeatLen = 9;
    asphalt.map.offset.x = (offset / repeatLen) % 1;
    asphalt.roughnessMap.offset.x = asphalt.map.offset.x;
    conc.offset.x = (offset / 3) % 1;
    grassTex.offset.x = (offset / 10) % 1;
  }
  layout();

  /* presets */
  const sunDir = new THREE.Vector3();
  let current = null;
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;

  function applyPreset(key) {
    const p = PRESETS[key];
    current = p;
    const phi = THREE.MathUtils.degToRad(90 - p.elevation);
    const theta = THREE.MathUtils.degToRad(p.azimuth);
    sunDir.setFromSphericalCoords(1, phi, theta);
    U.sunPosition.value.copy(sunDir);
    U.turbidity.value = p.turbidity;
    U.rayleigh.value = p.rayleigh;
    U.mieCoefficient.value = p.mie;
    U.mieDirectionalG.value = p.mieG;
    if (U.cloudCoverage) U.cloudCoverage.value = p.clouds;
    U.skyGain.value = p.skyGain ?? 1;
    // light comes from the sun, or from a moon-ish direction when it has set
    const lightDir = sunDir.clone();
    if (lightDir.y < 0.12) lightDir.y = 0.12 + (p.night > 0.5 ? 0.3 : 0);
    lightDir.normalize();
    sun.position.copy(lightDir).multiplyScalar(60);
    sun.color.set(p.sun);
    sun.intensity = p.sunIntensity;
    hemi.color.set(p.hemiSky);
    hemi.groundColor.set(p.hemiGround);
    hemi.intensity = p.hemi;
    fill.intensity = p.fill ?? 0.5;
    renderer.toneMappingExposure = p.exposure;
    scene.fog = new THREE.FogExp2(p.fog, p.fogDensity);
    m1.material.color.set(p.mountains[0]);
    m2.material.color.set(p.mountains[1]);
    buildingMats.forEach((m) => (m.emissiveIntensity = p.windows));
    lampMat.color.setRGB(1, 0.72, 0.42).multiplyScalar(p.street * 6);
    poolMat.opacity = p.street * 0.22;
    starMat.opacity = p.stars;
    return p;
  }

  function captureEnvironment(hide = [], size = 512) {
    hide = [...hide, stars];
    const vis = hide.map((o) => o.visible);
    hide.forEach((o) => (o.visible = false));
    const rt = pmrem.fromScene(scene, 0, 0.1, 4000, { size, position: new THREE.Vector3(0, 1.3, 0) });
    hide.forEach((o, i) => (o.visible = vis[i]));
    if (envRT) envRT.dispose();
    envRT = rt;
    scene.environment = rt.texture;
  }

  function update(dt, speed, focus, cam) {
    if (speed !== 0) {
      offset += speed * dt;
      layout();
    }
    // never let a lamp post slice through the lens
    for (const m of movers) {
      if (!m.prop) continue;
      m.obj.visible = Math.hypot(m.obj.position.x - cam.x, m.obj.position.z - cam.z) > 1.6;
    }
    if (U.time) U.time.value += dt;
    // keep the shadow frustum centred on the action
    sun.target.position.set(focus.x, 0, focus.z);
    sun.position.copy(sun.target.position).add(sun.position.clone().sub(sun.target.position).normalize().multiplyScalar(60));
  }

  return { applyPreset, captureEnvironment, update, sun, get preset() { return current; } };
}
