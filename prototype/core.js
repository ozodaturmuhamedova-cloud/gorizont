/* Core: данные квартиры, каталог, геометрия, проверки, авторасстановка, прогулка.
   Чистые функции без DOM и three — соответствует domain/ из CLAUDE.md. */
window.Core = (function () {
  'use strict';

  // ---------- константы (domain/constants.ts) ----------
  const H = 2.7, DOOR_H = 2.1, EXT = 0.25, INT = 0.1, AW = 10, AD = 7;
  const GRID = 0.1, SNAP = 0.15, CORNER_SNAP = 0.25, EYE_RATIO = 0.936;
  const HEIGHT_MIN = 100, HEIGHT_MAX = 220;
  const START = { x: 3.95, z: 6.35, yaw: 0 };

  // ---------- ГПСЧ (testing/random/rng.ts) ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function createRng(seed) {
    const n = mulberry32(seed);
    return {
      next: n,
      float: (a, b) => a + (b - a) * n(),
      int: (a, b) => a + Math.floor(n() * (b - a + 1)),
      chance: (p) => n() < p,
      pick: (arr) => arr[Math.floor(n() * arr.length)],
    };
  }

  // ---------- квартира ----------
  const ROOMS = [
    { id: 'bed', type: 'bedroom', name: 'Спальня', x0: 0, x1: 4.5, z0: 0, z1: 4.2 },
    { id: 'liv', type: 'living', name: 'Кухня-гостиная', x0: 4.5, x1: 10, z0: 0, z1: 7 },
    { id: 'bath', type: 'bath', name: 'Санузел', x0: 0, x1: 2.2, z0: 4.2, z1: 7 },
    { id: 'hall', type: 'hall', name: 'Прихожая', x0: 2.2, x1: 4.5, z0: 4.2, z1: 7 },
  ];
  ROOMS.forEach((r) => {
    const sh = (onBoundary) => (onBoundary ? EXT / 2 : INT / 2);
    r.ix0 = r.x0 + sh(r.x0 === 0); r.ix1 = r.x1 - sh(r.x1 === AW);
    r.iz0 = r.z0 + sh(r.z0 === 0); r.iz1 = r.z1 - sh(r.z1 === AD);
    r.area = Math.round((r.ix1 - r.ix0) * (r.iz1 - r.iz0) * 10) / 10;
  });
  const AREA = Math.round(ROOMS.reduce((s, r) => s + r.area, 0) * 10) / 10;

  const WIN = (off, w) => ({ k: 'win', off, w, sill: 0.85, top: 2.25 });
  const WALLS = [
    { a: [0, 0], b: [10, 0], t: EXT, op: [WIN(1.4, 1.6), WIN(6.6, 2.2)] },
    { a: [10, 0], b: [10, 7], t: EXT, op: [WIN(1.6, 1.6)] },
    { a: [0, 7], b: [10, 7], t: EXT, op: [{ k: 'door', off: 3.5, w: 0.9, entry: true }, WIN(7.2, 1.6)] },
    { a: [0, 0], b: [0, 7], t: EXT, op: [WIN(1.3, 1.4)] },
    { a: [4.5, 0], b: [4.5, 7], t: INT, op: [{ k: 'door', off: 4.3, w: 1.0 }] },
    { a: [0, 4.2], b: [4.5, 4.2], t: INT, op: [{ k: 'door', off: 3.6, w: 0.8 }] },
    { a: [2.2, 4.2], b: [2.2, 7], t: INT, op: [{ k: 'door', off: 0.2, w: 0.7 }] },
  ];
  WALLS.forEach((w) => {
    w.hor = w.a[1] === w.b[1];
    w.len = w.hor ? w.b[0] - w.a[0] : w.b[1] - w.a[1];
    w.op.sort((p, q) => p.off - q.off);
    w.ext = w.t === EXT;
  });
  function wallRect(w, s0, s1) {
    const t = w.t / 2;
    return w.hor
      ? { x0: w.a[0] + s0, x1: w.a[0] + s1, z0: w.a[1] - t, z1: w.a[1] + t }
      : { x0: w.a[0] - t, x1: w.a[0] + t, z0: w.a[1] + s0, z1: w.a[1] + s1 };
  }

  // ---------- OBB ----------
  function mkObb(cx, cz, hx, hz, rot) {
    const c = Math.cos(rot), s = Math.sin(rot);
    return { cx, cz, hx, hz, ux: [c, -s], uz: [s, c] };
  }
  function rectObb(r) {
    return mkObb((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, (r.x1 - r.x0) / 2, (r.z1 - r.z0) / 2, 0);
  }
  function proj(o, L) {
    return o.hx * Math.abs(o.ux[0] * L[0] + o.ux[1] * L[1]) + o.hz * Math.abs(o.uz[0] * L[0] + o.uz[1] * L[1]);
  }
  function overlap(a, b, eps) {
    eps = eps === undefined ? 1e-3 : eps;
    const d = [b.cx - a.cx, b.cz - a.cz];
    for (const L of [a.ux, a.uz, b.ux, b.uz]) {
      if (Math.abs(d[0] * L[0] + d[1] * L[1]) >= proj(a, L) + proj(b, L) - eps) return false;
    }
    return true;
  }
  function corners(o) {
    const r = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      r.push([o.cx + o.ux[0] * o.hx * sx + o.uz[0] * o.hz * sz, o.cz + o.ux[1] * o.hx * sx + o.uz[1] * o.hz * sz]);
    return r;
  }
  function insideRoom(o, room, eps) {
    eps = eps === undefined ? 1e-3 : eps;
    return corners(o).every(([x, z]) => x >= room.ix0 - eps && x <= room.ix1 + eps && z >= room.iz0 - eps && z <= room.iz1 + eps);
  }
  function distPtObb(px, pz, o) {
    const dx = px - o.cx, dz = pz - o.cz;
    const lx = dx * o.ux[0] + dz * o.ux[1], lz = dx * o.uz[0] + dz * o.uz[1];
    return Math.hypot(Math.max(Math.abs(lx) - o.hx, 0), Math.max(Math.abs(lz) - o.hz, 0));
  }
  function localBox(p, lx0, lx1, lz0, lz1) {
    const c = Math.cos(p.rot), s = Math.sin(p.rot);
    const mx = (lx0 + lx1) / 2, mz = (lz0 + lz1) / 2;
    return { cx: p.x + c * mx + s * mz, cz: p.z - s * mx + c * mz, hx: (lx1 - lx0) / 2, hz: (lz1 - lz0) / 2, ux: [c, -s], uz: [s, c] };
  }
  function relPose(bp, lx, lz, drot) {
    const c = Math.cos(bp.rot), s = Math.sin(bp.rot);
    return { x: bp.x + c * lx + s * lz, z: bp.z - s * lx + c * lz, rot: bp.rot + drot };
  }

  // коллизии стен (окна непроходимы, двери — проёмы)
  const COLL = [];
  WALLS.forEach((w) => {
    let s = -w.t / 2;
    w.op.filter((o) => o.k === 'door').forEach((o) => {
      if (o.off > s) COLL.push(rectObb(wallRect(w, s, o.off)));
      s = o.off + o.w;
    });
    COLL.push(rectObb(wallRect(w, s, w.len + w.t / 2)));
  });

  // зоны дверей и окон
  const DOOR_Z = [], WIN_Z = [];
  WALLS.forEach((w) => w.op.forEach((o) => {
    const dep = (o.k === 'door' ? Math.min(o.w, 0.9) : 0.5) + w.t / 2;
    const r = w.hor
      ? { x0: w.a[0] + o.off, x1: w.a[0] + o.off + o.w, z0: w.a[1] - dep, z1: w.a[1] + dep }
      : { x0: w.a[0] - dep, x1: w.a[0] + dep, z0: w.a[1] + o.off, z1: w.a[1] + o.off + o.w };
    (o.k === 'door' ? DOOR_Z : WIN_Z).push(rectObb(r));
  }));

  function roomAt(x, z) {
    return ROOMS.find((r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) || null;
  }

  // ---------- каталог (data/furniture.json) ----------
  const CL = (front, sides, back) => ({ front: front || 0, sides: sides || 0, back: back || 0 });
  const LIST = [
    { id: 'bed160', fam: 'bed', name: 'Кровать «Норд» 160', cat: 'bed', rooms: ['bedroom'], size: [1.66, 2.1, 1.0], price: 64900, pl: 'wall', cl: CL(0.5, 0.6), pr: 90, alt: 'bed140' },
    { id: 'bed140', base: 'bed160', name: 'Кровать «Норд» 140', size: [1.46, 2.1, 1.0], price: 52900, pr: 89, alt: 'bed90' },
    { id: 'bed90', base: 'bed160', name: 'Кровать «Норд» 90', size: [0.96, 2.06, 0.9], price: 31900, pr: 88, cl: CL(0.5, 0.6), alt: null },
    { id: 'nightstand', name: 'Тумба прикроватная «Лаго»', cat: 'storage', rooms: ['bedroom'], size: [0.45, 0.4, 0.5], price: 8900, pl: 'wall', cl: CL(0.3), pr: 40 },
    { id: 'wardrobe', fam: 'wardrobe', name: 'Шкаф распашной «Фьорд» 160', cat: 'storage', rooms: ['bedroom', 'living'], size: [1.6, 0.6, 2.2], price: 47500, pl: 'wall', cl: CL(0.9), pr: 80, blocksWindow: true, alt: 'wardrobe100' },
    { id: 'wardrobe100', base: 'wardrobe', name: 'Шкаф распашной «Фьорд» 100', size: [1.0, 0.6, 2.2], price: 32900, pr: 79, alt: null },
    { id: 'dresser', name: 'Комод «Лаго»', cat: 'storage', rooms: ['bedroom', 'living'], size: [1.0, 0.45, 0.85], price: 21900, pl: 'wall', cl: CL(0.7), pr: 50 },
    { id: 'desk', name: 'Рабочий стол «Скрипт»', cat: 'table', rooms: ['bedroom', 'living'], size: [1.2, 0.6, 0.75], price: 17900, pl: 'wall', cl: CL(0.8), pr: 45 },
    { id: 'kitchen', fam: 'kitchen', name: 'Кухня «Тесса» 2,8 м', cat: 'kitchen', rooms: ['living'], size: [2.8, 0.6, 2.2], price: 189000, pl: 'wall', cl: CL(1.0), pr: 95, blocksWindow: true, alt: 'kitchen2' },
    { id: 'kitchen2', base: 'kitchen', name: 'Кухня «Тесса» 2,0 м', size: [2.0, 0.6, 2.2], price: 139000, pr: 94, alt: null },
    { id: 'fridge', name: 'Холодильник «Полюс»', cat: 'kitchen', rooms: ['living'], size: [0.6, 0.65, 1.9], price: 59900, pl: 'wall', cl: CL(0.9), pr: 85, blocksWindow: true },
    { id: 'sofa', fam: 'sofa', name: 'Диван «Брум» трёхместный', cat: 'sofa', rooms: ['living'], size: [2.2, 0.95, 0.85], price: 79900, pl: 'wall', cl: CL(0.8, 0.15), pr: 75, alt: 'sofa2' },
    { id: 'sofa2', base: 'sofa', name: 'Диван «Брум» двухместный', size: [1.7, 0.9, 0.85], price: 59900, pr: 74, alt: null },
    { id: 'armchair', name: 'Кресло «Брум»', cat: 'sofa', rooms: ['living', 'bedroom'], size: [0.85, 0.85, 0.85], price: 28900, pl: 'wall', cl: CL(0.5), pr: 30 },
    { id: 'coffee', name: 'Журнальный стол «Ось»', cat: 'table', rooms: ['living'], size: [1.0, 0.6, 0.42], price: 12900, pl: 'center', cl: CL(0.3, 0.3, 0.3), pr: 35 },
    { id: 'tvstand', name: 'ТВ-тумба «Медиа» с ТВ 55″', cat: 'tv', rooms: ['living', 'bedroom'], size: [1.8, 0.45, 1.25], price: 74900, pl: 'wall', cl: CL(0.5), pr: 70 },
    { id: 'dining', fam: 'dining', name: 'Обеденный стол «Сбор» 140', cat: 'table', rooms: ['living'], size: [1.4, 0.85, 0.75], price: 24900, pl: 'center', cl: CL(1.0, 0.9, 1.0), pr: 60, alt: 'dining90' },
    { id: 'dining90', base: 'dining', name: 'Обеденный стол «Сбор» 90', size: [0.9, 0.8, 0.75], price: 16900, pr: 59, alt: null },
    { id: 'chair', name: 'Стул «Сбор»', cat: 'chair', rooms: ['living', 'bedroom'], size: [0.45, 0.5, 0.9], price: 6900, pl: 'center', cl: CL(0, 0.03, 0.5), pr: 55 },
    { id: 'shelf', name: 'Стеллаж «Ряд»', cat: 'storage', rooms: ['living', 'bedroom'], size: [0.8, 0.35, 1.8], price: 14900, pl: 'wall', cl: CL(0.6), pr: 20, blocksWindow: true },
    { id: 'bathtub', fam: 'bathtub', name: 'Ванна акриловая 170', cat: 'plumbing', rooms: ['bath'], size: [1.7, 0.75, 0.6], price: 38900, pl: 'wall', cl: CL(0.6), pr: 90, alt: 'shower' },
    { id: 'shower', fam: 'shower', name: 'Душевой уголок 90×90', cat: 'plumbing', rooms: ['bath'], size: [0.9, 0.9, 2.0], price: 45900, pl: 'wall', cl: CL(0.6), pr: 89 },
    { id: 'toilet', name: 'Унитаз подвесной', cat: 'plumbing', rooms: ['bath'], size: [0.38, 0.6, 0.8], price: 24900, pl: 'wall', cl: CL(0.6, 0.15), pr: 85 },
    { id: 'sink', name: 'Тумба с раковиной 60', cat: 'plumbing', rooms: ['bath'], size: [0.6, 0.46, 0.85], price: 18900, pl: 'wall', cl: CL(0.6), pr: 80 },
    { id: 'washer', name: 'Стиральная машина', cat: 'plumbing', rooms: ['bath'], size: [0.6, 0.5, 0.85], price: 42900, pl: 'wall', cl: CL(0.6), pr: 60 },
    { id: 'hallwardrobe', name: 'Шкаф для прихожей «Порог»', cat: 'storage', rooms: ['hall'], size: [1.4, 0.6, 2.3], price: 42900, pl: 'wall', cl: CL(0.6), pr: 80, alt: 'hallwardrobe90' },
    { id: 'hallwardrobe90', base: 'hallwardrobe', name: 'Шкаф для прихожей «Порог» 90', size: [0.9, 0.6, 2.3], price: 29900, pr: 79, alt: null },
    { id: 'shoe', name: 'Обувница «Порог» 60', cat: 'storage', rooms: ['hall'], size: [0.6, 0.3, 0.95], price: 8900, pl: 'wall', cl: CL(0.5), pr: 50 },
    { id: 'bench', name: 'Банкетка «Порог»', cat: 'decor', rooms: ['hall', 'bedroom'], size: [0.8, 0.36, 0.45], price: 7900, pl: 'wall', cl: CL(0.5), pr: 30 },
  ];
  const CAT = {};
  LIST.forEach((it) => {
    const merged = it.base ? Object.assign({}, CAT[it.base], it) : Object.assign({}, it);
    merged.fam = merged.fam || merged.id;
    if (it.base) merged.fam = CAT[it.base].fam;
    CAT[it.id] = merged;
  });

  const PRESET = {
    bed: ['bed160', 'nightstand', 'nightstand', 'wardrobe', 'dresser'],
    liv: ['kitchen', 'fridge', 'sofa', 'tvstand', 'coffee', 'dining', 'chair', 'chair', 'chair', 'chair', 'armchair', 'shelf'],
    bath: ['bathtub', 'toilet', 'sink', 'washer'],
    hall: ['hallwardrobe', 'shoe'],
  };
  function randomPreset(rng) {
    const maybe = (p, id) => (rng.chance(p) ? [id] : []);
    return {
      bed: [rng.pick(['bed160', 'bed160', 'bed140', 'bed90'])].concat(maybe(0.85, 'nightstand'), maybe(0.6, 'nightstand'), maybe(0.85, 'wardrobe'), maybe(0.5, 'dresser'), maybe(0.45, 'desk'), maybe(0.25, 'armchair')),
      liv: [rng.chance(0.7) ? 'kitchen' : 'kitchen2', 'fridge', rng.chance(0.65) ? 'sofa' : 'sofa2']
        .concat(maybe(0.85, 'tvstand'), maybe(0.7, 'coffee'), [rng.chance(0.6) ? 'dining' : 'dining90'],
          Array(rng.int(2, 4)).fill('chair'), maybe(0.5, 'armchair'), maybe(0.5, 'shelf'), maybe(0.3, 'wardrobe100')),
      bath: [rng.chance(0.6) ? 'bathtub' : 'shower', 'toilet', 'sink'].concat(maybe(0.8, 'washer')),
      hall: maybe(0.8, 'hallwardrobe').concat(['shoe'], maybe(0.5, 'bench')),
    };
  }

  // ---------- footprint / clearance ----------
  function fp(item, p) { const [w, d] = item.size; return localBox(p, -w / 2, w / 2, -d / 2, d / 2); }
  function clBox(item, p) { const [w, d] = item.size, c = item.cl; return localBox(p, -w / 2 - c.sides, w / 2 + c.sides, -d / 2 - c.back, d / 2 + c.front); }
  function frontBox(item, p) { const [w, d] = item.size; return item.cl.front > 0 ? localBox(p, -w / 2, w / 2, d / 2, d / 2 + item.cl.front) : null; }
  function backBox(item, p) { const [w, d] = item.size; return item.cl.back > 0 ? localBox(p, -w / 2, w / 2, -d / 2 - item.cl.back, -d / 2) : null; }
  function sideBoxes(item, p) {
    const [w, d] = item.size, s = item.cl.sides;
    if (!s) return [];
    return [localBox(p, -w / 2 - s, -w / 2, -d / 2, d / 2), localBox(p, w / 2, w / 2 + s, -d / 2, d / 2)];
  }

  const FRIENDS = [['chair', 'dining'], ['nightstand', 'bed'], ['coffee', 'sofa'], ['coffee', 'armchair'], ['chair', 'desk']];
  function friends(a, b) {
    return FRIENDS.some(([x, y]) => (x === a.fam && y === b.fam) || (x === b.fam && y === a.fam));
  }

  const S = {
    outside: 'Вне квартиры',
    wall: 'Пересекает стену',
    door: 'Перекрывает дверной проём',
    hits: (n) => 'Пересекается: ' + n,
    window: 'Перекрывает окно',
    access: (n) => 'Загораживает подход к: ' + n,
    doorsWontOpen: 'Дверцы не откроются полностью',
    tight: 'Мало места перед предметом',
    tightBack: 'Мало места за спинкой',
    oneSide: 'Подход только с одной стороны',
    noSide: 'Нет подхода сбоку',
    noSpace: 'Не хватило места с учётом проходов',
    noAccess: 'К предмету не подойти',
  };

  /** validatePlacement: ok / warning / error с причинами. others — уже расставленные {item,F,C}. */
  function validate(item, p, others) {
    const errs = [], warns = [], notes = [];
    const room = roomAt(p.x, p.z);
    if (!room) return { status: 'error', errs: [S.outside], warns, notes, room: null, reasons: [S.outside] };
    const F = fp(item, p);
    if (!insideRoom(F, room)) errs.push(S.wall);
    if (DOOR_Z.some((z) => overlap(F, z))) errs.push(S.door);
    for (const o of others) if (overlap(F, o.F)) { errs.push(S.hits(o.item.name)); break; }

    if (item.blocksWindow && WIN_Z.some((z) => overlap(F, z))) warns.push(S.window);
    const C = clBox(item, p);
    for (const o of others) { if (friends(item, o.item)) continue; if (overlap(F, o.C)) { warns.push(S.access(o.item.name)); break; } }
    let front = false;
    for (const o of others) { if (friends(item, o.item)) continue; if (overlap(C, o.F)) { warns.push(item.cat === 'storage' ? S.doorsWontOpen : S.tight); front = true; break; } }
    const fb = frontBox(item, p);
    if (!front && fb && !insideRoom(fb, room)) warns.push(item.cat === 'storage' ? S.doorsWontOpen : S.tight);
    const bb = backBox(item, p);
    if (bb && !insideRoom(bb, room)) warns.push(S.tightBack);
    const sb = sideBoxes(item, p);
    let oneSide = false;
    if (sb.length) {
      const okN = sb.filter((b) => insideRoom(b, room) && !others.some((o) => !friends(item, o.item) && overlap(b, o.F))).length;
      if (okN === 1) { notes.push(S.oneSide); oneSide = true; }
      if (okN === 0) warns.push(S.noSide);
    }
    const status = errs.length ? 'error' : warns.length ? 'warning' : 'ok';
    return { status, errs, warns, notes, oneSide, room, reasons: errs.concat(warns, notes) };
  }

  // ---------- кандидаты ----------
  function wallCands(item, room) {
    const [w, d] = item.size, g = 0.02, out = [];
    const along = (from, to, half, fn) => {
      const len = to - from - 2 * half;
      if (len < -1e-6) return;
      const n = Math.floor(len / GRID + 1e-6);
      for (let i = 0; i <= n; i++) fn(from + half + i * GRID);
      if (len - n * GRID > 1e-3) fn(to - half);
    };
    along(room.ix0, room.ix1, w / 2, (x) => out.push({ x, z: room.iz0 + d / 2 + g, rot: 0 }));
    along(room.ix0, room.ix1, w / 2, (x) => out.push({ x, z: room.iz1 - d / 2 - g, rot: Math.PI }));
    along(room.iz0, room.iz1, w / 2, (z) => out.push({ x: room.ix0 + d / 2 + g, z, rot: Math.PI / 2 }));
    along(room.iz0, room.iz1, w / 2, (z) => out.push({ x: room.ix1 - d / 2 - g, z, rot: -Math.PI / 2 }));
    return out;
  }
  function centerCands(item, room, rots) {
    const out = [];
    for (let x = room.ix0 + 0.2; x < room.ix1 - 0.1; x += 0.2)
      for (let z = room.iz0 + 0.2; z < room.iz1 - 0.1; z += 0.2)
        for (const rot of rots) out.push({ x, z, rot });
    return out;
  }
  function nightstandCands(item, bed) {
    const [bw, bd] = bed.item.size, [nw, nd] = item.size;
    return [-1, 1].map((sx) => relPose(bed.p, sx * (bw / 2 + nw / 2 + 0.03), -bd / 2 + nd / 2, 0));
  }
  function chairCands(item, table) {
    const [tw, td] = table.item.size, cd = item.size[1], gap = 0.01;
    const xs = tw >= 1.2 ? [-tw / 4, tw / 4] : [0];
    const out = [];
    xs.forEach((x) => out.push(relPose(table.p, x, td / 2 + cd / 2 + gap, Math.PI)));
    xs.forEach((x) => out.push(relPose(table.p, x, -td / 2 - cd / 2 - gap, 0)));
    out.push(relPose(table.p, tw / 2 + cd / 2 + gap, 0, -Math.PI / 2));
    out.push(relPose(table.p, -tw / 2 - cd / 2 - gap, 0, Math.PI / 2));
    out.forEach((p, i) => (p.idx = i));
    return out;
  }

  // ---------- оценка (score.ts) ----------
  const W = { WALL: 20, NEAR_DOOR: -10, CORNER: 8, BED_SOLID_WALL: 10, BED_UNDER_WINDOW: -15, SOFA_VIEW: 12, SOFA_CRAMPED: -10, TV_PAIR: 30, TV_NO_PAIR: -10, FRIDGE_NEXT: 25, ONE_SIDE: -6 };
  function rayToEdge(p, dir, room) {
    let t = Infinity;
    if (dir[0] > 1e-6) t = Math.min(t, (room.ix1 - p.x) / dir[0]);
    if (dir[0] < -1e-6) t = Math.min(t, (room.ix0 - p.x) / dir[0]);
    if (dir[1] > 1e-6) t = Math.min(t, (room.iz1 - p.z) / dir[1]);
    if (dir[1] < -1e-6) t = Math.min(t, (room.iz0 - p.z) / dir[1]);
    return t;
  }
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  function score(item, p, ctx) {
    const fam = item.fam, room = ctx.room, find = (f) => ctx.inRoom.find((o) => o.item.fam === f);
    if (fam === 'chair' && p.idx !== undefined) return -p.idx + ctx.rng.float(0, 0.2);
    let s = 0;
    if (item.pl === 'wall') s += W.WALL;
    const dd = Math.min.apply(null, DOOR_Z.map((z) => Math.hypot(z.cx - p.x, z.cz - p.z)));
    if (dd < 1.0) s += W.NEAR_DOOR;
    const uz = [Math.sin(p.rot), Math.cos(p.rot)], ux = [Math.cos(p.rot), -Math.sin(p.rot)];
    if (item.cat === 'storage' || item.cat === 'kitchen' || item.cat === 'plumbing') {
      const cs = corners(fp(item, p)), xs = cs.map((c) => c[0]), zs = cs.map((c) => c[1]);
      const tX = Math.min.apply(null, xs) - room.ix0 < 0.06 || room.ix1 - Math.max.apply(null, xs) < 0.06;
      const tZ = Math.min.apply(null, zs) - room.iz0 < 0.06 || room.iz1 - Math.max.apply(null, zs) < 0.06;
      if (tX && tZ) s += W.CORNER;
    }
    if (fam === 'bed') {
      const bx = p.x - uz[0] * (item.size[1] / 2 + 0.1), bz = p.z - uz[1] * (item.size[1] / 2 + 0.1);
      s += WIN_Z.some((z) => distPtObb(bx, bz, z) < 0.05) ? W.BED_UNDER_WINDOW : W.BED_SOLID_WALL;
      s += Math.min(dd, 4) * 2;
    }
    if (fam === 'sofa') {
      const ahead = rayToEdge(p, uz, room) - item.size[1] / 2;
      if (ahead >= 2.4 && ahead <= 5.0) s += W.SOFA_VIEW; else if (ahead < 1.8) s += W.SOFA_CRAMPED;
      const k = find('kitchen'); if (k) s += Math.min(dist(k.p, p), 5) * 2;
    }
    if (fam === 'tvstand') {
      const so = find('sofa');
      if (so) {
        const suz = [Math.sin(so.p.rot), Math.cos(so.p.rot)], sux = [Math.cos(so.p.rot), -Math.sin(so.p.rot)];
        const dot = uz[0] * suz[0] + uz[1] * suz[1];
        const v = [p.x - so.p.x, p.z - so.p.z];
        const al = v[0] * suz[0] + v[1] * suz[1], lat = Math.abs(v[0] * sux[0] + v[1] * sux[1]);
        s += dot < -0.95 && al >= 1.8 && al <= 5.0 ? W.TV_PAIR - lat * 8 : W.TV_NO_PAIR;
      }
    }
    if (fam === 'fridge') {
      const k = find('kitchen');
      if (k) {
        const F = fp(item, p); F.hx += 0.06; F.hz += 0.06;
        s += overlap(F, k.F) ? W.FRIDGE_NEXT : -dist(k.p, p) * 3;
      }
    }
    if (fam === 'dining') {
      const k = find('kitchen'); if (k) s += Math.max(0, 6 - dist(k.p, p)) * 2.5;
      const so = find('sofa'); if (so) s += Math.min(dist(so.p, p), 5) * 1.5;
      if (WIN_Z.some((z) => Math.hypot(z.cx - p.x, z.cz - p.z) < 2.2)) s += 6;
    }
    if (fam === 'bathtub' || fam === 'shower') {
      // ванна вдоль стены с дверью освобождает остальные стены под сантехнику
      const bx = p.x - uz[0] * (item.size[1] / 2 + 0.1), bz = p.z - uz[1] * (item.size[1] / 2 + 0.1);
      const dz = Math.min.apply(null, DOOR_Z.map((z) => distPtObb(bx, bz, z)));
      s += Math.max(0, 2 - dz) * 8;
    }
    if (fam === 'armchair') { const ct = find('coffee') || find('sofa'); if (ct) s += Math.max(0, 3 - dist(ct.p, p)) * 6; }
    if (fam === 'wardrobe' || fam === 'hallwardrobe') s += dd < 2.2 ? 4 : 0;
    void ux;
    return s + ctx.rng.float(0, ctx.jitter);
  }

  function entryOf(item, p, uid) {
    const r = roomAt(p.x, p.z);
    return { uid, id: item.id, item, p, F: fp(item, p), C: clBox(item, p), room: r ? r.id : null };
  }

  function bestPose(item, room, placed, rng, jitter) {
    const fam = item.fam, inRoom = placed.filter((o) => o.room === room.id);
    let cands = null;
    if (fam === 'nightstand') { const bed = inRoom.find((o) => o.item.fam === 'bed'); if (bed) cands = nightstandCands(item, bed); }
    if (fam === 'chair') { const t = inRoom.find((o) => o.item.fam === 'dining'); if (t) cands = chairCands(item, t); }
    if (fam === 'coffee') {
      const so = inRoom.find((o) => o.item.fam === 'sofa');
      if (so) cands = [0.4, 0.45, 0.5].map((g) => relPose(so.p, 0, so.item.size[1] / 2 + g + item.size[1] / 2, 0));
    }
    if (!cands) cands = item.pl === 'center' ? centerCands(item, room, [0, Math.PI / 2]) : wallCands(item, room);
    let best = null, bs = -Infinity;
    const ctx = { room, inRoom, rng, jitter };
    for (const p of cands) {
      const v = validate(item, p, placed);
      if (v.errs.length || v.warns.length || v.room !== room) continue;
      let s = score(item, p, ctx);
      if (v.oneSide) s += W.ONE_SIDE;
      if (s > bs) { bs = s; best = p; }
    }
    return best ? { x: best.x, z: best.z, rot: best.rot } : null;
  }

  /** autoLayout: жадно по приоритету, с компактными заменами. */
  function autoLayout(preset, rng, jitter, uidStart) {
    let uid = uidStart || 1;
    const placed = [], skipped = [];
    for (const room of ROOMS) {
      const ids = (preset[room.id] || []).slice();
      ids.sort((a, b) => CAT[b].pr - CAT[a].pr || CAT[b].size[0] * CAT[b].size[1] - CAT[a].size[0] * CAT[a].size[1]);
      for (const id of ids) {
        let item = CAT[id], got = null;
        while (item) {
          got = bestPose(item, room, placed, rng, jitter);
          if (got) break;
          item = item.alt ? CAT[item.alt] : null;
        }
        if (got) placed.push(entryOf(item, got, uid++));
        else skipped.push({ id, name: CAT[id].name, room: room.name, reason: S.noSpace });
      }
    }
    // финальная проверка проходимости: к каждому предмету должен быть подход
    for (let guard = 0; guard < 6; guard++) {
      const bad = walkCheck(placed, collisionRadius(170)).items;
      if (!bad.length) break;
      const worst = bad.sort((a, b) => a.item.pr - b.item.pr)[0];
      placed.splice(placed.indexOf(worst), 1);
      const rm = ROOMS.find((r) => r.id === worst.room);
      skipped.push({ id: worst.id, name: worst.item.name, room: rm ? rm.name : '', reason: S.noAccess });
    }
    return { placed, skipped, nextUid: uid };
  }

  // ---------- прогулка (walk.ts) ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const round2 = (v) => Math.round(v * 100) / 100;
  function validHeight(h) { return Number.isFinite(h) && h >= HEIGHT_MIN && h <= HEIGHT_MAX; }
  function eyeHeight(h) { return round2((h / 100) * EYE_RATIO); }
  function camHeight(h) { return Math.min(eyeHeight(h), H - 0.1); }
  function collisionRadius(h) { return clamp((h / 100) * 0.13, 0.18, 0.28); }
  function walkSpeed(h) { return clamp((h / 100) * 0.8, 1.0, 1.6); }

  function pushOut(pos, r, o) {
    const dx = pos.x - o.cx, dz = pos.z - o.cz;
    let lx = dx * o.ux[0] + dz * o.ux[1], lz = dx * o.uz[0] + dz * o.uz[1];
    const qx = clamp(lx, -o.hx, o.hx), qz = clamp(lz, -o.hz, o.hz);
    const ex = lx - qx, ez = lz - qz, d = Math.hypot(ex, ez);
    if (d >= r) return false;
    if (d < 1e-6) {
      if (o.hx - Math.abs(lx) < o.hz - Math.abs(lz)) lx = (Math.sign(lx) || 1) * (o.hx + r);
      else lz = (Math.sign(lz) || 1) * (o.hz + r);
    } else { lx = qx + (ex / d) * r; lz = qz + (ez / d) * r; }
    pos.x = o.cx + o.ux[0] * lx + o.uz[0] * lz;
    pos.z = o.cz + o.ux[1] * lx + o.uz[1] * lz;
    return true;
  }
  function resolveWalk(pos, r, furnitureObbs) {
    const obs = COLL.concat(furnitureObbs);
    for (let it = 0; it < 4; it++) {
      let any = false;
      for (const o of obs) if (pushOut(pos, r, o)) any = true;
      pos.x = clamp(pos.x, EXT / 2 + r, AW - EXT / 2 - r);
      pos.z = clamp(pos.z, EXT / 2 + r, AD - EXT / 2 - r);
      if (!any) break;
    }
    return pos;
  }

  /** isWalkable: BFS по сетке 0.1 м от входа. */
  function walkCheck(placed, r) {
    const st = 0.1, nx = Math.round(AW / st), nz = Math.round(AD / st);
    const free = new Uint8Array(nx * nz), seen = new Uint8Array(nx * nz);
    const obs = COLL.concat(placed.map((o) => o.F));
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = (i + 0.5) * st, z = (j + 0.5) * st;
      if (x < EXT / 2 + r || x > AW - EXT / 2 - r || z < EXT / 2 + r || z > AD - EXT / 2 - r) continue;
      let ok = true;
      for (const o of obs) if (distPtObb(x, z, o) < r) { ok = false; break; }
      free[j * nx + i] = ok ? 1 : 0;
    }
    let si = Math.floor(START.x / st), sj = Math.floor(START.z / st);
    const q = [];
    if (free[sj * nx + si]) { seen[sj * nx + si] = 1; q.push(sj * nx + si); }
    while (q.length) {
      const c = q.pop(), i = c % nx, j = (c / nx) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
        const k = b * nx + a;
        if (free[k] && !seen[k]) { seen[k] = 1; q.push(k); }
      }
    }
    const reach = (x, z) => {
      const i = Math.floor(x / st), j = Math.floor(z / st);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const a = i + di, b = j + dj;
        if (a >= 0 && b >= 0 && a < nx && b < nz && seen[b * nx + a]) return true;
      }
      return false;
    };
    const rooms = ROOMS.filter((rm) => {
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const x = (i + 0.5) * st, z = (j + 0.5) * st;
        if (seen[j * nx + i] && x > rm.ix0 && x < rm.ix1 && z > rm.iz0 && z < rm.iz1) return false;
      }
      return true;
    }).map((rm) => rm.name);
    const items = placed.filter((o) => {
      const [w, d] = o.item.size, off = r + 0.08;
      const pts = [[0, d / 2 + off], [0, -d / 2 - off], [w / 2 + off, 0], [-w / 2 - off, 0]].map(([lx, lz]) => relPose(o.p, lx, lz, 0));
      return !pts.some((pt) => reach(pt.x, pt.z));
    });
    return { rooms, items, free, seen, nx, nz, st };
  }

  // ---------- притяжение ----------
  function snapPose(item, p, noSnap) {
    let x = Math.round(p.x / GRID) * GRID, z = Math.round(p.z / GRID) * GRID, rot = p.rot, snapped = false;
    if (noSnap) return { x, z, rot, snapped };
    const room = roomAt(p.x, p.z);
    if (!room || item.pl !== 'wall') return { x, z, rot, snapped };
    const [w, d] = item.size, g = 0.02;
    const sides = [
      { gap: p.z - room.iz0 - d / 2, rot: 0, apply: () => { z = room.iz0 + d / 2 + g; } , along: 'x' },
      { gap: room.iz1 - p.z - d / 2, rot: Math.PI, apply: () => { z = room.iz1 - d / 2 - g; }, along: 'x' },
      { gap: p.x - room.ix0 - d / 2, rot: Math.PI / 2, apply: () => { x = room.ix0 + d / 2 + g; }, along: 'z' },
      { gap: room.ix1 - p.x - d / 2, rot: -Math.PI / 2, apply: () => { x = room.ix1 - d / 2 - g; }, along: 'z' },
    ];
    let best = null;
    for (const s of sides) if (s.gap < SNAP && s.gap > -d && (!best || s.gap < best.gap)) best = s;
    if (best) {
      best.apply(); rot = best.rot; snapped = true;
      if (best.along === 'x') {
        if (x - w / 2 - room.ix0 < CORNER_SNAP) x = room.ix0 + w / 2 + 0.01;
        if (room.ix1 - x - w / 2 < CORNER_SNAP) x = room.ix1 - w / 2 - 0.01;
      } else {
        if (z - w / 2 - room.iz0 < CORNER_SNAP) z = room.iz0 + w / 2 + 0.01;
        if (room.iz1 - z - w / 2 < CORNER_SNAP) z = room.iz1 - w / 2 - 0.01;
      }
    }
    return { x, z, rot, snapped };
  }

  return {
    H, DOOR_H, EXT, INT, AW, AD, GRID, START, HEIGHT_MIN, HEIGHT_MAX, AREA,
    ROOMS, WALLS, COLL, DOOR_Z, WIN_Z, CAT, LIST, PRESET, S,
    createRng, randomPreset, wallRect, mkObb, overlap, corners, distPtObb, localBox, relPose,
    roomAt, fp, clBox, validate, autoLayout, entryOf, snapPose,
    validHeight, eyeHeight, camHeight, collisionRadius, walkSpeed, resolveWalk, walkCheck,
  };
})();
