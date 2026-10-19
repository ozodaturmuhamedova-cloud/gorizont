/**
 * Кандидаты позиций (§7.2, candidates.ts): вдоль стен, в углах, сеткой по комнате,
 * а для членов группы — относительно уже стоящего «главного» предмета.
 */
import { GRID_STEP } from '../constants';
import type { FurnitureItem } from '../types';
import { localPoint, type Pose, type Shape } from './fits';
import type { Rect, RoomZones, Side } from './zones';

/** Зазор между спинкой и стеной, м. */
export const WALL_GAP = 0.02;
/** Шаг сетки для свободно стоящих предметов, м. */
export const CENTER_STEP = 0.2;

/** Поворот, при котором перед предмета смотрит внутрь комнаты от стороны side. */
export const ROTATION_FOR_SIDE: Record<Side, number> = {
  top: 0,
  bottom: Math.PI,
  left: -Math.PI / 2,
  right: Math.PI / 2,
};

/** Центр предмета, прижатого спинкой к стороне side, в точке along вдоль неё. */
export function poseAtWall(item: FurnitureItem, inner: Rect, side: Side, along: number): Pose {
  const d = item.size[1];
  const off = d / 2 + WALL_GAP;
  const rotation = ROTATION_FOR_SIDE[side];
  switch (side) {
    case 'top':
      return { position: [along, inner.min[1] + off], rotation };
    case 'bottom':
      return { position: [along, inner.max[1] - off], rotation };
    case 'left':
      return { position: [inner.min[0] + off, along], rotation };
    case 'right':
      return { position: [inner.max[0] - off, along], rotation };
  }
}

/** Вдоль каждого участка стены без дверей с шагом 0.1 м; оба конца участка — обязательно. */
export function wallCandidates(item: FurnitureItem, z: RoomZones): Pose[] {
  const half = item.size[0] / 2;
  const out: Pose[] = [];
  for (const run of z.wallRuns) {
    const lo = run.from + half + WALL_GAP;
    const hi = run.to - half - WALL_GAP;
    if (hi < lo - 1e-9) continue;
    const n = Math.floor((hi - lo) / GRID_STEP + 1e-9);
    for (let k = 0; k <= n; k++) out.push(poseAtWall(item, z.inner, run.side, lo + k * GRID_STEP));
    if (hi - (lo + n * GRID_STEP) > 1e-6) out.push(poseAtWall(item, z.inner, run.side, hi));
  }
  return out;
}

/** Каждый угол комнаты в двух ориентациях: спинкой к одной или к другой стене. */
export function cornerCandidates(item: FurnitureItem, z: RoomZones): Pose[] {
  const { min, max } = z.inner;
  const half = item.size[0] / 2 + WALL_GAP;
  return [
    poseAtWall(item, z.inner, 'top', min[0] + half),
    poseAtWall(item, z.inner, 'top', max[0] - half),
    poseAtWall(item, z.inner, 'bottom', min[0] + half),
    poseAtWall(item, z.inner, 'bottom', max[0] - half),
    poseAtWall(item, z.inner, 'left', min[1] + half),
    poseAtWall(item, z.inner, 'left', max[1] - half),
    poseAtWall(item, z.inner, 'right', min[1] + half),
    poseAtWall(item, z.inner, 'right', max[1] - half),
  ];
}

/** Сетка 0.2 м по комнате с поворотами 0° и 90° (и 45° для декора). */
export function centerCandidates(item: FurnitureItem, z: RoomZones): Pose[] {
  const rotations = item.category === 'decor' ? [0, Math.PI / 4, Math.PI / 2] : [0, Math.PI / 2];
  const out: Pose[] = [];
  for (let x = z.inner.min[0] + CENTER_STEP; x < z.inner.max[0] - 1e-9; x += CENTER_STEP) {
    for (let y = z.inner.min[1] + CENTER_STEP; y < z.inner.max[1] - 1e-9; y += CENTER_STEP) {
      for (const rotation of rotations) out.push({ position: [x, y], rotation });
    }
  }
  return out;
}

function rel(base: Pose, x: number, y: number, dRot: number): Pose {
  return { position: localPoint(base, x, y), rotation: base.rotation + dRot };
}

/**
 * Позиции относительно «главного» предмета группы: стулья вокруг стола, тумбочки
 * у изголовья, журнальный столик перед диваном. null — главного предмета ещё нет.
 */
export function relativeCandidates(item: FurnitureItem, placed: readonly Shape[]): Pose[] | null {
  if (item.category === 'chair') {
    const table = placed.find((p) => p.item.category === 'table' && p.item.group === item.group);
    if (!table) return null;
    const [tw, td] = table.item.size;
    const cd = item.size[1];
    const gap = 0.02;
    const xs = tw >= 1.2 ? [-tw / 4, tw / 4] : [0];
    // стулья смотрят на стол: длинные стороны — первыми
    return [
      ...xs.map((x) => rel(table.pose, x, td / 2 + cd / 2 + gap, Math.PI)),
      ...xs.map((x) => rel(table.pose, x, -td / 2 - cd / 2 - gap, 0)),
      rel(table.pose, tw / 2 + cd / 2 + gap, 0, Math.PI / 2),
      rel(table.pose, -tw / 2 - cd / 2 - gap, 0, -Math.PI / 2),
    ];
  }
  if (item.category === 'storage' && item.group === 'sleep') {
    const bed = placed.find((p) => p.item.category === 'bed');
    if (!bed) return null;
    const [bw, bd] = bed.item.size;
    const [nw, nd] = item.size;
    return [-1, 1].map((sx) => rel(bed.pose, sx * (bw / 2 + nw / 2 + 0.03), -bd / 2 + nd / 2, 0));
  }
  if (item.category === 'table' && item.group === 'lounge') {
    const sofa = placed.find((p) => p.item.category === 'sofa' && p.item.pairWith);
    if (!sofa) return null;
    const sd = sofa.item.size[1];
    const d = item.size[1];
    return [0.4, 0.45, 0.5].map((g) => rel(sofa.pose, 0, sd / 2 + g + d / 2, 0));
  }
  return null;
}

/** Все кандидаты для предмета: относительные (если есть) или по типу расстановки. */
export function candidatesFor(item: FurnitureItem, z: RoomZones, placed: readonly Shape[]): Pose[] {
  const relative = relativeCandidates(item, placed);
  if (relative) return relative;
  switch (item.placement) {
    case 'wall':
      return wallCandidates(item, z);
    case 'corner':
      return [...cornerCandidates(item, z), ...wallCandidates(item, z)];
    case 'center':
      return centerCandidates(item, z);
  }
}
