/**
 * Property-тесты генератора: каждая квартира и расстановка из диапазона seed'ов должна проходить
 * все инварианты. По умолчанию seed 1…200, в `npm run test:fuzz` — 1…5000.
 */
import { describe, expect, it } from 'vitest';
import { building, furniture } from '../../data';
import { parseBuilding } from '../../domain/data';
import { ROOM_COUNTS } from '../../domain/types';
import {
  REGRESSION_SEEDS,
  apartmentViolations,
  asBuildingJson,
  furnitureViolations,
  plausibilityViolations,
  randomApartment,
  randomFurnished,
  seedRange,
} from './index';

const seeds = seedRange();
/** Собирает все нарушения по диапазону seed'ов в одно сообщение: `seed=17: …`. */
function collect(check: (seed: number) => string[]): string[] {
  const out: string[] = [];
  for (const seed of seeds) for (const v of check(seed)) out.push(`seed=${seed}: ${v}`);
  return out;
}

describe('randomApartment: детерминизм и опции', () => {
  it('один seed — одна и та же квартира, разные seed — разные', () => {
    expect(randomApartment(17)).toEqual(randomApartment(17));
    expect(randomApartment(17)).not.toEqual(randomApartment(18));
  });

  it('отпечатки seed 1–3 не меняются (изменение генератора должно быть осознанным)', () => {
    const fp = (seed: number) => {
      const a = randomApartment(seed);
      return {
        rooms: a.rooms,
        area: a.area,
        outlinePoints: a.outline.length,
        types: a.roomsGeometry.map((r) => r.type).sort(),
        walls: a.walls.length,
        doors: a.openings.filter((o) => o.kind === 'door').length,
        windows: a.openings.filter((o) => o.kind === 'window').length,
        ceiling: a.walls[0]!.height,
        price: a.price,
      };
    };
    expect(fp(1)).toEqual({
      rooms: 3,
      area: 76,
      outlinePoints: 6,
      types: ['bath', 'bedroom', 'bedroom', 'hall', 'kitchen', 'living'],
      walls: 20,
      doors: 6,
      windows: 5,
      ceiling: 2.5,
      price: 11_900_000,
    });
    expect(fp(2)).toEqual({
      rooms: 3,
      area: 89.3,
      outlinePoints: 4,
      types: ['balcony', 'bath', 'bedroom', 'bedroom', 'hall', 'kitchen', 'living'],
      walls: 22,
      doors: 7,
      windows: 4,
      ceiling: 2.7,
      price: 15_830_000,
    });
    expect(fp(3)).toEqual({
      rooms: 3,
      area: 89.5,
      outlinePoints: 4,
      types: ['bath', 'bedroom', 'bedroom', 'hall', 'kitchen', 'living'],
      walls: 19,
      doors: 6,
      windows: 4,
      ceiling: 2.5,
      price: 20_330_000,
    });
  });

  it('полные снапшоты seed 1–3', () => {
    for (const seed of [1, 2, 3]) expect(randomApartment(seed)).toMatchSnapshot();
  });

  it('комнатность: студия без кухни, иначе кухня + нужное число жилых комнат', () => {
    for (const rooms of ROOM_COUNTS) {
      for (let seed = 1; seed <= 20; seed++) {
        const a = randomApartment(seed, { rooms });
        const t = a.roomsGeometry.map((r) => r.type);
        expect(a.rooms).toBe(rooms);
        expect(t.filter((x) => x === 'hall')).toHaveLength(1);
        expect(t.filter((x) => x === 'bath')).toHaveLength(1);
        expect(t.filter((x) => x === 'kitchen')).toHaveLength(rooms === 0 ? 0 : 1);
        expect(t.filter((x) => x === 'living' || x === 'bedroom')).toHaveLength(Math.max(1, rooms));
      }
    }
  });

  it('форма контура, балкон, потолок и площадь задаются опциями', () => {
    for (let seed = 1; seed <= 20; seed++) {
      expect(randomApartment(seed, { shape: 'rect' }).outline).toHaveLength(4);
      expect(randomApartment(seed, { shape: 'L' }).outline).toHaveLength(6);
      const withBalcony = randomApartment(seed, { balcony: true, rooms: 2 });
      expect(withBalcony.roomsGeometry.some((r) => r.type === 'balcony')).toBe(true);
      const noBalcony = randomApartment(seed, { balcony: false });
      expect(noBalcony.roomsGeometry.some((r) => r.type === 'balcony')).toBe(false);
      expect(randomApartment(seed, { ceiling: 3 }).walls.every((w) => w.height === 3)).toBe(true);
      const ranged = randomApartment(seed, { rooms: 2, areaRange: [55, 60] });
      expect(ranged.area).toBeGreaterThanOrEqual(55);
      expect(ranged.area).toBeLessThanOrEqual(60);
    }
  });

  it('невозможные опции — понятная ошибка с seed', () => {
    expect(() => randomApartment(5, { rooms: 4, areaRange: [20, 25] })).toThrow(/seed=5/);
  });
});

describe('инварианты на диапазоне seed’ов', () => {
  it('каждая случайная квартира проходит все инварианты', () => {
    expect(collect((s) => apartmentViolations(randomApartment(s)))).toEqual([]);
  });

  it('каждая случайная квартира проходит ту же валидацию, что building.json', () => {
    const apartments = seeds.map((s) => randomApartment(s));
    expect(() => parseBuilding(asBuildingJson(apartments))).not.toThrow();
  });

  it('помещения правдоподобных размеров (прихожая и санузел меньше комнат)', () => {
    expect(collect((s) => plausibilityViolations(randomApartment(s)))).toEqual([]);
  });

  it('мебель стоит без нарушений при любой плотности', () => {
    for (const density of ['sparse', 'normal', 'dense'] as const) {
      const v = collect((s) => {
        const f = randomFurnished(s, { density });
        return furnitureViolations(f.apartment, f.placed, furniture).map((x) => x.message);
      });
      expect(v).toEqual([]);
    }
  });

  it('allowInvalid: каждое внедрённое нарушение обнаруживается', () => {
    const missed = collect((s) => {
      const f = randomFurnished(s, { allowInvalid: true });
      const bad = new Set(
        furnitureViolations(f.apartment, f.placed, furniture).map((x) => x.index),
      );
      return bad.size >= f.injectedInvalid
        ? []
        : [`внедрено ${f.injectedInvalid}, найдено ${bad.size}`];
    });
    expect(missed).toEqual([]);
  });

  it('регрессионные seed’ы', () => {
    const v = REGRESSION_SEEDS.flatMap(({ seed, note }) => {
      const f = randomFurnished(seed);
      return [
        ...apartmentViolations(f.apartment),
        ...plausibilityViolations(f.apartment),
        ...furnitureViolations(f.apartment, f.placed, furniture).map((x) => x.message),
      ].map((m) => `seed=${seed} (${note}): ${m}`);
    });
    expect(v).toEqual([]);
  });

  it('генерация квартиры с мебелью укладывается в 20 мс', () => {
    const n = 100;
    const t0 = performance.now();
    for (let s = 1; s <= n; s++) randomFurnished(s);
    expect((performance.now() - t0) / n).toBeLessThan(20);
  });
});

describe('инварианты на реальных данных', () => {
  it('квартиры building.json проходят те же проверки', () => {
    const v = building.layouts.flatMap((l) => {
      const apt = building.apartments.find((a) => a.layoutId === l.id)!;
      return apartmentViolations(apt).map((m) => `${l.id}: ${m}`);
    });
    expect(v).toEqual([]);
  });

  it('временный размещатель расставляет мебель и в реальных квартирах', () => {
    for (const l of building.layouts) {
      const apartment = building.apartments.find((a) => a.layoutId === l.id)!;
      const f = randomFurnished(1, { apartment });
      expect(f.placed.length).toBeGreaterThan(0);
      expect(furnitureViolations(apartment, f.placed, furniture)).toEqual([]);
    }
  });
});

describe('инварианты ловят испорченные квартиры', () => {
  const broken = (mutate: (a: ReturnType<typeof randomApartment>) => void) => {
    const a = structuredClone(randomApartment(9));
    mutate(a);
    return apartmentViolations(a).join('\n');
  };

  it('недостижимая комната', () => {
    expect(
      broken((a) => {
        a.openings = a.openings.filter((o) => o.kind !== 'door' || o.entry);
      }),
    ).toMatch(/недостижима из прихожей/);
  });

  it('проём за пределами стены', () => {
    expect(
      broken((a) => {
        a.openings[0]!.offset = 99;
      }),
    ).toMatch(/заходит на угол или за стену/);
  });

  it('комната без окна', () => {
    expect(
      broken((a) => {
        a.openings = a.openings.filter((o) => o.kind !== 'window');
      }),
    ).toMatch(/нет окна/);
  });

  it('пересекающиеся комнаты и неверная площадь', () => {
    const msg = broken((a) => {
      a.roomsGeometry[0]!.polygon = a.roomsGeometry[0]!.polygon.map(([x, y]) => [x + 0.5, y]);
    });
    expect(msg).toMatch(/пересекаются|выходит за контур/);
  });
});
