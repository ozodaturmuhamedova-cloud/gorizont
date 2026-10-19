/**
 * Инварианты квартиры и расстановки (CLAUDE.md §10.1). Возвращают список нарушений:
 * пустой список — всё в порядке. Работают и на сгенерированных, и на реальных данных.
 */
import { AREA_TOLERANCE, EPS, WALL_EXTERIOR } from '../../domain/constants';
import {
  bbox,
  footprintObb,
  obbCorners,
  obbsOverlap,
  pointInPolygon,
  polygonArea,
  rectIntersectsWall,
  wallDir,
  wallLength,
} from '../../domain/geometry';
import { AREA_LIMITS, STUDIO_LIVING_MIN } from './roomsGen';
import type {
  Apartment,
  FurnitureCatalog,
  Obb,
  Opening,
  PlacedFurniture,
  Room,
  Vec2,
  Wall,
} from '../../domain/types';

/** Проём должен отстоять от конца стены хотя бы на столько, м. */
export const CORNER_MARGIN = 0.05;
/** Допуск между суммой площадей комнат и площадью контура, м². */
export const OUTLINE_AREA_TOLERANCE = 0.1;
/** Глубина зоны перед окном, где нельзя ставить высокую мебель, м. */
export const WINDOW_ZONE_DEPTH = 0.5;
const PROBE = 0.05;

const HABITABLE = new Set(['living', 'bedroom', 'kitchen']);

function isAxisRect(poly: readonly Vec2[]): boolean {
  if (poly.length !== 4) return false;
  const { min, max } = bbox(poly);
  return Math.abs(polygonArea(poly) - (max[0] - min[0]) * (max[1] - min[1])) < EPS;
}

function rectOverlapArea(a: readonly Vec2[], b: readonly Vec2[]): number {
  const A = bbox(a);
  const B = bbox(b);
  const w = Math.min(A.max[0], B.max[0]) - Math.max(A.min[0], B.min[0]);
  const h = Math.min(A.max[1], B.max[1]) - Math.max(A.min[1], B.min[1]);
  return w > 0 && h > 0 ? w * h : 0;
}

function roomAt(rooms: readonly Room[], p: Vec2): Room | undefined {
  return rooms.find((r) => pointInPolygon(p, r.polygon));
}

/** Точки по обе стороны от середины проёма — чтобы понять, какие комнаты он соединяет. */
function probes(w: Wall, o: Opening): [Vec2, Vec2] {
  const [dx, dy] = wallDir(w);
  const t = o.offset + o.width / 2;
  const mid: Vec2 = [w.a[0] + dx * t, w.a[1] + dy * t];
  const off = w.thickness / 2 + PROBE;
  return [
    [mid[0] - dy * off, mid[1] + dx * off],
    [mid[0] + dy * off, mid[1] - dx * off],
  ];
}

/** Зона проёма: прямоугольник вдоль стены шириной проёма и глубиной depth по обе стороны. */
function openingZone(w: Wall, o: Opening, depth: number): Obb {
  const [dx, dy] = wallDir(w);
  const t = o.offset + o.width / 2;
  return {
    center: [w.a[0] + dx * t, w.a[1] + dy * t],
    half: [o.width / 2, w.thickness / 2 + depth],
    rotation: Math.atan2(dy, dx),
  };
}

/** Зоны перед дверями: квадрат «ширина × ширина» с каждой стороны (§7.2). */
export function doorZones(apt: Pick<Apartment, 'walls' | 'openings'>): Obb[] {
  return apt.openings
    .filter((o) => o.kind === 'door')
    .map((o) => openingZone(apt.walls[o.wallIndex]!, o, o.width));
}

export function windowZones(apt: Pick<Apartment, 'walls' | 'openings'>): Obb[] {
  return apt.openings
    .filter((o) => o.kind === 'window')
    .map((o) => openingZone(apt.walls[o.wallIndex]!, o, WINDOW_ZONE_DEPTH));
}

export interface DoorGraph {
  /** Комната, в которую ведёт входная дверь. */
  entryRoom: Room | undefined;
  /** Смежность комнат через двери: id → множество id. */
  links: Map<string, Set<string>>;
  /** Двери, которые никуда не ведут (кроме входной). */
  dangling: number[];
}

export function doorGraph(apt: Apartment): DoorGraph {
  const links = new Map(apt.roomsGeometry.map((r) => [r.id, new Set<string>()]));
  let entryRoom: Room | undefined;
  const dangling: number[] = [];
  apt.openings.forEach((o, k) => {
    if (o.kind !== 'door') return;
    const w = apt.walls[o.wallIndex];
    if (!w) return;
    const [p1, p2] = probes(w, o);
    const r1 = roomAt(apt.roomsGeometry, p1);
    const r2 = roomAt(apt.roomsGeometry, p2);
    if (r1 && r2 && r1 !== r2) {
      links.get(r1.id)!.add(r2.id);
      links.get(r2.id)!.add(r1.id);
    } else if (o.entry && (r1 ?? r2)) {
      entryRoom = r1 ?? r2;
    } else {
      dangling.push(k);
    }
  });
  return { entryRoom, links, dangling };
}

/** Нарушения в геометрии квартиры. */
export function apartmentViolations(apt: Apartment): string[] {
  const v: string[] = [];
  const rooms = apt.roomsGeometry;

  // площади
  const roomsArea = rooms.reduce((s, r) => s + polygonArea(r.polygon), 0);
  const outlineArea = polygonArea(apt.outline);
  if (Math.abs(roomsArea - outlineArea) > OUTLINE_AREA_TOLERANCE) {
    v.push(
      `площадь комнат ${roomsArea.toFixed(2)} м² ≠ площади контура ${outlineArea.toFixed(2)} м²`,
    );
  }
  if (Math.abs(roomsArea - apt.area) > AREA_TOLERANCE) {
    v.push(`area ${apt.area} м² ≠ площади комнат ${roomsArea.toFixed(2)} м²`);
  }

  // комнаты в контуре и без наложений
  for (const r of rooms) {
    if (!r.polygon.every((p) => pointInPolygon(p, apt.outline))) {
      v.push(`комната «${r.id}» выходит за контур квартиры`);
    }
  }
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i]!;
      const b = rooms[j]!;
      if (isAxisRect(a.polygon) && isAxisRect(b.polygon)) {
        const overlap = rectOverlapArea(a.polygon, b.polygon);
        if (overlap > EPS)
          v.push(`комнаты «${a.id}» и «${b.id}» пересекаются (${overlap.toFixed(2)} м²)`);
      }
    }
  }

  // проёмы
  apt.openings.forEach((o, k) => {
    const w = apt.walls[o.wallIndex];
    if (!w) {
      v.push(`проём #${k}: нет стены ${o.wallIndex}`);
      return;
    }
    const len = wallLength(w);
    if (o.offset < CORNER_MARGIN - EPS || o.offset + o.width > len - CORNER_MARGIN + EPS) {
      v.push(`проём #${k} заходит на угол или за стену`);
    }
    if ((o.sill ?? 0) + o.height > w.height + EPS) v.push(`проём #${k} выше стены`);
    if (o.kind === 'window' && w.thickness < WALL_EXTERIOR - EPS) {
      v.push(`окно #${k} во внутренней стене`);
    }
  });
  const entries = apt.openings.filter((o) => o.entry).length;
  if (entries !== 1) v.push(`входных дверей ${entries}, нужна одна`);

  // достижимость
  const g = doorGraph(apt);
  for (const k of g.dangling) v.push(`дверь #${k} никуда не ведёт`);
  if (!g.entryRoom) {
    v.push('входная дверь не ведёт ни в одну комнату');
  } else {
    if (g.entryRoom.type !== 'hall') v.push(`вход ведёт не в прихожую, а в «${g.entryRoom.id}»`);
    const seen = new Set([g.entryRoom.id]);
    const queue = [g.entryRoom.id];
    while (queue.length) {
      for (const n of g.links.get(queue.shift()!) ?? []) {
        if (!seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
    for (const r of rooms) if (!seen.has(r.id)) v.push(`комната «${r.id}» недостижима из прихожей`);
  }
  for (const r of rooms) {
    if (r.type === 'bath' && (g.links.get(r.id)?.size ?? 0) > 1) {
      v.push(`санузел «${r.id}» проходной`);
    }
  }

  // окна в жилых комнатах и кухне
  for (const r of rooms.filter((x) => HABITABLE.has(x.type))) {
    const lit = apt.openings.some((o) => {
      if (o.kind !== 'window') return false;
      const w = apt.walls[o.wallIndex];
      return w !== undefined && probes(w, o).some((p) => pointInPolygon(p, r.polygon));
    });
    if (!lit) v.push(`в комнате «${r.id}» нет окна`);
  }
  return v;
}

export interface FurnitureViolation {
  /** Индекс предмета в массиве placed. */
  index: number;
  message: string;
}

/** Нарушения в расстановке мебели. */
export function furnitureViolations(
  apt: Apartment,
  placed: readonly PlacedFurniture[],
  catalog: Pick<FurnitureCatalog, 'byId'>,
): FurnitureViolation[] {
  const out: FurnitureViolation[] = [];
  const doors = doorZones(apt);
  const windows = windowZones(apt);
  const fps = placed.map((p) => {
    const item = catalog.byId.get(p.itemId);
    return item ? footprintObb(item.size, p.position, p.rotation) : null;
  });

  placed.forEach((p, i) => {
    const item = catalog.byId.get(p.itemId);
    const fp = fps[i];
    if (!item || !fp) {
      out.push({ index: i, message: `предмета «${p.itemId}» нет в каталоге` });
      return;
    }
    const name = `«${item.name}» (#${i})`;
    const room = roomAt(apt.roomsGeometry, p.position);
    if (!room) out.push({ index: i, message: `${name} вне комнат` });
    else if (!obbCorners(fp).every((c) => pointInPolygon(c, room.polygon))) {
      out.push({ index: i, message: `${name} выходит за комнату «${room.id}»` });
    }
    if (apt.walls.some((w) => rectIntersectsWall(fp, w))) {
      out.push({ index: i, message: `${name} пересекает стену` });
    }
    fps.forEach((other, j) => {
      if (j !== i && other && obbsOverlap(fp, other)) {
        out.push({ index: i, message: `${name} пересекается с предметом #${j}` });
      }
    });
    if (doors.some((z) => obbsOverlap(fp, z))) {
      out.push({ index: i, message: `${name} перекрывает дверь` });
    }
    if (item.blocksWindow && windows.some((z) => obbsOverlap(fp, z))) {
      out.push({ index: i, message: `${name} перекрывает окно` });
    }
  });
  return out;
}

/**
 * Правдоподобие размеров помещений сгенерированной квартиры (те же пределы, что в генераторе).
 * Только для случайных квартир: реальные планировки могут быть шире (например, холл 17 м² в 3к).
 */
export function plausibilityViolations(apt: Apartment): string[] {
  return apt.roomsGeometry.flatMap((r) => {
    const a = polygonArea(r.polygon);
    const [lo, hi] = AREA_LIMITS[r.type];
    const min = apt.rooms === 0 && r.type === 'living' ? STUDIO_LIVING_MIN : lo;
    return a < min - EPS || a > hi + EPS
      ? [`«${r.id}» ${a.toFixed(1)} м² вне ${min}–${hi} м²`]
      : [];
  });
}
