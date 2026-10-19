import type { Apartment, RoomCount } from './types';

export type Range = [min: number, max: number];

export interface ApartmentFilters {
  /** Пустой список — любая комнатность. */
  rooms: RoomCount[];
  /** null — без ограничения. Границы включительно. */
  areaRange: Range | null;
  priceRange: Range | null;
  onlyFree: boolean;
}

export const DEFAULT_FILTERS: ApartmentFilters = {
  rooms: [],
  areaRange: null,
  priceRange: null,
  onlyFree: false,
};

type Filterable = Pick<Apartment, 'rooms' | 'area' | 'price' | 'status'>;

function inRange(v: number, r: Range | null): boolean {
  return r === null || (v >= r[0] && v <= r[1]);
}

export function matchesFilters(apt: Filterable, f: ApartmentFilters): boolean {
  if (f.rooms.length > 0 && !f.rooms.includes(apt.rooms)) return false;
  if (f.onlyFree && apt.status !== 'free') return false;
  return inRange(apt.area, f.areaRange) && inRange(apt.price, f.priceRange);
}

export function filterApartments<T extends Filterable>(
  list: readonly T[],
  f: ApartmentFilters,
): T[] {
  return list.filter((a) => matchesFilters(a, f));
}

/** Границы для слайдеров фильтра. Для пустого списка — null. */
export function filterBounds(list: readonly Filterable[]): { area: Range; price: Range } | null {
  if (list.length === 0) return null;
  const areas = list.map((a) => a.area);
  const prices = list.map((a) => a.price);
  return {
    area: [Math.min(...areas), Math.max(...areas)],
    price: [Math.min(...prices), Math.max(...prices)],
  };
}
