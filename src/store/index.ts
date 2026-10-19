/**
 * Единый стор приложения (CLAUDE.md §8), разбит на слайсы.
 * Компоненты читают его селекторами: useStore((s) => s.floor).
 */
import { create, type StateCreator } from 'zustand';
import { building, findApartment } from '../data';
import { DEFAULT_FILTERS, type ApartmentFilters } from '../domain/filters';

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

export interface UiSlice {
  hoveredId: string | null;
  setHovered: (id: string | null) => void;
}

export type StoreState = SelectionSlice & FiltersSlice & UiSlice;

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

const createUiSlice: StateCreator<StoreState, [], [], UiSlice> = (set) => ({
  hoveredId: null,
  setHovered: (id) => set({ hoveredId: id }),
});

export const useStore = create<StoreState>()((...a) => ({
  ...createSelectionSlice(...a),
  ...createFiltersSlice(...a),
  ...createUiSlice(...a),
}));

/** Начальное состояние — для сброса между тестами. */
export const initialStoreState = useStore.getState();
