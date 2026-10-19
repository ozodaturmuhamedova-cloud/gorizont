import { EPS, GRID_STEP } from './constants';
import type { Obb, Opening, Vec2, Wall } from './types';

// ---------- полигоны ----------

/** Площадь со знаком (формула шнурков): положительная при обходе против часовой в осях x→, y↑. */
export function signedArea(poly: readonly Vec2[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i]!;
    const [x2, y2] = poly[(i + 1) % poly.length]!;
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

export function polygonArea(poly: readonly Vec2[]): number {
  return Math.abs(signedArea(poly));
}

export function bbox(poly: readonly Vec2[]): { min: Vec2; max: Vec2 } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of poly) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { min: [minX, minY], max: [maxX, maxY] };
}

/** Центр габаритного прямоугольника. По нему квартира центрируется в 3D (§5). */
export function centerOf(poly: readonly Vec2[]): Vec2 {
  const { min, max } = bbox(poly);
  return [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2];
}

/** Центр масс полигона — точка для подписи комнаты. Для вырожденного полигона — центр габаритов. */
export function polygonCentroid(poly: readonly Vec2[]): Vec2 {
  const a = signedArea(poly);
  if (Math.abs(a) < EPS) return centerOf(poly);
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i]!;
    const [x2, y2] = poly[(i + 1) % poly.length]!;
    const k = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * k;
    cy += (y1 + y2) * k;
  }
  return [cx / (6 * a), cy / (6 * a)];
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

export function pointOnSegment(p: Vec2, a: Vec2, b: Vec2, eps = EPS): boolean {
  const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  if (Math.abs(cross) > eps * Math.max(1, dist(a, b))) return false;
  const dot = (p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1]);
  const len2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
  return dot >= -eps && dot <= len2 + eps;
}

/** Точка внутри полигона или на его границе. */
export function pointInPolygon(p: Vec2, poly: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (pointOnSegment(p, a, b)) return true;
    if (a[1] > p[1] !== b[1] > p[1]) {
      const x = ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0];
      if (p[0] < x) inside = !inside;
    }
  }
  return inside;
}

// ---------- преобразования ----------

/** План → 3D: x остаётся x, y плана становится z, высота — y (§5). */
export function to3D(p: Vec2, h = 0): [number, number, number] {
  return [p[0], h, p[1]];
}

/** Привязка к сетке без хвостов вроде 0.30000000000000004 и без -0. */
export function snap(v: number, step = GRID_STEP): number {
  const r = Number((Math.round(v / step) * step).toFixed(10));
  return r === 0 ? 0 : r;
}

export function snapVec(p: Vec2, step = GRID_STEP): Vec2 {
  return [snap(p[0], step), snap(p[1], step)];
}

// ---------- стены и проёмы ----------

export function wallLength(w: Wall): number {
  return dist(w.a, w.b);
}

/** Единичный вектор вдоль стены от a к b. */
export function wallDir(w: Wall): Vec2 {
  const len = wallLength(w);
  return [(w.b[0] - w.a[0]) / len, (w.b[1] - w.a[1]) / len];
}

export function pointAlongWall(w: Wall, offset: number): Vec2 {
  const [dx, dy] = wallDir(w);
  return [w.a[0] + dx * offset, w.a[1] + dy * offset];
}

/** Концы проёма на осевой линии стены. */
export function openingSpan(w: Wall, o: Pick<Opening, 'offset' | 'width'>): [Vec2, Vec2] {
  return [pointAlongWall(w, o.offset), pointAlongWall(w, o.offset + o.width)];
}

/** Тело стены как повёрнутый прямоугольник. */
export function wallObb(w: Wall): Obb {
  return {
    center: [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2],
    half: [wallLength(w) / 2, w.thickness / 2],
    rotation: Math.atan2(w.b[1] - w.a[1], w.b[0] - w.a[0]),
  };
}

// ---------- повёрнутые прямоугольники ----------

function axes(o: Obb): [Vec2, Vec2] {
  const c = Math.cos(o.rotation);
  const s = Math.sin(o.rotation);
  return [
    [c, s],
    [-s, c],
  ];
}

export function obbCorners(o: Obb): Vec2[] {
  const [u, v] = axes(o);
  const [hx, hy] = o.half;
  const [cx, cy] = o.center;
  return [
    [cx - u[0] * hx - v[0] * hy, cy - u[1] * hx - v[1] * hy],
    [cx + u[0] * hx - v[0] * hy, cy + u[1] * hx - v[1] * hy],
    [cx + u[0] * hx + v[0] * hy, cy + u[1] * hx + v[1] * hy],
    [cx - u[0] * hx + v[0] * hy, cy - u[1] * hx + v[1] * hy],
  ];
}

function radius(o: Obb, axis: Vec2): number {
  const [u, v] = axes(o);
  return (
    o.half[0] * Math.abs(u[0] * axis[0] + u[1] * axis[1]) +
    o.half[1] * Math.abs(v[0] * axis[0] + v[1] * axis[1])
  );
}

/** Пересечение двух прямоугольников по теореме о разделяющей оси. Касание — не пересечение. */
export function obbsOverlap(a: Obb, b: Obb, eps = EPS): boolean {
  const d: Vec2 = [b.center[0] - a.center[0], b.center[1] - a.center[1]];
  for (const axis of [...axes(a), ...axes(b)]) {
    const gap = Math.abs(d[0] * axis[0] + d[1] * axis[1]);
    if (gap >= radius(a, axis) + radius(b, axis) - eps) return false;
  }
  return true;
}

/** След предмета мебели на полу: ширина × глубина, повёрнутые на rotation вокруг центра. */
export function footprintObb(
  size: readonly [number, number, ...number[]],
  position: Vec2,
  rotation: number,
): Obb {
  return { center: position, half: [size[0] / 2, size[1] / 2], rotation };
}

/** Пересекает ли прямоугольник (например, след мебели) тело стены. Проёмы не учитываются. */
export function rectIntersectsWall(rect: Obb, wall: Wall): boolean {
  return obbsOverlap(rect, wallObb(wall));
}
