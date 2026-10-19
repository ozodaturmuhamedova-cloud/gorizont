/**
 * Единый стор приложения (CLAUDE.md §8), разбит на слайсы.
 * Компоненты читают его селекторами: useStore((s) => s.floor).
 */
import { create, type StateCreator } from 'zustand';
import { building, findApartment } from '../data';

export interface SelectionSlice {
  floor: number;
  apartmentId: string | null;
  setFloor: (floor: number) => void;
  /** Выбрать квартиру (проданные не выбираются) или снять выбор (null). */
  selectApartment: (id: string | null) => void;
}

export interface UiSlice {
  hoveredId: string | null;
  setHovered: (id: string | null) => void;
}

export type StoreState = SelectionSlice & UiSlice;

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

const createUiSlice: StateCreator<StoreState, [], [], UiSlice> = (set) => ({
  hoveredId: null,
  setHovered: (id) => set({ hoveredId: id }),
});

export const useStore = create<StoreState>()((...a) => ({
  ...createSelectionSlice(...a),
  ...createUiSlice(...a),
}));

/** Начальное состояние — для сброса между тестами. */
export const initialStoreState = useStore.getState();
