/**
 * Геометрия 3D-сцены из тех же данных, что и 2D-план (§1: один источник данных).
 * Координаты 3D: x = x плана, z = y плана, y — вверх (§5). Квартиру в начало координат
 * переносит сцена (группа со сдвигом −centerOf(outline)), здесь — координаты этажа.
 */
import {
  EPS,
  FRAME_DEPTH,
  FRAME_PROFILE,
  GLASS_THICKNESS,
  SILL_DEPTH,
  SILL_THICKNESS,
  TRIM_DEPTH,
  TRIM_WIDTH,
} from './constants';
import { bbox, centerOf, pointInPolygon, wallDir, wallLength } from './geometry';
import type { Opening, Vec2, Wall } from './types';

export type Vec3 = [number, number, number];

/** Прямоугольный брусок: центр, размеры (вдоль стены, высота, поперёк), поворот вокруг Y. */
export interface Box3 {
  position: Vec3;
  size: Vec3;
  rotationY: number;
}

/** Кусок стены в её собственной развёртке: вдоль стены [from, to], по высоте [y0, y1]. */
export interface WallPiece {
  kind: 'solid' | 'lintel' | 'below' | 'above';
  from: number;
  to: number;
  y0: number;
  y1: number;
}

/**
 * Разбивает стену на сплошные куски вокруг проёмов: между проёмами — на всю высоту,
 * над дверью — перемычка, под и над окном — подоконная часть и перемычка.
 * Концы стены продлены на половину толщины, чтобы углы смыкались без щелей.
 * cutHeight — режим «срез стен»: всё выше обрезается.
 */
export function wallPieces(
  wall: Wall,
  openings: readonly Opening[],
  cutHeight = Infinity,
): WallPiece[] {
  const len = wallLength(wall);
  const half = wall.thickness / 2;
  const top = Math.min(wall.height, cutHeight);
  const out: WallPiece[] = [];
  const push = (kind: WallPiece['kind'], from: number, to: number, y0: number, y1: number) => {
    if (to - from > EPS && y1 - y0 > EPS) out.push({ kind, from, to, y0, y1 });
  };
  let s = -half;
  for (const o of [...openings].sort((a, b) => a.offset - b.offset)) {
    const end = o.offset + o.width;
    push('solid', s, o.offset, 0, top);
    if (o.kind === 'door') {
      push('lintel', o.offset, end, Math.min(o.height, top), top);
    } else {
      const sill = o.sill ?? 0;
      push('below', o.offset, end, 0, Math.min(sill, top));
      push('above', o.offset, end, Math.min(sill + o.height, top), top);
    }
    s = Math.max(s, end);
  }
  push('solid', s, len + half, 0, top);
  return out;
}

/** Поворот вокруг Y, при котором локальная ось X бруска идёт вдоль стены от a к b. */
export function wallRotationY(wall: Wall): number {
  const [dx, dy] = wallDir(wall);
  return -Math.atan2(dy, dx);
}

/** Точка на стене: along — вдоль от a, across — поперёк (по нормали (−dy, dx)). */
function wallPoint(wall: Wall, along: number, across = 0): Vec2 {
  const [dx, dy] = wallDir(wall);
  return [wall.a[0] + dx * along - dy * across, wall.a[1] + dy * along + dx * across];
}

function box(
  wall: Wall,
  from: number,
  to: number,
  y0: number,
  y1: number,
  depth: number,
  across = 0,
): Box3 {
  const [x, z] = wallPoint(wall, (from + to) / 2, across);
  return {
    position: [x, (y0 + y1) / 2, z],
    size: [to - from, y1 - y0, depth],
    rotationY: wallRotationY(wall),
  };
}

export function pieceBox(wall: Wall, p: WallPiece): Box3 {
  return box(wall, p.from, p.to, p.y0, p.y1, wall.thickness);
}

/**
 * С какой стороны стены «внутри» квартиры: +1 — по нормали (−dy, dx), −1 — против.
 * Нужно для подоконников. Для внутренних стен обе стороны внутри — вернётся +1.
 */
export function inwardSign(wall: Wall, outline: readonly Vec2[]): 1 | -1 {
  const probe = wall.thickness / 2 + 0.2;
  return pointInPolygon(wallPoint(wall, wallLength(wall) / 2, probe), outline) ? 1 : -1;
}

/** Стекло, рама и подоконник окна. */
export function windowParts(
  wall: Wall,
  o: Opening,
  inward: 1 | -1,
): { glass: Box3; frame: Box3[]; sill: Box3 } {
  const s = o.sill ?? 0;
  const top = s + o.height;
  const a = o.offset;
  const b = o.offset + o.width;
  const p = FRAME_PROFILE;
  const mid = (a + b) / 2;
  return {
    glass: box(wall, a, b, s, top, GLASS_THICKNESS),
    frame: [
      box(wall, a, a + p, s, top, FRAME_DEPTH),
      box(wall, b - p, b, s, top, FRAME_DEPTH),
      box(wall, a, b, s, s + p, FRAME_DEPTH),
      box(wall, a, b, top - p, top, FRAME_DEPTH),
      box(wall, mid - p / 2, mid + p / 2, s, top, FRAME_DEPTH),
    ],
    sill: box(
      wall,
      a - p,
      b + p,
      s - SILL_THICKNESS,
      s,
      SILL_DEPTH,
      inward * (wall.thickness / 2 + SILL_DEPTH / 2 - 0.05),
    ),
  };
}

/** Наличники двери с обеих сторон стены: две стойки и верх. */
export function doorTrims(wall: Wall, o: Opening): Box3[] {
  const a = o.offset;
  const b = o.offset + o.width;
  const h = o.height;
  const w = TRIM_WIDTH;
  const off = wall.thickness / 2 + TRIM_DEPTH / 2;
  return [1, -1].flatMap((side) => [
    box(wall, a - w, a, 0, h + w, TRIM_DEPTH, side * off),
    box(wall, b, b + w, 0, h + w, TRIM_DEPTH, side * off),
    box(wall, a - w, b + w, h, h + w, TRIM_DEPTH, side * off),
  ]);
}

/**
 * Контур для THREE.Shape: y плана со знаком минус. После rotateX(−π/2) точка (x, −y)
 * попадает в (x, 0, y), а нормаль смотрит вверх — пол виден сверху.
 */
export function floorShapePoints(polygon: readonly Vec2[]): Vec2[] {
  return polygon.map(([x, y]) => [x, -y]);
}

export interface SceneFrame {
  /** Центр квартиры на плане — на него сдвигается сцена. */
  center: Vec2;
  size: Vec2;
  /** Радиус описанной окружности, м. */
  radius: number;
}

export function sceneFrame(outline: readonly Vec2[]): SceneFrame {
  const { min, max } = bbox(outline);
  const size: Vec2 = [max[0] - min[0], max[1] - min[1]];
  return { center: centerOf(outline), size, radius: Math.hypot(size[0], size[1]) / 2 };
}

/** Домашний вид камеры «3/4» для квартиры, сдвинутой в начало координат. */
export function orbitHome(frame: SceneFrame, fovDeg = 50): { position: Vec3; target: Vec3 } {
  const dist = (frame.radius / Math.sin(((fovDeg / 2) * Math.PI) / 180)) * 1.05;
  const dir: Vec3 = [0.5, 0.95, 0.85];
  const n = Math.hypot(...dir);
  return {
    position: [(dir[0] / n) * dist, (dir[1] / n) * dist, (dir[2] / n) * dist],
    target: [0, 0.6, 0],
  };
}

/** Проёмы, сгруппированные по стенам. */
export function openingsByWall(openings: readonly Opening[]): Map<number, Opening[]> {
  const m = new Map<number, Opening[]>();
  for (const o of openings) m.set(o.wallIndex, [...(m.get(o.wallIndex) ?? []), o]);
  return m;
}
