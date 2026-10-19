import { describe, expect, it } from 'vitest';
import { building } from '../data';
import { DOOR_HEIGHT, WALL_CUT_HEIGHT } from './constants';
import { pointInPolygon, wallLength } from './geometry';
import {
  doorTrims,
  floorShapePoints,
  inwardSign,
  openingsByWall,
  orbitHome,
  pieceBox,
  sceneFrame,
  wallPieces,
  wallRotationY,
  windowParts,
  type WallPiece,
} from './scene3d';
import type { Opening, Wall } from './types';

const wall: Wall = { a: [0, 0], b: [5, 0], thickness: 0.2, height: 2.7 };
const door: Opening = { wallIndex: 0, offset: 1, width: 0.9, kind: 'door', height: DOOR_HEIGHT };
const win: Opening = {
  wallIndex: 0,
  offset: 3,
  width: 1.5,
  kind: 'window',
  sill: 0.85,
  height: 1.45,
};
const area = (ps: WallPiece[]) => ps.reduce((s, p) => s + (p.to - p.from) * (p.y1 - p.y0), 0);

describe('стена → сплошные куски вокруг проёмов', () => {
  it('без проёмов — один кусок с продлением на полтолщины с обеих сторон', () => {
    expect(wallPieces(wall, [])).toEqual([{ kind: 'solid', from: -0.1, to: 5.1, y0: 0, y1: 2.7 }]);
  });

  it('площадь кусков = площадь стены минус проёмы', () => {
    const ps = wallPieces(wall, [win, door]);
    const full = (5 + 0.2) * 2.7;
    expect(area(ps)).toBeCloseTo(full - 0.9 * DOOR_HEIGHT - 1.5 * 1.45, 9);
    expect(ps.map((p) => p.kind)).toEqual(['solid', 'lintel', 'solid', 'below', 'above', 'solid']);
  });

  it('ни один кусок не заходит в проём', () => {
    for (const p of wallPieces(wall, [door, win])) {
      for (const o of [door, win]) {
        const y0 = o.sill ?? 0;
        const overlapX = Math.min(p.to, o.offset + o.width) - Math.max(p.from, o.offset);
        const overlapY = Math.min(p.y1, y0 + o.height) - Math.max(p.y0, y0);
        expect(overlapX > 1e-9 && overlapY > 1e-9).toBe(false);
      }
    }
  });

  it('срез стен: всё по высоте среза, перемычки над дверью и окном исчезают', () => {
    const ps = wallPieces(wall, [door, win], WALL_CUT_HEIGHT);
    expect(Math.max(...ps.map((p) => p.y1))).toBe(WALL_CUT_HEIGHT);
    expect(ps.some((p) => p.kind === 'lintel' || p.kind === 'above')).toBe(false);
    expect(ps.find((p) => p.kind === 'below')!.y1).toBe(0.85);
  });
});

describe('перевод в 3D', () => {
  it('стена вдоль x: поворот 0, брусок по центру куска на оси стены', () => {
    const b = pieceBox(wall, { kind: 'solid', from: 0, to: 2, y0: 0, y1: 2.7 });
    expect(b.rotationY).toBeCloseTo(0, 12);
    expect(b.position).toEqual([1, 1.35, 0]);
    expect(b.size).toEqual([2, 2.7, 0.2]);
  });

  it('стена вдоль y плана: брусок поворачивается так, что его ось X идёт в +z', () => {
    const w: Wall = { a: [2, 1], b: [2, 4], thickness: 0.1, height: 2.7 };
    const r = wallRotationY(w);
    // three.js: поворот вокруг Y переводит (1, 0, 0) в (cos r, 0, −sin r)
    expect(Math.cos(r)).toBeCloseTo(0, 12);
    expect(-Math.sin(r)).toBeCloseTo(1, 12);
    const b = pieceBox(w, { kind: 'solid', from: 1, to: 2, y0: 0, y1: 1 });
    expect(b.position[0]).toBeCloseTo(2, 12);
    expect(b.position[2]).toBeCloseTo(2.5, 12);
  });

  it('пол: после rotateX(−π/2) точка (x, −y) ложится в (x, 0, y)', () => {
    const [[x, sy]] = floorShapePoints([[3, 4]]) as [[number, number]];
    const angle = -Math.PI / 2;
    const z = sy * Math.sin(angle); // поворот вокруг X: z' = y·sin + z·cos
    expect(x).toBe(3);
    expect(z).toBeCloseTo(4, 12);
  });
});

describe('окна и двери', () => {
  const outline: [number, number][] = [
    [0, 0],
    [5, 0],
    [5, 4],
    [0, 4],
  ];

  it('внутренняя сторона наружной стены определяется по контуру', () => {
    // нормаль стены (0,0)→(5,0) — (0, 1), внутрь квартиры
    expect(inwardSign(wall, outline)).toBe(1);
    const reversed: Wall = { ...wall, a: [5, 0], b: [0, 0] };
    expect(inwardSign(reversed, outline)).toBe(-1);
  });

  it('подоконник торчит внутрь квартиры, стекло — в плоскости стены', () => {
    const p = windowParts(wall, win, inwardSign(wall, outline));
    expect(p.glass.position[2]).toBeCloseTo(0, 12);
    expect(p.sill.position[2]).toBeGreaterThan(0.1);
    expect(pointInPolygon([p.sill.position[0], p.sill.position[2]], outline)).toBe(true);
    expect(p.frame).toHaveLength(5);
  });

  it('наличники двери — по три с каждой стороны стены', () => {
    const t = doorTrims(wall, door);
    expect(t).toHaveLength(6);
    expect(new Set(t.map((b) => Math.sign(b.position[2])))).toEqual(new Set([1, -1]));
  });
});

describe('кадр и камера на реальных квартирах', () => {
  for (const l of building.layouts) {
    it(`${l.id}: центр внутри квартиры, камера смотрит сверху-сбоку`, () => {
      const f = sceneFrame(l.outline);
      expect(pointInPolygon(f.center, l.outline)).toBe(true);
      const { position } = orbitHome(f);
      expect(position[1]).toBeGreaterThan(f.radius);
      expect(Math.hypot(...position)).toBeGreaterThan(f.radius * 1.5);
      // все проёмы на стенах, у каждой стены есть хотя бы один кусок
      const byWall = openingsByWall(l.openings);
      l.walls.forEach((w, i) => {
        expect(wallPieces(w, byWall.get(i) ?? []).length).toBeGreaterThan(0);
        expect(wallLength(w)).toBeGreaterThan(0);
      });
    });
  }
});

describe('камера и пропорции экрана', () => {
  it('на узком портретном экране камера дальше, на широком — как при 1:1', () => {
    const f = sceneFrame(building.layouts[5]!.outline);
    const d = (aspect: number) => Math.hypot(...orbitHome(f, 50, aspect).position);
    expect(d(0.45)).toBeGreaterThan(d(1) * 1.8);
    expect(d(1.6)).toBeCloseTo(d(1), 9);
  });
});
