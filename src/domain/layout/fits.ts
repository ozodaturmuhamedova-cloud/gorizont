/**
 * След предмета и зона подхода (§7.2) и таблица правил пересечения.
 *
 * Локальные оси предмета: x — ширина, y — глубина; спинка на −y, перед на +y.
 * При rotation = 0 перед смотрит в +y плана. Ось y предмета на плане — (−sin r, cos r).
 */
import { EPS } from '../constants';
import { obbCorners, obbsOverlap } from '../geometry';
import type { FurnitureItem, Obb, Vec2 } from '../types';
import type { Rect, RoomZones } from './zones';

export interface Pose {
  position: Vec2;
  rotation: number;
}

export interface Shape {
  item: FurnitureItem;
  pose: Pose;
  /** След самого предмета. */
  fp: Obb;
  /** След, расширенный на clearance (перед, бока, спинка). */
  cb: Obb;
  /**
   * Часть зоны подхода, которая не может упираться в стену или дверь: без спинки.
   * У стула спинка — как раз место, чтобы его отодвинуть, поэтому это вся зона.
   * У кровати — только перед: в узкой комнате её ставят боком к стене (§7.2, подход
   * с одной стороны), а доступность боков проверяет isWalkable.
   */
  cbNoBack: Obb;
}

/** Прямоугольник в локальных координатах предмета [x0, x1] × [y0, y1] → на плане. */
export function localBox(pose: Pose, x0: number, x1: number, y0: number, y1: number): Obb {
  const c = Math.cos(pose.rotation);
  const s = Math.sin(pose.rotation);
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  return {
    center: [pose.position[0] + c * mx - s * my, pose.position[1] + s * mx + c * my],
    half: [(x1 - x0) / 2, (y1 - y0) / 2],
    rotation: pose.rotation,
  };
}

/** Точка в локальных координатах предмета → на плане. */
export function localPoint(pose: Pose, x: number, y: number): Vec2 {
  const c = Math.cos(pose.rotation);
  const s = Math.sin(pose.rotation);
  return [pose.position[0] + c * x - s * y, pose.position[1] + s * x + c * y];
}

/** Направление «вперёд» предмета на плане. */
export function frontDir(pose: Pose): Vec2 {
  return [-Math.sin(pose.rotation), Math.cos(pose.rotation)];
}

export function footprint(item: FurnitureItem, pose: Pose): Obb {
  const [w, d] = item.size;
  return localBox(pose, -w / 2, w / 2, -d / 2, d / 2);
}

export function clearanceBox(item: FurnitureItem, pose: Pose): Obb {
  const [w, d] = item.size;
  const c = item.clearance;
  return localBox(pose, -w / 2 - c.sides, w / 2 + c.sides, -d / 2 - c.back, d / 2 + c.front);
}

export function shapeOf(item: FurnitureItem, pose: Pose): Shape {
  const [w, d] = item.size;
  const c = item.clearance;
  return {
    item,
    pose,
    fp: footprint(item, pose),
    cb: clearanceBox(item, pose),
    cbNoBack:
      item.category === 'chair'
        ? clearanceBox(item, pose)
        : item.category === 'bed'
          ? localBox(pose, -w / 2, w / 2, -d / 2, d / 2 + c.front)
          : localBox(pose, -w / 2 - c.sides, w / 2 + c.sides, -d / 2, d / 2 + c.front),
  };
}

/** Правила из таблицы §7.2. Жёсткие — ошибка при ручной расстановке, остальные — предупреждение. */
export type Rule =
  | 'outside' // след выходит за стены комнаты
  | 'overlap' // след × след
  | 'door' // след × зона двери
  | 'blocksAccess' // след × чужая зона подхода
  | 'noClearance' // своя зона подхода × чужой след
  | 'clearanceWall' // зона подхода упирается в стену не спинкой (см. Shape.cbNoBack)
  | 'doorClearance' // зона подхода × зона двери
  | 'window'; // высокий предмет перед окном

export const HARD_RULES: ReadonlySet<Rule> = new Set<Rule>(['outside', 'overlap', 'door']);

export interface Violation {
  rule: Rule;
  /** Индекс соседа в others, если нарушение связано с ним. */
  other?: number;
}

export function insideRect(o: Obb, r: Rect, eps = EPS): boolean {
  return obbCorners(o).every(
    ([x, y]) =>
      x >= r.min[0] - eps && x <= r.max[0] + eps && y >= r.min[1] - eps && y <= r.max[1] + eps,
  );
}

/** Предметы одной группы (стол и стулья, кровать и тумбочки) могут стоять в зонах друг друга. */
export function friends(a: FurnitureItem, b: FurnitureItem): boolean {
  return a.group !== undefined && a.group === b.group;
}

/** Все нарушения для предмета в комнате рядом с уже стоящими others (той же комнаты). */
export function violations(s: Shape, zones: RoomZones, others: readonly Shape[]): Violation[] {
  const v: Violation[] = [];
  if (!insideRect(s.fp, zones.inner)) v.push({ rule: 'outside' });
  others.forEach((o, i) => {
    if (obbsOverlap(s.fp, o.fp)) v.push({ rule: 'overlap', other: i });
  });
  if (zones.doors.some((z) => obbsOverlap(s.fp, z))) v.push({ rule: 'door' });

  others.forEach((o, i) => {
    if (friends(s.item, o.item)) return;
    if (obbsOverlap(s.fp, o.cb)) v.push({ rule: 'blocksAccess', other: i });
    if (obbsOverlap(s.cb, o.fp)) v.push({ rule: 'noClearance', other: i });
  });
  if (!insideRect(s.cbNoBack, zones.inner)) v.push({ rule: 'clearanceWall' });
  if (zones.doors.some((z) => obbsOverlap(s.cbNoBack, z))) v.push({ rule: 'doorClearance' });
  if (s.item.blocksWindow && zones.windows.some((z) => obbsOverlap(s.fp, z))) {
    v.push({ rule: 'window' });
  }
  return v;
}

/**
 * Насколько строго проверять:
 * - 'strict' — то же, что violations(...).length === 0;
 * - 'door' — зона подхода может заходить в зону открывания двери (это общий проход; в
 *   проходной кухне иначе не встаёт гарнитур);
 * - 'tight' — вдобавок след может заходить в чужую зону подхода и наоборот (тесный санузел).
 * Жёсткие правила, стены и окна проверяются всегда. Авторасстановка штрафует за послабления.
 */
export type FitLevel = 'strict' | 'door' | 'tight';

/** Проверка с ранним выходом — для перебора кандидатов. */
export function fits(
  s: Shape,
  zones: RoomZones,
  others: readonly Shape[],
  level: FitLevel = 'strict',
): boolean {
  if (!insideRect(s.cbNoBack, zones.inner) || !insideRect(s.fp, zones.inner)) return false;
  if (zones.doors.some((z) => obbsOverlap(s.fp, z))) return false;
  if (level === 'strict' && zones.doors.some((z) => obbsOverlap(s.cbNoBack, z))) return false;
  if (s.item.blocksWindow && zones.windows.some((z) => obbsOverlap(s.fp, z))) return false;
  for (const o of others) {
    if (obbsOverlap(s.fp, o.fp)) return false;
    if (level === 'tight' || friends(s.item, o.item)) continue;
    if (obbsOverlap(s.fp, o.cb) || obbsOverlap(s.cb, o.fp)) return false;
  }
  return true;
}
