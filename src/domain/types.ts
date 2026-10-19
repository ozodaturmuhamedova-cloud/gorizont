/** Доменные типы (CLAUDE.md §5). Все размеры — в метрах, площади — в м², цены — в рублях. */

/** Точка на плане: x вправо, y вниз (в 3D: x → x, y → z). */
export type Vec2 = [number, number];

export const ROOM_TYPES = ['living', 'bedroom', 'kitchen', 'bath', 'hall', 'balcony'] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export const APARTMENT_STATUSES = ['free', 'reserved', 'sold'] as const;
export type ApartmentStatus = (typeof APARTMENT_STATUSES)[number];

/** Комнатность: 0 — студия. */
export const ROOM_COUNTS = [0, 1, 2, 3, 4] as const;
export type RoomCount = (typeof ROOM_COUNTS)[number];

export interface Room {
  id: string;
  type: RoomType;
  polygon: Vec2[];
}

/** Стена задаётся осевой линией a → b. */
export interface Wall {
  a: Vec2;
  b: Vec2;
  thickness: number;
  height: number;
}

export const OPENING_KINDS = ['door', 'window'] as const;
export type OpeningKind = (typeof OPENING_KINDS)[number];

/** Проём в стене: offset — расстояние от точки wall.a до начала проёма вдоль стены. */
export interface Opening {
  wallIndex: number;
  offset: number;
  width: number;
  kind: OpeningKind;
  /** Высота подоконника, только для окон. */
  sill?: number;
  height: number;
  /** Входная дверь квартиры (точка старта прогулки, CLAUDE.md §7.1). */
  entry?: boolean;
}

/** Типовая планировка: геометрия хранится один раз и переиспользуется на всех этажах. */
export interface Layout {
  id: string;
  rooms: RoomCount;
  area: number;
  outline: Vec2[];
  roomsGeometry: Room[];
  walls: Wall[];
  openings: Opening[];
}

export interface Apartment {
  /** "s1-f5-a3": секция-этаж-номер на этаже. */
  id: string;
  /** Сквозной номер квартиры в доме. */
  number: number;
  floor: number;
  layoutId: string;
  rooms: RoomCount;
  area: number;
  price: number;
  status: ApartmentStatus;
  outline: Vec2[];
  roomsGeometry: Room[];
  walls: Wall[];
  openings: Opening[];
}

export const CORE_TYPES = ['stairs', 'lift'] as const;
export type CoreType = (typeof CORE_TYPES)[number];

export interface FloorPlate {
  outline: Vec2[];
  corridor: Vec2[];
  core: { type: CoreType; polygon: Vec2[] }[];
}

export interface Building {
  complex: string;
  section: number;
  floors: number;
  ceilingHeight: number;
  floorPlate: FloorPlate;
  layouts: Layout[];
  apartments: Apartment[];
}

// ---------- мебель ----------

export const FURNITURE_CATEGORIES = [
  'bed',
  'sofa',
  'table',
  'chair',
  'storage',
  'tv',
  'kitchen',
  'plumbing',
  'decor',
] as const;
export type FurnitureCategory = (typeof FURNITURE_CATEGORIES)[number];

export const PLACEMENTS = ['wall', 'corner', 'center'] as const;
export type Placement = (typeof PLACEMENTS)[number];

export interface Clearance {
  front: number;
  sides: number;
  back: number;
}

export interface PairRule {
  itemId: string;
  distance: [min: number, max: number];
  facing: true;
}

export interface FurnitureItem {
  id: string;
  name: string;
  price: number;
  /** Ширина, глубина, высота. Спинка — сторона глубины с отрицательным знаком. */
  size: [w: number, d: number, h: number];
  model?: string;
  color?: string;
  allowedRooms?: RoomType[];
  category: FurnitureCategory;
  placement: Placement;
  clearance: Clearance;
  /** 0–100, больше — ставится раньше. */
  priority: number;
  group?: string;
  pairWith?: PairRule;
  blocksWindow?: boolean;
  compactAlt?: string;
}

export interface FurnitureCatalog {
  items: FurnitureItem[];
  byId: ReadonlyMap<string, FurnitureItem>;
  /** Базовый набор для кнопки «Готовый комплект» по типу комнаты. */
  presets: Partial<Record<RoomType, string[]>>;
}

export interface PlacedFurniture {
  itemId: string;
  position: Vec2;
  /** Поворот в плоскости пола, радианы. */
  rotation: number;
}

// ---------- отделка ----------

export interface Finish {
  id: string;
  name: string;
  /** Доплата за м²; 0 — входит в стоимость. */
  pricePerM2: number;
  floor: { wood: string; tile: string };
  wall: string;
}

// ---------- геометрия ----------

/** Повёрнутый прямоугольник: центр, половины сторон, поворот в радианах. */
export interface Obb {
  center: Vec2;
  half: Vec2;
  rotation: number;
}
