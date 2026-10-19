(function () {
  'use strict';
  const C = window.Core;
  const $ = (s) => document.querySelector(s);
  const rub = (n) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n);
  const f1 = (n) => n.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const f2 = (n) => n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const mm = (m) => Math.round(m * 1000).toLocaleString('ru-RU');
  const LS = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* хранилище недоступно */ } },
  };
  const KEY = 'gorizont.v1', HKEY = 'gorizont.heightCm';

  const APT_PRICE = 9870000;
  const FINISHES = [
    { id: 'scandi', name: 'Скандинавия', floor: '#d6bd94', tile: '#e6eae8', wall: '#f0eee8', cap: '#3a3f3c', price: 0 },
    { id: 'loft', name: 'Лофт', floor: '#7a573f', tile: '#7c8184', wall: '#aaa7a1', cap: '#2a2c2b', price: 4500 },
    { id: 'classic', name: 'Классика', floor: '#9b6a43', tile: '#e2d6c2', wall: '#e7dcca', cap: '#4a3f34', price: 6200 },
  ];
  const STATUS_HEX = { ok: 0x2f9a5c, warning: 0xd59a14, error: 0xd2463a };
  const ROOM_TABS = [['all', 'Все'], ['bedroom', 'Спальня'], ['living', 'Кухня-гостиная'], ['bath', 'Санузел'], ['hall', 'Прихожая']];

  // ---------- состояние ----------
  const st = {
    placed: [], skipped: [], uid: 1, finish: 'scandi', seed: 7, setName: 'Готовый комплект',
    mode: 'orbit', cut: false, zones: false, tab: 'all',
    selected: null, ghost: null, drag: null, heightCm: null, walkCheck: null,
  };
  const hv = LS.get(HKEY); if (C.validHeight(hv)) st.heightCm = hv;

  function makeEntry(id, p, uid) { return C.entryOf(C.CAT[id], { x: p.x, z: p.z, rot: p.rot }, uid); }
  function save() {
    LS.set(KEY, { placed: st.placed.map((e) => ({ id: e.id, x: e.p.x, z: e.p.z, rot: e.p.rot })), skipped: st.skipped, finish: st.finish, seed: st.seed, setName: st.setName });
  }
  function load() {
    const d = LS.get(KEY);
    if (!d || !Array.isArray(d.placed)) return false;
    st.placed = d.placed.filter((e) => C.CAT[e.id]).map((e) => makeEntry(e.id, e, st.uid++));
    st.skipped = Array.isArray(d.skipped) ? d.skipped : [];
    if (FINISHES.some((f) => f.id === d.finish)) st.finish = d.finish;
    st.seed = d.seed || 7; st.setName = d.setName || 'Готовый комплект';
    return true;
  }
  function applyLayout(preset, seed, jitter, name) {
    const rng = C.createRng(seed);
    const pr = preset || C.randomPreset(rng);
    const res = C.autoLayout(pr, rng, jitter, st.uid);
    st.placed = res.placed; st.skipped = res.skipped; st.uid = res.nextUid;
    st.seed = seed; st.setName = name; st.selected = null;
    commit();
  }
  const finish = () => FINISHES.find((f) => f.id === st.finish);

  // ---------- three.js ----------
  const stage = $('#stage');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch (e) {
    renderer = null;
  }
  if (!renderer || !window.THREE) {
    const d = document.createElement('div'); d.className = 'ov'; d.id = 'nogl';
    d.textContent = 'Браузер не поддерживает WebGL, поэтому 3D-сцена недоступна. План квартиры и смета работают.';
    stage.appendChild(d);
    return;
  }
  const R = renderer;
  R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  R.outputEncoding = THREE.sRGBEncoding; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
  stage.insertBefore(R.domElement, stage.firstChild);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200);
  const TARGET = new THREE.Vector3(5, 0.4, 3.5);
  camera.position.set(12.8, 11.5, 15.5);

  const hemi = new THREE.HemisphereLight(0xf4f7ff, 0x8a8170, 0.75); scene.add(hemi);
  const amb = new THREE.AmbientLight(0xffffff, 0.12); scene.add(amb);
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.05);
  sun.position.set(13, 18, 10); sun.target.position.set(5, 0, 3.5); scene.add(sun); scene.add(sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 50 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;

  const groundMat = new THREE.MeshStandardMaterial({ color: 0xcfd5cd, roughness: 1 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2), groundMat);
  ground.position.y = -0.32; ground.receiveShadow = true; scene.add(ground);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(C.AW + 0.5, 0.3, C.AD + 0.5), new THREE.MeshStandardMaterial({ color: 0x8d918d, roughness: 0.9 }));
  slab.position.set(C.AW / 2, -0.152, C.AD / 2); slab.receiveShadow = true; scene.add(slab);

  const floorG = new THREE.Group(), wallG = new THREE.Group(), furnG = new THREE.Group(), helpG = new THREE.Group();
  scene.add(floorG, wallG, furnG, helpG);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(C.AW, C.AD).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf6f5f1, roughness: 1 }));
  ceiling.position.set(C.AW / 2, C.H, C.AD / 2); ceiling.visible = false; scene.add(ceiling);

  function dispose(g) {
    g.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map) m.map.dispose(); if (!m.userData.shared) m.dispose(); });
    });
    while (g.children.length) g.remove(g.children[0]);
  }

  // текстуры
  function shade(hex, l) { const c = new THREE.Color(hex); c.offsetHSL(0, 0, l); return '#' + c.getHexString(); }
  function woodTex(base) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 512; const g = cv.getContext('2d');
    const rng = C.createRng(11); const rows = 8, ph = 512 / rows;
    for (let r = 0; r < rows; r++) {
      let x = -rng.float(0, 300);
      while (x < 512) {
        const len = rng.float(220, 420);
        g.fillStyle = shade(base, rng.float(-0.05, 0.04)); g.fillRect(x, r * ph, len, ph);
        g.globalAlpha = 0.07;
        for (let k = 0; k < 7; k++) { g.fillStyle = k % 2 ? '#000' : '#fff'; g.fillRect(x, r * ph + rng.float(2, ph - 3), len, rng.float(0.6, 1.6)); }
        g.globalAlpha = 1; g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 1.2; g.strokeRect(x + 0.5, r * ph + 0.5, len, ph);
        x += len;
      }
    }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
  }
  function tileTex(base) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 512; const g = cv.getContext('2d');
    const rng = C.createRng(5), n = 4, s = 512 / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = shade(base, rng.float(-0.025, 0.02)); g.fillRect(i * s, j * s, s, s); }
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 4;
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, 512); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(512, i * s); g.stroke(); }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; return t;
  }

  function buildFloors() {
    dispose(floorG);
    const f = finish(), wood = woodTex(f.floor), tile = tileTex(f.tile);
    for (const r of C.ROOMS) {
      const w = r.x1 - r.x0, d = r.z1 - r.z0, isTile = r.type === 'bath', sz = isTile ? 1.2 : 2.0;
      const g = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / sz, (uv.getY(i) * d) / sz);
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: (isTile ? tile : wood), roughness: isTile ? 0.35 : 0.72 }));
      m.position.set((r.x0 + r.x1) / 2, 0.001, (r.z0 + r.z1) / 2); m.receiveShadow = true; floorG.add(m);
    }
  }

  let wallMat, capMat;
  function buildWalls() {
    dispose(wallG);
    const f = finish();
    wallMat = new THREE.MeshStandardMaterial({ color: f.wall, roughness: 0.92 });
    capMat = new THREE.MeshStandardMaterial({ color: f.cap, roughness: 0.8 });
    const mats = [wallMat, wallMat, capMat, wallMat, wallMat, wallMat];
    const glass = new THREE.MeshStandardMaterial({ color: 0xbfdbe8, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1, depthWrite: false });
    const frame = new THREE.MeshStandardMaterial({ color: 0xe9ebea, roughness: 0.6 });
    const trim = new THREE.MeshStandardMaterial({ color: 0xbfa07a, roughness: 0.6 });
    const top = st.cut && st.mode !== 'walk' ? 1.15 : C.H;
    const box = (r, y0, y1, mat) => {
      if (r.x1 - r.x0 < 1e-4 || r.z1 - r.z0 < 1e-4 || y1 - y0 < 1e-4) return;
      const m = new THREE.Mesh(new THREE.BoxGeometry(r.x1 - r.x0, y1 - y0, r.z1 - r.z0), mat);
      m.position.set((r.x0 + r.x1) / 2, (y0 + y1) / 2, (r.z0 + r.z1) / 2); m.castShadow = m.receiveShadow = true; wallG.add(m);
    };
    for (const w of C.WALLS) {
      let s = -w.t / 2; const end = w.len + w.t / 2;
      const inward = w.hor ? Math.sign(C.AD / 2 - w.a[1]) : Math.sign(C.AW / 2 - w.a[0]);
      for (const o of w.op) {
        box(C.wallRect(w, s, o.off), 0, top, mats);
        const r = C.wallRect(w, o.off, o.off + o.w);
        if (o.k === 'door') {
          if (top > C.DOOR_H) box(r, C.DOOR_H, top, mats);
          // наличники с двух сторон
          const tw = 0.06;
          for (const side of [-1, 1]) {
            const off = side * (w.t / 2 + 0.008);
            const post = (s0) => w.hor ? { x0: w.a[0] + s0, x1: w.a[0] + s0 + tw, z0: w.a[1] + off - 0.008, z1: w.a[1] + off + 0.008 } : { x0: w.a[0] + off - 0.008, x1: w.a[0] + off + 0.008, z0: w.a[1] + s0, z1: w.a[1] + s0 + tw };
            box(post(o.off - tw), 0, Math.min(C.DOOR_H + tw, top), trim);
            box(post(o.off + o.w), 0, Math.min(C.DOOR_H + tw, top), trim);
            if (top > C.DOOR_H) { const hd = w.hor ? { x0: w.a[0] + o.off - tw, x1: w.a[0] + o.off + o.w + tw, z0: w.a[1] + off - 0.008, z1: w.a[1] + off + 0.008 } : { x0: w.a[0] + off - 0.008, x1: w.a[0] + off + 0.008, z0: w.a[1] + o.off - tw, z1: w.a[1] + o.off + o.w + tw }; box(hd, C.DOOR_H, C.DOOR_H + tw, trim); }
          }
        } else {
          box(r, 0, Math.min(o.sill, top), mats);
          if (top > o.top) box(r, o.top, top, mats);
          if (top > o.sill) {
            const gy1 = Math.min(o.top, top);
            const gr = w.hor ? { x0: r.x0, x1: r.x1, z0: w.a[1] - 0.01, z1: w.a[1] + 0.01 } : { x0: w.a[0] - 0.01, x1: w.a[0] + 0.01, z0: r.z0, z1: r.z1 };
            const gm = new THREE.Mesh(new THREE.BoxGeometry(gr.x1 - gr.x0, gy1 - o.sill, gr.z1 - gr.z0), glass);
            gm.position.set((gr.x0 + gr.x1) / 2, (o.sill + gy1) / 2, (gr.z0 + gr.z1) / 2); wallG.add(gm);
            // рама и импост
            const fr = (a0, a1) => w.hor ? { x0: w.a[0] + a0, x1: w.a[0] + a1, z0: w.a[1] - 0.04, z1: w.a[1] + 0.04 } : { x0: w.a[0] - 0.04, x1: w.a[0] + 0.04, z0: w.a[1] + a0, z1: w.a[1] + a1 };
            box(fr(o.off, o.off + 0.05), o.sill, gy1, frame); box(fr(o.off + o.w - 0.05, o.off + o.w), o.sill, gy1, frame);
            box(fr(o.off + o.w / 2 - 0.025, o.off + o.w / 2 + 0.025), o.sill, gy1, frame);
            box(fr(o.off, o.off + o.w), o.sill, o.sill + 0.05, frame);
            if (gy1 === o.top) box(fr(o.off, o.off + o.w), o.top - 0.05, o.top, frame);
          }
          // подоконник
          const dep = 0.22, so = inward * (w.t / 2 + dep / 2 - 0.05);
          const sl = w.hor ? { x0: r.x0 - 0.05, x1: r.x1 + 0.05, z0: w.a[1] + so - dep / 2, z1: w.a[1] + so + dep / 2 } : { x0: w.a[0] + so - dep / 2, x1: w.a[0] + so + dep / 2, z0: r.z0 - 0.05, z1: r.z1 + 0.05 };
          if (top >= o.sill) box(sl, o.sill - 0.03, o.sill + 0.01, frame);
        }
        s = o.off + o.w;
      }
      box(C.wallRect(w, s, end), 0, top, mats);
    }
  }

  // материалы мебели
  const MATDEF = {
    woodL: [0xc9a77b, 0.65], woodD: [0x6b4a34, 0.6], fabric: [0x8a9a91, 0.95], fabric2: [0x9aaba1, 0.95], accent: [0xc59b5f, 0.9],
    white: [0xf1f0ec, 0.55], white2: [0xfbfaf7, 0.8], dark: [0x2c302e, 0.6], black: [0x111314, 0.3], metal: [0xb8bec0, 0.35, 0.6],
    ceramic: [0xfcfcfb, 0.15], water: [0x9fcbe0, 0.1], mirror: [0xcfdde3, 0.05, 0.9], tile: [0xdfe3e1, 0.3], glass: [0xcfe5ee, 0.05],
    book1: [0x6c8a7e, 0.8], book2: [0xb2754e, 0.8], book3: [0x3e5468, 0.8],
  };
