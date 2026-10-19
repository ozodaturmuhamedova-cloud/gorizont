/**
 * Проходимость комнаты (§7.2, шаг 6): поиск в ширину по сетке 0.1 м от дверей комнаты.
 * Посетитель — круг collisionRadius; к каждому предмету должна вести дорога до его зоны подхода.
 */
import { GRID_STEP } from '../constants';
import { obbCorners } from '../geometry';
import type { Obb, Vec2 } from '../types';
import { localBox, type Shape } from './fits';
import type { RoomZones } from './zones';

/** Рост, для которого проверяется проходимость при авторасстановке, см. */
export const WALK_CHECK_HEIGHT_CM = 170;
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
  const { min, max } = z.inner;
  const nx = Math.max(1, Math.round((max[0] - min[0]) / step));
  const ny = Math.max(1, Math.round((max[1] - min[1]) / step));
  const sx = (max[0] - min[0]) / nx;
  const sy = (max[1] - min[1]) / ny;
  const cell = (i: number, j: number): Vec2 => [min[0] + (i + 0.5) * sx, min[1] + (j + 0.5) * sy];
  // допуск: клетка у самой стены на полшага не «обнуляет» узкий, но реальный проход
  const wallR = radius - Math.min(sx, sy) / 2;

  // клетки, чьи центры попадают в габарит obb (+ запас), — чтобы не перебирать всю сетку
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
  for (const door of z.doors) {
    cellsNear(door, 0, (k, p) => {
      if (free[k] && !seen[k] && pointInObb(door, p)) {
        seen[k] = 1;
        queue.push(k);
      }
    });
  }
  if (z.doors.length === 0) return [];
  for (let h = 0; h < queue.length; h++) {
    const k = queue[h]!;
    const i = Math.floor(k / ny);
    const j = k % ny;
    if (i > 0) visit(k - ny);
    if (i < nx - 1) visit(k + ny);
    if (j > 0) visit(k - 1);
    if (j < ny - 1) visit(k + 1);
  }
  function visit(n: number) {
    if (free[n] && !seen[n]) {
      seen[n] = 1;
      queue.push(n);
    }
  }

  const bad: number[] = [];
  shapes.forEach((s, idx) => {
    let ok = false;
    for (const b of accessBoxes(s, radius)) {
      cellsNear(b, 0, (k, p) => {
        if (!ok && seen[k] && pointInObb(b, p)) ok = true;
      });
      if (ok) break;
    }
    if (!ok) bad.push(idx);
  });
  return bad;
}

export function isWalkable(z: RoomZones, shapes: readonly Shape[], radius: number): boolean {
  return unreachableItems(z, shapes, radius).length === 0;
}
