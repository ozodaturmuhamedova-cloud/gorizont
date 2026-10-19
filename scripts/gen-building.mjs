/**
 * Генератор src/data/building.json: 1 секция, 9 этажей, 6 типовых планировок на этаж.
 * Запуск: npm run data:building. Результат детерминирован (seed фиксирован).
 *
 * Этаж 26 × 17 м. Коридор z = 7…9 вдоль всего этажа.
 * Север (z = 0…7): студия, 1к, 2к, лестнично-лифтовой узел. Юг (z = 9…17): 1к, 2к, угловая 3к.
 * Планировки описаны в локальных координатах: u — вдоль фасада, v — от коридора (v = 0) к окнам (v = d).
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CEIL = 2.7;
const EXT = 0.25;
const INT = 0.1;
const DOOR_H = 2.1;
const SILL = 0.85;
const WIN_H = 1.45;
const FLOORS = 9;
const FLOOR_STEP = 0.015;
const SEED = 2026;

const r2 = (v) => Math.round(v * 100) / 100;
const r1 = (v) => Math.round(v * 10) / 10;

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- шаблоны планировок ----------
// rooms: [id, type, u0, v0, u1, v1]; walls: { key: [[u,v],[u,v]] } — внутренние стены;
// doors/windows: [wallKey, at, width] — at — координата начала проёма вдоль стены (по u или v).
// Ключи наружных стен: corr (v = 0), ext (v = d), left (u = 0), right (u = w).

function studio(w, d) {
  return {
    rooms: 0,
    roomsGeometry: [
      ['bath', 'bath', 0, 0, 2.2, 2.4],
      ['hall', 'hall', 2.2, 0, w, 2.4],
      ['living', 'living', 0, 2.4, w, d],
    ],
    walls: {
      i1: [
        [2.2, 0],
        [2.2, 2.4],
      ],
      i2: [
        [0, 2.4],
        [w, 2.4],
      ],
    },
    doors: [
      ['corr', w - 1.3, 0.9, true],
      ['i1', 0.8, 0.7],
      ['i2', 2.6, 0.9],
    ],
    windows: [['ext', 1.6, 1.8]],
  };
}

function oneRoom(w, d) {
  return {
    rooms: 1,
    roomsGeometry: [
      ['bath', 'bath', 0, 0, 2.0, 2.6],
      ['hall', 'hall', 2.0, 0, w, 2.6],
      ['kitchen', 'kitchen', 0, 2.6, 3.0, d],
      ['living', 'living', 3.0, 2.6, w, d],
    ],
    walls: {
      i1: [
        [2, 0],
        [2, 2.6],
      ],
      i2: [
        [0, 2.6],
        [w, 2.6],
      ],
      i3: [
        [3, 2.6],
        [3, d],
      ],
    },
    doors: [
      ['corr', w - 1.3, 0.9, true],
      ['i1', 0.9, 0.7],
      ['i2', 2.1, 0.8],
      ['i2', 3.5, 0.9],
    ],
    windows: [
      ['ext', 0.8, 1.4],
      ['ext', 3 + (w - 3) / 2 - 0.8, 1.6],
    ],
  };
}

function twoRoom(w, d, s2) {
  return {
    rooms: 2,
    roomsGeometry: [
      ['bath', 'bath', 0, 0, 2.0, 2.6],
      ['hall', 'hall', 2.0, 0, w, 2.6],
      ['kitchen', 'kitchen', 0, 2.6, 3.0, d],
      ['living', 'living', 3.0, 2.6, s2, d],
      ['bed1', 'bedroom', s2, 2.6, w, d],
    ],
    walls: {
      i1: [
        [2, 0],
        [2, 2.6],
      ],
      i2: [
        [0, 2.6],
        [w, 2.6],
      ],
      i3: [
        [3, 2.6],
        [3, d],
      ],
      i4: [
        [s2, 2.6],
        [s2, d],
      ],
    },
    doors: [
      ['corr', w / 2 - 0.45, 0.9, true],
      ['i1', 0.9, 0.7],
      ['i2', 2.1, 0.8],
      ['i2', 3.5, 0.9],
      ['i2', s2 + 0.4, 0.8],
    ],
    windows: [
      ['ext', 0.8, 1.4],
      ['ext', 3 + (s2 - 3) / 2 - 0.9, 1.8],
      ['ext', s2 + (w - s2) / 2 - 0.75, 1.5],
    ],
  };
}

/** Угловая 3к: правая стена (u = w) — наружная, в ней окно второй спальни. */
function threeRoomCorner(w, d) {
  const band = 3.2;
  return {
    rooms: 3,
    roomsGeometry: [
      ['bath', 'bath', 0, 0, 2.0, band],
      ['hall', 'hall', 2.0, 0, 7.4, band],
      ['bed2', 'bedroom', 7.4, 0, w, band],
      ['kitchen', 'kitchen', 0, band, 3.0, d],
      ['living', 'living', 3.0, band, 6.2, d],
      ['bed1', 'bedroom', 6.2, band, w, d],
    ],
    walls: {
      i1: [
        [2, 0],
        [2, band],
      ],
      i2: [
        [7.4, 0],
        [7.4, band],
      ],
      i3: [
        [0, band],
        [w, band],
      ],
      i4: [
        [3, band],
        [3, d],
      ],
      i5: [
        [6.2, band],
        [6.2, d],
      ],
    },
    doors: [
      ['corr', 4.0, 0.9, true],
      ['i1', 1.2, 0.7],
      ['i2', 1.6, 0.8],
      ['i3', 2.1, 0.8],
      ['i3', 4.2, 0.9],
      ['i3', 6.4, 0.8],
    ],
    windows: [
      ['ext', 0.8, 1.4],
      ['ext', 3 + 3.2 / 2 - 0.9, 1.8],
      ['ext', 6.2 + (w - 6.2) / 2 - 0.9, 1.8],
      ['right', 1.0, 1.2],
    ],
  };
}

// ---------- размещение на этаже ----------
// north: z = 7 − v (окна на север, z = 0); south: z = 9 + v (окна на юг, z = 17)
const SLOTS = [
  { side: 'north', x0: 0, w: 5.0, d: 7, make: () => studio(5.0, 7), basePerM2: 162000 },
  { side: 'north', x0: 5.0, w: 6.0, d: 7, make: () => oneRoom(6.0, 7), basePerM2: 152000 },
  { side: 'north', x0: 11.0, w: 9.0, d: 7, make: () => twoRoom(9.0, 7, 6.0), basePerM2: 148000 },
  { side: 'south', x0: 0, w: 6.5, d: 8, make: () => oneRoom(6.5, 8), basePerM2: 152000 },
  { side: 'south', x0: 6.5, w: 9.5, d: 8, make: () => twoRoom(9.5, 8, 6.4), basePerM2: 148000 },
  {
    side: 'south',
    x0: 16.0,
    w: 10.0,
    d: 8,
    make: () => threeRoomCorner(10.0, 8),
    basePerM2: 140000,
  },
];

function toFloor(slot, [u, v]) {
  return [r2(slot.x0 + u), r2(slot.side === 'north' ? 7 - v : 9 + v)];
}

function rectPoly(slot, u0, v0, u1, v1) {
  return [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ].map((p) => toFloor(slot, p));
}

const area = (poly) => {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s / 2);
};

function buildLayout(slot) {
  const t = slot.make();
  const { w, d } = slot;
  const local = {
    corr: [[0, 0], [w, 0], EXT],
    ext: [[0, d], [w, d], EXT],
    left: [[0, 0], [0, d], EXT],
    right: [[w, 0], [w, d], EXT],
  };
  for (const [k, [a, b]] of Object.entries(t.walls)) local[k] = [a, b, INT];

  const keys = Object.keys(local);
  const walls = keys.map((k) => {
    const [a, b, thickness] = local[k];
    return { a: toFloor(slot, a), b: toFloor(slot, b), thickness, height: CEIL };
  });

  const openings = [];
  const place = (key, at, width, kind, entry) => {
    const [a, b] = local[key];
    const horizontal = a[1] === b[1];
    const p0 = horizontal ? [at, a[1]] : [a[0], at];
    const p1 = horizontal ? [at + width, a[1]] : [a[0], at + width];
    const wi = keys.indexOf(key);
    const fa = walls[wi].a;
    const f0 = toFloor(slot, p0);
    const f1 = toFloor(slot, p1);
    const offset = Math.min(
      Math.hypot(f0[0] - fa[0], f0[1] - fa[1]),
      Math.hypot(f1[0] - fa[0], f1[1] - fa[1]),
    );
    const o = { wallIndex: wi, offset: r2(offset), width, kind };
    if (kind === 'window') {
      o.sill = SILL;
      o.height = WIN_H;
    } else {
      o.height = DOOR_H;
      if (entry) o.entry = true;
    }
    openings.push(o);
  };
  for (const [k, at, width, entry] of t.doors) place(k, r2(at), width, 'door', entry);
  for (const [k, at, width] of t.windows) place(k, r2(at), width, 'window');

  const roomsGeometry = t.roomsGeometry.map(([id, type, u0, v0, u1, v1]) => ({
    id,
    type,
    polygon: rectPoly(slot, u0, v0, u1, v1),
  }));
  const total = r1(roomsGeometry.reduce((s, r) => s + area(r.polygon), 0));
  const prefix = ['studio', 'k1', 'k2', 'k3'][t.rooms];
  return {
    id: `${prefix}-${Math.round(total)}`,
    rooms: t.rooms,
    area: total,
    outline: rectPoly(slot, 0, 0, w, d),
    roomsGeometry,
    walls,
    openings,
  };
}

const layouts = SLOTS.map(buildLayout);

const rng = mulberry32(SEED);
const DEMO_ID = 's1-f9-a3';
const apartments = [];
for (let floor = 1; floor <= FLOORS; floor++) {
  SLOTS.forEach((slot, i) => {
    const layout = layouts[i];
    const id = `s1-f${floor}-a${i + 1}`;
    const roll = rng();
    let status = roll < 0.28 ? 'sold' : roll < 0.42 ? 'reserved' : 'free';
    if (id === DEMO_ID) status = 'free';
    const price =
      Math.round((layout.area * slot.basePerM2 * (1 + FLOOR_STEP * (floor - 1))) / 10000) * 10000;
    apartments.push({
      id,
      number: (floor - 1) * SLOTS.length + i + 1,
      floor,
      layoutId: layout.id,
      price,
      status,
    });
  });
}

const building = {
  complex: 'ЖК Горизонт',
  section: 1,
  floors: FLOORS,
  ceilingHeight: CEIL,
  floorPlate: {
    outline: [
      [0, 0],
      [26, 0],
      [26, 17],
      [0, 17],
    ],
    corridor: [
      [0, 7],
      [26, 7],
      [26, 9],
      [0, 9],
    ],
    core: [
      {
        type: 'stairs',
        polygon: [
          [20, 0],
          [23.5, 0],
          [23.5, 7],
          [20, 7],
        ],
      },
      {
        type: 'lift',
        polygon: [
          [23.5, 0],
          [26, 0],
          [26, 3.5],
          [23.5, 3.5],
        ],
      },
      {
        type: 'lift',
        polygon: [
          [23.5, 3.5],
          [26, 3.5],
          [26, 7],
          [23.5, 7],
        ],
      },
    ],
  },
  layouts,
  apartments,
};

const out = fileURLToPath(new URL('../src/data/building.json', import.meta.url));
writeFileSync(out, JSON.stringify(building, null, 2) + '\n');
console.log(
  `building.json: ${layouts.length} планировок (${layouts.map((l) => `${l.id} ${l.area} м²`).join(', ')}), ${apartments.length} квартир`,
);
