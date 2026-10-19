/**
 * Подготовка комнаты к расстановке (§7.2, zones.ts): внутренний прямоугольник по граням стен,
 * зоны дверей и окон, участки стен, к которым можно прислонять мебель.
 *
 * Ограничение: комнаты считаются прямоугольными (так во всех данных и в генераторе).
 * Для непрямоугольной комнаты берётся её габаритный прямоугольник.
 */
import { EPS, WALL_INTERIOR } from '../constants';
import { bbox, obbsOverlap, openingSpan, wallDir } from '../geometry';
import type { Apartment, Obb, Opening, Room, Vec2, Wall } from '../types';

/** Глубина зоны перед окном, где нельзя ставить высокую мебель (§7.2), м. */
export const WINDOW_ZONE_DEPTH = 0.5;

export interface Rect {
  min: Vec2;
  max: Vec2;
}

export type Side = 'top' | 'bottom' | 'left' | 'right';
export const SIDES: readonly Side[] = ['top', 'bottom', 'left', 'right'];

/** Участок вдоль стороны комнаты: top/bottom — по x, left/right — по y. */
export interface Run {
  side: Side;
  from: number;
  to: number;
}

export interface RoomZones {
  room: Room;
  /** Пол комнаты между гранями стен. */
  inner: Rect;
  /** Зоны открывания дверей, задевающие комнату: квадрат «ширина × ширина» по обе стороны. */
  doors: Obb[];
  /** Зоны перед окнами комнаты, глубиной WINDOW_ZONE_DEPTH. */
  windows: Obb[];
  doorRuns: Run[];
  windowRuns: Run[];
  /** Стороны комнаты без дверных проёмов — кандидаты для мебели «у стены». */
  wallRuns: Run[];
}

export function rectObb(r: Rect): Obb {
  return {
    center: [(r.min[0] + r.max[0]) / 2, (r.min[1] + r.max[1]) / 2],
    half: [(r.max[0] - r.min[0]) / 2, (r.max[1] - r.min[1]) / 2],
    rotation: 0,
  };
}

/** Зона проёма: вдоль стены ширина проёма, поперёк — толщина стены и depth с каждой стороны. */
export function openingZone(w: Wall, o: Opening, depth: number): Obb {
  const [dx, dy] = wallDir(w);
  const t = o.offset + o.width / 2;
  return {
    center: [w.a[0] + dx * t, w.a[1] + dy * t],
    half: [o.width / 2, w.thickness / 2 + depth],
    rotation: Math.atan2(dy, dx),
  };
}

const horizontal = (s: Side) => s === 'top' || s === 'bottom';

/** Линия стороны и её диапазон: top — y = min.y, x ∈ [min.x, max.x] и т. д. */
function sideLine(r: Rect, s: Side): { at: number; from: number; to: number } {
  switch (s) {
    case 'top':
      return { at: r.min[1], from: r.min[0], to: r.max[0] };
    case 'bottom':
      return { at: r.max[1], from: r.min[0], to: r.max[0] };
    case 'left':
      return { at: r.min[0], from: r.min[1], to: r.max[1] };
    case 'right':
      return { at: r.max[0], from: r.min[1], to: r.max[1] };
  }
}

/** Отрезок стены лежит на линии стороны: возвращает его проекцию на ось стороны. */
function onSide(a: Vec2, b: Vec2, s: Side, line: { at: number }): [number, number] | null {
  const i: 0 | 1 = horizontal(s) ? 1 : 0;
  const j: 0 | 1 = i === 1 ? 0 : 1;
  if (Math.abs(a[i] - line.at) > 1e-4 || Math.abs(b[i] - line.at) > 1e-4) return null;
  return [Math.min(a[j], b[j]), Math.max(a[j], b[j])];
}

function overlapLen(a: [number, number], b: [number, number]): number {
  return Math.min(a[1], b[1]) - Math.max(a[0], b[0]);
}

function subtract(from: number, to: number, cuts: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  let cur = from;
  for (const [a, b] of [...cuts].sort((p, q) => p[0] - q[0])) {
    if (a > cur + EPS) out.push([cur, Math.min(a, to)]);
    cur = Math.max(cur, b);
    if (cur >= to) break;
  }
  if (cur < to - EPS) out.push([cur, to]);
  return out.filter(([a, b]) => b - a > EPS);
}

export function roomZones(apt: Apartment, room: Room): RoomZones {
  const outer = bbox(room.polygon);
  // половина толщины стены на каждой стороне — по самой толстой стене на этой линии
  const halfOf = (s: Side): number => {
    const line = sideLine(outer, s);
    let half = WALL_INTERIOR / 2;
    for (const w of apt.walls) {
      const span = onSide(w.a, w.b, s, line);
      if (span && overlapLen(span, [line.from, line.to]) > EPS)
        half = Math.max(half, w.thickness / 2);
    }
    return half;
  };
  const inner: Rect = {
    min: [outer.min[0] + halfOf('left'), outer.min[1] + halfOf('top')],
    max: [outer.max[0] - halfOf('right'), outer.max[1] - halfOf('bottom')],
  };
  const innerObb = rectObb(inner);

  const doors: Obb[] = [];
  const windows: Obb[] = [];
  const doorRuns: Run[] = [];
  const windowRuns: Run[] = [];
  for (const o of apt.openings) {
    const w = apt.walls[o.wallIndex];
    if (!w) continue;
    const zone = openingZone(w, o, o.kind === 'door' ? o.width : WINDOW_ZONE_DEPTH);
    if (!obbsOverlap(zone, innerObb)) continue;
    (o.kind === 'door' ? doors : windows).push(zone);
    const [p0, p1] = openingSpan(w, o);
    for (const s of SIDES) {
      const span = onSide(p0, p1, s, sideLine(outer, s));
      if (!span) continue;
      const line = sideLine(inner, s);
      const from = Math.max(span[0], line.from);
      const to = Math.min(span[1], line.to);
      if (to - from > EPS) (o.kind === 'door' ? doorRuns : windowRuns).push({ side: s, from, to });
    }
  }

  const wallRuns: Run[] = SIDES.flatMap((s) => {
    const line = sideLine(inner, s);
    const cuts = doorRuns.filter((r) => r.side === s).map((r): [number, number] => [r.from, r.to]);
    return subtract(line.from, line.to, cuts).map(([from, to]) => ({ side: s, from, to }));
  });

  return { room, inner, doors, windows, doorRuns, windowRuns, wallRuns };
}

/** Комната, в которой лежит точка (по полигону комнаты). */
export function roomAt(apt: Apartment, p: Vec2): Room | undefined {
  return apt.roomsGeometry.find((r) => {
    const { min, max } = bbox(r.polygon);
    return (
      p[0] >= min[0] - EPS && p[0] <= max[0] + EPS && p[1] >= min[1] - EPS && p[1] <= max[1] + EPS
    );
  });
}

const cache = new WeakMap<Apartment, Map<string, RoomZones>>();

/** Зоны комнаты с кешем: при перетаскивании они считаются один раз. */
export function zonesFor(apt: Apartment, room: Room): RoomZones {
  let m = cache.get(apt);
  if (!m) cache.set(apt, (m = new Map()));
  let z = m.get(room.id);
  if (!z) m.set(room.id, (z = roomZones(apt, room)));
  return z;
}
