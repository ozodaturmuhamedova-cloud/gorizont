import { describe, expect, it } from 'vitest';
import buildingJson from './building.json';
import finishesJson from './finishes.json';
import furnitureJson from './furniture.json';
import { building, defaultFinish, findApartment, finishes, furniture } from './index';
import { AREA_TOLERANCE, EPS, PRICE_FLOOR_STEP } from '../domain/constants';
import { DataError, parseBuilding, parseFinishes, parseFurniture } from '../domain/data';
import { polygonArea, pointInPolygon, wallLength } from '../domain/geometry';
import { ROOM_TYPES } from '../domain/types';

// ---------- хелперы для отрицательных тестов: копия JSON и доступ к вложенным полям ----------
type Obj = Record<string | number, unknown>;
const clone = (v: unknown): unknown => JSON.parse(JSON.stringify(v)) as unknown;
function at(root: unknown, ...path: (string | number)[]): Obj {
  let cur = root;
  for (const k of path) cur = (cur as Obj)[k];
  return cur as Obj;
}
const list = (root: unknown, ...path: (string | number)[]): Obj[] =>
  at(root, ...path) as unknown as Obj[];

describe('building.json', () => {
  it('1 секция, 9 этажей, по 6 квартир на этаже', () => {
    expect(building.section).toBe(1);
    expect(building.floors).toBe(9);
    expect(building.layouts).toHaveLength(6);
    expect(building.apartments).toHaveLength(54);
    for (let f = 1; f <= building.floors; f++) {
      expect(building.apartments.filter((a) => a.floor === f)).toHaveLength(6);
    }
  });

  it('в каждой квартире площадь по полигонам совпадает с area (±0,5 м²)', () => {
    for (const a of building.apartments) {
      const sum = a.roomsGeometry.reduce((s, r) => s + polygonArea(r.polygon), 0);
      expect(Math.abs(sum - a.area)).toBeLessThanOrEqual(AREA_TOLERANCE);
    }
  });

  it('комнаты замощают контур квартиры без зазоров', () => {
    for (const l of building.layouts) {
      const sum = l.roomsGeometry.reduce((s, r) => s + polygonArea(r.polygon), 0);
      expect(sum).toBeCloseTo(polygonArea(l.outline), 6);
    }
  });

  it('проёмы лежат в пределах своей стены и ниже её верха', () => {
    for (const l of building.layouts) {
      for (const o of l.openings) {
        const w = l.walls[o.wallIndex];
        expect(w).toBeDefined();
        expect(o.offset).toBeGreaterThanOrEqual(0);
        expect(o.offset + o.width).toBeLessThanOrEqual(wallLength(w!) + EPS);
        expect((o.sill ?? 0) + o.height).toBeLessThanOrEqual(w!.height + EPS);
      }
    }
  });

  it('в каждой планировке одна входная дверь, у каждой жилой комнаты и кухни есть окно', () => {
    for (const l of building.layouts) {
      expect(l.openings.filter((o) => o.entry)).toHaveLength(1);
      for (const r of l.roomsGeometry.filter((r) =>
        ['living', 'bedroom', 'kitchen'].includes(r.type),
      )) {
        const hasWindow = l.openings.some((o) => {
          if (o.kind !== 'window') return false;
          const w = l.walls[o.wallIndex]!;
          const t = (o.offset + o.width / 2) / wallLength(w);
          const mid: [number, number] = [
            w.a[0] + (w.b[0] - w.a[0]) * t,
            w.a[1] + (w.b[1] - w.a[1]) * t,
          ];
          return pointInPolygon(mid, r.polygon);
        });
        expect(hasWindow).toBe(true);
      }
    }
  });

  it('комнатность совпадает с числом жилых комнат (студия — 0)', () => {
    for (const l of building.layouts) {
      const living = l.roomsGeometry.filter((r) => r.type === 'living' || r.type === 'bedroom');
      expect(l.rooms).toBe(l.rooms === 0 ? 0 : living.length);
    }
  });

  it('квартиры лежат внутри этажа и не пересекают коридор', () => {
    const { outline, corridor } = building.floorPlate;
    for (const l of building.layouts) {
      for (const p of l.outline) expect(pointInPolygon(p, outline)).toBe(true);
      const [cx, cy] = [
        l.outline.reduce((s, p) => s + p[0], 0) / 4,
        l.outline.reduce((s, p) => s + p[1], 0) / 4,
      ];
      expect(pointInPolygon([cx, cy], corridor)).toBe(false);
    }
  });

  it('цена растёт на 1,5 % за этаж (с округлением до 10 000 ₽)', () => {
    for (const layout of building.layouts) {
      const byFloor = building.apartments
        .filter((a) => a.layoutId === layout.id)
        .sort((a, b) => a.floor - b.floor);
      const base = byFloor[0]!;
      for (const a of byFloor) {
        const expected = base.price * (1 + PRICE_FLOOR_STEP * (a.floor - 1));
        expect(Math.abs(a.price - expected)).toBeLessThanOrEqual(10_000 * (1 + a.floor * 0.02));
        expect(a.price).toBeGreaterThanOrEqual(base.price);
      }
    }
  });

  it('демо-квартира для заглушек существует и свободна', () => {
    const demo = findApartment('s1-f9-a3');
    expect(demo).toBeDefined();
    expect(demo!.status).toBe('free');
    expect(demo!.number).toBe(51);
  });
});

describe('furniture.json', () => {
  it('в каталоге около двадцати предметов, все поля правил на месте', () => {
    expect(furniture.items.length).toBeGreaterThanOrEqual(18);
    for (const it of furniture.items) {
      expect(it.priority).toBeGreaterThanOrEqual(0);
      expect(it.clearance.front).toBeGreaterThanOrEqual(0);
    }
  });

  it('компактная замена меньше оригинала по площади', () => {
    for (const it of furniture.items.filter((x) => x.compactAlt)) {
      const alt = furniture.byId.get(it.compactAlt!)!;
      expect(alt.size[0] * alt.size[1]).toBeLessThan(it.size[0] * it.size[1]);
    }
  });

  it('у каждого типа комнаты, кроме балкона, есть готовый комплект', () => {
    for (const t of ROOM_TYPES.filter((t) => t !== 'balcony')) {
      expect(furniture.presets[t]?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

describe('finishes.json', () => {
  it('три отделки, первая бесплатная и используется по умолчанию', () => {
    expect(finishes.map((f) => f.id)).toEqual(['scandi', 'loft', 'classic']);
    expect(defaultFinish.pricePerM2).toBe(0);
  });
});

describe('валидация отклоняет битые данные с путём до поля', () => {
  it('проём выходит за стену', () => {
    const b = clone(buildingJson);
    at(b, 'layouts', 0, 'openings', 0).offset = 999;
    expect(() => parseBuilding(b)).toThrow(
      /layouts\[0\]\.openings\[0\]\.offset: проём выходит за стену/,
    );
  });

  it('area не совпадает с полигонами', () => {
    const b = clone(buildingJson);
    const layout = at(b, 'layouts', 1);
    layout.area = (layout.area as number) + 5;
    expect(() => parseBuilding(b)).toThrow(/layouts\[1\]\.area/);
  });

  it('ссылка на несуществующую планировку', () => {
    const b = clone(buildingJson);
    at(b, 'apartments', 3).layoutId = 'nope';
    expect(() => parseBuilding(b)).toThrow(/apartments\[3\]\.layoutId: нет планировки «nope»/);
  });

  it('неизвестный статус и повтор id', () => {
    const b1 = clone(buildingJson);
    at(b1, 'apartments', 0).status = 'booked';
    expect(() => parseBuilding(b1)).toThrow(/apartments\[0\]\.status/);
    const b2 = clone(buildingJson);
    at(b2, 'apartments', 1).id = at(b2, 'apartments', 0).id;
    expect(() => parseBuilding(b2)).toThrow(/повторяется id/);
  });

  it('две входные двери', () => {
    const b = clone(buildingJson);
    const door = list(b, 'layouts', 0, 'openings').find((o) => o.kind === 'door' && !o.entry);
    door!.entry = true;
    expect(() => parseBuilding(b)).toThrow(/входных дверей 2/);
  });

  it('мебель: замена и пара должны существовать, замена — быть компактнее', () => {
    const f1 = clone(furnitureJson);
    at(f1, 'items', 0).compactAlt = 'ghost';
    expect(() => parseFurniture(f1)).toThrow(/compactAlt: нет предмета «ghost»/);

    const f2 = clone(furnitureJson);
    const sofa = list(f2, 'items').find((x) => x.pairWith);
    (sofa!.pairWith as Obj).itemId = 'ghost';
    expect(() => parseFurniture(f2)).toThrow(/pairWith\.itemId/);

    const f3 = clone(furnitureJson);
    at(f3, 'items', 1).compactAlt = 'bed160';
    expect(() => parseFurniture(f3)).toThrow(/не компактнее/);
  });

  it('мебель: комплект не может содержать предмет, запрещённый для комнаты', () => {
    const f = clone(furnitureJson);
    (at(f, 'presets').bath as string[]).push('sofa3');
    expect(() => parseFurniture(f)).toThrow(/нельзя ставить в комнату типа bath/);
  });

  it('отделка: цвет только в виде #rrggbb', () => {
    const f = clone(finishesJson);
    at(f, 0).wall = 'white';
    expect(() => parseFinishes(f)).toThrow(DataError);
    expect(() => parseFinishes(f)).toThrow(/finishes\[0\]\.wall/);
  });
});
