/**
 * Генератор случайной, но воспроизводимой планировки (CLAUDE.md §10.1).
 *
 * 1. Контур: прямоугольник или Г-образная форма (прямоугольник без угла).
 * 2. BSP: у каждого помещения есть целевая площадь (прихожая 4–8 м², санузел 3.5–6 м² …);
 *    контур режется поперёк длинной стороны пропорционально сумме площадей по обе стороны
 *    разреза, по сетке 0.1 м (мин. сторона 1.5 м, пропорции не уже 1:3).
 * 3. Типы: прихожая — у коридора (верхняя сторона, y = 0), жилые комнаты и кухня — у фасада
 *    (с окном), санузел — что осталось.
 * 4. Двери — остовное дерево от прихожей; проходить можно только через прихожую, гостиную и кухню,
 *    поэтому санузел и спальни не бывают проходными.
 * 5. Стены — по границам помещений: общие — внутренние (0.1 м), остальные — наружные (0.25 м).
 *
 * Внутри всё считается в целых дециметрах, наружу отдаётся в метрах.
 */
import {
  DOOR_HEIGHT,
  PRICE_FLOOR_STEP,
  WALL_EXTERIOR,
  WALL_INTERIOR,
} from '../../domain/constants';
import {
  ROOM_COUNTS,
  type Apartment,
  type ApartmentStatus,
  type Opening,
  type Room,
  type RoomCount,
  type RoomType,
  type Vec2,
  type Wall,
} from '../../domain/types';
import { createRng, type Rng } from './rng';

export type Shape = 'rect' | 'L';

export interface RandomApartmentOptions {
  /** Комнатность или 'any' (по умолчанию). */
  rooms?: RoomCount | 'any';
  /** Допустимая площадь, м². Пересекается с типичным диапазоном для комнатности. */
  areaRange?: [number, number];
  /** Высота потолка, м: число или диапазон. По умолчанию 2.5–3.2. */
  ceiling?: number | [number, number];
  shape?: Shape | 'any';
  /** Балкон: всегда, никогда или с вероятностью 0.4 (по умолчанию). */
  balcony?: boolean | 'random';
}

// ---------- параметры генератора (в дециметрах) ----------
const DM = 10;
const MIN_SIDE = 15;
const MAX_ASPECT = 3;
const ENTRY_DOOR = 9;
const BATH_DOOR = 7;
const DOOR_MIN = 7;
const DOOR_MAX = 9;
const DOOR_MARGIN = 1;
const WINDOW_MIN = 9;
const WINDOW_MAX = 18;
const WINDOW_MARGIN = 2;
const MAX_ATTEMPTS = 300;
const BALCONY_CHANCE = 0.4;
const L_SHAPE_CHANCE = 0.4;
const SECOND_WINDOW_CHANCE = 0.35;

const DEFAULT_AREA: [number, number] = [25, 120];
const DEFAULT_CEILING: [number, number] = [2.5, 3.2];
/** Типичная площадь по комнатности, м². */
const AREA_BY_ROOMS: Record<RoomCount, [number, number]> = {
  0: [25, 40],
  1: [34, 52],
  2: [48, 78],
  3: [66, 100],
  4: [86, 120],
};
const STATUS_WEIGHTS: [ApartmentStatus, number][] = [
  ['free', 0.55],
  ['reserved', 0.15],
  ['sold', 0.3],
];

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
/** Отрезок на оси: horizontal — y = at, x ∈ [from, to]; иначе x = at, y ∈ [from, to]. */
interface Seg {
  horizontal: boolean;
  at: number;
  from: number;
  to: number;
}
interface Adj {
  a: number;
  b: number;
  seg: Seg;
}
interface Ext {
  leaf: number;
  seg: Seg;
  corridor: boolean;
}

const width = (r: Rect) => r.x1 - r.x0;
const height = (r: Rect) => r.y1 - r.y0;
const rectArea = (r: Rect) => width(r) * height(r);
const segLen = (s: Seg) => s.to - s.from;
const aspectOk = (a: number, b: number) => Math.max(a, b) / Math.min(a, b) <= MAX_ASPECT;
const m = (dm: number) => dm / DM;
const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;

// ---------- 1. контур ----------

interface Outline {
  pieces: Rect[];
  poly: Vec2[];
}

function makeOutline(rng: Rng, shape: Shape, areaM2: number): Outline | null {
  const target = areaM2 * DM * DM;
  if (shape === 'rect') {
    const aspect = rng.float(1, 1.8);
    let W = Math.round(Math.sqrt(target * aspect));
    let D = Math.round(target / W);
    if (rng.chance(0.5)) [W, D] = [D, W];
    return {
      pieces: [{ x0: 0, y0: 0, x1: W, y1: D }],
      poly: [
        [0, 0],
        [W, 0],
        [W, D],
        [0, D],
      ],
    };
  }
  const nwF = rng.float(0.3, 0.45);
  const ndF = rng.float(0.3, 0.5);
  const full = target / (1 - nwF * ndF);
  const aspect = rng.float(1, 1.6);
  let W = Math.round(Math.sqrt(full * aspect));
  let D = Math.round(full / W);
  if (rng.chance(0.5)) [W, D] = [D, W];
  const nw = Math.round(W * nwF);
  const nd = Math.round(D * ndF);
  if (nw < MIN_SIDE || W - nw < MIN_SIDE || D - nd < MIN_SIDE || nd < MIN_SIDE / 2) return null;
  const corner = rng.pick(['tr', 'br', 'tl', 'bl'] as const);
  const p = (x: number, y: number): Vec2 => [x, y];
  switch (corner) {
    case 'tr':
      return {
        pieces: [
          { x0: 0, y0: 0, x1: W - nw, y1: D },
          { x0: W - nw, y0: nd, x1: W, y1: D },
        ],
        poly: [p(0, 0), p(W - nw, 0), p(W - nw, nd), p(W, nd), p(W, D), p(0, D)],
      };
    case 'br':
      return {
        pieces: [
          { x0: 0, y0: 0, x1: W - nw, y1: D },
          { x0: W - nw, y0: 0, x1: W, y1: D - nd },
        ],
        poly: [p(0, 0), p(W, 0), p(W, D - nd), p(W - nw, D - nd), p(W - nw, D), p(0, D)],
      };
    case 'tl':
      return {
        pieces: [
          { x0: nw, y0: 0, x1: W, y1: D },
          { x0: 0, y0: nd, x1: nw, y1: D },
        ],
        poly: [p(nw, 0), p(W, 0), p(W, D), p(0, D), p(0, nd), p(nw, nd)],
      };
    case 'bl':
      return {
        pieces: [
          { x0: nw, y0: 0, x1: W, y1: D },
          { x0: 0, y0: 0, x1: nw, y1: D - nd },
        ],
        poly: [p(0, 0), p(W, 0), p(W, D), p(nw, D), p(nw, D - nd), p(0, D - nd)],
      };
  }
}

// ---------- 2. BSP со взвешенными разрезами ----------

/** Целевые площади помещений, м²: из них берутся пропорции разрезов. */
const TARGET_AREA: Record<RoomType, [number, number]> = {
  hall: [4, 8],
  bath: [3.5, 6],
  kitchen: [7, 13],
  living: [15, 24],
  bedroom: [9, 15],
  balcony: [3, 5],
};
const STUDIO_LIVING: [number, number] = [18, 28];

function targetWeights(rooms: RoomCount, balcony: boolean, rng: Rng): number[] {
  const w = (r: [number, number]) => rng.float(r[0], r[1]);
  const out = [w(TARGET_AREA.hall), w(TARGET_AREA.bath)];
  if (rooms === 0) out.push(w(STUDIO_LIVING));
  else {
    out.push(w(TARGET_AREA.kitchen), w(TARGET_AREA.living));
    for (let k = 1; k < rooms; k++) out.push(w(TARGET_AREA.bedroom));
  }
  if (balcony) out.push(w(TARGET_AREA.balcony));
  return rng.shuffle(out);
}

const sum = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0);

/** Индекс разбиения списка на две части с суммами, ближайшими к долям target. */
function splitIndex(ws: readonly number[], share: number): number {
  const total = sum(ws);
  let best = 1;
  let bestDiff = Infinity;
  let acc = 0;
  for (let k = 1; k < ws.length; k++) {
    acc += ws[k - 1]!;
    const diff = Math.abs(acc / total - share);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = k;
    }
  }
  return best;
}

/**
 * Делит прямоугольник на ws.length частей с площадями, пропорциональными весам:
 * веса делятся на две группы, прямоугольник режется поперёк длинной стороны в той же пропорции.
 */
function partition(r: Rect, ws: readonly number[]): Rect[] | null {
  if (ws.length === 1) return [r];
  const k = splitIndex(ws, 0.5);
  const left = ws.slice(0, k);
  const right = ws.slice(k);
  const ratio = sum(left) / sum(ws);
  const order = width(r) >= height(r) ? [true, false] : [false, true];
  for (const vertical of order) {
    const len = vertical ? width(r) : height(r);
    if (len < 2 * MIN_SIDE) continue;
    const cut = Math.min(len - MIN_SIDE, Math.max(MIN_SIDE, Math.round(len * ratio)));
    const [a, b]: [Rect, Rect] = vertical
      ? [
          { ...r, x1: r.x0 + cut },
          { ...r, x0: r.x0 + cut },
        ]
      : [
          { ...r, y1: r.y0 + cut },
          { ...r, y0: r.y0 + cut },
        ];
    const pa = partition(a, left);
    const pb = pa && partition(b, right);
    if (pa && pb) return [...pa, ...pb];
  }
  return null;
}

function bsp(pieces: Rect[], weights: number[]): Rect[] | null {
  let leaves: Rect[] | null;
  if (pieces.length === 1) {
    leaves = partition(pieces[0]!, weights);
  } else {
    const [A, B] = pieces as [Rect, Rect];
    if (weights.length < 2) return null;
    // второму куску Г-образного контура достаётся доля весов по его доле площади
    const k = splitIndex(weights, rectArea(A) / (rectArea(A) + rectArea(B)));
    const pa = partition(A, weights.slice(0, k));
    const pb = pa && partition(B, weights.slice(k));
    leaves = pa && pb ? [...pa, ...pb] : null;
  }
  const ok = leaves?.every(
    (r) => width(r) >= MIN_SIDE && height(r) >= MIN_SIDE && aspectOk(width(r), height(r)),
  );
  return ok ? leaves : null;
}

// ---------- смежность и наружные участки ----------

function adjacency(leaves: Rect[]): Adj[] {
  const out: Adj[] = [];
  for (let i = 0; i < leaves.length; i++) {
    for (let j = i + 1; j < leaves.length; j++) {
      const A = leaves[i]!;
      const B = leaves[j]!;
      for (const x of [A.x1 === B.x0 ? A.x1 : null, A.x0 === B.x1 ? A.x0 : null]) {
        if (x === null) continue;
        const from = Math.max(A.y0, B.y0);
        const to = Math.min(A.y1, B.y1);
        if (to > from) out.push({ a: i, b: j, seg: { horizontal: false, at: x, from, to } });
      }
      for (const y of [A.y1 === B.y0 ? A.y1 : null, A.y0 === B.y1 ? A.y0 : null]) {
        if (y === null) continue;
        const from = Math.max(A.x0, B.x0);
        const to = Math.min(A.x1, B.x1);
        if (to > from) out.push({ a: i, b: j, seg: { horizontal: true, at: y, from, to } });
      }
    }
  }
  return out;
}

function subtract(from: number, to: number, cuts: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  let cur = from;
  for (const [a, b] of [...cuts].sort((p, q) => p[0] - q[0])) {
    if (a > cur) out.push([cur, Math.min(a, to)]);
    cur = Math.max(cur, b);
    if (cur >= to) break;
  }
  if (cur < to) out.push([cur, to]);
  return out.filter(([a, b]) => b > a);
}

function exterior(leaves: Rect[], adj: Adj[]): Ext[] {
  const out: Ext[] = [];
  leaves.forEach((r, i) => {
    const sides: (Seg & { top: boolean })[] = [
      { horizontal: true, at: r.y0, from: r.x0, to: r.x1, top: true },
      { horizontal: true, at: r.y1, from: r.x0, to: r.x1, top: false },
      { horizontal: false, at: r.x0, from: r.y0, to: r.y1, top: false },
      { horizontal: false, at: r.x1, from: r.y0, to: r.y1, top: false },
    ];
    for (const s of sides) {
      const covered = adj
        .filter(
          (e) => (e.a === i || e.b === i) && e.seg.horizontal === s.horizontal && e.seg.at === s.at,
        )
        .map((e): [number, number] => [e.seg.from, e.seg.to]);
      for (const [from, to] of subtract(s.from, s.to, covered)) {
        out.push({
          leaf: i,
          seg: { horizontal: s.horizontal, at: s.at, from, to },
          corridor: s.top && s.at === 0,
        });
      }
    }
  });
  return out;
}

// ---------- 3. типы помещений ----------

const WINDOW_NEED = WINDOW_MIN + 2 * WINDOW_MARGIN;
/** Штраф к площади при выборе прихожей, если у помещения есть фасад, дм² (8 м²). */
const HALL_FACADE_PENALTY = 8 * DM * DM;
/** Границы площадей по типам, м²: квартиры за пределами отбрасываются и строятся заново. */
export const AREA_LIMITS: Record<RoomType, [number, number]> = {
  hall: [2.5, 14],
  bath: [2.5, 9],
  kitchen: [5, 20],
  living: [10, 40],
  bedroom: [7, 24],
  balcony: [2.5, 10],
};
export const STUDIO_LIVING_MIN = 14;

function plausible(leaves: Rect[], types: RoomType[], rooms: RoomCount): boolean {
  return types.every((t, i) => {
    const a = rectArea(leaves[i]!) / (DM * DM);
    const [lo, hi] = AREA_LIMITS[t];
    const min = rooms === 0 && t === 'living' ? STUDIO_LIVING_MIN : lo;
    return a >= min && a <= hi;
  });
}
const HABITABLE: readonly RoomType[] = ['living', 'bedroom', 'kitchen'];

function sharedLen(adj: Adj[], i: number, j: number): number {
  return adj
    .filter((e) => (e.a === i && e.b === j) || (e.a === j && e.b === i))
    .reduce((s, e) => Math.max(s, segLen(e.seg)), 0);
}

/** a < b в лексикографическом порядке. */
function lexLess(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i]! < b[i]!;
  }
  return false;
}

/** Элемент с наименьшим ключом (ключ — кортеж, сравнивается лексикографически). */
function argmin<T>(list: readonly T[], key: (x: T) => number[]): T | undefined {
  let best: T | undefined;
  let bestKey: number[] = [];
  for (const x of list) {
    const k = key(x);
    if (best === undefined || lexLess(k, bestKey)) {
      best = x;
      bestKey = k;
    }
  }
  return best;
}

function assignTypes(
  leaves: Rect[],
  adj: Adj[],
  ext: Ext[],
  rooms: RoomCount,
  balcony: boolean,
): RoomType[] | null {
  const n = leaves.length;
  const maxLen = (i: number, corridor: boolean) =>
    ext
      .filter((e) => e.leaf === i && e.corridor === corridor)
      .reduce((s, e) => Math.max(s, segLen(e.seg)), 0);
  const capable = (i: number) => maxLen(i, false) >= WINDOW_NEED;
  const all = Array.from({ length: n }, (_, i) => i);

  // прихожая — самое маленькое помещение у коридора; помещение с фасадом «дороже» на HALL_FACADE_PENALTY
  const hall = argmin(
    all.filter((i) => maxLen(i, true) >= ENTRY_DOOR + 2 * DOOR_MARGIN),
    (i) => [rectArea(leaves[i]!) + (capable(i) ? HALL_FACADE_PENALTY : 0)],
  );
  if (hall === undefined) return null;
  const rest = all.filter((i) => i !== hall);
  const nonCapable = rest.filter((i) => !capable(i));
  if (nonCapable.length > 1) return null;
  const bath = nonCapable[0] ?? argmin(rest, (i) => [rectArea(leaves[i]!)]);
  if (bath === undefined) return null;

  const types: RoomType[] = new Array<RoomType>(n).fill('living');
  types[hall] = 'hall';
  types[bath] = 'bath';
  let habitable = rest.filter((i) => i !== bath);

  if (balcony) {
    const b = argmin(
      habitable.filter((i) =>
        habitable.some((j) => j !== i && sharedLen(adj, i, j) >= DOOR_MIN + 2),
      ),
      (i) => [rectArea(leaves[i]!)],
    );
    if (b === undefined) return null;
    types[b] = 'balcony';
    habitable = habitable.filter((i) => i !== b);
  }

  if (rooms === 0) {
    if (habitable.length !== 1) return null;
    types[habitable[0]!] = 'living';
    return types;
  }
  const kitchen = argmin(habitable, (i) => [
    sharedLen(adj, i, hall) >= DOOR_MAX + 2 ? 0 : 1,
    rectArea(leaves[i]!),
  ]);
  if (kitchen === undefined) return null;
  types[kitchen] = 'kitchen';
  const others = habitable.filter((i) => i !== kitchen);
  const living = argmin(others, (i) => [-rectArea(leaves[i]!)]);
  for (const i of others) types[i] = i === living ? 'living' : 'bedroom';
  return types;
}

// ---------- 4. двери: остовное дерево ----------

interface DoorPlan {
  adj: number;
  width: number;
  target: number;
}

function canPass(from: RoomType, to: RoomType): boolean {
  if (to === 'balcony') return from !== 'hall' && from !== 'bath' && from !== 'balcony';
  return from === 'hall' || from === 'living' || from === 'kitchen';
}

function spanningDoors(types: RoomType[], adj: Adj[], hall: number, rng: Rng): DoorPlan[] | null {
  const visited = new Set([hall]);
  const queue = [hall];
  const doors: DoorPlan[] = [];
  while (queue.length > 0) {
    const u = queue.shift()!;
    const edges = rng.shuffle(
      adj.map((e, k) => ({ e, k })).filter(({ e }) => e.a === u || e.b === u),
    );
    for (const { e, k } of edges) {
      const v = e.a === u ? e.b : e.a;
      if (visited.has(v) || !canPass(types[u]!, types[v]!)) continue;
      const len = segLen(e.seg);
      let w = types[v] === 'bath' ? BATH_DOOR : rng.int(DOOR_MIN, DOOR_MAX);
      if (len < w + 2 * DOOR_MARGIN) w = len - 2 * DOOR_MARGIN;
      if (w < DOOR_MIN) continue;
      visited.add(v);
      queue.push(v);
      doors.push({ adj: k, width: w, target: v });
    }
  }
  return visited.size === types.length ? doors : null;
}

// ---------- 5. сборка ----------

function segPoints(s: Seg): [Vec2, Vec2] {
  return s.horizontal
    ? [
        [m(s.from), m(s.at)],
        [m(s.to), m(s.at)],
      ]
    : [
        [m(s.at), m(s.from)],
        [m(s.at), m(s.to)],
      ];
}

function roomIds(types: RoomType[]): string[] {
  let beds = 0;
  return types.map((t) => (t === 'bedroom' ? `bed${++beds}` : t));
}

function weightedStatus(rng: Rng): ApartmentStatus {
  let r = rng.next();
  for (const [s, w] of STATUS_WEIGHTS) {
    if (r < w) return s;
    r -= w;
  }
  return 'free';
}

interface BuildCtx {
  seed: number;
  rng: Rng;
  rooms: RoomCount;
  shape: Shape;
  balcony: boolean;
  area: [number, number];
  ceiling: number;
}

function attempt(ctx: BuildCtx): Apartment | null {
  const { rng, rooms, ceiling } = ctx;
  const target = rng.float(ctx.area[0], ctx.area[1]);
  const outline = makeOutline(rng, ctx.shape, target);
  if (!outline) return null;
  const leaves = bsp(outline.pieces, targetWeights(rooms, ctx.balcony, rng));
  if (!leaves) return null;
  const totalDm2 = leaves.reduce((s, r) => s + rectArea(r), 0);
  const area = round1(totalDm2 / (DM * DM));
  if (area < ctx.area[0] || area > ctx.area[1]) return null;

  const adj = adjacency(leaves);
  const ext = exterior(leaves, adj);
  const types = assignTypes(leaves, adj, ext, rooms, ctx.balcony);
  if (!types || !plausible(leaves, types, rooms)) return null;
  const hall = types.indexOf('hall');
  const doors = spanningDoors(types, adj, hall, rng);
  if (!doors) return null;

  // стены: сначала внутренние (по одной на пару смежных помещений), потом наружные участки
  const walls: Wall[] = [];
  const adjWall = adj.map((e) => {
    const [a, b] = segPoints(e.seg);
    walls.push({ a, b, thickness: WALL_INTERIOR, height: ceiling });
    return walls.length - 1;
  });
  const extWall = ext.map((e) => {
    const [a, b] = segPoints(e.seg);
    walls.push({ a, b, thickness: WALL_EXTERIOR, height: ceiling });
    return walls.length - 1;
  });

  const openings: Opening[] = [];
  const door = (wallIndex: number, len: number, w: number, entry = false) => {
    const offset = rng.int(DOOR_MARGIN, len - DOOR_MARGIN - w);
    openings.push({
      wallIndex,
      offset: m(offset),
      width: m(w),
      kind: 'door',
      height: DOOR_HEIGHT,
      ...(entry && { entry: true }),
    });
  };

  const entrySeg = ext
    .map((e, k) => ({ e, k }))
    .filter(({ e }) => e.leaf === hall && e.corridor)
    .sort((p, q) => segLen(q.e.seg) - segLen(p.e.seg))[0];
  if (!entrySeg) return null;
  door(extWall[entrySeg.k]!, segLen(entrySeg.e.seg), ENTRY_DOOR, true);
  for (const d of doors) door(adjWall[d.adj]!, segLen(adj[d.adj]!.seg), d.width);

  types.forEach((t, i) => {
    if (!HABITABLE.includes(t)) return;
    const facades = ext
      .map((e, k) => ({ e, k }))
      .filter(({ e }) => e.leaf === i && !e.corridor && segLen(e.seg) >= WINDOW_NEED)
      .sort((p, q) => segLen(q.e.seg) - segLen(p.e.seg));
    facades.forEach(({ e, k }, idx) => {
      if (idx > 0 && !rng.chance(SECOND_WINDOW_CHANCE)) return;
      const len = segLen(e.seg);
      const w = rng.int(WINDOW_MIN, Math.min(WINDOW_MAX, len - 2 * WINDOW_MARGIN));
      const offset = rng.int(WINDOW_MARGIN, len - WINDOW_MARGIN - w);
      const sill = rng.pick([0.8, 0.85, 0.9]);
      openings.push({
        wallIndex: extWall[k]!,
        offset: m(offset),
        width: m(w),
        kind: 'window',
        sill,
        height: Math.min(1.5, round2(ceiling - 0.3 - sill)),
      });
    });
  });

  const ids = roomIds(types);
  const roomsGeometry: Room[] = leaves.map((r, i) => ({
    id: ids[i]!,
    type: types[i]!,
    polygon: [
      [m(r.x0), m(r.y0)],
      [m(r.x1), m(r.y0)],
      [m(r.x1), m(r.y1)],
      [m(r.x0), m(r.y1)],
    ],
  }));

  const floor = rng.int(1, 25);
  const perM2 = rng.int(120, 200) * 1000;
  const price = Math.round((area * perM2 * (1 + PRICE_FLOOR_STEP * (floor - 1))) / 10000) * 10000;
  const id = `rnd-${ctx.seed}`;
  return {
    id,
    number: Math.max(1, Math.floor(ctx.seed)),
    floor,
    layoutId: id,
    rooms,
    area,
    price,
    status: weightedStatus(rng),
    outline: outline.poly.map(([x, y]): Vec2 => [m(x), m(y)]),
    roomsGeometry,
    walls,
    openings,
  };
}

function intersect(a: [number, number], b: [number, number]): [number, number] | null {
  const lo = Math.max(a[0], b[0]);
  const hi = Math.min(a[1], b[1]);
  return lo <= hi ? [lo, hi] : null;
}

/** Случайная квартира по seed. Один и тот же seed с теми же опциями всегда даёт ту же квартиру. */
export function randomApartment(seed: number, opts: RandomApartmentOptions = {}): Apartment {
  const rng = createRng(seed);
  const rooms: RoomCount =
    opts.rooms === undefined || opts.rooms === 'any' ? rng.pick(ROOM_COUNTS) : opts.rooms;
  const userArea = opts.areaRange ?? DEFAULT_AREA;
  const area = intersect(AREA_BY_ROOMS[rooms], userArea) ?? userArea;
  const c = opts.ceiling ?? DEFAULT_CEILING;
  const ceiling = typeof c === 'number' ? c : Math.round(rng.float(c[0], c[1]) * 10) / 10;

  for (let k = 0; k < MAX_ATTEMPTS; k++) {
    const shape: Shape =
      opts.shape === undefined || opts.shape === 'any'
        ? rng.chance(L_SHAPE_CHANCE)
          ? 'L'
          : 'rect'
        : opts.shape;
    const balcony =
      opts.balcony === undefined || opts.balcony === 'random'
        ? rng.chance(BALCONY_CHANCE)
        : opts.balcony;
    const apt = attempt({ seed, rng, rooms, shape, balcony, area, ceiling });
    if (apt) return apt;
  }
  throw new Error(
    `seed=${seed}: не удалось построить квартиру (${rooms}-комн., ${area[0]}–${area[1]} м²) за ${MAX_ATTEMPTS} попыток`,
  );
}
