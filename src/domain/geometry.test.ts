import { describe, expect, it } from 'vitest';
import {
  bbox,
  centerOf,
  obbCorners,
  obbsOverlap,
  openingSpan,
  pointAlongWall,
  pointInPolygon,
  polygonArea,
  polygonCentroid,
  rectIntersectsWall,
  signedArea,
  snap,
  snapVec,
  to3D,
  wallLength,
  wallObb,
} from './geometry';
import type { Obb, Vec2, Wall } from './types';

const rect4x3: Vec2[] = [
  [0, 0],
  [4, 0],
  [4, 3],
  [0, 3],
];
/** Г-образная комната 4×4 без правого верхнего квадрата 2×2. */
const lShape: Vec2[] = [
  [0, 0],
  [2, 0],
  [2, 2],
  [4, 2],
  [4, 4],
  [0, 4],
];

describe('площадь полигона', () => {
  it('прямоугольник 4×3 = 12 м²', () => {
    expect(polygonArea(rect4x3)).toBe(12);
  });

  it('треугольник', () => {
    expect(
      polygonArea([
        [0, 0],
        [4, 0],
        [0, 3],
      ]),
    ).toBe(6);
  });

  it('Г-образная комната = 12 м²', () => {
    expect(polygonArea(lShape)).toBe(12);
  });

  it('знак площади зависит от направления обхода, модуль — нет', () => {
    const reversed = [...rect4x3].reverse();
    expect(signedArea(rect4x3)).toBe(-signedArea(reversed));
    expect(polygonArea(reversed)).toBe(12);
  });
});

describe('точка в полигоне', () => {
  it('внутри и снаружи', () => {
    expect(pointInPolygon([1, 1], rect4x3)).toBe(true);
    expect(pointInPolygon([5, 1], rect4x3)).toBe(false);
    expect(pointInPolygon([-0.01, 1], rect4x3)).toBe(false);
  });

  it('граница и вершина считаются внутри', () => {
    expect(pointInPolygon([4, 1.5], rect4x3)).toBe(true);
    expect(pointInPolygon([0, 0], rect4x3)).toBe(true);
  });

  it('вырез Г-образной комнаты — снаружи', () => {
    expect(pointInPolygon([3, 1], lShape)).toBe(false);
    expect(pointInPolygon([1, 1], lShape)).toBe(true);
    expect(pointInPolygon([3, 3], lShape)).toBe(true);
  });
});

describe('центры', () => {
  it('габариты и центр габаритов', () => {
    expect(bbox(lShape)).toEqual({ min: [0, 0], max: [4, 4] });
    expect(centerOf(rect4x3)).toEqual([2, 1.5]);
  });

  it('центр масс Г-образной комнаты смещён к заполненной части', () => {
    const [x, y] = polygonCentroid(lShape);
    expect(x).toBeCloseTo(5 / 3, 6);
    expect(y).toBeCloseTo(7 / 3, 6);
    expect(pointInPolygon([x, y], lShape)).toBe(true);
  });
});

describe('to3D и привязка к сетке', () => {
  it('y плана становится z, высота — y', () => {
    expect(to3D([3, 5])).toEqual([3, 0, 5]);
    expect(to3D([3, 5], 1.6)).toEqual([3, 1.6, 5]);
  });

  it('snap округляет к шагу 0.1 без хвостов и без -0', () => {
    expect(snap(1.06)).toBe(1.1);
    expect(snap(1.04)).toBe(1);
    expect(snap(0.1 + 0.2)).toBe(0.3);
    expect(Object.is(snap(-0.04), 0)).toBe(true);
    expect(snap(2.37, 0.25)).toBe(2.25);
    expect(snapVec([0.33, 1.98])).toEqual([0.3, 2]);
  });
});

describe('стены и проёмы', () => {
  const wall: Wall = { a: [0, 0], b: [0, 5], thickness: 0.2, height: 2.7 };

  it('длина и точки вдоль стены', () => {
    expect(wallLength(wall)).toBe(5);
    expect(pointAlongWall(wall, 2)).toEqual([0, 2]);
  });

  it('концы проёма', () => {
    expect(openingSpan(wall, { offset: 1, width: 0.9 })).toEqual([
      [0, 1],
      [0, 1.9],
    ]);
  });

  it('тело стены — прямоугольник длиной 5 и толщиной 0.2', () => {
    const o = wallObb(wall);
    expect(o.center).toEqual([0, 2.5]);
    expect(o.half).toEqual([2.5, 0.1]);
    const xs = obbCorners(o).map((p) => p[0]);
    expect(Math.min(...xs)).toBeCloseTo(-0.1, 9);
    expect(Math.max(...xs)).toBeCloseTo(0.1, 9);
  });
});

describe('пересечение прямоугольников', () => {
  const box = (cx: number, cy: number, hx: number, hy: number, rotation = 0): Obb => ({
    center: [cx, cy],
    half: [hx, hy],
    rotation,
  });

  it('разнесённые не пересекаются', () => {
    expect(obbsOverlap(box(0, 0, 1, 1), box(3, 0, 1, 1))).toBe(false);
  });

  it('наложенные пересекаются', () => {
    expect(obbsOverlap(box(0, 0, 1, 1), box(1.5, 0.5, 1, 1))).toBe(true);
  });

  it('касание стороной — не пересечение', () => {
    expect(obbsOverlap(box(0, 0, 1, 1), box(2, 0, 1, 1))).toBe(false);
  });

  it('повёрнутый на 45° квадрат: по габаритам задевает, по факту нет', () => {
    // габарит ромба доходит до x = 1.414 + 1.9 − 1.414…, но его угол не достаёт до квадрата
    const diamond = box(2.5, 2.5, 1, 1, Math.PI / 4);
    expect(obbsOverlap(box(0, 0, 1, 1), diamond)).toBe(false);
    expect(obbsOverlap(box(0, 0, 1, 1), box(2.2, 0, 1, 1, Math.PI / 4))).toBe(true);
  });
});

describe('прямоугольник против стены', () => {
  const wall: Wall = { a: [0, 0], b: [4, 0], thickness: 0.2, height: 2.7 };
  const bed = (cy: number): Obb => ({ center: [2, cy], half: [0.8, 1.05], rotation: 0 });

  it('кровать, заходящая в стену, пересекает её', () => {
    expect(rectIntersectsWall(bed(1.0), wall)).toBe(true);
  });

  it('кровать, прижатая к грани стены, не пересекает', () => {
    expect(rectIntersectsWall(bed(0.1 + 1.05), wall)).toBe(false);
  });

  it('кровать за торцом стены не пересекает', () => {
    expect(rectIntersectsWall({ center: [5, 0], half: [0.5, 0.5], rotation: 0 }, wall)).toBe(false);
  });

  it('повёрнутая кровать, задевающая углом', () => {
    const tilted: Obb = { center: [2, 1.2], half: [0.8, 1.05], rotation: Math.PI / 6 };
    expect(rectIntersectsWall(tilted, wall)).toBe(true);
  });
});
