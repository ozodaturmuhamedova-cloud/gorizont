import { describe, expect, it } from 'vitest';
import { formatArea, formatMillions, formatPrice, pluralRu } from './format';
import { estimate, finishCost, pricePerM2 } from './pricing';
import type { Finish, FurnitureCatalog, FurnitureItem, PlacedFurniture } from './types';

const item = (id: string, name: string, price: number): FurnitureItem => ({
  id,
  name,
  price,
  size: [1, 1, 1],
  category: 'decor',
  placement: 'wall',
  clearance: { front: 0, sides: 0, back: 0 },
  priority: 0,
});
const items = [
  item('sofa', 'Диван', 80000),
  item('chair', 'Стул', 7000),
  item('lamp', 'Торшер', 5000),
];
const catalog: Pick<FurnitureCatalog, 'byId'> = { byId: new Map(items.map((i) => [i.id, i])) };

const apt = { price: 10_000_000, area: 62.5 };
const free: Finish = {
  id: 'scandi',
  name: 'Скандинавия',
  pricePerM2: 0,
  floor: { wood: '#000000', tile: '#000000' },
  wall: '#ffffff',
};
const paid: Finish = { ...free, id: 'loft', name: 'Лофт', pricePerM2: 4500 };
const at = (itemId: string): PlacedFurniture => ({ itemId, position: [0, 0], rotation: 0 });

describe('смета', () => {
  it('без мебели и с бесплатной отделкой равна цене квартиры', () => {
    const e = estimate(apt, [], catalog, free);
    expect(e.furniture).toEqual([]);
    expect(e.furnitureTotal).toBe(0);
    expect(e.finish.total).toBe(0);
    expect(e.total).toBe(10_000_000);
  });

  it('платная отделка считается по площади', () => {
    const e = estimate(apt, [], catalog, paid);
    expect(e.finish.total).toBe(281_250);
    expect(e.total).toBe(10_281_250);
  });

  it('одинаковые предметы сворачиваются в строку, строки идут по убыванию суммы', () => {
    const placed = [at('chair'), at('sofa'), at('chair'), at('lamp'), at('chair')];
    const e = estimate(apt, placed, catalog, free);
    expect(e.furniture.map((l) => [l.itemId, l.qty, l.total])).toEqual([
      ['sofa', 1, 80000],
      ['chair', 3, 21000],
      ['lamp', 1, 5000],
    ]);
    expect(e.furnitureTotal).toBe(106_000);
    expect(e.total).toBe(10_106_000);
  });

  it('предметы, которых нет в каталоге, не входят в смету и перечислены отдельно', () => {
    const e = estimate(apt, [at('sofa'), at('ghost'), at('ghost')], catalog, free);
    expect(e.furnitureTotal).toBe(80000);
    expect(e.unknownItems).toEqual(['ghost']);
  });

  it('цена за м² и стоимость отделки округляются до рубля', () => {
    expect(pricePerM2({ price: 10_000_000, area: 64.4 })).toBe(155_280);
    expect(finishCost({ pricePerM2: 6200 }, 64.37)).toBe(399_094);
  });
});

describe('форматирование', () => {
  const plain = (s: string) => s.replace(/\s/g, '');

  it('цена в рублях без копеек', () => {
    expect(plain(formatPrice(9_870_000))).toBe('9870000₽');
    expect(plain(formatPrice(1234.6))).toBe('1235₽');
  });

  it('площадь с одним знаком после запятой', () => {
    expect(formatArea(64.4)).toBe('64,4 м²');
    expect(formatArea(35)).toBe('35,0 м²');
  });
});

describe('компактные цены и склонение', () => {
  const plain = (s: string) => s.replace(/\s/g, ' ');

  it('миллионы с двумя знаками', () => {
    expect(plain(formatMillions(10_440_000))).toBe('10,44 млн ₽');
    expect(plain(formatMillions(7_000_000))).toBe('7 млн ₽');
  });

  it('1 квартира, 2 квартиры, 5 квартир, 11 квартир, 21 квартира', () => {
    const q = (n: number) => pluralRu(n, 'квартира', 'квартиры', 'квартир');
    expect([1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 111].map(q)).toEqual([
      'квартира',
      'квартиры',
      'квартиры',
      'квартир',
      'квартир',
      'квартир',
      'квартир',
      'квартира',
      'квартиры',
      'квартир',
      'квартир',
    ]);
  });
});
