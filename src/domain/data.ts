/**
 * Проверка внешних JSON на входе (CLAUDE.md §9). Ошибка содержит путь до проблемного поля,
 * например `layouts[2].openings[4].offset: проём выходит за стену`.
 */
import { AREA_TOLERANCE, EPS } from './constants';
import { polygonArea, polygonCentroid, pointInPolygon, wallLength } from './geometry';
import {
  APARTMENT_STATUSES,
  CORE_TYPES,
  FURNITURE_CATEGORIES,
  OPENING_KINDS,
  PLACEMENTS,
  ROOM_COUNTS,
  ROOM_TYPES,
  type Apartment,
  type Building,
  type Clearance,
  type Finish,
  type FloorPlate,
  type FurnitureCatalog,
  type FurnitureItem,
  type Layout,
  type Opening,
  type PairRule,
  type Room,
  type RoomType,
  type Vec2,
  type Wall,
} from './types';

export class DataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataError';
  }
}

// ---------- базовые проверки ----------

function fail(path: string, msg: string): never {
  throw new DataError(`${path}: ${msg}`);
}

function obj(v: unknown, path: string): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(path, 'ожидается объект');
  return v as Record<string, unknown>;
}

function arr(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) fail(path, 'ожидается массив');
  return v;
}

function str(v: unknown, path: string): string {
  if (typeof v !== 'string' || v.trim() === '') fail(path, 'ожидается непустая строка');
  return v;
}

function bool(v: unknown, path: string): boolean {
  if (typeof v !== 'boolean') fail(path, 'ожидается true или false');
  return v;
}

interface NumOpts {
  min?: number;
  max?: number;
  int?: boolean;
  /** Строго больше min. */
  positive?: boolean;
}

function num(v: unknown, path: string, o: NumOpts = {}): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(path, 'ожидается число');
  if (o.int && !Number.isInteger(v)) fail(path, 'ожидается целое число');
  if (o.positive && v <= 0) fail(path, 'должно быть больше 0');
  if (o.min !== undefined && v < o.min) fail(path, `должно быть не меньше ${o.min}`);
  if (o.max !== undefined && v > o.max) fail(path, `должно быть не больше ${o.max}`);
  return v;
}

function oneOf<T extends string | number>(v: unknown, path: string, values: readonly T[]): T {
  if (!values.includes(v as T)) fail(path, `ожидается одно из: ${values.join(', ')}`);
  return v as T;
}

function hex(v: unknown, path: string): string {
  const s = str(v, path);
  if (!/^#[0-9a-f]{6}$/i.test(s)) fail(path, 'ожидается цвет вида #a1b2c3');
  return s;
}

function vec2(v: unknown, path: string): Vec2 {
  const a = arr(v, path);
  if (a.length !== 2) fail(path, 'ожидается точка [x, y]');
  return [num(a[0], `${path}[0]`), num(a[1], `${path}[1]`)];
}

function polygon(v: unknown, path: string): Vec2[] {
  const pts = arr(v, path).map((p, i) => vec2(p, `${path}[${i}]`));
  if (pts.length < 3) fail(path, 'в полигоне меньше трёх точек');
  if (polygonArea(pts) < EPS) fail(path, 'полигон нулевой площади');
  return pts;
}

function optional<T>(v: unknown, parse: (v: unknown) => T): T | undefined {
  return v === undefined ? undefined : parse(v);
}

function uniqueIds(ids: readonly (string | number)[], path: string): void {
  const seen = new Set<string | number>();
  ids.forEach((id, i) => {
    if (seen.has(id)) fail(`${path}[${i}]`, `повторяется id «${id}»`);
    seen.add(id);
  });
}

// ---------- здание ----------

function parseRoom(v: unknown, path: string): Room {
  const o = obj(v, path);
  return {
    id: str(o.id, `${path}.id`),
    type: oneOf(o.type, `${path}.type`, ROOM_TYPES),
    polygon: polygon(o.polygon, `${path}.polygon`),
  };
}

function parseWall(v: unknown, path: string): Wall {
  const o = obj(v, path);
  const w: Wall = {
    a: vec2(o.a, `${path}.a`),
    b: vec2(o.b, `${path}.b`),
    thickness: num(o.thickness, `${path}.thickness`, { positive: true }),
    height: num(o.height, `${path}.height`, { positive: true }),
  };
  if (wallLength(w) < EPS) fail(path, 'стена нулевой длины');
  return w;
}

function parseOpening(v: unknown, path: string, walls: readonly Wall[]): Opening {
  const o = obj(v, path);
  const wallIndex = num(o.wallIndex, `${path}.wallIndex`, { int: true, min: 0 });
  const wall = walls[wallIndex];
  if (!wall) fail(`${path}.wallIndex`, `нет стены с индексом ${wallIndex}`);
  const kind = oneOf(o.kind, `${path}.kind`, OPENING_KINDS);
  const op: Opening = {
    wallIndex,
    offset: num(o.offset, `${path}.offset`, { min: 0 }),
    width: num(o.width, `${path}.width`, { positive: true }),
    kind,
    height: num(o.height, `${path}.height`, { positive: true }),
  };
  if (kind === 'window') op.sill = num(o.sill, `${path}.sill`, { min: 0 });
  else if (o.sill !== undefined) fail(`${path}.sill`, 'подоконник бывает только у окна');
  const entry = optional(o.entry, (x) => bool(x, `${path}.entry`));
  if (entry !== undefined) {
    if (kind !== 'door') fail(`${path}.entry`, 'входной может быть только дверь');
    op.entry = entry;
  }
  if (op.offset + op.width > wallLength(wall) + EPS)
    fail(`${path}.offset`, 'проём выходит за стену');
  if ((op.sill ?? 0) + op.height > wall.height + EPS) fail(`${path}.height`, 'проём выше стены');
  return op;
}

function parseLayout(v: unknown, path: string): Layout {
  const o = obj(v, path);
  const outline = polygon(o.outline, `${path}.outline`);
  const roomsGeometry = arr(o.roomsGeometry, `${path}.roomsGeometry`).map((r, i) =>
    parseRoom(r, `${path}.roomsGeometry[${i}]`),
  );
  if (roomsGeometry.length === 0) fail(`${path}.roomsGeometry`, 'нет ни одной комнаты');
  uniqueIds(
    roomsGeometry.map((r) => r.id),
    `${path}.roomsGeometry`,
  );
  const walls = arr(o.walls, `${path}.walls`).map((w, i) => parseWall(w, `${path}.walls[${i}]`));
  const openings = arr(o.openings, `${path}.openings`).map((x, i) =>
    parseOpening(x, `${path}.openings[${i}]`, walls),
  );
  const layout: Layout = {
    id: str(o.id, `${path}.id`),
    rooms: oneOf(o.rooms, `${path}.rooms`, ROOM_COUNTS),
    area: num(o.area, `${path}.area`, { positive: true }),
    outline,
    roomsGeometry,
    walls,
    openings,
  };

  const roomsArea = roomsGeometry.reduce((s, r) => s + polygonArea(r.polygon), 0);
  if (Math.abs(roomsArea - layout.area) > AREA_TOLERANCE) {
    fail(`${path}.area`, `${layout.area} м², а по полигонам комнат ${roomsArea.toFixed(2)} м²`);
  }
  roomsGeometry.forEach((r, i) => {
    if (!pointInPolygon(polygonCentroid(r.polygon), outline)) {
      fail(`${path}.roomsGeometry[${i}]`, `комната «${r.id}» за контуром квартиры`);
    }
  });
  const entries = openings.filter((x) => x.entry).length;
  if (entries !== 1) fail(`${path}.openings`, `входных дверей ${entries}, нужна ровно одна`);
  return layout;
}

function parseFloorPlate(v: unknown, path: string): FloorPlate {
  const o = obj(v, path);
  return {
    outline: polygon(o.outline, `${path}.outline`),
    corridor: polygon(o.corridor, `${path}.corridor`),
    core: arr(o.core, `${path}.core`).map((c, i) => {
      const co = obj(c, `${path}.core[${i}]`);
      return {
        type: oneOf(co.type, `${path}.core[${i}].type`, CORE_TYPES),
        polygon: polygon(co.polygon, `${path}.core[${i}].polygon`),
      };
    }),
  };
}

export function parseBuilding(raw: unknown): Building {
  const o = obj(raw, 'building');
  const floors = num(o.floors, 'building.floors', { int: true, min: 1 });
  const layouts = arr(o.layouts, 'building.layouts').map((l, i) =>
    parseLayout(l, `building.layouts[${i}]`),
  );
  uniqueIds(
    layouts.map((l) => l.id),
    'building.layouts',
  );
  const byId = new Map(layouts.map((l) => [l.id, l]));

  const apartments = arr(o.apartments, 'building.apartments').map((a, i): Apartment => {
    const p = `building.apartments[${i}]`;
    const ao = obj(a, p);
    const layoutId = str(ao.layoutId, `${p}.layoutId`);
    const layout = byId.get(layoutId);
    if (!layout) fail(`${p}.layoutId`, `нет планировки «${layoutId}»`);
    const { id: _layoutId, ...geometry } = layout;
    void _layoutId;
    return {
      ...geometry,
      id: str(ao.id, `${p}.id`),
      number: num(ao.number, `${p}.number`, { int: true, min: 1 }),
      floor: num(ao.floor, `${p}.floor`, { int: true, min: 1, max: floors }),
      layoutId,
      price: num(ao.price, `${p}.price`, { positive: true }),
      status: oneOf(ao.status, `${p}.status`, APARTMENT_STATUSES),
    };
  });
  uniqueIds(
    apartments.map((a) => a.id),
    'building.apartments',
  );
  uniqueIds(
    apartments.map((a) => a.number),
    'building.apartments',
  );

  return {
    complex: str(o.complex, 'building.complex'),
    section: num(o.section, 'building.section', { int: true, min: 1 }),
    floors,
    ceilingHeight: num(o.ceilingHeight, 'building.ceilingHeight', { positive: true }),
    floorPlate: parseFloorPlate(o.floorPlate, 'building.floorPlate'),
    layouts,
    apartments,
  };
}

// ---------- мебель ----------

function parseClearance(v: unknown, path: string): Clearance {
  const o = obj(v, path);
  return {
    front: num(o.front, `${path}.front`, { min: 0 }),
    sides: num(o.sides, `${path}.sides`, { min: 0 }),
    back: num(o.back, `${path}.back`, { min: 0 }),
  };
}

function parsePair(v: unknown, path: string): PairRule {
  const o = obj(v, path);
  const d = arr(o.distance, `${path}.distance`);
  if (d.length !== 2) fail(`${path}.distance`, 'ожидается [min, max]');
  const min = num(d[0], `${path}.distance[0]`, { min: 0 });
  const max = num(d[1], `${path}.distance[1]`, { min: 0 });
  if (min > max) fail(`${path}.distance`, 'min больше max');
  if (o.facing !== true) fail(`${path}.facing`, 'ожидается true');
  return { itemId: str(o.itemId, `${path}.itemId`), distance: [min, max], facing: true };
}

function parseItem(v: unknown, path: string): FurnitureItem {
  const o = obj(v, path);
  const size = arr(o.size, `${path}.size`);
  if (size.length !== 3) fail(`${path}.size`, 'ожидается [ширина, глубина, высота]');
  const item: FurnitureItem = {
    id: str(o.id, `${path}.id`),
    name: str(o.name, `${path}.name`),
    price: num(o.price, `${path}.price`, { int: true, positive: true }),
    size: [
      num(size[0], `${path}.size[0]`, { positive: true }),
      num(size[1], `${path}.size[1]`, { positive: true }),
      num(size[2], `${path}.size[2]`, { positive: true }),
    ],
    category: oneOf(o.category, `${path}.category`, FURNITURE_CATEGORIES),
    placement: oneOf(o.placement, `${path}.placement`, PLACEMENTS),
    clearance: parseClearance(o.clearance, `${path}.clearance`),
    priority: num(o.priority, `${path}.priority`, { min: 0, max: 100 }),
  };
  const model = optional(o.model, (x) => str(x, `${path}.model`));
  const color = optional(o.color, (x) => hex(x, `${path}.color`));
  const allowedRooms = optional(o.allowedRooms, (x) =>
    arr(x, `${path}.allowedRooms`).map((r, i) =>
      oneOf(r, `${path}.allowedRooms[${i}]`, ROOM_TYPES),
    ),
  );
  const group = optional(o.group, (x) => str(x, `${path}.group`));
  const pairWith = optional(o.pairWith, (x) => parsePair(x, `${path}.pairWith`));
  const blocksWindow = optional(o.blocksWindow, (x) => bool(x, `${path}.blocksWindow`));
  const compactAlt = optional(o.compactAlt, (x) => str(x, `${path}.compactAlt`));
  return {
    ...item,
    ...(model !== undefined && { model }),
    ...(color !== undefined && { color }),
    ...(allowedRooms !== undefined && { allowedRooms }),
    ...(group !== undefined && { group }),
    ...(pairWith !== undefined && { pairWith }),
    ...(blocksWindow !== undefined && { blocksWindow }),
    ...(compactAlt !== undefined && { compactAlt }),
  };
}

export function parseFurniture(raw: unknown): FurnitureCatalog {
  const o = obj(raw, 'furniture');
  const items = arr(o.items, 'furniture.items').map((x, i) =>
    parseItem(x, `furniture.items[${i}]`),
  );
  uniqueIds(
    items.map((x) => x.id),
    'furniture.items',
  );
  const byId = new Map(items.map((x) => [x.id, x]));

  items.forEach((it, i) => {
    const p = `furniture.items[${i}]`;
    if (it.compactAlt !== undefined) {
      const alt = byId.get(it.compactAlt);
      if (!alt) fail(`${p}.compactAlt`, `нет предмета «${it.compactAlt}»`);
      if (alt.id === it.id) fail(`${p}.compactAlt`, 'предмет не может быть заменой самому себе');
      if (alt.size[0] * alt.size[1] >= it.size[0] * it.size[1]) {
        fail(`${p}.compactAlt`, `замена «${alt.id}» не компактнее оригинала`);
      }
    }
    if (it.pairWith && !byId.has(it.pairWith.itemId)) {
      fail(`${p}.pairWith.itemId`, `нет предмета «${it.pairWith.itemId}»`);
    }
  });

  const presetsRaw = obj(o.presets, 'furniture.presets');
  const presets: Partial<Record<RoomType, string[]>> = {};
  for (const [key, list] of Object.entries(presetsRaw)) {
    const p = `furniture.presets.${key}`;
    const room = oneOf(key, p, ROOM_TYPES);
    presets[room] = arr(list, p).map((id, i) => {
      const itemId = str(id, `${p}[${i}]`);
      const item = byId.get(itemId);
      if (!item) fail(`${p}[${i}]`, `нет предмета «${itemId}»`);
      if (item.allowedRooms && !item.allowedRooms.includes(room)) {
        fail(`${p}[${i}]`, `«${itemId}» нельзя ставить в комнату типа ${room}`);
      }
      return itemId;
    });
  }
  return { items, byId, presets };
}

// ---------- отделка ----------

export function parseFinishes(raw: unknown): Finish[] {
  const list = arr(raw, 'finishes').map((v, i): Finish => {
    const p = `finishes[${i}]`;
    const o = obj(v, p);
    const floor = obj(o.floor, `${p}.floor`);
    return {
      id: str(o.id, `${p}.id`),
      name: str(o.name, `${p}.name`),
      pricePerM2: num(o.pricePerM2, `${p}.pricePerM2`, { min: 0 }),
      floor: { wood: hex(floor.wood, `${p}.floor.wood`), tile: hex(floor.tile, `${p}.floor.tile`) },
      wall: hex(o.wall, `${p}.wall`),
    };
  });
  if (list.length === 0) fail('finishes', 'нужна хотя бы одна отделка');
  uniqueIds(
    list.map((f) => f.id),
    'finishes',
  );
  return list;
}
