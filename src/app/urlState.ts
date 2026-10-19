/**
 * Состояние плана в адресе страницы, чтобы ссылкой можно было поделиться:
 * /?floor=5&apt=s1-f5-a3&rooms=1,2&area=40-80&price=6000000-12000000&free=1
 * Неверные значения молча отбрасываются. Значения по умолчанию в адрес не пишутся.
 */
import { DEFAULT_FILTERS, type ApartmentFilters, type Range } from '../domain/filters';
import { ROOM_COUNTS, type RoomCount } from '../domain/types';

export interface UrlState {
  floor: number | null;
  apartmentId: string | null;
  filters: ApartmentFilters;
}

export interface UrlContext {
  floors: number;
  apartmentExists: (id: string) => boolean;
}

const KEYS = {
  floor: 'floor',
  apt: 'apt',
  rooms: 'rooms',
  area: 'area',
  price: 'price',
  free: 'free',
};

function num(s: string): number | null {
  if (s.trim() === '') return null;
  const v = Number(s);
  return Number.isFinite(v) && v >= 0 ? v : null;
}

/** «40-80», «40-» (от 40), «-80» (до 80). */
export function parseRange(s: string | null): Range | null {
  if (!s) return null;
  const m = /^([^-]*)-([^-]*)$/.exec(s);
  if (!m) return null;
  const lo = num(m[1]!);
  const hi = num(m[2]!);
  if ((m[1] !== '' && lo === null) || (m[2] !== '' && hi === null)) return null;
  if (lo === null && hi === null) return null;
  const a = lo ?? -Infinity;
  const b = hi ?? Infinity;
  return a <= b ? [a, b] : [b, a];
}

export function formatRange(r: Range): string {
  const part = (v: number) => (Number.isFinite(v) ? String(v) : '');
  return `${part(r[0])}-${part(r[1])}`;
}

export function parseUrlState(params: URLSearchParams, ctx: UrlContext): UrlState {
  const floorRaw = num(params.get(KEYS.floor) ?? '');
  const floor =
    floorRaw !== null && Number.isInteger(floorRaw) && floorRaw >= 1 && floorRaw <= ctx.floors
      ? floorRaw
      : null;
  const apt = params.get(KEYS.apt);
  const rooms = (params.get(KEYS.rooms) ?? '')
    .split(',')
    .map((x) => num(x))
    .filter((x): x is RoomCount => x !== null && (ROOM_COUNTS as readonly number[]).includes(x));
  return {
    floor,
    apartmentId: apt && ctx.apartmentExists(apt) ? apt : null,
    filters: {
      rooms: [...new Set(rooms)].sort((a, b) => a - b),
      areaRange: parseRange(params.get(KEYS.area)),
      priceRange: parseRange(params.get(KEYS.price)),
      onlyFree: params.get(KEYS.free) === '1',
    },
  };
}

export function toSearchParams(s: UrlState, defaultFloor: number): URLSearchParams {
  const p = new URLSearchParams();
  const f = s.filters;
  if (s.floor !== null && s.floor !== defaultFloor) p.set(KEYS.floor, String(s.floor));
  if (s.apartmentId) p.set(KEYS.apt, s.apartmentId);
  if (f.rooms.length > 0) p.set(KEYS.rooms, [...f.rooms].sort((a, b) => a - b).join(','));
  if (f.areaRange) p.set(KEYS.area, formatRange(f.areaRange));
  if (f.priceRange) p.set(KEYS.price, formatRange(f.priceRange));
  if (f.onlyFree !== DEFAULT_FILTERS.onlyFree) p.set(KEYS.free, '1');
  return p;
}

/** Есть ли в адресе хоть что-то из состояния плана. */
export function hasUrlState(params: URLSearchParams): boolean {
  return Object.values(KEYS).some((k) => params.has(k));
}
