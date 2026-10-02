import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { buildVan } from './van/van.js';
import { WHEEL } from './van/shape.js';
import { buildWorld, PRESETS } from './world/world.js';
import { shadowBlobTexture } from './textures.js';
import { FinishShader } from './finish.js';
import { createUI } from './ui.js';
import './style.css';

const params = new URLSearchParams(location.search);
const quality = params.get('q') || 'high';

/* renderer */
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('capture') });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'low' ? 1 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.03, 5000);

/* world + van */
const world = buildWorld(scene, renderer);
const van = buildVan();
scene.add(van.group);

// soft contact shadow under the body
const blob = new THREE.Mesh(
  new THREE.PlaneGeometry(6.4, 2.9),
  new THREE.MeshBasicMaterial({ map: shadowBlobTexture(), transparent: true, opacity: 0.85, depthWrite: false, color: 0x000000 }),
);
blob.rotation.x = -Math.PI / 2;
blob.position.y = 0.006;
blob.renderOrder = 1;
van.group.add(blob);

/* controls */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;

const EXTERIOR = {
  minDistance: 5.2,
  maxDistance: 10.5,
  minPolar: 0.25,
  maxPolar: Math.PI / 2 - 0.035,
};
function exteriorControls() {
  controls.minDistance = EXTERIOR.minDistance;
  controls.maxDistance = EXTERIOR.maxDistance;
  controls.minPolarAngle = EXTERIOR.minPolar;
  controls.maxPolarAngle = EXTERIOR.maxPolar;
  controls.enableZoom = true;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.8;
}
function interiorControls() {
  controls.minDistance = 0.001;
  controls.maxDistance = 0.12;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = Math.PI - 0.35;
  controls.enableZoom = false;
  controls.rotateSpeed = -0.32;
}

/* post processing */
const size = new THREE.Vector2();
renderer.getDrawingBufferSize(size);
const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: quality === 'low' ? 0 : 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.38, 0.35, 1.6);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const finish = new ShaderPass(FinishShader);
composer.addPass(finish);

/* shots */
const SHOTS = {
  hero: { pos: new THREE.Vector3(6.4, 1.55, 8.6), target: new THREE.Vector3(0.2, 1.05, 0), fov: 32 },
  rear: { pos: new THREE.Vector3(-7.4, 1.4, 6.2), target: new THREE.Vector3(-0.3, 1.05, 0), fov: 32 },
  side: { pos: new THREE.Vector3(0.6, 1.35, 9.6), target: new THREE.Vector3(0, 1.05, 0), fov: 30 },
  door: { pos: new THREE.Vector3(1.8, 1.5, 5.4), target: new THREE.Vector3(-0.1, 1.15, 0), fov: 38 },
  cabin: { pos: new THREE.Vector3(-1.72, 1.56, 0.32), target: new THREE.Vector3(1.6, 1.25, -0.15), fov: 68 },
  drive: { pos: new THREE.Vector3(-8.6, 2.2, 3.9), target: new THREE.Vector3(0.6, 1.0, 0), fov: 32 },
};

const app = {
  mode: 'exterior',
  speed: 0,
  targetSpeed: 0,
  transition: null,
  preset: 'golden',
  lastInteraction: performance.now(),
};

camera.position.copy(SHOTS.hero.pos).add(new THREE.Vector3(5, 2.5, 6));
controls.target.copy(SHOTS.hero.target);
exteriorControls();

/* camera transitions */
function flyTo(shot, { duration = 1.8, via = null, onDone = null } = {}) {
  const fromPos = camera.position.clone();
  const fromTarget = controls.target.clone();
  const fromFov = camera.fov;
  const pts = [fromPos, ...(via || []), shot.pos.clone()];
  const curve = pts.length > 2 ? new THREE.CatmullRomCurve3(pts, false, 'centripetal') : null;
  app.transition = {
    t: 0,
    duration,
    update(k) {
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      if (curve) camera.position.copy(curve.getPoint(e));
      else camera.position.lerpVectors(fromPos, shot.pos, e);
      controls.target.lerpVectors(fromTarget, shot.target, e);
      camera.fov = fromFov + (shot.fov - fromFov) * e;
      camera.updateProjectionMatrix();
    },
    onDone,
  };
  controls.enabled = false;
}

function cabinShotFrom() {
  // keep the interior camera a hair away from its target so OrbitControls can rotate
  const s = SHOTS.cabin;
  const dir = s.target.clone().sub(s.pos).normalize();
  return { pos: s.pos.clone(), target: s.pos.clone().add(dir.multiplyScalar(0.08)), fov: s.fov };
}

function setMode(mode) {
  if (mode === app.mode && !app.transition) return;
  const prev = app.mode;
  app.mode = mode;
  ui.setMode(mode);
  if (mode === 'interior') {
    app.targetSpeed = 0;
    van.setDoors(true);
    interiorControls();
    const shot = cabinShotFrom();
    flyTo(shot, {
      duration: 3.2,
      via: [new THREE.Vector3(0.2, 1.6, 4.2), new THREE.Vector3(0.0, 1.55, 1.6), new THREE.Vector3(-0.6, 1.56, 0.5)],
      onDone: () => {
        van.setDoors(false);
        ui.setDoors(false);
      },
    });
    ui.setDoors(true);
  } else if (mode === 'exterior') {
    app.targetSpeed = 0;
    if (prev === 'interior') {
      van.setDoors(true);
      ui.setDoors(true);
      flyTo(SHOTS.door, {
        duration: 3,
        via: [new THREE.Vector3(-0.4, 1.56, 0.6), new THREE.Vector3(0.0, 1.55, 1.7), new THREE.Vector3(0.6, 1.55, 3.8)],
        onDone: () => {
          exteriorControls();
          van.setDoors(false);
          ui.setDoors(false);
        },
      });
      controls.minDistance = 0;
      controls.maxDistance = Infinity;
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = Math.PI;
    } else {
      exteriorControls();
      flyTo(SHOTS.hero, { duration: 2 });
    }
  } else if (mode === 'drive') {
    van.setDoors(false);
    ui.setDoors(false);
    app.targetSpeed = 16;
    exteriorControls();
    if (prev === 'interior') {
      controls.minDistance = 0;
      controls.maxDistance = Infinity;
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = Math.PI;
      flyTo(SHOTS.drive, {
        duration: 3.2,
        via: [new THREE.Vector3(-0.4, 1.56, 0.6), new THREE.Vector3(0.0, 1.6, 1.8), new THREE.Vector3(-3, 2, 5)],
        onDone: exteriorControls,
      });
    } else {
      flyTo(SHOTS.drive, { duration: 2.4 });
    }
  }
}

function setPreset(key) {
  app.preset = key;
  const p = world.applyPreset(key);
  van.setNight(p.night);
  van.interior.setCabin(p.night > 0.3 || app.mode === 'interior' ? 1 : 0.6);
  world.captureEnvironment([van.group]);
  ui.setPreset(key);
}

/* UI */
const ui = createUI({
  presets: Object.fromEntries(Object.entries(PRESETS).map(([k, v]) => [k, v.label])),
  onMode: setMode,
  onPreset: setPreset,
  onDoors: () => {
    const open = van.toggleDoors();
    ui.setDoors(open);
    if (open && app.mode === 'exterior' && !app.transition) flyTo(SHOTS.door, { duration: 1.6 });
  },
  onLights: () => {
    van.state.lightsOn = !van.state.lightsOn;
    ui.setLights(van.state.lightsOn);
  },
  onMood: (m) => {
    van.interior.setMood(m);
    ui.setMood(m);
  },
  onShot: (k) => {
    if (app.mode === 'interior') return;
    flyTo(SHOTS[k], { duration: 1.8 });
  },
  hotspots: [
    { id: 'doors', label: 'Twin sliding doors', pos: new THREE.Vector3(0, 1.45, 1.02), action: () => ui.trigger('doors') },
    { id: 'cabin', label: 'Step inside', pos: new THREE.Vector3(-1.3, 1.65, 0.98), action: () => setMode('interior') },
    { id: 'lights', label: 'Light signature', pos: new THREE.Vector3(2.6, 1.0, 0.45), action: () => ui.trigger('lights') },
    { id: 'wheels', label: 'Aero wheels', pos: new THREE.Vector3(-WHEEL.x, 0.45, 1.06), action: () => flyTo(SHOTS.rear, { duration: 1.8 }) },
  ],
});

controls.addEventListener('start', () => {
  app.lastInteraction = performance.now();
  ui.hideHint();
});

/* resize */
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  renderer.getDrawingBufferSize(size);
  finish.uniforms.resolution.value.set(size.x, size.y);
}
window.addEventListener('resize', resize);
resize();

/* boot */
setPreset(params.get('time') && PRESETS[params.get('time')] ? params.get('time') : 'golden');
const startMode = params.get('mode');
if (params.get('doors') === 'open') {
  van.setDoors(true);
  van.state.doorT = 1;
  ui.setDoors(true);
}

const camLocal = new THREE.Vector3();
const timer = new THREE.Timer();
timer.connect(document);
let envTimer = 0;
let envDirty = false;
let frames = 0;

function tick() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 1 / 20);
  const time = timer.getElapsed();

  app.speed += (app.targetSpeed - app.speed) * Math.min(1, dt * (app.targetSpeed > app.speed ? 0.45 : 0.9));
  if (Math.abs(app.speed) < 0.01 && app.targetSpeed === 0) app.speed = 0;

  if (app.transition) {
    const tr = app.transition;
    tr.t += dt / tr.duration;
    tr.update(Math.min(1, tr.t));
    if (tr.t >= 1) {
      app.transition = null;
      controls.enabled = true;
      tr.onDone && tr.onDone();
    }
  }

  // idle cinematic orbit in exterior views
  const idle = performance.now() - app.lastInteraction > 12000;
  controls.autoRotate = !app.transition && app.mode !== 'interior' && idle;
  controls.autoRotateSpeed = 0.35;
  if (app.transition) camera.lookAt(controls.target);
  else controls.update(dt);

  van.update(dt, { speed: app.speed, time });
  camLocal.copy(camera.position);
  van.group.worldToLocal(camLocal);
  van.setCameraInside(Math.abs(camLocal.x) < 2.42 && Math.abs(camLocal.z) < 0.93 && camLocal.y > 0.5 && camLocal.y < 2.4);
  world.update(dt, app.speed, van.group.position, camera.position);

  // refresh reflections while the world streams past
  if (app.speed > 0.5) {
    envTimer += dt;
    if (envTimer > 0.25) {
      envTimer = 0;
      world.captureEnvironment([van.group], 256);
      envDirty = true;
    }
  } else if (envDirty) {
    // parked again: restore the high resolution reflections
    envDirty = false;
    world.captureEnvironment([van.group]);
  }

  finish.uniforms.time.value = time;
  finish.uniforms.vignette.value = app.mode === 'interior' ? 0.42 : 0.3;
  ui.update(camera, renderer.domElement, { speed: app.speed, mode: app.mode, transitioning: !!app.transition });

  composer.render();
  frames++;
  if (frames === 3) ui.ready();
  requestAnimationFrame(tick);
}

// intro: sweep in to the hero shot, then honour ?mode=
flyTo(SHOTS.hero, {
  duration: 3.2,
  onDone: () => {
    if (startMode && startMode !== 'exterior') setMode(startMode);
  },
});
if (params.has('nointro')) {
  app.transition.t = 1;
}
requestAnimationFrame(tick);

window.__app = { app, van, world, camera, controls, setMode, setPreset, flyTo, SHOTS };
