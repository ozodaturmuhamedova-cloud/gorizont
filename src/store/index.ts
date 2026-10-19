/**
 * Единый стор приложения (CLAUDE.md §8), разбит на слайсы.
 * Компоненты читают его селекторами: useStore((s) => s.floor).
 */
import { create, type StateCreator } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { building, defaultFinish, findApartment, findFinish } from '../data';
import { DEFAULT_FILTERS, type ApartmentFilters } from '../domain/filters';
import type { SkippedItem } from '../domain/layout';
import type { PlacedFurniture, RoomType } from '../domain/types';

export interface SelectionSlice {
  floor: number;
  apartmentId: string | null;
  setFloor: (floor: number) => void;
  /** Выбрать квартиру (проданные не выбираются) или снять выбор (null). */
  selectApartment: (id: string | null) => void;
}

export interface FiltersSlice {
  filters: ApartmentFilters;
  /** Частичное обновление: setFilters({ onlyFree: true }). Выбор квартиры не сбрасывается. */
  setFilters: (patch: Partial<ApartmentFilters>) => void;
  resetFilters: () => void;
}

export interface FurnishSlice {
  finishId: string;
  setFinish: (id: string) => void;
  /** Расставленная мебель по квартирам. Сохраняется в localStorage вместе с отделкой. */
  placed: Record<string, PlacedFurniture[]>;
  /** Что не поместилось при последнем «Готовом комплекте». */
  skipped: Record<string, SkippedItem[]>;
  addFurniture: (aptId: string, p: PlacedFurniture) => void;
  /** Новая позиция и поворот предмета с индексом index. */
  moveFurniture: (aptId: string, index: number, pose: Omit<PlacedFurniture, 'itemId'>) => void;
  removeFurniture: (aptId: string, index: number) => void;
  /** Заменить всю расстановку (готовый комплект, очистка). */
  setFurniture: (aptId: string, list: PlacedFurniture[], skipped?: SkippedItem[]) => void;
}

export interface UiSlice {
  hoveredId: string | null;
  setHovered: (id: string | null) => void;
  /** 3D: «срез стен» — стены по пояс, чтобы видеть комнаты сверху. */
  wallsCut: boolean;
  setWallsCut: (cut: boolean) => void;
  /** Предмет каталога, который сейчас ставят (следует за курсором). */
  placingItemId: string | null;
  setPlacing: (id: string | null) => void;
  /** Индекс выбранного предмета в placed[apartmentId]. */
  selectedFurniture: number | null;
  selectFurniture: (index: number | null) => void;
  /** Вкладка каталога. */
  catalogRoom: RoomType;
  setCatalogRoom: (room: RoomType) => void;
}

export type StoreState = SelectionSlice & FiltersSlice & FurnishSlice & UiSlice;

const createSelectionSlice: StateCreator<StoreState, [], [], SelectionSlice> = (set) => ({
  floor: building.floors,
  apartmentId: null,
  setFloor: (floor) =>
    set((s) =>
      floor === s.floor || floor < 1 || floor > building.floors
        ? s
        : { floor, apartmentId: null, hoveredId: null },
    ),
  selectApartment: (id) =>
    set((s) => {
      if (id === null) return { apartmentId: null };
      const apt = findApartment(id);
      if (!apt || apt.status === 'sold') return s;
      return { apartmentId: id, floor: apt.floor };
    }),
});

const createFiltersSlice: StateCreator<StoreState, [], [], FiltersSlice> = (set) => ({
  filters: DEFAULT_FILTERS,
  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  resetFilters: () => set({ filters: DEFAULT_FILTERS }),
});

const createFurnishSlice: StateCreator<StoreState, [], [], FurnishSlice> = (set) => {
  const update = (aptId: string, fn: (list: PlacedFurniture[]) => PlacedFurniture[]) =>
    set((s) => ({ placed: { ...s.placed, [aptId]: fn(s.placed[aptId] ?? []) } }));
  return {
    finishId: defaultFinish.id,
    setFinish: (id) => set((s) => (findFinish(id) ? { finishId: id } : s)),
    placed: {},
    skipped: {},
    addFurniture: (aptId, p) => {
      update(aptId, (list) => [...list, p]);
      set((s) => ({ selectedFurniture: (s.placed[aptId]?.length ?? 1) - 1 }));
    },
    moveFurniture: (aptId, index, pose) =>
      update(aptId, (list) => list.map((p, i) => (i === index ? { ...p, ...pose } : p))),
    removeFurniture: (aptId, index) => {
      update(aptId, (list) => list.filter((_, i) => i !== index));
      set({ selectedFurniture: null });
    },
    setFurniture: (aptId, list, skipped = []) =>
      set((s) => ({
        placed: { ...s.placed, [aptId]: list },
        skipped: { ...s.skipped, [aptId]: skipped },
        selectedFurniture: null,
      })),
  };
};

const createUiSlice: StateCreator<StoreState, [], [], UiSlice> = (set) => ({
  hoveredId: null,
  setHovered: (id) => set({ hoveredId: id }),
  wallsCut: false,
  setWallsCut: (cut) => set({ wallsCut: cut }),
  placingItemId: null,
  setPlacing: (id) => set({ placingItemId: id, selectedFurniture: null }),
  selectedFurniture: null,
  selectFurniture: (index) => set({ selectedFurniture: index }),
  catalogRoom: 'living',
  setCatalogRoom: (room) => set({ catalogRoom: room }),
});

/** Ключ в localStorage. */
export const STORAGE_KEY = 'gorizont';
/** Квартиры /dev/random не сохраняются. */
const isTransient = (aptId: string) => aptId.startsWith('rnd');

/** Что сохраняется между визитами: мебель и отделка (CLAUDE.md §8). */
export function persistedPart(s: StoreState): Pick<StoreState, 'placed' | 'finishId'> {
  return {
    finishId: s.finishId,
    placed: Object.fromEntries(Object.entries(s.placed).filter(([id]) => !isTransient(id))),
  };
}

export const useStore = create<StoreState>()(
  persist(
    (...a) => ({
      ...createSelectionSlice(...a),
      ...createFiltersSlice(...a),
      ...createFurnishSlice(...a),
      ...createUiSlice(...a),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: persistedPart,
      merge: (saved, current) => {
        const s = (saved ?? {}) as Partial<StoreState>;
        return {
          ...current,
          finishId: s.finishId && findFinish(s.finishId) ? s.finishId : current.finishId,
          placed: s.placed && typeof s.placed === 'object' ? s.placed : current.placed,
        };
      },
    },
  ),
);

/** Начальное состояние — для сброса между тестами. */
export const initialStoreState = useStore.getState();
