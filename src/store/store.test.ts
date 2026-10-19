import { beforeEach, describe, expect, it } from 'vitest';
import { building } from '../data';
import { initialStoreState, useStore } from './index';

const byStatus = (status: string) => building.apartments.find((a) => a.status === status)!;

describe('стор: выбор этажа и квартиры', () => {
  beforeEach(() => useStore.setState(initialStoreState, true));

  it('по умолчанию открыт верхний этаж и ничего не выбрано', () => {
    const s = useStore.getState();
    expect(s.floor).toBe(building.floors);
    expect(s.apartmentId).toBeNull();
  });

  it('выбор свободной квартиры переключает на её этаж', () => {
    const free = building.apartments.find((a) => a.status === 'free' && a.floor === 2)!;
    useStore.getState().selectApartment(free.id);
    expect(useStore.getState().apartmentId).toBe(free.id);
    expect(useStore.getState().floor).toBe(2);
  });

  it('бронь выбрать можно, проданную — нельзя', () => {
    const reserved = byStatus('reserved');
    useStore.getState().selectApartment(reserved.id);
    expect(useStore.getState().apartmentId).toBe(reserved.id);
    useStore.getState().selectApartment(byStatus('sold').id);
    expect(useStore.getState().apartmentId).toBe(reserved.id);
  });

  it('смена этажа снимает выбор, несуществующий этаж игнорируется', () => {
    useStore.getState().selectApartment(byStatus('free').id);
    useStore.getState().setFloor(3);
    expect(useStore.getState().apartmentId).toBeNull();
    useStore.getState().setFloor(99);
    expect(useStore.getState().floor).toBe(3);
  });

  it('несуществующая квартира не выбирается', () => {
    useStore.getState().selectApartment('nope');
    expect(useStore.getState().apartmentId).toBeNull();
  });
});

describe('стор: отделка и срез стен', () => {
  beforeEach(() => useStore.setState(initialStoreState, true));

  it('по умолчанию первая отделка, неизвестная игнорируется', () => {
    expect(useStore.getState().finishId).toBe('scandi');
    useStore.getState().setFinish('loft');
    expect(useStore.getState().finishId).toBe('loft');
    useStore.getState().setFinish('nope');
    expect(useStore.getState().finishId).toBe('loft');
  });

  it('срез стен включается и выключается', () => {
    useStore.getState().setWallsCut(true);
    expect(useStore.getState().wallsCut).toBe(true);
  });
});
