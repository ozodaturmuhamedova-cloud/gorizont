/**
 * Авторасстановка (§7.2): предметы по убыванию приоритета, у каждого — лучшие кандидаты
 * по оценке; при тупике откат до BACKTRACK_DEPTH предыдущих предметов, затем compactAlt,
 * затем пропуск. В конце — проверка проходимости.
 */
import type { Rng } from '../rng';
import type { Apartment, FurnitureCatalog, FurnitureItem, PlacedFurniture, Room } from '../types';
import { collisionRadius } from '../walk';
import { candidatesFor, relativeCandidates } from './candidates';
import { fits, shapeOf, violations, type Shape } from './fits';
import { freeChairSlots, scoreCandidate, W } from './score';
import {
  blockedDoors,
  unreachableItems,
  WALK_CHECK_HEIGHT_CM,
  WALK_PASS_HEIGHT_CM,
} from './walkable';
import { zonesFor, type RoomZones } from './zones';

/** Сколько лучших кандидатов помнить для отката. */
export const TOP_K = 3;
/** Насколько далеко назад можно откатываться. */
export const BACKTRACK_DEPTH = 3;
/** Всего попыток (подборов кандидатов) на комнату. */
export const LAYOUT_BUDGET = 200;
/** Запас к радиусу крупного посетителя при проверке прохода между дверями, м. */
export const PASS_MARGIN = 0.08;
/** Меньше стольких стульев стол не ставится (§7.2, «Группы»). */
export const MIN_CHAIRS = 2;
/** Сколько лучших кандидатов проверять на проходимость. */
export const WALK_CHECKS = 12;

export type SkipReason = 'noSpace' | 'noAccess';

export interface SkippedItem {
  itemId: string;
  roomId: string;
  reason: SkipReason;
}

export interface RoomLayout {
  roomId: string;
  placed: PlacedFurniture[];
  shapes: Shape[];
  skipped: SkippedItem[];
  score: number;
}

export interface LayoutOptions {
  /** Случайная добавка к оценке; 0 — без случайности. */
  jitter?: number;
  budget?: number;
}

interface Option {
  shape: Shape;
  score: number;
}

interface Step {
  /** Что просили поставить (для отчёта). */
  wanted: FurnitureItem;
  options: Option[];
  pick: number;
  /** Поставлен в тесном режиме. */
  tight: boolean;
}

const area = (i: FurnitureItem) => i.size[0] * i.size[1];

/** Предмет, без которого этот не ставится: стул — без стола своей группы и т. п. */
function anchorOf(item: FurnitureItem, all: readonly FurnitureItem[]): FurnitureItem | undefined {
  if (item.category === 'chair') {
    return all.find((a) => a.category === 'table' && a.group === item.group);
  }
  if (item.category === 'storage' && item.group === 'sleep')
    return all.find((a) => a.category === 'bed');
  if (item.category === 'table' && item.group === 'lounge') {
    return all.find((a) => a.category === 'sofa' && a.pairWith);
  }
  return undefined;
}

/** Порядок расстановки: приоритет по убыванию, затем площадь следа по убыванию. */
export function layoutOrder(items: readonly FurnitureItem[]): FurnitureItem[] {
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => b.item.priority - a.item.priority || area(b.item) - area(a.item) || a.i - b.i)
    .map((x) => x.item);
}

export function autoLayout(
  apt: Apartment,
  room: Room,
  items: readonly FurnitureItem[],
  catalog: Pick<FurnitureCatalog, 'byId'>,
  rng: Rng,
  opts: LayoutOptions = {},
): RoomLayout {
  const z: RoomZones = zonesFor(apt, room);
  const order = layoutOrder(items);
  const ctxBase = { zones: z, rng, jitter: opts.jitter };
  let budget = opts.budget ?? LAYOUT_BUDGET;
  const radius = collisionRadius(WALK_CHECK_HEIGHT_CM);
  // между дверями проходной комнаты должен пройти и крупный посетитель
  // (с запасом на дискретность сетки: прогулка проверяет путь своей сеткой)
  const passRadius = collisionRadius(WALK_PASS_HEIGHT_CM) + PASS_MARGIN;

  const companionsOf = (item: FurnitureItem) =>
    item.group
      ? order.filter((o) => o !== item && o.group === item.group && o.priority < item.priority)
      : [];

  /**
   * Лучшие кандидаты, к которым можно подойти. tight — тесная комната: зоны подхода
   * разных предметов могут заходить друг на друга (с штрафом), но доступ к каждому
   * предмету по-прежнему проверяется поиском пути.
   */
  const optionsFor = (item: FurnitureItem, placed: readonly Shape[], tight: boolean): Option[] => {
    budget--;
    const relative = relativeCandidates(item, placed);
    const poses = relative ?? (anchorOf(item, order) ? [] : candidatesFor(item, z, placed));
    const companions = companionsOf(item);
    const chairs = companions.filter((c) => c.category === 'chair');
    // группа «стол + стулья» ставится, только если встанут хотя бы два стула
    const needSlots = Math.min(MIN_CHAIRS, chairs.length);
    const out: Option[] = [];
    poses.forEach((pose, slot) => {
      const shape = shapeOf(item, pose);
      if (!fits(shape, z, placed, tight ? 'tight' : 'door')) return;
      if (needSlots > 0 && freeChairSlots(shape, chairs[0]!, z, placed) < needSlots) return;
      let score = scoreCandidate(shape, { ...ctxBase, placed, companions });
      if (relative) score += slot * W.CHAIR_SLOT;
      if (tight) score += W.TIGHT * violations(shape, z, placed).length;
      out.push({ shape, score });
    });
    // проходимость проверяем только у лучших: поиск в ширину дороже проверки правил
    out.sort((a, b) => b.score - a.score);
    const walkable: Option[] = [];
    for (let k = 0; k < out.length && k < WALK_CHECKS && walkable.length < TOP_K; k++) {
      const o = out[k]!;
      const all = [...placed, o.shape];
      if (unreachableItems(z, all, radius).length === 0 && blockedDoors(z, all, passRadius) === 0) {
        walkable.push(o);
      }
    }
    return walkable;
  };

  const shapesOf = (steps: readonly Step[]) => steps.map((s) => s.options[s.pick]!.shape);

  /** Переставить rest жадно поверх steps, затем item; null — что-то не встало. */
  const greedy = (steps: Step[], rest: readonly Step[], item: FurnitureItem): Step[] | null => {
    const out = [...steps];
    const todo = [
      ...rest.map((r) => ({
        item: r.options[r.pick]!.shape.item,
        wanted: r.wanted,
        tight: r.tight,
      })),
      { item, wanted: item, tight: false },
    ];
    for (const t of todo) {
      if (budget <= 0) return null;
      const options = optionsFor(t.item, shapesOf(out), t.tight);
      if (options.length === 0) return null;
      out.push({ wanted: t.wanted, options, pick: 0, tight: t.tight });
    }
    return out;
  };

  /** Откат: поменять кандидата у одного из последних предметов и переставить следующие. */
  const backtrack = (steps: Step[], item: FurnitureItem): Step[] | null => {
    for (let depth = 1; depth <= BACKTRACK_DEPTH && depth <= steps.length; depth++) {
      const j = steps.length - depth;
      const step = steps[j]!;
      for (let p = step.pick + 1; p < step.options.length; p++) {
        if (budget <= 0) return null;
        const base = [...steps.slice(0, j), { ...step, pick: p }];
        const done = greedy(base, steps.slice(j + 1), item);
        if (done) return done;
      }
    }
    return null;
  };

  /** Цепочка замен: сам предмет, его compactAlt, compactAlt замены… */
  const chainOf = (item: FurnitureItem): FurnitureItem[] => {
    const out = [item];
    for (let alt = item.compactAlt; alt; ) {
      const next = catalog.byId.get(alt);
      if (!next || out.includes(next)) break;
      out.push(next);
      alt = next.compactAlt;
    }
    return out;
  };

  /** Обычный режим: предмет → откат → компактная замена; затем то же в тесном режиме. */
  const place = (steps: Step[], wanted: FurnitureItem): Step[] | null => {
    for (const tight of [false, true]) {
      for (const item of chainOf(wanted)) {
        if (budget <= 0) return null;
        const options = optionsFor(item, shapesOf(steps), tight);
        if (options.length > 0) return [...steps, { wanted, options, pick: 0, tight }];
        if (tight) continue;
        const redone = backtrack(steps, item);
        if (redone) {
          redone[redone.length - 1]!.wanted = wanted;
          return redone;
        }
      }
    }
    return null;
  };

  let steps: Step[] = [];
  const skipped: SkippedItem[] = [];
  for (const wanted of order) {
    const next = place(steps, wanted);
    if (next) steps = next;
    else skipped.push({ itemId: wanted.id, roomId: room.id, reason: 'noSpace' });
  }

  // страховка: каждый шаг уже проверен на проходимость, но откат мог её нарушить —
  // тогда убираем недоступный предмет с наименьшим приоритетом
  while (steps.length > 0) {
    const shapes = shapesOf(steps);
    const bad = unreachableItems(z, shapes, radius);
    if (bad.length === 0 && blockedDoors(z, shapes, passRadius) === 0) break;
    // недоступный предмет с наименьшим приоритетом, а если отрезаны двери — последний поставленный
    const candidates = bad.length > 0 ? bad : [steps.length - 1];
    const worst = candidates.reduce((a, b) =>
      steps[b]!.wanted.priority <= steps[a]!.wanted.priority ? b : a,
    );
    skipped.push({ itemId: steps[worst]!.wanted.id, roomId: room.id, reason: 'noAccess' });
    steps = steps.filter((_, i) => i !== worst);
  }

  const shapes = shapesOf(steps);
  return {
    roomId: room.id,
    shapes,
    placed: shapes.map((s) => ({
      itemId: s.item.id,
      position: [round3(s.pose.position[0]), round3(s.pose.position[1])],
      rotation: s.pose.rotation,
    })),
    skipped,
    score: steps.reduce((sum, s) => sum + s.options[s.pick]!.score, 0),
  };
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;

export interface ApartmentLayout {
  placed: PlacedFurniture[];
  skipped: SkippedItem[];
  rooms: RoomLayout[];
}

/** Набор предметов для комнаты по presets; в студии кухня — часть гостиной. */
export function presetFor(apt: Apartment, room: Room, catalog: FurnitureCatalog): FurnitureItem[] {
  const ids = [...(catalog.presets[room.type] ?? [])];
  const hasKitchen = apt.roomsGeometry.some((r) => r.type === 'kitchen');
  if (!hasKitchen && room.type === 'living') ids.push(...(catalog.presets.kitchen ?? []));
  return ids.map((id) => catalog.byId.get(id)).filter((x): x is FurnitureItem => !!x);
}

/** «Готовый комплект»: autoLayout по каждой комнате с набором из presets (или своим). */
export function furnishApartment(
  apt: Apartment,
  catalog: FurnitureCatalog,
  rng: Rng,
  itemsFor: (room: Room) => FurnitureItem[] = (room) => presetFor(apt, room, catalog),
  opts: LayoutOptions = {},
): ApartmentLayout {
  const rooms = apt.roomsGeometry.map((room) =>
    autoLayout(apt, room, itemsFor(room), catalog, rng, opts),
  );
  return {
    rooms,
    placed: rooms.flatMap((r) => r.placed),
    skipped: rooms.flatMap((r) => r.skipped),
  };
}
