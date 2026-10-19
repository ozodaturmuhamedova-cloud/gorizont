/**
 * Случайный набор мебели для квартиры (CLAUDE.md §10.1).
 *
 * Генератор только выбирает предметы; ставит их autoLayout из domain/layout/ — тот же
 * алгоритм, что и кнопка «Готовый комплект». Своего размещателя здесь нет.
 */
import { furniture as defaultCatalog } from '../../data';
import { wallDir, wallLength } from '../../domain/geometry';
import { autoLayout, type SkippedItem } from '../../domain/layout';
import type {
  Apartment,
  FurnitureCatalog,
  FurnitureItem,
  PlacedFurniture,
  Room,
} from '../../domain/types';
import { createRng, type Rng } from './rng';
import { randomApartment, type RandomApartmentOptions } from './roomsGen';

export type Density = 'sparse' | 'normal' | 'dense';

export interface RandomFurnishedOptions extends RandomApartmentOptions {
  /** Готовая квартира; по умолчанию — randomApartment(seed, opts). */
  apartment?: Apartment;
  catalog?: FurnitureCatalog;
  density?: Density;
  /** Добавить 1–3 заведомо неверных предмета (в стене, в двери, поверх другого). */
  allowInvalid?: boolean;
}

export type { SkippedItem };

export interface FurnishedApartment {
  apartment: Apartment;
  placed: PlacedFurniture[];
  skipped: SkippedItem[];
  /** Сколько неверных предметов добавлено в режиме allowInvalid. */
  injectedInvalid: number;
}

/** Мебель берёт свой поток случайных чисел, чтобы квартира совпадала с randomApartment(seed). */
const FURNITURE_SALT = 0x5f3759df;
function pickItems(
  room: Room,
  isStudio: boolean,
  catalog: FurnitureCatalog,
  density: Density,
  rng: Rng,
): FurnitureItem[] {
  const ids = [...(catalog.presets[room.type] ?? [])];
  if (isStudio && room.type === 'living') ids.push(...(catalog.presets.kitchen ?? []));
  let items = ids.map((id) => catalog.byId.get(id)).filter((x): x is FurnitureItem => !!x);
  if (density === 'sparse') {
    items = [...items]
      .sort((a, b) => b.priority - a.priority)
      .slice(0, Math.ceil(items.length / 2));
  }
  if (density === 'dense') {
    const extra = catalog.items.filter(
      (it) => (!it.allowedRooms || it.allowedRooms.includes(room.type)) && !ids.includes(it.id),
    );
    const n = rng.int(1, 3);
    for (let k = 0; k < n && extra.length > 0; k++) items.push(rng.pick(extra));
  }
  return items.sort((a, b) => b.priority - a.priority);
}

function injectInvalid(
  apt: Apartment,
  catalog: FurnitureCatalog,
  placed: PlacedFurniture[],
  rng: Rng,
): number {
  const n = rng.int(1, 3);
  const doors = apt.openings.filter((o) => o.kind === 'door');
  for (let k = 0; k < n; k++) {
    const kind = rng.pick(['wall', 'door', 'overlap'] as const);
    const item = rng.pick(catalog.items);
    if (kind === 'overlap' && placed.length > 0) {
      const victim = rng.pick(placed);
      placed.push({ ...victim, position: [...victim.position] });
      continue;
    }
    if (kind === 'door' && doors.length > 0) {
      const d = rng.pick(doors);
      const w = apt.walls[d.wallIndex]!;
      const [dx, dy] = wallDir(w);
      const t = d.offset + d.width / 2;
      placed.push({ itemId: item.id, position: [w.a[0] + dx * t, w.a[1] + dy * t], rotation: 0 });
      continue;
    }
    const w = rng.pick(apt.walls);
    const [dx, dy] = wallDir(w);
    const t = wallLength(w) / 2;
    placed.push({ itemId: item.id, position: [w.a[0] + dx * t, w.a[1] + dy * t], rotation: 0 });
  }
  return n;
}

/** Случайная квартира с мебелью. Тот же seed с теми же опциями даёт ту же расстановку. */
export function randomFurnished(
  seed: number,
  opts: RandomFurnishedOptions = {},
): FurnishedApartment {
  const apartment = opts.apartment ?? randomApartment(seed, opts);
  const catalog = opts.catalog ?? defaultCatalog;
  const density = opts.density ?? 'normal';
  const rng = createRng(seed ^ FURNITURE_SALT);
  const placed: PlacedFurniture[] = [];
  const skipped: SkippedItem[] = [];
  for (const room of apartment.roomsGeometry) {
    const items = pickItems(room, apartment.rooms === 0, catalog, density, rng);
    const res = autoLayout(apartment, room, items, catalog, rng);
    placed.push(...res.placed);
    skipped.push(...res.skipped);
  }
  const injectedInvalid = opts.allowInvalid ? injectInvalid(apartment, catalog, placed, rng) : 0;
  return { apartment, placed, skipped, injectedInvalid };
}
