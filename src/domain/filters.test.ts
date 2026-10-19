import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS, filterApartments, filterBounds, matchesFilters } from './filters';
import type { ApartmentFilters } from './filters';
import type { ApartmentStatus, RoomCount } from './types';

interface Apt {
  id: string;
  rooms: RoomCount;
  area: number;
  price: number;
  status: ApartmentStatus;
}
const apt = (
  id: string,
  rooms: RoomCount,
  area: number,
  price: number,
  status: ApartmentStatus,
) => ({
  id,
  rooms,
  area,
  price,
  status,
});
const list: Apt[] = [
  apt('studio', 0, 35, 5_700_000, 'free'),
  apt('k1', 1, 42, 6_400_000, 'reserved'),
  apt('k1b', 1, 52, 7_900_000, 'free'),
  apt('k2', 2, 63, 9_300_000, 'sold'),
  apt('k2b', 2, 76, 11_200_000, 'free'),
  apt('k3', 3, 80, 11_200_000, 'free'),
];
const ids = (f: Partial<ApartmentFilters>) =>
  filterApartments(list, { ...DEFAULT_FILTERS, ...f }).map((a) => a.id);

describe('фильтры квартир', () => {
  it('по умолчанию проходят все', () => {
    expect(ids({})).toEqual(list.map((a) => a.id));
  });

  it('комнатность: несколько вариантов сразу', () => {
    expect(ids({ rooms: [1] })).toEqual(['k1', 'k1b']);
    expect(ids({ rooms: [0, 3] })).toEqual(['studio', 'k3']);
  });

  it('только свободные', () => {
    expect(ids({ onlyFree: true })).toEqual(['studio', 'k1b', 'k2b', 'k3']);
  });

  it('границы площади и цены включительно', () => {
    expect(ids({ areaRange: [42, 63] })).toEqual(['k1', 'k1b', 'k2']);
    expect(ids({ priceRange: [7_900_000, 11_200_000] })).toEqual(['k1b', 'k2', 'k2b', 'k3']);
  });

  it('комбинация всех условий', () => {
    expect(
      ids({ rooms: [2, 3], onlyFree: true, areaRange: [70, 90], priceRange: [0, 11_200_000] }),
    ).toEqual(['k2b', 'k3']);
  });

  it('ничего не нашлось', () => {
    expect(ids({ rooms: [4] })).toEqual([]);
    expect(ids({ areaRange: [100, 200] })).toEqual([]);
  });

  it('matchesFilters согласован с filterApartments', () => {
    const f: ApartmentFilters = { ...DEFAULT_FILTERS, rooms: [1], onlyFree: true };
    expect(list.filter((a) => matchesFilters(a, f)).map((a) => a.id)).toEqual(['k1b']);
  });
});

describe('границы для слайдеров', () => {
  it('минимум и максимум площади и цены', () => {
    expect(filterBounds(list)).toEqual({ area: [35, 80], price: [5_700_000, 11_200_000] });
  });

  it('пустой список — null', () => {
    expect(filterBounds([])).toBeNull();
  });
});
