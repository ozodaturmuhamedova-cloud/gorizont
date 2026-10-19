import { beforeEach, describe, expect, it } from 'vitest';
import { building, findApartment } from '../data';
import { ROTATE_STEP } from '../domain/constants';
import { zonesFor } from '../domain/layout';
import type { Vec2 } from '../domain/types';
import { checkPose, removeSelected, rotateSelected } from './furnishActions';
import { STORAGE_KEY, initialStoreState, persistedPart, useStore } from './index';

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

describe('стор: мебель', () => {
  const APT = 's1-f9-a3';
  const apt = findApartment(APT)!;
  const bedroom = apt.roomsGeometry.find((r) => r.type === 'bedroom')!;
  const at = (x: number, y: number, rotation = 0) => ({ position: [x, y] as Vec2, rotation });

  beforeEach(() => {
    localStorage.clear();
    useStore.setState(initialStoreState, true);
  });

  it('добавить, передвинуть, удалить; добавленный предмет выбирается', () => {
    const s = useStore.getState();
    s.addFurniture(APT, { itemId: 'dresser', ...at(1, 1) });
    s.addFurniture(APT, { itemId: 'chair', ...at(2, 2) });
    expect(useStore.getState().selectedFurniture).toBe(1);
    s.moveFurniture(APT, 0, at(3, 3, 1));
    expect(useStore.getState().placed[APT]![0]).toEqual({ itemId: 'dresser', ...at(3, 3, 1) });
    s.removeFurniture(APT, 0);
    expect(useStore.getState().placed[APT]!.map((p) => p.itemId)).toEqual(['chair']);
    expect(useStore.getState().selectedFurniture).toBeNull();
  });

  it('готовый комплект заменяет расстановку и запоминает, что не поместилось', () => {
    const s = useStore.getState();
    s.addFurniture(APT, { itemId: 'dresser', ...at(1, 1) });
    s.setFurniture(
      APT,
      [{ itemId: 'bed160', ...at(5, 5) }],
      [{ itemId: 'washer', roomId: 'bath', reason: 'noSpace' }],
    );
    expect(useStore.getState().placed[APT]).toHaveLength(1);
    expect(useStore.getState().skipped[APT]).toHaveLength(1);
  });

  it('выбор предмета каталога снимает выбор поставленного', () => {
    const s = useStore.getState();
    s.addFurniture(APT, { itemId: 'dresser', ...at(1, 1) });
    s.setPlacing('chair');
    expect(useStore.getState().placingItemId).toBe('chair');
    expect(useStore.getState().selectedFurniture).toBeNull();
  });

  it('в localStorage сохраняются мебель и отделка, но не квартиры /dev/random', () => {
    const s = useStore.getState();
    s.setFinish('loft');
    s.addFurniture(APT, { itemId: 'dresser', ...at(1, 1) });
    s.addFurniture('rnd-5-any-any-normal', { itemId: 'chair', ...at(1, 1) });
    const saved = persistedPart(useStore.getState());
    expect(saved.finishId).toBe('loft');
    expect(Object.keys(saved.placed)).toEqual([APT]);
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as { state?: unknown };
    expect(raw.state).toEqual(saved);
  });

  it('поворот выбранного: шаг 15°, в стену не поворачивается', () => {
    const z = zonesFor(apt, bedroom);
    const cx = (z.inner.min[0] + z.inner.max[0]) / 2;
    const cy = (z.inner.min[1] + z.inner.max[1]) / 2;
    useStore.getState().addFurniture(APT, { itemId: 'dresser', ...at(cx, cy) });
    const r = rotateSelected(apt, 1);
    expect(r?.check.status).not.toBe('error');
    expect(useStore.getState().placed[APT]![0]!.rotation).toBeCloseTo(ROTATE_STEP);
    // шкаф вплотную к стене: поворот упёр бы его в стену — остаётся как был
    const wall = {
      itemId: 'wardrobe160',
      position: [cx, z.inner.min[1] + 0.32] as Vec2,
      rotation: 0,
    };
    useStore.getState().setFurniture(APT, [wall]);
    useStore.getState().selectFurniture(0);
    expect(rotateSelected(apt, 1)?.check.status).toBe('error');
    expect(useStore.getState().placed[APT]![0]!.rotation).toBe(0);
    removeSelected(apt);
    expect(useStore.getState().placed[APT]).toEqual([]);
  });

  it('checkPose: притяжение к стене и статус', () => {
    const z = zonesFor(apt, bedroom);
    const cx = (z.inner.min[0] + z.inner.max[0]) / 2;
    const c = checkPose(apt, 'dresser', at(cx, z.inner.min[1] + 0.3, 0.2))!;
    expect(c.pose.rotation).toBe(0);
    expect(c.check.status).toBe('ok');
    expect(checkPose(apt, 'nope', at(0, 0))).toBeNull();
  });
});
