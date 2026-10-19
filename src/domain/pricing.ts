import type { Apartment, Finish, FurnitureCatalog, PlacedFurniture } from './types';

export interface EstimateLine {
  itemId: string;
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface Estimate {
  apartment: number;
  finish: { id: string; name: string; perM2: number; total: number };
  furniture: EstimateLine[];
  furnitureTotal: number;
  total: number;
  /** id предметов, которых нет в каталоге: в смету не входят. */
  unknownItems: string[];
}

export function pricePerM2(apt: Pick<Apartment, 'price' | 'area'>): number {
  return Math.round(apt.price / apt.area);
}

export function finishCost(finish: Pick<Finish, 'pricePerM2'>, area: number): number {
  return Math.round(finish.pricePerM2 * area);
}

/** Смета «квартира + отделка + мебель». Одинаковые предметы сворачиваются в одну строку. */
export function estimate(
  apt: Pick<Apartment, 'price' | 'area'>,
  placed: readonly PlacedFurniture[],
  catalog: Pick<FurnitureCatalog, 'byId'>,
  finish: Finish,
): Estimate {
  const lines = new Map<string, EstimateLine>();
  const unknown = new Set<string>();
  for (const p of placed) {
    const item = catalog.byId.get(p.itemId);
    if (!item) {
      unknown.add(p.itemId);
      continue;
    }
    const line = lines.get(item.id);
    if (line) {
      line.qty += 1;
      line.total += item.price;
    } else {
      lines.set(item.id, {
        itemId: item.id,
        name: item.name,
        qty: 1,
        unitPrice: item.price,
        total: item.price,
      });
    }
  }
  const furniture = [...lines.values()].sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name, 'ru'),
  );
  const furnitureTotal = furniture.reduce((s, l) => s + l.total, 0);
  const finishTotal = finishCost(finish, apt.area);
  return {
    apartment: apt.price,
    finish: { id: finish.id, name: finish.name, perM2: finish.pricePerM2, total: finishTotal },
    furniture,
    furnitureTotal,
    total: apt.price + finishTotal + furnitureTotal,
    unknownItems: [...unknown],
  };
}
