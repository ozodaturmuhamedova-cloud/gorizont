/**
 * Ручная расстановка (§7.2, validate.ts): статус предмета под курсором и притяжение к стене/углу.
 */
import { CORNER_SNAP_DISTANCE, SNAP_DISTANCE } from '../constants';
import { dist, snap } from '../geometry';
import type { Apartment, FurnitureCatalog, FurnitureItem, PlacedFurniture } from '../types';
import { cornerCandidates, poseAtWall, WALL_GAP } from './candidates';
import { HARD_RULES, shapeOf, violations, type Pose, type Rule, type Shape } from './fits';
import { roomAt, zonesFor, type Side } from './zones';

export type PlacementStatus = 'ok' | 'warning' | 'error';

export interface PlacementCheck {
  status: PlacementStatus;
  /** Уникальные нарушенные правила: сначала жёсткие. */
  reasons: Rule[];
  roomId?: string;
}

/** Предметы, стоящие в комнате roomId (по центру следа). */
export function shapesInRoom(
  apt: Apartment,
  roomId: string,
  placed: readonly PlacedFurniture[],
  catalog: Pick<FurnitureCatalog, 'byId'>,
): Shape[] {
  const out: Shape[] = [];
  for (const p of placed) {
    const item = catalog.byId.get(p.itemId);
    if (!item || roomAt(apt, p.position)?.id !== roomId) continue;
    out.push(shapeOf(item, { position: p.position, rotation: p.rotation }));
  }
  return out;
}

export function validatePlacement(
  apt: Apartment,
  item: FurnitureItem,
  pose: Pose,
  others: readonly PlacedFurniture[],
  catalog: Pick<FurnitureCatalog, 'byId'>,
): PlacementCheck {
  const room = roomAt(apt, pose.position);
  if (!room) return { status: 'error', reasons: ['outside'] };
  const z = zonesFor(apt, room);
  const rules = new Set(
    violations(shapeOf(item, pose), z, shapesInRoom(apt, room.id, others, catalog)).map(
      (v) => v.rule,
    ),
  );
  const reasons = [...rules].sort((a, b) => Number(HARD_RULES.has(b)) - Number(HARD_RULES.has(a)));
  const status: PlacementStatus = reasons.some((r) => HARD_RULES.has(r))
    ? 'error'
    : reasons.length > 0
      ? 'warning'
      : 'ok';
  return { status, reasons, roomId: room.id };
}

export type SnapKind = 'wall' | 'corner' | 'grid';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Притяжение при перетаскивании: угол (corner, 0.25 м) → глухая стена (wall/corner, 0.15 м
 * от спинки) → сетка 0.1 м. Поворот при притяжении к стене — спинкой к ней.
 */
export function snapPose(
  apt: Apartment,
  item: FurnitureItem,
  pose: Pose,
): { pose: Pose; kind: SnapKind } {
  const grid: Pose = {
    position: [snap(pose.position[0]), snap(pose.position[1])],
    rotation: pose.rotation,
  };
  const room = roomAt(apt, pose.position);
  if (!room || item.placement === 'center') return { pose: grid, kind: 'grid' };
  const z = zonesFor(apt, room);
  const p = pose.position;

  if (item.placement === 'corner') {
    const near = cornerCandidates(item, z)
      .map((c) => ({ c, d: dist(c.position, p) }))
      .filter((x) => x.d <= CORNER_SNAP_DISTANCE)
      .sort((a, b) => a.d - b.d)[0];
    if (near) return { pose: near.c, kind: 'corner' };
  }

  const half = item.size[0] / 2;
  const depth = item.size[1] / 2 + WALL_GAP;
  let best: { pose: Pose; d: number } | null = null;
  for (const run of z.wallRuns) {
    const horizontal = run.side === 'top' || run.side === 'bottom';
    const along = horizontal ? p[0] : p[1];
    const lineAt: Record<Side, number> = {
      top: z.inner.min[1],
      bottom: z.inner.max[1],
      left: z.inner.min[0],
      right: z.inner.max[0],
    };
    const across = Math.abs((horizontal ? p[1] : p[0]) - lineAt[run.side]) - depth;
    if (across > SNAP_DISTANCE) continue;
    const lo = run.from + half + WALL_GAP;
    const hi = run.to - half - WALL_GAP;
    if (hi < lo || along < run.from || along > run.to) continue;
    const snapped = poseAtWall(item, z.inner, run.side, clamp(snap(along), lo, hi));
    if (!best || across < best.d) best = { pose: snapped, d: across };
  }
  if (best) return { pose: best.pose, kind: 'wall' };
  return { pose: grid, kind: 'grid' };
}
