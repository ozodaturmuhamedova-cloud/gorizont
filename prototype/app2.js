  const MAT = {}, GMAT = {};
  for (const k in MATDEF) {
    const [c, r, m] = MATDEF[k];
    MAT[k] = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m || 0 }); MAT[k].userData.shared = true;
    GMAT[k] = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m || 0, transparent: true, opacity: 0.55, depthWrite: false }); GMAT[k].userData.shared = true;
  }
  MAT.water.transparent = true; MAT.water.opacity = 0.7;
  MAT.glass.transparent = true; MAT.glass.opacity = 0.3; MAT.glass.depthWrite = false;

  /** Процедурная модель предмета: спинка на -z, перед на +z, пол на y=0. */
  function buildMesh(item, ghost) {
    const g = new THREE.Group(), M = ghost ? GMAT : MAT;
    const [w, d, h] = item.size, bk = -d / 2;
    const B = (bw, bh, bd, x, y, z, m) => {
      const me = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), m);
      me.position.set(x, y, z); me.castShadow = !ghost; me.receiveShadow = !ghost; g.add(me); return me;
    };
    const legs = (lw, ld, lh, inset, m) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(0.04, lh, 0.04, sx * (lw / 2 - inset), lh / 2, sz * (ld / 2 - inset), m); };
    const seams = (n, y, hh, z, m) => { for (let i = 1; i < n; i++) B(0.008, hh, 0.01, -w / 2 + (i * w) / n, y, z, m); };
    switch (item.fam) {
      case 'bed':
        B(w, 0.28, d, 0, 0.14, 0, M.woodL);
        B(w - 0.06, 0.22, d - 0.14, 0, 0.39, 0.05, M.white2);
        B(w, h, 0.07, 0, h / 2, bk + 0.035, M.fabric);
        (w > 1.2 ? [-1, 1] : [0]).forEach((sx) => B(Math.min(0.56, w * 0.42), 0.12, 0.32, sx * w * 0.24, 0.56, bk + 0.3, M.white));
        B(w - 0.02, 0.06, d * 0.52, 0, 0.53, d * 0.2, M.accent);
        break;
      case 'nightstand':
        B(w, h - 0.08, d, 0, (h - 0.08) / 2 + 0.08, 0, M.woodL); legs(w, d, 0.08, 0.04, M.dark);
        B(w - 0.06, 0.01, 0.01, 0, h * 0.62, d / 2 + 0.004, M.dark);
        break;
      case 'wardrobe': case 'hallwardrobe': {
        const n = Math.max(2, Math.round(w / 0.5));
        B(w, h - 0.06, d, 0, (h - 0.06) / 2 + 0.06, 0, item.fam === 'wardrobe' ? M.white : M.woodL);
        B(w - 0.04, 0.06, d - 0.04, 0, 0.03, 0, M.dark);
        seams(n, h / 2 + 0.03, h - 0.12, d / 2 + 0.004, M.dark);
        for (let i = 0; i < n; i++) B(0.02, 0.28, 0.025, -w / 2 + ((i + (i % 2 ? 0.12 : 0.88)) * w) / n, 1.05, d / 2 + 0.015, M.metal);
        if (item.fam === 'hallwardrobe') B(w / n - 0.08, h - 0.4, 0.008, -w / 2 + w / n / 2, h / 2 + 0.05, d / 2 + 0.01, M.mirror);
        break;
      }
      case 'dresser':
        B(w, h - 0.1, d, 0, (h - 0.1) / 2 + 0.1, 0, M.woodD); legs(w, d, 0.1, 0.05, M.dark);
        for (let i = 1; i < 3; i++) B(w - 0.04, 0.008, 0.01, 0, 0.1 + (i * (h - 0.1)) / 3, d / 2 + 0.004, M.dark);
        break;
      case 'desk':
        B(w, 0.035, d, 0, h - 0.018, 0, M.woodL); legs(w, d, h - 0.035, 0.04, M.dark);
        B(0.55, 0.32, 0.02, 0.15, h + 0.2, bk + 0.12, M.black);
        break;
      case 'kitchen':
        B(w, 0.76, d - 0.03, 0, 0.1 + 0.38, -0.015, M.white);
        B(w - 0.02, 0.1, d - 0.08, 0, 0.05, -0.04, M.dark);
        B(w, 0.04, d, 0, 0.88, 0, M.woodL);
        B(w, 0.72, 0.34, 0, 1.43 + 0.36, bk + 0.17, M.white);
        B(w, 0.55, 0.01, 0, 0.9 + 0.275, bk + 0.005, M.tile);
        seams(Math.round(w / 0.6), 0.48, 0.74, d / 2 - 0.025, M.dark);
        for (let i = 1; i < Math.round(w / 0.6); i++) B(0.008, 0.7, 0.01, -w / 2 + (i * w) / Math.round(w / 0.6), 1.79, bk + 0.345, M.dark);
        B(0.58, 0.01, 0.5, w / 2 - 0.5, 0.905, 0.02, M.black);
        B(0.5, 0.012, 0.42, -w / 2 + 0.55, 0.903, 0.02, M.metal);
        B(0.03, 0.22, 0.03, -w / 2 + 0.55, 1.01, bk + 0.08, M.metal);
        break;
      case 'fridge':
        B(w, h, d, 0, h / 2, 0, M.metal);
        B(w - 0.02, 0.01, 0.01, 0, h * 0.62, d / 2 + 0.004, M.dark);
        B(0.02, 0.32, 0.03, w / 2 - 0.06, h * 0.78, d / 2 + 0.02, M.dark);
        B(0.02, 0.32, 0.03, w / 2 - 0.06, h * 0.45, d / 2 + 0.02, M.dark);
        break;
      case 'sofa': case 'armchair': {
        const arm = 0.16, n = item.fam === 'armchair' ? 1 : w > 1.9 ? 3 : 2;
        B(w, 0.3, d, 0, 0.19, 0, M.fabric);
        B(w, 0.46, 0.2, 0, 0.34 + 0.23, bk + 0.1, M.fabric);
        for (const sx of [-1, 1]) B(arm, 0.58, d, sx * (w / 2 - arm / 2), 0.33, 0, M.fabric);
        const cw = (w - 2 * arm) / n;
        for (let i = 0; i < n; i++) {
          B(cw - 0.02, 0.12, d - 0.24, -w / 2 + arm + cw * (i + 0.5), 0.4, 0.1, M.fabric2);
          B(cw - 0.04, 0.34, 0.12, -w / 2 + arm + cw * (i + 0.5), 0.63, bk + 0.25, M.fabric2);
        }
        legs(w, d, 0.04, 0.06, M.dark);
        break;
      }
      case 'coffee':
        B(w, 0.04, d, 0, h - 0.02, 0, M.woodD); legs(w, d, h - 0.04, 0.05, M.dark);
        B(w - 0.12, 0.02, d - 0.12, 0, 0.12, 0, M.woodD);
        break;
      case 'tvstand':
        B(w, 0.4, d, 0, 0.25, 0, M.woodD); legs(w, d, 0.05, 0.05, M.dark);
        seams(3, 0.25, 0.36, d / 2 + 0.004, M.dark);
        B(0.3, 0.02, 0.2, 0, 0.46, bk + 0.14, M.dark); B(0.05, 0.12, 0.03, 0, 0.53, bk + 0.12, M.dark);
        B(1.23, 0.71, 0.04, 0, 0.59 + 0.355, bk + 0.12, M.black);
        break;
      case 'dining':
        B(w, 0.04, d, 0, h - 0.02, 0, M.woodL); legs(w, d, h - 0.04, 0.06, M.woodD);
        break;
      case 'chair':
        B(w, 0.045, d * 0.9, 0, 0.45, 0.02, M.woodL);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(0.03, 0.45, 0.03, sx * (w / 2 - 0.03), 0.225, sz * (d * 0.45 - 0.03) + 0.02, M.woodD);
        for (const sx of [-1, 1]) B(0.03, 0.45, 0.03, sx * (w / 2 - 0.03), 0.45 + 0.225, bk + 0.045, M.woodD);
        B(w, 0.2, 0.025, 0, 0.45 + 0.34, bk + 0.045, M.woodL);
        break;
      case 'shelf': {
        for (const sx of [-1, 1]) B(0.02, h, d, sx * (w / 2 - 0.01), h / 2, 0, M.woodL);
        const n = 5;
        for (let i = 0; i < n; i++) B(w - 0.04, 0.02, d, 0, 0.02 + (i * (h - 0.04)) / (n - 1), 0, M.woodL);
        const bm = [M.book1, M.book2, M.book3]; let k = 0;
        for (let i = 0; i < n - 1; i++) { let x = -w / 2 + 0.05; while (x < w / 2 - 0.12) { const bw = 0.03 + ((k * 7) % 5) * 0.012, bh = 0.2 + ((k * 3) % 4) * 0.025; B(bw, bh, d * 0.7, x + bw / 2, 0.03 + (i * (h - 0.04)) / (n - 1) + bh / 2, 0, bm[k % 3]); x += bw + 0.006; k++; if (k % 9 === 0) x += 0.1; } }
        break;
      }
      case 'bathtub':
        B(w, h, d, 0, h / 2, 0, M.ceramic);
        B(w - 0.14, 0.02, d - 0.14, 0, h - 0.06, 0, M.water);
        B(0.03, 0.2, 0.03, 0, h + 0.12, bk + 0.05, M.metal);
        break;
      case 'shower':
        B(w, 0.12, d, 0, 0.06, 0, M.ceramic);
        B(w, h - 0.12, 0.01, 0, 0.12 + (h - 0.12) / 2, d / 2, M.glass);
        B(0.01, h - 0.12, d, w / 2, 0.12 + (h - 0.12) / 2, 0, M.glass);
        B(0.25, 0.02, 0.25, 0, h - 0.05, bk + 0.2, M.metal);
        break;
      case 'toilet':
        B(w + 0.12, 1.1, 0.14, 0, 0.55, bk + 0.07, M.white2);
        B(w, 0.3, d - 0.18, 0, 0.36, bk + 0.14 + (d - 0.18) / 2, M.ceramic);
        B(w - 0.02, 0.03, d - 0.2, 0, 0.525, bk + 0.15 + (d - 0.2) / 2, M.white);
        B(0.2, 0.13, 0.012, 0, 0.98, bk + 0.145, M.metal);
        break;
      case 'sink':
        B(w, 0.48, d, 0, 0.55, 0, M.woodL);
        B(w + 0.02, 0.1, d + 0.02, 0, 0.84, 0, M.ceramic);
        B(w - 0.16, 0.02, d - 0.16, 0, 0.885, 0.01, M.white);
        B(0.03, 0.17, 0.03, 0, 0.97, bk + 0.06, M.metal);
        B(w * 0.9, 0.7, 0.02, 0, 1.55, bk + 0.01, M.mirror);
        break;
      case 'washer': {
        B(w, h, d, 0, h / 2, 0, M.white);
        const door = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 32).rotateX(Math.PI / 2), M.dark);
        door.position.set(0, 0.42, d / 2 + 0.01); g.add(door);
        B(w - 0.04, 0.06, 0.01, 0, h - 0.07, d / 2 + 0.004, M.dark);
        break;
      }
      case 'shoe':
        B(w, h - 0.03, d, 0, (h - 0.03) / 2, 0, M.white); B(w, 0.03, d, 0, h - 0.015, 0, M.woodL);
        seams(2, (h - 0.03) / 2, h - 0.1, d / 2 + 0.004, M.dark);
        break;
      case 'bench':
        B(w, 0.08, d, 0, h - 0.04, 0, M.fabric2); legs(w, d, h - 0.08, 0.04, M.woodD);
        break;
      default:
        B(w, h, d, 0, h / 2, 0, M.white);
    }
    return g;
  }

  // ---------- рендер мебели и подсказок ----------
  const meshes = new Map();
  function renderFurniture() {
    dispose(furnG); meshes.clear();
    for (const e of st.placed) {
      const g = buildMesh(e.item, false);
      g.position.set(e.p.x, 0, e.p.z); g.rotation.y = e.p.rot; g.userData.uid = e.uid;
      furnG.add(g); meshes.set(e.uid, g);
    }
  }
  function obbMesh(o, color, opacity, y) {
    const grp = new THREE.Group();
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(o.hx * 2, o.hz * 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    grp.add(pl);
    const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([a, b]) => new THREE.Vector3(a * o.hx, 0.002, b * o.hz));
    grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity: Math.min(1, opacity * 2.4) })));
    grp.position.set(o.cx, y, o.cz); grp.rotation.y = Math.atan2(-o.ux[1], o.ux[0]);
    return grp;
  }
  function renderHelpers() {
    dispose(helpG);
    if (st.mode === 'walk') return;
    for (const e of st.placed) {
      const v = e.v;
      if (st.zones) helpG.add(obbMesh(e.C, 0x2c6a57, 0.1, 0.006));
      if (v && v.status !== 'ok' && e.uid !== (st.drag && st.drag.uid)) helpG.add(obbMesh(e.F, STATUS_HEX[v.status], 0.35, 0.012));
    }
    const sel = st.drag ? { item: st.drag.entry.item, p: st.drag.pose, v: st.drag.v } : st.ghost ? { item: st.ghost.item, p: st.ghost.pose, v: st.ghost.v } : st.selected ? byUid(st.selected) : null;
    if (sel && sel.p) {
      const v = sel.v || { status: 'ok' };
      helpG.add(obbMesh(C.clBox(sel.item, sel.p), STATUS_HEX[v.status], 0.12, 0.008));
      helpG.add(obbMesh(C.fp(sel.item, sel.p), STATUS_HEX[v.status], 0.5, 0.014));
    }
  }
  const byUid = (u) => st.placed.find((e) => e.uid === u);

  // ---------- проверки ----------
  function others(exceptUid) { return st.placed.filter((e) => e.uid !== exceptUid); }
  function revalidate() {
    for (const e of st.placed) e.v = C.validate(e.item, e.p, others(e.uid));
    st.walkCheck = C.walkCheck(st.placed, C.collisionRadius(st.heightCm || 170));
  }
  function commit() {
    revalidate(); renderFurniture(); renderHelpers(); renderEstimate(); renderBar(); drawMini(); save();
  }

  // ---------- камера и управление ----------
  let controls = null;
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    R.setSize(w, h, false); camera.aspect = w / Math.max(h, 1); camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitV = new THREE.Vector3();
  function setNdc(ev) { const r = R.domElement.getBoundingClientRect(); ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); }
  function floorHit() { ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(floorPlane, hitV) ? { x: hitV.x, z: hitV.z } : null; }
  function pickFurniture() {
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(furnG.children, true)[0];
    if (!hit) return null;
    let o = hit.object; while (o && o.parent !== furnG) o = o.parent;
    return o ? o.userData.uid : null;
  }

  const tip = $('#tip');
  function showTip(ev, v, name) {
    if (!v || !ev) { tip.hidden = true; return; }
    const r = stage.getBoundingClientRect();
    const head = v.status === 'error' ? 'Нельзя поставить' : v.status === 'warning' ? 'Можно, но есть замечание' : 'Хорошее место';
    tip.innerHTML = '';
    const b = document.createElement('div'); b.textContent = (name ? name + ' · ' : '') + head; tip.appendChild(b);
    if (v.reasons && v.reasons.length) { const i = document.createElement('i'); i.textContent = v.reasons[0]; tip.appendChild(i); }
    tip.style.left = Math.min(ev.clientX - r.left, r.width - 250) + 'px'; tip.style.top = Math.min(ev.clientY - r.top, r.height - 60) + 'px';
    tip.hidden = false;
  }

  let toastT = 0;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; t.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => { t.style.opacity = 0; setTimeout(() => (t.hidden = true), 220); }, 2400); }

  function startGhost(id) {
    if (st.mode === 'walk') exitWalk();
    const item = C.CAT[id];
    st.selected = null;
    ndc.set(0, 0); const h = floorHit() || { x: 7, z: 3.5 };
    const room = C.roomAt(h.x, h.z) || C.ROOMS[1];
    const pose = C.snapPose(item, { x: (room.ix0 + room.ix1) / 2, z: (room.iz0 + room.iz1) / 2, rot: 0 }, false);
    if (st.ghost) furnG.remove(st.ghost.mesh);
    const mesh = buildMesh(item, true); furnG.add(mesh);
    st.ghost = { item, pose, mesh, v: null, noSnap: false };
    updateGhost(pose);
    renderCatalog(); renderBar(); setHint();
  }
  function updateGhost(p, ev) {
    const g = st.ghost; if (!g) return;
    g.pose = C.snapPose(g.item, p, g.noSnap);
    g.v = C.validate(g.item, g.pose, st.placed);
    g.mesh.position.set(g.pose.x, 0, g.pose.z); g.mesh.rotation.y = g.pose.rot;
    renderHelpers(); renderBar();
    if (ev && ev.pointerType === 'mouse') showTip(ev, g.v);
  }
  function cancelGhost() {
    if (!st.ghost) return;
    furnG.remove(st.ghost.mesh); dispose(st.ghost.mesh); st.ghost = null; tip.hidden = true;
    renderHelpers(); renderCatalog(); renderBar(); setHint();
  }
  function placeGhost() {
    const g = st.ghost; if (!g) return;
    if (g.v.status === 'error') { toast('Нельзя поставить: ' + g.v.reasons[0].toLowerCase()); return; }
    const e = makeEntry(g.item.id, g.pose, st.uid++);
    st.placed.push(e);
    furnG.remove(g.mesh); st.ghost = null; tip.hidden = true;
    st.selected = e.uid;
    commit(); renderCatalog(); setHint();
    if (e.v.status === 'warning') toast('Поставлено с замечанием: ' + e.v.reasons[0].toLowerCase());
  }
  function rotateActive(dir) {
    const step = (dir * Math.PI) / 12;
    if (st.ghost) { st.ghost.noSnap = true; updateGhost({ x: st.ghost.pose.x, z: st.ghost.pose.z, rot: st.ghost.pose.rot + step }); return; }
    const e = st.selected && byUid(st.selected); if (!e) return;
    const p = { x: e.p.x, z: e.p.z, rot: e.p.rot + step };
    const v = C.validate(e.item, p, others(e.uid));
    if (v.status === 'error') { toast('Не помещается при повороте: ' + v.reasons[0].toLowerCase()); return; }
    Object.assign(e, makeEntry(e.id, p, e.uid)); commit();
  }
  function removeSelected() {
    const e = st.selected && byUid(st.selected); if (!e) return;
    st.placed = st.placed.filter((x) => x !== e); st.selected = null; commit(); toast('Удалено: ' + e.item.name);
  }
  function select(uid) { st.selected = uid; renderHelpers(); renderBar(); setHint(); renderEstimate(); }

  // указатель
  const cv = R.domElement;
  let down = null;
  cv.addEventListener('pointerdown', (ev) => {
    if (st.mode === 'walk') return walkPointerDown(ev);
    if (ev.button !== 0) return;
    setNdc(ev);
    down = { x: ev.clientX, y: ev.clientY, type: ev.pointerType };
    if (st.ghost) return;
    const uid = pickFurniture();
    if (uid) {
      const e = byUid(uid), h = floorHit();
      if (!e || !h) return;
      controls.enabled = false;
      st.selected = uid;
      st.drag = { uid, entry: e, off: { x: h.x - e.p.x, z: h.z - e.p.z }, pose: Object.assign({}, e.p), moved: false, v: e.v, noSnap: false };
      cv.setPointerCapture(ev.pointerId);
      renderBar(); renderHelpers();
    }
  });
  cv.addEventListener('pointermove', (ev) => {
    if (st.mode === 'walk') return walkPointerMove(ev);
    setNdc(ev);
    if (st.ghost && (ev.pointerType === 'mouse' || (down && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) < 6))) {
      if (ev.pointerType !== 'mouse' && !down) return;
      const h = floorHit(); if (h) { st.ghost.noSnap = ev.altKey; updateGhost({ x: h.x, z: h.z, rot: st.ghost.pose.rot }, ev); }
      return;
    }
    const d = st.drag;
    if (d) {
      if (!d.moved && down && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) < 4) return;
      d.moved = true;
      const h = floorHit(); if (!h) return;
      d.pose = C.snapPose(d.entry.item, { x: h.x - d.off.x, z: h.z - d.off.z, rot: d.pose.rot }, ev.altKey);
      d.v = C.validate(d.entry.item, d.pose, others(d.uid));
      const m = meshes.get(d.uid); m.position.set(d.pose.x, 0, d.pose.z); m.rotation.y = d.pose.rot;
      renderHelpers(); renderBar(); showTip(ev, d.v, d.entry.item.name);
      return;
    }
    if (ev.pointerType === 'mouse') { const u = pickFurniture(); cv.style.cursor = u ? 'grab' : ''; }
  });
  cv.addEventListener('pointerup', (ev) => {
    if (st.mode === 'walk') return walkPointerUp(ev);
    const moved = down ? Math.hypot(ev.clientX - down.x, ev.clientY - down.y) : 99;
    const d = st.drag;
    if (d) {
      controls.enabled = true; st.drag = null; tip.hidden = true;
      if (d.moved) {
        if (d.v.status === 'error') { toast('Нельзя поставить: ' + d.v.reasons[0].toLowerCase()); }
        else Object.assign(d.entry, makeEntry(d.entry.id, d.pose, d.uid));
        commit();
      } else { renderHelpers(); renderBar(); renderEstimate(); }
      setHint(); down = null; return;
    }
    if (st.ghost && moved < 6) {
      setNdc(ev); const h = floorHit();
      if (ev.pointerType === 'mouse') { if (h) updateGhost({ x: h.x, z: h.z, rot: st.ghost.pose.rot }); placeGhost(); }
      else if (h) updateGhost({ x: h.x, z: h.z, rot: st.ghost.pose.rot });
    } else if (!st.ghost && moved < 6 && st.selected) { select(null); }
    down = null;
  });
  cv.addEventListener('pointerleave', () => { tip.hidden = true; });

  // ---------- прогулка ----------
  const walker = { x: C.START.x, z: C.START.z, yaw: 0, pitch: 0, eye: 1.6, r: 0.22 };
  const keys = {}, joy = { x: 0, y: 0, id: null };
  let orbitSaved = null, tween = null, locked = false, look = null;
  const coarse = window.matchMedia('(pointer: coarse)').matches;

  function openHeight(thenWalk) {
    const dlg = $('#hdlg'); dlg.hidden = false; dlg.dataset.walk = thenWalk ? '1' : '';
    const h = st.heightCm || 170; $('#hNum').value = h; $('#hRange').value = h; heightPreview();
    setTimeout(() => $('#hNum').focus(), 30);
  }
  function heightPreview() {
    const h = Number($('#hNum').value), ok = C.validHeight(h);
    $('#hOk').disabled = !ok;
    $('#hMsg').textContent = ok ? '' : 'Укажите рост от 100 до 220 см';
    if (!ok) return;
    $('#hEye').textContent = f2(C.eyeHeight(h)) + ' м'; $('#hSpd').textContent = f1(C.walkSpeed(h)) + ' м/с';
    // 2,70 м потолка = 88 px
    const px = (m) => 94 - (m / C.H) * 88;
    const top = px(h / 100), eye = px(C.eyeHeight(h));
    const fig = $('#hFig'); fig.children[0].setAttribute('cy', top + 6); fig.children[1].setAttribute('y', top + 13); fig.children[1].setAttribute('height', Math.max(10, 90 - (top + 13)));
    $('#hEyeLine').setAttribute('y1', eye); $('#hEyeLine').setAttribute('y2', eye);
  }
  $('#hNum').addEventListener('input', () => { $('#hRange').value = $('#hNum').value; heightPreview(); });
  $('#hRange').addEventListener('input', () => { $('#hNum').value = $('#hRange').value; heightPreview(); });
  $('#hCancel').addEventListener('click', () => { $('#hdlg').hidden = true; });
  $('#hform').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const h = Math.round(Number($('#hNum').value));
    if (!C.validHeight(h)) return;
    st.heightCm = h; LS.set(HKEY, h); $('#hdlg').hidden = true;
    revalidate(); renderEstimate();
    if (st.mode === 'walk') { walker.r = C.collisionRadius(h); resolve(); updateHud(); }
    else if ($('#hdlg').dataset.walk) startWalk();
  });

  function furnObbs() { return st.placed.map((e) => e.F); }
  function resolve() { C.resolveWalk(walker, walker.r, furnObbs()); }

  function enterWalk() { if (!C.validHeight(st.heightCm)) { openHeight(true); return; } startWalk(); }
  function startWalk() {
    if (!C.validHeight(st.heightCm)) return; // без роста в прогулку войти нельзя
    cancelGhost(); st.selected = null; st.drag = null;
    orbitSaved = { pos: camera.position.clone(), target: controls.target.clone() };
    controls.enabled = false;
    st.mode = 'walk';
    Object.assign(walker, { x: C.START.x, z: C.START.z, yaw: 0, pitch: -0.04, r: C.collisionRadius(st.heightCm) });
    walker.eye = C.camHeight(st.heightCm); resolve();
    ceiling.visible = true; buildWalls(); renderHelpers();
    camera.fov = 66; camera.updateProjectionMatrix();
    const to = new THREE.Object3D(); to.position.set(walker.x, walker.eye, walker.z); to.rotation.order = 'YXZ'; to.rotation.set(walker.pitch, walker.yaw, 0);
    tween = { t: 0, dur: 0.8, fp: camera.position.clone(), fq: camera.quaternion.clone(), tp: to.position.clone(), tq: to.quaternion.clone(), done: () => { tween = null; } };
    uiMode();
  }
  function exitWalk() {
    if (st.mode !== 'walk') return;
    if (document.pointerLockElement) try { document.exitPointerLock(); } catch (e) { /* нет блокировки */ }
    st.mode = 'orbit'; ceiling.visible = false; buildWalls();
    camera.fov = 45; camera.updateProjectionMatrix();
    const pos = orbitSaved ? orbitSaved.pos : new THREE.Vector3(12.8, 11.5, 15.5), tgt = orbitSaved ? orbitSaved.target : TARGET.clone();
    const to = new THREE.PerspectiveCamera(); to.position.copy(pos); to.lookAt(tgt);
    tween = { t: 0, dur: 0.8, fp: camera.position.clone(), fq: camera.quaternion.clone(), tp: pos.clone(), tq: to.quaternion.clone(), done: () => { tween = null; controls.target.copy(tgt); controls.enabled = true; controls.update(); } };
    renderHelpers(); uiMode();
  }

  function walkPointerDown(ev) {
    if (ev.target !== cv) return;
    if (ev.pointerType === 'mouse' && !locked && cv.requestPointerLock) {
      try { const p = cv.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* блокировка недоступна */ }
    }
    if (!locked) { look = { id: ev.pointerId, x: ev.clientX, y: ev.clientY }; try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* ок */ } }
  }
  function walkPointerMove(ev) {
    if (locked) return;
    if (look && look.id === ev.pointerId) {
      const k = ev.pointerType === 'mouse' ? 0.005 : 0.007;
      walker.yaw -= (ev.clientX - look.x) * k; walker.pitch -= (ev.clientY - look.y) * k;
      walker.pitch = Math.max(-1.3, Math.min(1.3, walker.pitch)); look.x = ev.clientX; look.y = ev.clientY;
    }
  }
  function walkPointerUp(ev) { if (look && look.id === ev.pointerId) look = null; }
  document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === cv; uiMode(); });
  document.addEventListener('mousemove', (ev) => {
    if (!locked || st.mode !== 'walk') return;
    walker.yaw -= ev.movementX * 0.0022; walker.pitch -= ev.movementY * 0.0022;
    walker.pitch = Math.max(-1.3, Math.min(1.3, walker.pitch));
  });

  // джойстик
  const joyEl = $('#joy'), knob = $('#joyK');
  joyEl.addEventListener('pointerdown', (ev) => { joy.id = ev.pointerId; joyEl.setPointerCapture(ev.pointerId); joyMove(ev); ev.stopPropagation(); });
  joyEl.addEventListener('pointermove', (ev) => { if (joy.id === ev.pointerId) joyMove(ev); });
  const joyEnd = () => { joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; };
  joyEl.addEventListener('pointerup', joyEnd); joyEl.addEventListener('pointercancel', joyEnd);
  function joyMove(ev) {
    const r = joyEl.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R0 = r.width / 2 - 20;
    let dx = ev.clientX - cx, dy = ev.clientY - cy; const l = Math.hypot(dx, dy); if (l > R0) { dx *= R0 / l; dy *= R0 / l; }
    knob.style.transform = `translate(${dx}px,${dy}px)`; joy.x = dx / R0; joy.y = -dy / R0;
  }

  function walkStep(dt) {
    const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + joy.y;
    const side = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
    const l = Math.hypot(fwd, side);
    const target = C.camHeight(st.heightCm);
    walker.eye += (target - walker.eye) * Math.min(1, dt * 5);
    if (l > 0.01) {
      const k = Math.min(1, l) / l, sp = C.walkSpeed(st.heightCm) * (keys.ShiftLeft || keys.ShiftRight ? 1.5 : 1);
      const fx = -Math.sin(walker.yaw), fz = -Math.cos(walker.yaw), rx = Math.cos(walker.yaw), rz = -Math.sin(walker.yaw);
      let dx = (fx * fwd + rx * side) * k * sp * dt, dz = (fz * fwd + rz * side) * k * sp * dt;
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.05));
      for (let i = 0; i < steps; i++) { walker.x += dx / steps; walker.z += dz / steps; resolve(); }
    }
    camera.position.set(walker.x, walker.eye, walker.z);
    camera.rotation.order = 'YXZ'; camera.rotation.set(walker.pitch, walker.yaw, 0);
  }
  let hudRoom = null, hudT = 0;
  function updateHud() {
    const r = C.roomAt(walker.x, walker.z);
    const key = (r ? r.id : '') + st.heightCm;
    if (key === hudRoom) return; hudRoom = key;
    $('#hudRoom').textContent = r ? r.name + ' · ' + f1(r.area) + ' м²' : 'Квартира';
    const eye = C.eyeHeight(st.heightCm), cam = C.camHeight(st.heightCm);
    $('#hudH').textContent = st.heightCm + ' см';
    $('#hudEye').textContent = f2(cam) + ' м';
    $('#hudCeil').textContent = f2(C.H - cam) + ' м';
    $('#hudWarn').hidden = eye < C.H - 0.1;
  }

  // ---------- клавиатура ----------
  window.addEventListener('keydown', (ev) => {
    if (ev.target.closest && ev.target.closest('input,select,textarea')) return;
    if (!$('#hdlg').hidden) { if (ev.key === 'Escape') $('#hdlg').hidden = true; return; }
    keys[ev.code] = true;
    if (st.mode === 'walk') {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code)) ev.preventDefault();
      if (ev.code === 'Escape' && !locked) exitWalk();
      return;
    }
    if (ev.code === 'KeyQ') rotateActive(1);
    else if (ev.code === 'KeyE') rotateActive(-1);
    else if ((ev.code === 'Delete' || ev.code === 'Backspace') && st.selected) { ev.preventDefault(); removeSelected(); }
    else if (ev.code === 'Escape') { if (st.ghost) cancelGhost(); else select(null); }
    else if (ev.code === 'Enter' && st.ghost) placeGhost();
  });
  window.addEventListener('keyup', (ev) => { keys[ev.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  // ---------- мини-план ----------
  const mini = $('#miniCv'), mctx = mini.getContext('2d');
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function drawMini() {
    const W = mini.width, H2 = mini.height, s = Math.min(W / (C.AW + 0.4), H2 / (C.AD + 0.4)), ox = (W - C.AW * s) / 2, oz = (H2 - C.AD * s) / 2;
    const X = (x) => ox + x * s, Z = (z) => oz + z * s;
    mctx.clearRect(0, 0, W, H2);
    for (const r of C.ROOMS) { mctx.fillStyle = r.type === 'bath' ? css('--sunk') : css('--panel'); mctx.fillRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * s, (r.z1 - r.z0) * s); }
    const poly = (o, fill, stroke) => { const cs = C.corners(o); mctx.beginPath(); [cs[0], cs[1], cs[3], cs[2]].forEach(([x, z], i) => (i ? mctx.lineTo(X(x), Z(z)) : mctx.moveTo(X(x), Z(z)))); mctx.closePath(); if (fill) { mctx.fillStyle = fill; mctx.fill(); } if (stroke) { mctx.strokeStyle = stroke; mctx.lineWidth = 1.5; mctx.stroke(); } };
    for (const e of st.placed) {
      const col = e.v && e.v.status === 'error' ? css('--err') : e.v && e.v.status === 'warning' ? css('--warn') : css('--muted');
      poly(e.F, e.uid === st.selected ? css('--accent') : col + '55', e.uid === st.selected ? css('--accent') : col);
    }
    if (st.ghost) poly(C.fp(st.ghost.item, st.ghost.pose), css('--accent') + '66', css('--accent'));
    mctx.fillStyle = css('--fg'); for (const o of C.COLL) poly(o, css('--fg'));
    mctx.strokeStyle = css('--accent'); mctx.lineWidth = 3;
    for (const w of C.WALLS) for (const o of w.op) if (o.k === 'win') { const r = C.wallRect(w, o.off, o.off + o.w); mctx.beginPath(); if (w.hor) { mctx.moveTo(X(r.x0), Z(w.a[1])); mctx.lineTo(X(r.x1), Z(w.a[1])); } else { mctx.moveTo(X(w.a[0]), Z(r.z0)); mctx.lineTo(X(w.a[0]), Z(r.z1)); } mctx.stroke(); }
    if (st.mode === 'walk') {
      const px = X(walker.x), pz = Z(walker.z), a = -walker.yaw - Math.PI / 2, fov = 0.6;
      mctx.fillStyle = css('--brass') + '55'; mctx.beginPath(); mctx.moveTo(px, pz); mctx.arc(px, pz, 2.4 * s, a - fov, a + fov); mctx.closePath(); mctx.fill();
      mctx.fillStyle = css('--brass'); mctx.beginPath(); mctx.arc(px, pz, Math.max(4, walker.r * s), 0, Math.PI * 2); mctx.fill();
    }
  }

  // ---------- интерфейс ----------
  function setHint() {
    let t;
    if (st.mode === 'walk') t = coarse ? 'Джойстик — идти · свайп справа — осмотреться' : 'W A S D — идти · мышь — осмотреться · Shift — быстрее · Esc — отпустить мышь';
    else if (st.ghost) t = coarse ? 'Коснитесь пола, чтобы передвинуть предмет, затем «Поставить»' : 'Клик по полу — поставить · Q / E — поворот на 15° · Alt — без притяжения к стене · Esc — отмена';
    else if (st.selected) t = 'Перетащите предмет · Q / E — поворот · Delete — удалить · Esc — снять выбор';
    else t = coarse ? 'Выберите предмет в каталоге или коснитесь мебели в сцене' : 'Выберите предмет в каталоге или перетащите мебель в сцене · правая кнопка — сдвиг, колесо — масштаб';
    $('#hintT').textContent = t;
  }
  function pillHtml(v) { const s = v ? v.status : 'ok'; const cls = s === 'error' ? 'err' : s === 'warning' ? 'warn' : 'ok'; const label = s === 'error' ? 'Не помещается' : s === 'warning' ? 'Есть замечание' : 'Всё хорошо'; return `<span class="pill ${cls}">${label}</span>`; }
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function renderBar() {
    const bar = $('#bar');
    if (st.mode === 'walk') { bar.hidden = true; return; }
    if (st.ghost) {
      const v = st.ghost.v;
      bar.innerHTML = `<span class="t">${esc(st.ghost.item.name)}</span>${pillHtml(v)}<span class="s ${v && v.reasons.length ? '' : 'unit'}">${esc(v && v.reasons[0] ? v.reasons[0] : 'Выберите место')}</span>
        <button class="btn" data-a="rl" aria-label="Повернуть влево на 15°">↺</button><button class="btn" data-a="rr" aria-label="Повернуть вправо на 15°">↻</button>
        <button class="btn primary" data-a="place">Поставить</button><button class="btn ghost" data-a="cancel">Отмена</button>`;
      bar.hidden = false; return;
    }
    const e = st.selected && byUid(st.selected);
    if (!e) { bar.hidden = true; return; }
    const v = st.drag && st.drag.uid === e.uid ? st.drag.v : e.v;
    bar.innerHTML = `<span class="t">${esc(e.item.name)}</span>${pillHtml(v)}<span class="s">${esc(v && v.reasons[0] ? v.reasons[0] : rub(e.item.price))}</span>
      <button class="btn" data-a="rl" aria-label="Повернуть влево на 15°">↺</button><button class="btn" data-a="rr" aria-label="Повернуть вправо на 15°">↻</button>
      <button class="btn danger" data-a="del">Удалить</button>`;
    bar.hidden = false;
  }
  $('#bar').addEventListener('click', (ev) => {
    const a = ev.target.closest('[data-a]'); if (!a) return;
    ({ rl: () => rotateActive(1), rr: () => rotateActive(-1), place: placeGhost, cancel: cancelGhost, del: removeSelected })[a.dataset.a]();
  });

  function renderCatalog() {
    const tabs = $('#tabs');
    tabs.innerHTML = ROOM_TABS.map(([k, n]) => `<button data-t="${k}" aria-pressed="${st.tab === k}">${n}</button>`).join('');
    const list = C.LIST.filter((it) => st.tab === 'all' || (C.CAT[it.id].rooms || []).includes(st.tab));
    $('#items').innerHTML = list.map((it) => {
      const x = C.CAT[it.id];
      return `<li><button class="item" data-id="${x.id}" aria-pressed="${!!(st.ghost && st.ghost.item.id === x.id)}"><span class="n">${esc(x.name)}</span><span class="p">${rub(x.price)}</span><span class="d">${mm(x.size[0])} × ${mm(x.size[1])} × ${mm(x.size[2])} мм</span></button></li>`;
    }).join('');
  }
  $('#tabs').addEventListener('click', (ev) => { const b = ev.target.closest('[data-t]'); if (b) { st.tab = b.dataset.t; renderCatalog(); } });
  $('#items').addEventListener('click', (ev) => { const b = ev.target.closest('[data-id]'); if (!b) return; if (st.ghost && st.ghost.item.id === b.dataset.id) cancelGhost(); else startGhost(b.dataset.id); });

  function renderEstimate() {
    const f = finish(), counts = new Map();
    for (const e of st.placed) { const c = counts.get(e.id) || { item: e.item, n: 0 }; c.n++; counts.set(e.id, c); }
    const furnSum = st.placed.reduce((s, e) => s + e.item.price, 0), finSum = Math.round(f.price * C.AREA), total = APT_PRICE + furnSum + finSum;
    const lines = [...counts.values()].sort((a, b) => b.item.price * b.n - a.item.price * a.n)
      .map((c) => `<li><span>${esc(c.item.name)}${c.n > 1 ? ` <span class="q">× ${c.n}</span>` : ''}</span><span class="v">${rub(c.item.price * c.n)}</span></li>`).join('');
    const probs = st.placed.filter((e) => e.v && e.v.status !== 'ok');
    const wc = st.walkCheck || { rooms: [], items: [] };
    let checks = '';
    if (!wc.rooms.length && !wc.items.length) checks += `<li class="ok"><span class="dot"></span><span>Проход есть во все комнаты и ко всей мебели <span class="m">(рост ${st.heightCm || 170} см)</span></span></li>`;
    wc.rooms.forEach((n) => (checks += `<li class="err"><span class="dot"></span><span>Нет прохода: ${esc(n)}</span></li>`));
    wc.items.forEach((e) => (checks += `<li class="err"><span class="dot"></span><span><button data-u="${e.uid}">${esc(e.item.name)}</button> — не подойти</span></li>`));
    probs.forEach((e) => (checks += `<li class="${e.v.status === 'error' ? 'err' : 'warn'}"><span class="dot"></span><span><button data-u="${e.uid}">${esc(e.item.name)}</button> <span class="m">— ${esc(e.v.reasons[0].toLowerCase())}</span></span></li>`));
    if (!probs.length && !wc.items.length) checks += `<li class="ok"><span class="dot"></span><span>Мебель стоит без нарушений</span></li>`;
    const skipped = st.skipped.length ? `<div><p class="sub">Не поместилось</p><ul class="checks">${st.skipped.map((s) => `<li class="warn"><span class="dot"></span><span>${esc(s.name)} <span class="m">— ${esc(s.room)}, ${esc(s.reason.toLowerCase())}</span></span></li>`).join('')}</ul></div>` : '';
    $('#estBody').innerHTML = `
      <div class="kv"><span class="k">Квартира 47, ${f1(C.AREA)} м²</span><span class="v">${rub(APT_PRICE)}</span>
        <span class="k">Цена за м²</span><span class="v">${rub(Math.round(APT_PRICE / C.AREA))}</span>
        <span class="k">Отделка «${esc(f.name)}»${f.price ? ` <span class="unit">${rub(f.price)}/м²</span>` : ''}</span><span class="v">${f.price ? rub(finSum) : 'входит'}</span></div>
      <div><p class="sub">Мебель · ${st.placed.length} шт.</p>${st.placed.length ? `<ul class="lines">${lines}</ul>` : '<p class="unit">Пока пусто. Выберите предмет в каталоге или нажмите «Готовый комплект».</p>'}
        <div class="kv" style="margin-top:8px"><span class="k">Итого мебель</span><span class="v">${rub(furnSum)}</span></div></div>
      <div class="total"><span>Итого</span><b>${rub(total)}</b></div>
      <div><p class="sub">Проверки</p><ul class="checks">${checks}</ul></div>
      ${skipped}`;
  }
  $('#estBody').addEventListener('click', (ev) => { const b = ev.target.closest('[data-u]'); if (b) { if (st.mode === 'walk') exitWalk(); select(Number(b.dataset.u)); } });

  function uiMode() {
    const walk = st.mode === 'walk';
    $('#mOrbit').setAttribute('aria-pressed', !walk); $('#mWalk').setAttribute('aria-pressed', walk);
    $('#hud').hidden = !walk; $('#cross').hidden = !walk || !locked;
    $('#lockcue').hidden = !walk || locked || coarse;
    $('#joy').hidden = !walk || !coarse;
    $('#cut').disabled = walk;
    hudRoom = null; if (walk) updateHud();
    renderBar(); setHint(); drawMini();
  }

  // кнопки
  $('#mOrbit').addEventListener('click', exitWalk);
  $('#mWalk').addEventListener('click', enterWalk);
  $('#hudExit').addEventListener('click', exitWalk);
  $('#hudChange').addEventListener('click', () => { if (document.pointerLockElement) document.exitPointerLock(); openHeight(false); });
  $('#preset').addEventListener('click', () => { if (st.mode === 'walk') exitWalk(); cancelGhost(); applyLayout(C.PRESET, 7, 2, 'Готовый комплект'); renderSeed(); toast(`Расставлено ${st.placed.length} предметов`); });
  $('#random').addEventListener('click', () => {
    if (st.mode === 'walk') exitWalk(); cancelGhost();
    const seed = 1 + Math.floor((Date.now() % 100000) * 7.3) % 99991;
    applyLayout(null, seed, 10, 'Случайный набор'); renderSeed();
    toast(`Набор #${seed}: ${st.placed.length} предметов${st.skipped.length ? ', не поместилось ' + st.skipped.length : ''}`);
  });
  $('#clear').addEventListener('click', () => { cancelGhost(); st.placed = []; st.skipped = []; st.selected = null; commit(); });
  function renderSeed() { $('#seed').textContent = `${st.setName} · seed ${st.seed}`; }
  const fsel = $('#finish');
  fsel.innerHTML = FINISHES.map((f) => `<option value="${f.id}">${f.name}${f.price ? ' · +' + f.price.toLocaleString('ru-RU') + ' ₽/м²' : ''}</option>`).join('');
  fsel.addEventListener('change', () => { st.finish = fsel.value; buildFloors(); buildWalls(); renderEstimate(); save(); });
  $('#cut').addEventListener('change', (ev) => { st.cut = ev.target.checked; buildWalls(); });
  $('#zones').addEventListener('change', (ev) => { st.zones = ev.target.checked; renderHelpers(); });

  // тема → цвет сцены
  function applyTheme() {
    const bg = new THREE.Color(css('--scene') || '#dde2db');
    scene.background = bg; groundMat.color.set(css('--ground') || '#cfd5cd');
    drawMini();
  }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // ---------- старт ----------
  controls = new THREE.OrbitControls(camera, cv);
  controls.target.copy(TARGET); controls.enableDamping = true; controls.dampingFactor = 0.09;
  controls.maxPolarAngle = Math.PI * 0.47; controls.minDistance = 4; controls.maxDistance = 32;
  controls.update();

  $('#areaTop').textContent = f1(C.AREA);
  if (!load()) { applyLayout(C.PRESET, 7, 2, 'Готовый комплект'); }
  fsel.value = st.finish;
  buildFloors(); buildWalls(); revalidate(); renderFurniture(); renderHelpers();
  renderCatalog(); renderEstimate(); renderSeed(); uiMode(); applyTheme(); resize();

  const clock = new THREE.Clock(); let miniT = 0;
  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (tween) {
      tween.t += dt; const k = Math.min(1, tween.t / tween.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      camera.position.lerpVectors(tween.fp, tween.tp, e); THREE.Quaternion.slerp(tween.fq, tween.tq, camera.quaternion, e);
      if (k >= 1) tween.done();
    } else if (st.mode === 'walk') {
      walkStep(dt); hudT += dt; if (hudT > 0.15) { hudT = 0; updateHud(); }
    } else controls.update();
    if (st.mode === 'walk') { miniT += dt; if (miniT > 0.1) { miniT = 0; drawMini(); } }
    R.render(scene, camera);
  }
  loop();
  window.__gorizont = { st, C }; // для отладки
})();
