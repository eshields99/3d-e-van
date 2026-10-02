import * as THREE from 'three';

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, { repeat = [1, 1], srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Small deterministic PRNG so the scene looks the same on every load.
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function asphaltTextures() {
  const S = 1024;
  const [c, g] = canvas(S);
  const [rc, rg] = canvas(S);
  const r = rng(7);
  g.fillStyle = '#2a2b2d';
  g.fillRect(0, 0, S, S);
  rg.fillStyle = '#9a9a9a';
  rg.fillRect(0, 0, S, S);
  // aggregate speckle
  for (let i = 0; i < 90000; i++) {
    const x = r() * S;
    const y = r() * S;
    const l = 25 + r() * 40;
    g.fillStyle = `rgba(${l},${l},${l + 2},${0.35 + r() * 0.5})`;
    const s = 0.6 + r() * 1.8;
    g.fillRect(x, y, s, s);
    const q = 120 + r() * 120;
    rg.fillStyle = `rgba(${q},${q},${q},0.5)`;
    rg.fillRect(x, y, s, s);
  }
  // patches / tyre polish (darker, smoother)
  for (let i = 0; i < 40; i++) {
    const x = r() * S;
    const y = r() * S;
    const rad = 40 + r() * 160;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, `rgba(10,10,12,${0.12 + r() * 0.12})`);
    grd.addColorStop(1, 'rgba(10,10,12,0)');
    g.fillStyle = grd;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    const grr = rg.createRadialGradient(x, y, 0, x, y, rad);
    grr.addColorStop(0, 'rgba(40,40,40,0.35)');
    grr.addColorStop(1, 'rgba(40,40,40,0)');
    rg.fillStyle = grr;
    rg.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  return { map: tex(c), roughnessMap: tex(rc, { srgb: false }) };
}

export function concreteTexture() {
  const S = 512;
  const [c, g] = canvas(S);
  const r = rng(11);
  g.fillStyle = '#77736d';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 30000; i++) {
    const l = 90 + r() * 60;
    g.fillStyle = `rgba(${l},${l - 3},${l - 6},0.25)`;
    g.fillRect(r() * S, r() * S, 1.5, 1.5);
  }
  g.strokeStyle = 'rgba(30,30,30,0.55)';
  g.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    g.beginPath();
    g.moveTo((i * S) / 4, 0);
    g.lineTo((i * S) / 4, S);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(0, S / 2);
  g.lineTo(S, S / 2);
  g.stroke();
  return tex(c);
}

export function grassTexture() {
  const S = 512;
  const [c, g] = canvas(S);
  const r = rng(5);
  g.fillStyle = '#1f2a14';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 60000; i++) {
    const h = 70 + r() * 40;
    g.fillStyle = `hsla(${h},${35 + r() * 25}%,${10 + r() * 16}%,0.6)`;
    g.fillRect(r() * S, r() * S, 1, 2 + r() * 3);
  }
  return tex(c);
}

export function woodFloorTexture() {
  const W = 1024;
  const H = 1024;
  const [c, g] = canvas(W, H);
  const r = rng(21);
  const plank = H / 8;
  for (let p = 0; p < 8; p++) {
    const base = 32 + r() * 14;
    g.fillStyle = `hsl(28, 32%, ${base * 0.55}%)`;
    g.fillRect(0, p * plank, W, plank);
    for (let i = 0; i < 160; i++) {
      const y = p * plank + r() * plank;
      g.strokeStyle = `hsla(26, 35%, ${12 + r() * 18}%, ${0.15 + r() * 0.25})`;
      g.lineWidth = 0.6 + r() * 1.6;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= W; x += 32) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 2.5 * r());
      g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(0, p * plank, W, 2);
    const off = r() * W;
    g.fillRect(off, p * plank, 2, plank);
  }
  return tex(c, { repeat: [1.2, 1.2] });
}

export function fabricTexture(color = '#d9d3c9') {
  const S = 256;
  const [c, g] = canvas(S);
  const r = rng(3);
  g.fillStyle = color;
  g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 2) {
    g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.04})`;
    g.fillRect(0, y, S, 1);
  }
  for (let x = 0; x < S; x += 2) {
    g.fillStyle = `rgba(255,255,255,${0.02 + r() * 0.03})`;
    g.fillRect(x, 0, 1, S);
  }
  return tex(c, { repeat: [6, 6] });
}

export function leatherNormal() {
  const S = 256;
  const [c, g] = canvas(S);
  const r = rng(17);
  g.fillStyle = 'rgb(128,128,255)';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2500; i++) {
    const x = r() * S;
    const y = r() * S;
    const rad = 1 + r() * 3;
    const grd = g.createRadialGradient(x - rad * 0.3, y - rad * 0.3, 0, x, y, rad);
    grd.addColorStop(0, 'rgba(150,150,255,0.6)');
    grd.addColorStop(1, 'rgba(110,110,255,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  }
  return tex(c, { srgb: false, repeat: [3, 3] });
}

export function buildingTexture(seed = 1, cols = 12, rows = 18) {
  const W = 1024;
  const H = 1024;
  const [c, g] = canvas(W, H);
  const [ec, eg] = canvas(W, H);
  const r = rng(seed);
  // curtain-wall glass
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#2b3038');
  grd.addColorStop(1, '#16191e');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  eg.fillStyle = '#000';
  eg.fillRect(0, 0, W, H);
  const cw = W / cols;
  const rh = H / rows;
  for (let y = 0; y < rows; y++) {
    // lit offices come in clusters along a floor
    let run = 0;
    for (let x = 0; x < cols; x++) {
      if (run <= 0 && r() < 0.1) run = 1 + Math.floor(r() * 5);
      const lit = run-- > 0;
      const px = x * cw;
      const py = y * rh + rh * 0.18;
      const h = rh * 0.72;
      g.fillStyle = `rgba(${40 + r() * 20},${46 + r() * 20},${56 + r() * 22},0.5)`;
      g.fillRect(px, py, cw, h);
      if (lit) {
        const warm = r() > 0.2;
        const l = 40 + r() * 22;
        eg.fillStyle = warm ? `hsl(${30 + r() * 10}, 70%, ${l}%)` : `hsl(205, 25%, ${l}%)`;
        eg.fillRect(px, py, cw, h);
        eg.fillStyle = 'rgba(255,244,225,0.85)';
        eg.fillRect(px, py + 1, cw, 2);
      }
    }
  }
  // mullions + slab edges
  g.fillStyle = 'rgba(140,145,150,0.35)';
  eg.fillStyle = '#000';
  for (let x = 0; x <= cols; x++) {
    g.fillRect(x * cw - 1, 0, 2, H);
    eg.fillRect(x * cw - 1, 0, 2, H);
  }
  for (let y = 0; y < rows; y++) {
    g.fillStyle = '#9a9690';
    g.fillRect(0, y * rh, W, rh * 0.16);
    eg.fillRect(0, y * rh, W, rh * 0.16);
  }
  return { map: tex(c), emissiveMap: tex(ec) };
}

export function shadowBlobTexture() {
  const S = 512;
  const [c, g] = canvas(S);
  g.filter = 'blur(26px)';
  g.fillStyle = 'rgba(0,0,0,1)';
  const pad = 70;
  const rr = 90;
  g.beginPath();
  g.roundRect(pad, pad, S - pad * 2, S - pad * 2, rr);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  return t;
}

export function badgeTexture(text = 'AURA') {
  const [c, g] = canvas(512, 128);
  g.clearRect(0, 0, 512, 128);
  g.font = '600 74px "Inter", "Helvetica Neue", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.letterSpacing = '22px';
  const grd = g.createLinearGradient(0, 30, 0, 100);
  grd.addColorStop(0, '#f4f4f4');
  grd.addColorStop(0.5, '#9a9a9a');
  grd.addColorStop(1, '#e6e6e6');
  g.fillStyle = grd;
  g.fillText(text, 256 + 11, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function screenTexture() {
  const W = 1024;
  const H = 576;
  const [c, g] = canvas(W, H);
  const draw = (progress = 0.35, eta = 6) => {
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0b0f17');
    bg.addColorStop(1, '#141a26');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    // map grid
    g.save();
    g.beginPath();
    g.roundRect(40, 40, 600, H - 80, 28);
    g.clip();
    g.fillStyle = '#101622';
    g.fillRect(40, 40, 600, H - 80);
    g.strokeStyle = 'rgba(120,150,200,0.12)';
    g.lineWidth = 2;
    for (let i = 0; i < 18; i++) {
      g.beginPath();
      g.moveTo(40 + i * 40, 40);
      g.lineTo(40 + i * 40 - 120, H - 40);
      g.stroke();
      g.beginPath();
      g.moveTo(40, 60 + i * 34);
      g.lineTo(640, 30 + i * 34);
      g.stroke();
    }
    // route
    const pts = [
      [90, 470],
      [210, 400],
      [260, 300],
      [380, 260],
      [450, 160],
      [590, 110],
    ];
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(255,170,90,0.25)';
    g.lineWidth = 18;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
    g.strokeStyle = '#ffb46a';
    g.lineWidth = 6;
    g.stroke();
    // position marker along route
    const seg = progress * (pts.length - 1);
    const i0 = Math.min(pts.length - 2, Math.floor(seg));
    const f = seg - i0;
    const mx = pts[i0][0] + (pts[i0 + 1][0] - pts[i0][0]) * f;
    const my = pts[i0][1] + (pts[i0 + 1][1] - pts[i0][1]) * f;
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.beginPath();
    g.arc(mx, my, 26, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(mx, my, 11, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffb46a';
    g.beginPath();
    g.arc(590, 110, 12, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // text panel
    g.fillStyle = '#8b93a5';
    g.font = '500 26px Inter, Arial, sans-serif';
    g.fillText('NEXT STOP', 690, 110);
    g.fillStyle = '#f2f4f8';
    g.font = '600 50px Inter, Arial, sans-serif';
    g.fillText('Harbor Point', 690, 170);
    g.fillStyle = '#ffb46a';
    g.font = '700 120px Inter, Arial, sans-serif';
    g.fillText(String(eta), 690, 320);
    const etaW = g.measureText(String(eta)).width;
    g.fillStyle = '#8b93a5';
    g.font = '500 34px Inter, Arial, sans-serif';
    g.fillText('min', 690 + etaW + 14, 320);
    g.fillStyle = '#8b93a5';
    g.font = '500 26px Inter, Arial, sans-serif';
    g.fillText('CABIN 21°C  ·  6 SEATS', 690, 400);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.beginPath();
    g.roundRect(690, 440, 280, 10, 5);
    g.fill();
    g.fillStyle = '#ffb46a';
    g.beginPath();
    g.roundRect(690, 440, 280 * progress, 10, 5);
    g.fill();
  };
  draw();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return {
    texture: t,
    update(progress, eta) {
      draw(progress, eta);
      t.needsUpdate = true;
    },
  };
}
