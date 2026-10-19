/**
 * Прямоугольная квартира из одной комнаты для unit-тестов расстановки.
 * Стены толщиной 0.2 м по контуру [0, w] × [0, h]: пол комнаты — [0.1, w − 0.1] × [0.1, h − 0.1].
 */
import type { Apartment, Opening, RoomType, Wall } from '../../domain/types';

export type WallName = 'top' | 'bottom' | 'left' | 'right';

export interface RectOpening {
  wall: WallName;
  /** От начала стены: для top/bottom — от x = 0, для left/right — от y = 0. */
  offset: number;
  width: number;
  kind: 'door' | 'window';
}

export const RECT_WALL = 0.2;
const WALL_ORDER: WallName[] = ['top', 'right', 'bottom', 'left'];

export function rectApartment(
  w: number,
  h: number,
  openings: RectOpening[] = [{ wall: 'top', offset: 0.3, width: 0.8, kind: 'door' }],
  type: RoomType = 'bedroom',
): Apartment {
  const walls: Record<WallName, Wall> = {
    top: { a: [0, 0], b: [w, 0], thickness: RECT_WALL, height: 2.7 },
    right: { a: [w, 0], b: [w, h], thickness: RECT_WALL, height: 2.7 },
    bottom: { a: [0, h], b: [w, h], thickness: RECT_WALL, height: 2.7 },
    left: { a: [0, 0], b: [0, h], thickness: RECT_WALL, height: 2.7 },
  };
  const outline: [number, number][] = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  return {
    id: `rect-${w}x${h}`,
    number: 1,
    floor: 1,
    layoutId: 'rect',
    rooms: 1,
    area: w * h,
    price: 1,
    status: 'free',
    outline,
    roomsGeometry: [{ id: 'r', type, polygon: outline }],
    walls: WALL_ORDER.map((n) => walls[n]),
    openings: openings.map(
      (o): Opening => ({
        wallIndex: WALL_ORDER.indexOf(o.wall),
        offset: o.offset,
        width: o.width,
        kind: o.kind,
        height: o.kind === 'door' ? 2.1 : 1.5,
        ...(o.kind === 'window' ? { sill: 0.85 } : {}),
      }),
    ),
  };
}
