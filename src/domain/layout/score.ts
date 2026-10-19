/**
 * Оценка кандидата (§7.2, score.ts): сумма именованных весов + небольшая случайная добавка,
 * чтобы при разных seed получались разные, но разумные расстановки.
 */
import { LAYOUT_JITTER } from '../constants';
import { dist, obbsOverlap } from '../geometry';
import type { Rng } from '../rng';
import type { FurnitureItem, Vec2 } from '../types';
import { relativeCandidates } from './candidates';
import { frontDir, insideRect, localBox, fits, shapeOf, type Shape } from './fits';
import type { RoomZones } from './zones';

export const W = {
  /** Спинка у стены. */
  BACK_TO_WALL: 20,
  /** Ближе 1 м к двери. */
  NEAR_DOOR: -15,
  /** За каждое нарушение мягкого правила в тесном режиме (autoLayout). */
  TIGHT: -15,
  /** Зона подхода заходит в зону открывания двери. */
  CLEARANCE_IN_DOOR: -25,
  /** Низкий предмет перед окном (высокие запрещены правилом). */
  COVERS_WINDOW: -20,
  BED_HEAD_AT_WALL: 30,
  BED_NOT_FACING_DOOR: 10,
  BED_TWO_SIDES: 15,
  BED_ONE_SIDE: 5,
  SOFA_TV_SPACE: 25,
  SOFA_SPACE_PARTIAL: 10,
  TV_FACING_SOFA: 30,
  TV_LATERAL_PER_M: -8,
  TV_WINDOW_BEHIND: -10,
  DINING_NEAR_KITCHEN: 15,
  DINING_NEAR_WINDOW: 10,
  /** За каждый стул группы, который встанет вокруг стола. */
  DINING_CHAIR: 6,
  STORAGE_NEAR_DOOR: 10,
  KITCHEN_TOUCHES_KITCHEN: 15,
  KITCHEN_IN_CORNER: 15,
  PLUMBING_IN_CORNER: 8,
  /** Порядок мест у стола: длинные стороны раньше торцов. */
  CHAIR_SLOT: -1,
} as const;

/** Расстояние «близко к двери», м. */
const NEAR_DOOR_M = 1;
/** Ширина подхода к кровати сбоку, м. */
const BED_SIDE_ACCESS = 0.6;
const NEAR_WINDOW_M = 2;
const NEAR_ROOM_DOOR_M = 2.2;
const KITCHEN_REACH_M = 5;
/** Допуск «вплотную», м. */
const TOUCH = 0.06;

export interface ScoreContext {
  zones: RoomZones;
  /** Уже стоящие предметы этой комнаты. */
  placed: readonly Shape[];
  rng: Rng;
  jitter?: number;
  /** Ещё не поставленные предметы той же группы (стулья для стола). */
  companions?: readonly FurnitureItem[];
}

const centerDist = (a: { center: Vec2 }, b: { center: Vec2 }) => dist(a.center, b.center);

/** Касается ли предмет стен комнаты с двух перпендикулярных сторон (стоит в углу). */
function inCorner(s: Shape, z: RoomZones): boolean {
  // кандидаты для мебели у стен повёрнуты кратно 90°: габарит по осям плана
  const turned = Math.abs(Math.sin(s.pose.rotation)) > 0.5;
  const [hx, hy] = turned ? [s.fp.half[1], s.fp.half[0]] : s.fp.half;
  const x0 = s.fp.center[0] - hx;
  const x1 = s.fp.center[0] + hx;
  const y0 = s.fp.center[1] - hy;
  const y1 = s.fp.center[1] + hy;
  const touchX = x0 <= z.inner.min[0] + TOUCH || x1 >= z.inner.max[0] - TOUCH;
  const touchY = y0 <= z.inner.min[1] + TOUCH || y1 >= z.inner.max[1] - TOUCH;
  return touchX && touchY;
}

/** Свободное расстояние перед предметом до стены комнаты, м. */
function spaceAhead(s: Shape, z: RoomZones): number {
  const [fx, fy] = frontDir(s.pose);
  const d = s.item.size[1] / 2;
  const [px, py] = [s.pose.position[0] + fx * d, s.pose.position[1] + fy * d];
  let t = Infinity;
  if (fx > 1e-6) t = Math.min(t, (z.inner.max[0] - px) / fx);
  if (fx < -1e-6) t = Math.min(t, (z.inner.min[0] - px) / fx);
  if (fy > 1e-6) t = Math.min(t, (z.inner.max[1] - py) / fy);
  if (fy < -1e-6) t = Math.min(t, (z.inner.min[1] - py) / fy);
  return t;
}

/** Сколько мест для стула chair свободно вокруг стола table. */
export function freeChairSlots(
  table: Shape,
  chair: FurnitureItem,
  z: RoomZones,
  placed: readonly Shape[],
): number {
  const withTable = [...placed, table];
  return (relativeCandidates(chair, withTable) ?? []).filter((pose) =>
    fits(shapeOf(chair, pose), z, withTable, 'door'),
  ).length;
}

export function scoreCandidate(s: Shape, ctx: ScoreContext): number {
  const { zones: z, placed, rng } = ctx;
  const item = s.item;
  const [w, d] = item.size;
  let score = 0;

  // общее
  if (item.placement !== 'center') score += W.BACK_TO_WALL;
  if (z.doors.some((door) => centerDist(door, s.fp) < NEAR_DOOR_M + Math.max(w, d) / 2)) {
    score += W.NEAR_DOOR;
  }
  if (z.doors.some((door) => obbsOverlap(s.cbNoBack, door))) score += W.CLEARANCE_IN_DOOR;
  if (!item.blocksWindow && z.windows.some((win) => obbsOverlap(s.fp, win))) {
    score += W.COVERS_WINDOW;
  }

  switch (item.category) {
    case 'bed': {
      score += W.BED_HEAD_AT_WALL;
      const ahead = localBox(s.pose, -w / 2, w / 2, d / 2, d / 2 + 4);
      score += z.doors.some((door) => obbsOverlap(ahead, door))
        ? -W.BED_NOT_FACING_DOOR
        : W.BED_NOT_FACING_DOOR;
      const sides = [-1, 1].filter((sx) => {
        const side = localBox(
          s.pose,
          sx < 0 ? -w / 2 - BED_SIDE_ACCESS : w / 2,
          sx < 0 ? -w / 2 : w / 2 + BED_SIDE_ACCESS,
          -d / 2,
          d / 2,
        );
        return insideRect(side, z.inner) && !placed.some((p) => obbsOverlap(side, p.fp));
      }).length;
      score += sides === 2 ? W.BED_TWO_SIDES : sides === 1 ? W.BED_ONE_SIDE : 0;
      break;
    }
    case 'sofa': {
      if (item.pairWith) {
        const space = spaceAhead(s, z);
        const [lo, hi] = item.pairWith.distance;
        if (space >= lo && space <= hi + 0.6) score += W.SOFA_TV_SPACE;
        else if (space > hi) score += W.SOFA_SPACE_PARTIAL;
      }
      break;
    }
    case 'tv': {
      const sofa = placed.find((p) => p.item.pairWith?.itemId === item.id);
      if (sofa) {
        const [sx, sy] = frontDir(sofa.pose);
        const [tx, ty] = frontDir(s.pose);
        const facing = sx * tx + sy * ty < -0.95;
        const v: Vec2 = [
          s.pose.position[0] - sofa.pose.position[0],
          s.pose.position[1] - sofa.pose.position[1],
        ];
        const along = v[0] * sx + v[1] * sy;
        const lateral = Math.abs(v[0] * -sy + v[1] * sx);
        const [lo, hi] = sofa.item.pairWith!.distance;
        if (facing && along >= lo && along <= hi + 1) {
          score += W.TV_FACING_SOFA + lateral * W.TV_LATERAL_PER_M;
        }
      }
      const behind = localBox(s.pose, -w / 2, w / 2, -d / 2 - 0.3, -d / 2);
      if (z.windows.some((win) => obbsOverlap(behind, win))) score += W.TV_WINDOW_BEHIND;
      break;
    }
    case 'table': {
      if (item.group === 'dining') {
        const kitchen = placed.find((p) => p.item.category === 'kitchen');
        if (kitchen) {
          score +=
            W.DINING_NEAR_KITCHEN * Math.max(0, 1 - centerDist(kitchen.fp, s.fp) / KITCHEN_REACH_M);
        }
        if (z.windows.some((win) => centerDist(win, s.fp) < NEAR_WINDOW_M))
          score += W.DINING_NEAR_WINDOW;
        const chairs = (ctx.companions ?? []).filter((c) => c.category === 'chair');
        if (chairs[0]) {
          score +=
            W.DINING_CHAIR * Math.min(freeChairSlots(s, chairs[0], z, placed), chairs.length);
        }
      }
      break;
    }
    case 'storage': {
      if (z.doors.some((door) => centerDist(door, s.fp) < NEAR_ROOM_DOOR_M + w / 2)) {
        score += W.STORAGE_NEAR_DOOR - W.NEAR_DOOR; // шкафу у входа место
      }
      break;
    }
    case 'kitchen': {
      const grown = { ...s.fp, half: [s.fp.half[0] + TOUCH, s.fp.half[1] + TOUCH] as Vec2 };
      if (placed.some((p) => p.item.category === 'kitchen' && obbsOverlap(grown, p.fp))) {
        score += W.KITCHEN_TOUCHES_KITCHEN;
      }
      if (inCorner(s, z)) score += W.KITCHEN_IN_CORNER;
      break;
    }
    case 'plumbing': {
      if (inCorner(s, z)) score += W.PLUMBING_IN_CORNER;
      break;
    }
    default:
      break;
  }
  return score + rng.float(0, ctx.jitter ?? LAYOUT_JITTER);
}
