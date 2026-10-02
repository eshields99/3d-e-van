import * as THREE from 'three';

const ICONS = {
  exterior: '<svg viewBox="0 0 24 24"><path d="M3 15.5V10a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v5.5a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 15.5Z"/><circle cx="7.5" cy="17" r="1.8"/><circle cx="16.5" cy="17" r="1.8"/><path d="M3.5 11.5h17"/></svg>',
  interior: '<svg viewBox="0 0 24 24"><path d="M7 4v9a2 2 0 0 0 2 2h7"/><path d="M7 15l-1 5M16 15l2 5"/><path d="M10 11h6a2 2 0 0 1 2 2v2"/></svg>',
  drive: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2"/><path d="M12 14v6.5M10.2 11 4 9.5M13.8 11 20 9.5"/></svg>',
  doors: '<svg viewBox="0 0 24 24"><rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M12 3.5v17M9.5 12h.01M14.5 12h.01"/></svg>',
  lights: '<svg viewBox="0 0 24 24"><path d="M4 9h7M4 12h9M4 15h7"/><path d="M15 6.5c3 0 5 2.5 5 5.5s-2 5.5-5 5.5Z"/></svg>',
};

export function createUI(opts) {
  const root = document.getElementById('ui');
  root.innerHTML = `
    <div class="loader" id="loader">
      <div class="loader-brand">AURA</div>
      <div class="loader-bar"><span></span></div>
      <div class="loader-text">Preparing studio</div>
    </div>

    <header class="brand">
      <div class="wordmark">AURA<span>ONE</span></div>
      <div class="tagline">Electric autonomous shuttle · Concept</div>
    </header>

    <div class="time panel" role="group" aria-label="Time of day">
      ${Object.entries(opts.presets)
        .map(([k, v]) => `<button data-preset="${k}">${v}</button>`)
        .join('')}
    </div>

    <aside class="specs">
      <div class="spec"><b data-count="480">0</b><small>km range</small></div>
      <div class="spec"><b data-count="6">0</b><small>lounge seats</small></div>
      <div class="spec"><b data-count="4">0</b><small>autonomy level</small></div>
      <div class="spec"><b data-count="22" data-suffix="min">0</b><small>10–80% charge</small></div>
    </aside>

    <div class="hud" id="hud">
      <div class="hud-speed"><b id="speed">0</b><small>km/h</small></div>
      <div class="hud-row"><span class="dot"></span>Autonomous · Lane 2</div>
      <div class="hud-bar"><span style="width:78%"></span></div>
      <div class="hud-row dim">78% · 374 km</div>
    </div>

    <div class="hotspots" id="hotspots"></div>

    <nav class="dock panel">
      <div class="seg" id="modes">
        <button data-mode="exterior">${ICONS.exterior}<span>Exterior</span></button>
        <button data-mode="interior">${ICONS.interior}<span>Interior</span></button>
        <button data-mode="drive">${ICONS.drive}<span>Drive</span></button>
      </div>
      <div class="sep"></div>
      <div class="actions">
        <button class="toggle" data-action="doors" title="Doors (D)">${ICONS.doors}<span>Doors</span></button>
        <button class="toggle on" data-action="lights" title="Lights (L)">${ICONS.lights}<span>Lights</span></button>
      </div>
      <div class="sep only-ext"></div>
      <div class="shots only-ext">
        <button data-shot="hero">Hero</button>
        <button data-shot="side">Side</button>
        <button data-shot="rear">Rear</button>
      </div>
      <div class="sep only-int"></div>
      <div class="moods only-int" aria-label="Ambient light">
        <button data-mood="warm" style="--c:#ff9a4d" title="Warm"></button>
        <button data-mood="ice" style="--c:#5aaeff" title="Ice"></button>
        <button data-mood="violet" style="--c:#a066ff" title="Violet"></button>
        <button data-mood="off" style="--c:#2a2a2a" title="Off"></button>
      </div>
    </nav>

    <div class="hint" id="hint">Drag to orbit · Scroll to zoom · Tap the markers</div>
  `;

  const $ = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];

  $$('[data-mode]').forEach((b) => b.addEventListener('click', () => opts.onMode(b.dataset.mode)));
  $$('[data-preset]').forEach((b) => b.addEventListener('click', () => opts.onPreset(b.dataset.preset)));
  $$('[data-shot]').forEach((b) => b.addEventListener('click', () => opts.onShot(b.dataset.shot)));
  $$('[data-mood]').forEach((b) => b.addEventListener('click', () => opts.onMood(b.dataset.mood)));
  $('[data-action="doors"]').addEventListener('click', opts.onDoors);
  $('[data-action="lights"]').addEventListener('click', opts.onLights);

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k === '1') opts.onMode('exterior');
    if (k === '2') opts.onMode('interior');
    if (k === '3') opts.onMode('drive');
    if (k === 'd') opts.onDoors();
    if (k === 'l') opts.onLights();
  });

  // hotspots
  const hsWrap = $('#hotspots');
  const spots = opts.hotspots.map((h) => {
    const el = document.createElement('button');
    el.className = 'hotspot';
    el.innerHTML = `<i></i><span>${h.label}</span>`;
    el.addEventListener('click', h.action);
    hsWrap.appendChild(el);
    return { ...h, el };
  });

  const v = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  const toSpot = new THREE.Vector3();
  let mode = 'exterior';

  function setMode(m) {
    mode = m;
    root.dataset.mode = m;
    $$('[data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
  }
  setMode('exterior');

  return {
    setMode,
    setPreset(k) {
      $$('[data-preset]').forEach((b) => b.classList.toggle('active', b.dataset.preset === k));
    },
    setDoors(open) {
      $('[data-action="doors"]').classList.toggle('on', open);
    },
    setLights(on) {
      $('[data-action="lights"]').classList.toggle('on', on);
    },
    setMood(m) {
      $$('[data-mood]').forEach((b) => b.classList.toggle('active', b.dataset.mood === m));
    },
    trigger(name) {
      $(`[data-action="${name}"]`).click();
    },
    hideHint() {
      $('#hint').classList.add('gone');
    },
    ready() {
      $('#loader').classList.add('done');
      root.classList.add('ready');
      // count-up specs
      $$('[data-count]').forEach((el, i) => {
        const to = +el.dataset.count;
        const suf = el.dataset.suffix || '';
        const t0 = performance.now() + 900 + i * 120;
        const step = (now) => {
          const k = Math.min(1, Math.max(0, (now - t0) / 1400));
          const e = 1 - Math.pow(1 - k, 4);
          el.innerHTML = `${Math.round(to * e)}${suf ? `<em>${suf}</em>` : ''}`;
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      setTimeout(() => this.hideHint(), 9000);
    },
    update(camera, canvas, info) {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      camera.getWorldDirection(camDir);
      const showSpots = info.mode === 'exterior' && !info.transitioning;
      for (const s of spots) {
        v.copy(s.pos).project(camera);
        toSpot.copy(s.pos).sub(camera.position).normalize();
        // hide markers on the far side of the van
        const facing = s.pos.z * camera.position.z > 0 || Math.abs(s.pos.z) < 0.6;
        const front = s.pos.x > 2 ? camera.position.x > 1.5 : true;
        const visible = showSpots && v.z < 1 && facing && front && camDir.dot(toSpot) > 0;
        s.el.classList.toggle('show', visible);
        if (visible) s.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
      }
      const sp = $('#speed');
      const kmh = Math.round(info.speed * 3.6);
      if (sp.textContent !== String(kmh)) sp.textContent = kmh;
    },
  };
}
