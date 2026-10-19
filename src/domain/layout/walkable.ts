/**
 * Проходимость комнаты (§7.2, шаг 6): поиск в ширину по сетке 0.1 м от дверей комнаты.
 * Посетитель — круг collisionRadius; к каждому предмету должна вести дорога до его зоны подхода.
 */
import { GRID_STEP } from '../constants';
import { obbCorners } from '../geometry';
import type { Obb, Vec2 } from '../types';
import { localBox, type Shape } from './fits';
import type { RoomZones } from './zones';

/** Рост, для которого проверяется подход к каждому предмету при авторасстановке, см. */
export const WALK_CHECK_HEIGHT_CM = 170;
/** Рост, для которого между дверями комнаты остаётся проход (самый крупный посетитель тестов). */
export const WALK_PASS_HEIGHT_CM = 195;
/** Полоса проёма для проверки прохода: полтолщины стены + запас до центра посетителя, м. */
const WALL_MOUTH = 0.2;
/** Боковой подход считается, только если зона сбоку не меньше этой, м. */
const SIDE_ACCESS_MIN = 0.2;

function toLocal(o: Obb, p: Vec2): Vec2 {
  const c = Math.cos(o.rotation);
  const s = Math.sin(o.rotation);
  const dx = p[0] - o.center[0];
  const dy = p[1] - o.center[1];
  return [c * dx + s * dy, -s * dx + c * dy];
}

export function pointInObb(o: Obb, p: Vec2): boolean {
  const [x, y] = toLocal(o, p);
  return Math.abs(x) <= o.half[0] + 1e-9 && Math.abs(y) <= o.half[1] + 1e-9;
}

export function distToObb(o: Obb, p: Vec2): number {
  const [x, y] = toLocal(o, p);
  const dx = Math.max(Math.abs(x) - o.half[0], 0);
  const dy = Math.max(Math.abs(y) - o.half[1], 0);
  return Math.hypot(dx, dy);
}

/** Где должен стоять человек, чтобы пользоваться предметом: перед ним, за ним (стул), сбоку (кровать). */
export function accessBoxes(s: Shape, radius: number): Obb[] {
  const [w, d] = s.item.size;
  const c = s.item.clearance;
  const out: Obb[] = [];
  const sx = w / 2 + c.sides;
  if (c.front > 0 || (c.back === 0 && c.sides < SIDE_ACCESS_MIN)) {
    out.push(localBox(s.pose, -sx, sx, d / 2, d / 2 + c.front + radius));
  }
  if (c.back > 0) out.push(localBox(s.pose, -sx, sx, -d / 2 - c.back - radius, -d / 2));
  if (c.sides >= SIDE_ACCESS_MIN) {
    out.push(localBox(s.pose, w / 2, w / 2 + c.sides + radius, -d / 2, d / 2));
    out.push(localBox(s.pose, -w / 2 - c.sides - radius, -w / 2, -d / 2, d / 2));
  }
  return out;
}

interface Flood {
  /** Достигнута ли клетка k. */
  seen: Uint8Array;
  /** Обойти клетки, чьи центры попадают в габарит obb (+ запас). */
  cellsNear: (o: Obb, pad: number, visit: (k: number, p: Vec2) => void) => void;
}

/** Поиск в ширину по сетке комнаты от зон дверей seeds для посетителя радиуса radius. */
function flood(
  z: RoomZones,
  shapes: readonly Shape[],
  radius: number,
  seeds: readonly Obb[],
  step: number,
  /** Допуск у стен: клетка у самой стены на полшага не «обнуляет» узкий, но реальный проход. */
  wallSlack: boolean,
): Flood {
  const { min, max } = z.inner;
  const nx = Math.max(1, Math.round((max[0] - min[0]) / step));
  const ny = Math.max(1, Math.round((max[1] - min[1]) / step));
  const sx = (max[0] - min[0]) / nx;
  const sy = (max[1] - min[1]) / ny;
  const cell = (i: number, j: number): Vec2 => [min[0] + (i + 0.5) * sx, min[1] + (j + 0.5) * sy];
  const wallR = wallSlack ? radius - Math.min(sx, sy) / 2 : radius;

  const cellsNear = (o: Obb, pad: number, visit: (k: number, p: Vec2) => void) => {
    const cs = obbCorners(o);
    const xs = cs.map((c) => c[0]);
    const ys = cs.map((c) => c[1]);
    const i0 = Math.max(0, Math.floor((Math.min(...xs) - pad - min[0]) / sx));
    const i1 = Math.min(nx - 1, Math.ceil((Math.max(...xs) + pad - min[0]) / sx));
    const j0 = Math.max(0, Math.floor((Math.min(...ys) - pad - min[1]) / sy));
    const j1 = Math.min(ny - 1, Math.ceil((Math.max(...ys) + pad - min[1]) / sy));
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) visit(i * ny + j, cell(i, j));
  };

  const free = new Uint8Array(nx * ny);
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const p = cell(i, j);
      if (p[0] - min[0] < wallR || max[0] - p[0] < wallR) continue;
      if (p[1] - min[1] < wallR || max[1] - p[1] < wallR) continue;
      free[i * ny + j] = 1;
    }
  }
  for (const s of shapes) {
    cellsNear(s.fp, radius, (k, p) => {
      if (free[k] && distToObb(s.fp, p) < radius) free[k] = 0;
    });
  }

  const seen = new Uint8Array(nx * ny);
  const queue: number[] = [];
  const visit = (n: number) => {
    if (free[n] && !seen[n]) {
      seen[n] = 1;
      queue.push(n);
    }
  };
  for (const door of seeds) {
    cellsNear(door, 0, (k, p) => {
      if (pointInObb(door, p)) visit(k);
    });
  }
  for (let h = 0; h < queue.length; h++) {
    const k = queue[h]!;
    const i = Math.floor(k / ny);
    const j = k % ny;
    if (i > 0) visit(k - ny);
    if (i < nx - 1) visit(k + ny);
    if (j > 0) visit(k - 1);
    if (j < ny - 1) visit(k + 1);
  }
  return { seen, cellsNear };
}

function touches(f: Flood, o: Obb): boolean {
  let ok = false;
  f.cellsNear(o, 0, (k, p) => {
    if (!ok && f.seen[k] && pointInObb(o, p)) ok = true;
  });
  return ok;
}

/**
 * Индексы предметов, к которым нельзя подойти от дверей комнаты.
 * Комната без дверей (такого в данных нет) считается проходимой.
 */
export function unreachableItems(
  z: RoomZones,
  shapes: readonly Shape[],
  radius: number,
  step = GRID_STEP,
): number[] {
  if (z.doors.length === 0) return [];
  const f = flood(z, shapes, radius, z.doors, step, true);
  const bad: number[] = [];
  shapes.forEach((s, idx) => {
    if (!accessBoxes(s, radius).some((b) => touches(f, b))) bad.push(idx);
  });
  return bad;
}

/**
 * Сколько дверей комнаты отрезано мебелью от первой двери: через проходную комнату
 * (прихожую, гостиную) посетитель должен пройти дальше.
 */
export function blockedDoors(
  z: RoomZones,
  shapes: readonly Shape[],
  radius: number,
  step = GRID_STEP,
): number {
  // не вся зона открывания (она глубиной в ширину двери), а сам проём: полоса у стены
  const mouths = z.doors.map(
    (d): Obb => ({ ...d, half: [d.half[0], Math.min(d.half[1], WALL_MOUTH + radius)] }),
  );
  const [first, ...rest] = mouths;
  if (!first || rest.length === 0) return 0;
  const f = flood(z, shapes, radius, [first], step, false);
  if (!touches(f, first)) return rest.length + 1;
  return rest.filter((d) => !touches(f, d)).length;
}

export function isWalkable(
  z: RoomZones,
  shapes: readonly Shape[],
  radius: number,
  passRadius = radius,
): boolean {
  return (
    unreachableItems(z, shapes, radius).length === 0 && blockedDoors(z, shapes, passRadius) === 0
  );
}
