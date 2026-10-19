/**
 * Случайный набор мебели для квартиры (CLAUDE.md §10.1).
 *
 * ВРЕМЕННЫЙ размещатель: случайная позиция и поворот кратно 90° с отбраковкой (до 50 попыток
 * на предмет). В фазе 5 его заменит autoLayout из domain/layout/ — тогда генератор будет
 * только выбирать предметы, а ставить их будет тот же алгоритм, что и кнопка «Готовый комплект».
 */
import { furniture as defaultCatalog } from '../../data';
import { WALL_EXTERIOR } from '../../domain/constants';
import { bbox, footprintObb, obbsOverlap, wallDir, wallLength } from '../../domain/geometry';
import type {
  Apartment,
  FurnitureCatalog,
  FurnitureItem,
  Obb,
  PlacedFurniture,
  Room,
  Vec2,
} from '../../domain/types';
import { doorZones, windowZones } from './invariants';
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

export interface SkippedItem {
  itemId: string;
  roomId: string;
  reason: string;
}

export interface FurnishedApartment {
  apartment: Apartment;
  placed: PlacedFurniture[];
  skipped: SkippedItem[];
  /** Сколько неверных предметов добавлено в режиме allowInvalid. */
  injectedInvalid: number;
}

/** Мебель берёт свой поток случайных чисел, чтобы квартира совпадала с randomApartment(seed). */
const FURNITURE_SALT = 0x5f3759df;
const PLACE_ATTEMPTS = 50;
/** Отступ следа мебели от осевой линии стены: половина наружной стены + 1 см. */
const WALL_GAP = WALL_EXTERIOR / 2 + 0.01;
const QUARTER_TURNS = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
const NO_SPACE = 'Не хватило места';

const round2 = (v: number) => Math.round(v * 100) / 100;

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

function tryPlace(
  item: FurnitureItem,
  room: Room,
  blocked: (fp: Obb, item: FurnitureItem) => boolean,
  rng: Rng,
): PlacedFurniture | null {
  const { min, max } = bbox(room.polygon);
  for (let k = 0; k < PLACE_ATTEMPTS; k++) {
    const rotation = rng.pick(QUARTER_TURNS);
    const turned = Math.abs(Math.sin(rotation)) > 0.5;
    const hx = (turned ? item.size[1] : item.size[0]) / 2;
    const hy = (turned ? item.size[0] : item.size[1]) / 2;
    const lo: Vec2 = [min[0] + WALL_GAP + hx, min[1] + WALL_GAP + hy];
    const hi: Vec2 = [max[0] - WALL_GAP - hx, max[1] - WALL_GAP - hy];
    if (lo[0] > hi[0] || lo[1] > hi[1]) continue;
    const position: Vec2 = [round2(rng.float(lo[0], hi[0])), round2(rng.float(lo[1], hi[1]))];
    if (blocked(footprintObb(item.size, position, rotation), item)) continue;
    return { itemId: item.id, position, rotation };
  }
  return null;
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
  const doors = doorZones(apartment);
  const windows = windowZones(apartment);
  const placed: PlacedFurniture[] = [];
  const footprints: Obb[] = [];
  const skipped: SkippedItem[] = [];

  const blocked = (fp: Obb, item: FurnitureItem) =>
    footprints.some((o) => obbsOverlap(fp, o)) ||
    doors.some((z) => obbsOverlap(fp, z)) ||
    (item.blocksWindow === true && windows.some((z) => obbsOverlap(fp, z)));

  for (const room of apartment.roomsGeometry) {
    for (const wanted of pickItems(room, apartment.rooms === 0, catalog, density, rng)) {
      let item: FurnitureItem | undefined = wanted;
      let spot: PlacedFurniture | null = null;
      while (item && !spot) {
        spot = tryPlace(item, room, blocked, rng);
        if (!spot) item = item.compactAlt ? catalog.byId.get(item.compactAlt) : undefined;
      }
      if (spot && item) {
        placed.push(spot);
        footprints.push(footprintObb(item.size, spot.position, spot.rotation));
      } else {
        skipped.push({ itemId: wanted.id, roomId: room.id, reason: NO_SPACE });
      }
    }
  }
  const injectedInvalid = opts.allowInvalid ? injectInvalid(apartment, catalog, placed, rng) : 0;
  return { apartment, placed, skipped, injectedInvalid };
}
