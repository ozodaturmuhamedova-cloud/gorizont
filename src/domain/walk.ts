/**
 * Рост посетителя → параметры прогулки (§7.1). Расстановка мебели (§7.2) использует
 * collisionRadius, чтобы проверить, что к каждому предмету можно подойти.
 */
import {
  CEILING_EYE_GAP,
  EYE_RATIO,
  HEIGHT_MAX_CM,
  HEIGHT_MIN_CM,
  WALK_GRID,
  WALK_PUSH_ITERATIONS,
  WALK_START_OFFSET,
  WALK_SUBSTEP_RATIO,
} from './constants';
import { bbox, centerOf, footprintObb, pointInPolygon, wallDir, wallLength } from './geometry';
import type { Apartment, FurnitureCatalog, Obb, PlacedFurniture, Room, Vec2 } from './types';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Рост в допустимом диапазоне 100–220 см. */
export function isValidHeight(cm: number): boolean {
  return Number.isFinite(cm) && cm >= HEIGHT_MIN_CM && cm <= HEIGHT_MAX_CM;
}

/** Высота глаз, м. */
export function eyeHeight(cm: number): number {
  return round2((cm / 100) * EYE_RATIO);
}

/** Высота камеры: глаза, но не выше потолка минус зазор. */
export function cameraHeight(cm: number, ceiling: number): number {
  return Math.min(eyeHeight(cm), round2(ceiling - CEILING_EYE_GAP));
}

/** «Плечи» посетителя — радиус круга коллизий, м. */
export function collisionRadius(cm: number): number {
  return clamp((cm / 100) * 0.13, 0.18, 0.28);
}

/** Скорость шага, м/с. */
export function walkSpeed(cm: number): number {
  return clamp((cm / 100) * 0.8, 1.0, 1.6);
}

/** Потолок прогулки бьёт по глазам: камера опущена ниже уровня глаз. */
export function ceilingTooLow(cm: number, ceiling: number): boolean {
  return eyeHeight(cm) > cameraHeight(cm, ceiling);
}

/** Высота потолка квартиры — по самой высокой стене. */
export function ceilingOf(apt: Pick<Apartment, 'walls'>): number {
  return Math.max(...apt.walls.map((w) => w.height));
}

// ---------- коллизии (в плоскости пола) ----------

/**
 * Препятствия прогулки: глухие куски стен (проёмы межкомнатных дверей вырезаны, окна и входная
 * дверь — сплошные: из квартиры не выйти) и следы мебели.
 */
export function walkObstacles(
  apt: Pick<Apartment, 'walls' | 'openings'>,
  placed: readonly PlacedFurniture[] = [],
  catalog?: Pick<FurnitureCatalog, 'byId'>,
): Obb[] {
  const out: Obb[] = [];
  apt.walls.forEach((w, wi) => {
    const len = wallLength(w);
    if (len <= 0) return;
    const [dx, dy] = wallDir(w);
    const half = w.thickness / 2;
    const doors = apt.openings
      .filter((o) => o.wallIndex === wi && o.kind === 'door' && !o.entry)
      .map((o) => [o.offset, o.offset + o.width] as const)
      .sort((a, b) => a[0] - b[0]);
    // концы стены продлеваем на полтолщины, чтобы углы были закрыты; косяки дверей — нет
    let from = -half;
    const pieces: [number, number][] = [];
    for (const [a, b] of doors) {
      if (a > from) pieces.push([from, a]);
      from = Math.max(from, b);
    }
    if (len + half > from) pieces.push([from, len + half]);
    for (const [a, b] of pieces) {
      const t = (a + b) / 2;
      out.push({
        center: [w.a[0] + dx * t, w.a[1] + dy * t],
        half: [(b - a) / 2, half],
        rotation: Math.atan2(dy, dx),
      });
    }
  });
  if (catalog) {
    for (const p of placed) {
      const item = catalog.byId.get(p.itemId);
      if (item) out.push(footprintObb(item.size, p.position, p.rotation));
    }
  }
  return out;
}

/** Ближайшая точка OBB к p. */
function closestOnObb(o: Obb, p: Vec2): Vec2 {
  const c = Math.cos(o.rotation);
  const s = Math.sin(o.rotation);
  const dx = p[0] - o.center[0];
  const dy = p[1] - o.center[1];
  const lx = Math.max(-o.half[0], Math.min(o.half[0], c * dx + s * dy));
  const ly = Math.max(-o.half[1], Math.min(o.half[1], -s * dx + c * dy));
  return [o.center[0] + c * lx - s * ly, o.center[1] + s * lx + c * ly];
}

/** Насколько круг (p, r) заходит в препятствие и куда его выталкивать; null — не задевает. */
export function circlePenetration(
  o: Obb,
  p: Vec2,
  r: number,
): { depth: number; normal: Vec2 } | null {
  const q = closestOnObb(o, p);
  const dx = p[0] - q[0];
  const dy = p[1] - q[1];
  const d = Math.hypot(dx, dy);
  if (d >= r) return null;
  if (d > 1e-9) return { depth: r - d, normal: [dx / d, dy / d] };
  // центр внутри прямоугольника: выталкиваем через ближайшую грань
  const c = Math.cos(o.rotation);
  const s = Math.sin(o.rotation);
  const ox = p[0] - o.center[0];
  const oy = p[1] - o.center[1];
  const lx = c * ox + s * oy;
  const ly = -s * ox + c * oy;
  const gx = o.half[0] - Math.abs(lx);
  const gy = o.half[1] - Math.abs(ly);
  const local: Vec2 = gx < gy ? [Math.sign(lx) || 1, 0] : [0, Math.sign(ly) || 1];
  return {
    depth: Math.min(gx, gy) + r,
    normal: [c * local[0] - s * local[1], s * local[0] + c * local[1]],
  };
}

export function collides(p: Vec2, r: number, obstacles: readonly Obb[]): boolean {
  return obstacles.some((o) => circlePenetration(o, p, r) !== null);
}

function resolve(p: Vec2, r: number, obstacles: readonly Obb[]): Vec2 {
  let q: Vec2 = [p[0], p[1]];
  for (let k = 0; k < WALK_PUSH_ITERATIONS; k++) {
    let moved = false;
    for (const o of obstacles) {
      const hit = circlePenetration(o, q, r);
      if (!hit) continue;
      q = [q[0] + hit.normal[0] * (hit.depth + 1e-6), q[1] + hit.normal[1] * (hit.depth + 1e-6)];
      moved = true;
    }
    if (!moved) break;
  }
  return q;
}

/**
 * Шаг посетителя на delta: подшаги не длиннее половины радиуса, после каждого — выталкивание
 * из препятствий. Упор в стену под углом даёт скольжение вдоль неё.
 */
export function moveCircle(p: Vec2, delta: Vec2, r: number, obstacles: readonly Obb[]): Vec2 {
  const len = Math.hypot(delta[0], delta[1]);
  const n = Math.max(1, Math.ceil(len / (r * WALK_SUBSTEP_RATIO)));
  let q: Vec2 = [p[0], p[1]];
  for (let i = 0; i < n; i++) {
    const next = resolve([q[0] + delta[0] / n, q[1] + delta[1] / n], r, obstacles);
    // в узкой щели выталкивание может «дрожать» — тогда стоим на месте
    if (collides(next, r - 1e-4, obstacles)) break;
    q = next;
  }
  return q;
}

/**
 * Если посетитель оказался внутри препятствия (сменил рост, поставили мебель), — ближайшая
 * свободная точка внутри квартиры: поиск по расширяющимся кольцам сетки.
 */
export function nearestFree(
  p: Vec2,
  r: number,
  obstacles: readonly Obb[],
  outline: readonly Vec2[],
  maxDist = 3,
): Vec2 {
  const free = (q: Vec2) => pointInPolygon(q, outline) && !collides(q, r, obstacles);
  if (free(p)) return p;
  const pushed = resolve(p, r, obstacles);
  if (free(pushed) && Math.hypot(pushed[0] - p[0], pushed[1] - p[1]) < r * 2) return pushed;
  for (let ring = 1; ring * WALK_GRID <= maxDist; ring++) {
    let best: Vec2 | null = null;
    let bestD = Infinity;
    for (let i = -ring; i <= ring; i++) {
      for (let j = -ring; j <= ring; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
        const q: Vec2 = [p[0] + i * WALK_GRID, p[1] + j * WALK_GRID];
        const d = Math.hypot(i, j);
        if (d < bestD && free(q)) {
          best = q;
          bestD = d;
        }
      }
    }
    if (best) return best;
  }
  return p;
}

// ---------- старт и комнаты ----------

export interface WalkPose {
  position: Vec2;
  /** Направление взгляда на плане, рад: 0 — вдоль +x, π/2 — вдоль +y. */
  heading: number;
}

/** Комната, в которой стоит посетитель. */
export function roomContaining(apt: Pick<Apartment, 'roomsGeometry'>, p: Vec2): Room | undefined {
  return apt.roomsGeometry.find((r) => pointInPolygon(p, r.polygon));
}

/**
 * Точка старта (§7.1): в прихожей у входной двери, взгляд внутрь квартиры. Если входной двери
 * или прихожей нет — центр самой большой комнаты.
 */
export function startPose(apt: Apartment, cm: number, obstacles?: readonly Obb[]): WalkPose {
  const r = collisionRadius(cm);
  const obs = obstacles ?? walkObstacles(apt);
  const entry = apt.openings.find((o) => o.kind === 'door' && o.entry);
  const w = entry ? apt.walls[entry.wallIndex] : undefined;
  const hasHall = apt.roomsGeometry.some((room) => room.type === 'hall');
  if (entry && w && hasHall) {
    const [dx, dy] = wallDir(w);
    const t = entry.offset + entry.width / 2;
    const c: Vec2 = [w.a[0] + dx * t, w.a[1] + dy * t];
    const off = w.thickness / 2 + WALK_START_OFFSET + r;
    for (const sign of [1, -1]) {
      const n: Vec2 = [-dy * sign, dx * sign];
      const p: Vec2 = [c[0] + n[0] * off, c[1] + n[1] * off];
      if (pointInPolygon(p, apt.outline)) {
        return { position: nearestFree(p, r, obs, apt.outline), heading: Math.atan2(n[1], n[0]) };
      }
    }
  }
  const biggest = [...apt.roomsGeometry].sort((a, b) => {
    const A = bbox(a.polygon);
    const B = bbox(b.polygon);
    return (
      (B.max[0] - B.min[0]) * (B.max[1] - B.min[1]) - (A.max[0] - A.min[0]) * (A.max[1] - A.min[1])
    );
  })[0];
  const p = biggest ? centerOf(biggest.polygon) : centerOf(apt.outline);
  return { position: nearestFree(p, r, obs, apt.outline), heading: -Math.PI / 2 };
}

/**
 * Куда можно дойти из точки from посетителю радиуса r: поиск в ширину по сетке WALK_GRID
 * внутри контура квартиры. Возвращает проверку «достижима ли точка».
 */
export function reachableFrom(
  apt: Pick<Apartment, 'outline'>,
  from: Vec2,
  r: number,
  obstacles: readonly Obb[],
): (p: Vec2) => boolean {
  const { min, max } = bbox(apt.outline);
  const nx = Math.ceil((max[0] - min[0]) / WALK_GRID) + 1;
  const ny = Math.ceil((max[1] - min[1]) / WALK_GRID) + 1;
  const at = (i: number, j: number): Vec2 => [min[0] + i * WALK_GRID, min[1] + j * WALK_GRID];
  const state = new Int8Array(nx * ny); // 0 — не проверено, 1 — свободно и достигнуто, -1 — занято
  const ok = (i: number, j: number) => {
    const k = i * ny + j;
    if (state[k] !== 0) return false;
    const q = at(i, j);
    const free = pointInPolygon(q, apt.outline) && !collides(q, r, obstacles);
    state[k] = free ? 1 : -1;
    return free;
  };
  const si = Math.round((from[0] - min[0]) / WALK_GRID);
  const sj = Math.round((from[1] - min[1]) / WALK_GRID);
  const queue: number[] = [];
  if (si >= 0 && sj >= 0 && si < nx && sj < ny && ok(si, sj)) queue.push(si * ny + sj);
  for (let h = 0; h < queue.length; h++) {
    const k = queue[h]!;
    const i = Math.floor(k / ny);
    const j = k % ny;
    for (const [a, b] of [
      [i + 1, j],
      [i - 1, j],
      [i, j + 1],
      [i, j - 1],
    ] as const) {
      if (a >= 0 && b >= 0 && a < nx && b < ny && ok(a, b)) queue.push(a * ny + b);
    }
  }
  return (p: Vec2) => {
    // ближайшие узлы сетки вокруг точки: достаточно одного достигнутого
    const i0 = Math.floor((p[0] - min[0]) / WALK_GRID);
    const j0 = Math.floor((p[1] - min[1]) / WALK_GRID);
    for (const [a, b] of [
      [i0, j0],
      [i0 + 1, j0],
      [i0, j0 + 1],
      [i0 + 1, j0 + 1],
    ] as const) {
      if (a >= 0 && b >= 0 && a < nx && b < ny && state[a * ny + b] === 1) return true;
    }
    return false;
  };
}
