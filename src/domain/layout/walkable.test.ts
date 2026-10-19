import { describe, expect, it } from 'vitest';
import { furniture } from '../../data';
import { rectApartment } from '../../testing/fixtures/rectRoom';
import type { FurnitureItem } from '../types';
import { collisionRadius } from '../walk';
import { shapeOf } from './fits';
import { accessBoxes, distToObb, isWalkable, pointInObb, unreachableItems } from './walkable';
import { zonesFor } from './zones';

const get = (id: string) => furniture.byId.get(id)!;
const apt = rectApartment(3, 3); // дверь вверху, x 0.3–1.1
const z = zonesFor(apt, apt.roomsGeometry[0]!);
/** Перегородка-«гарнитур» вдоль y = 1.5 шириной width от левой стены. */
const barrier = (width: number) => {
  const item: FurnitureItem = { ...get('kitchen280'), id: 'barrier', size: [width, 0.6, 2] };
  return shapeOf(item, { position: [0.1 + width / 2, 1.5], rotation: 0 });
};

describe('isWalkable', () => {
  it('точка в OBB и расстояние до OBB', () => {
    const o = {
      center: [1, 1] as [number, number],
      half: [0.5, 0.2] as [number, number],
      rotation: Math.PI / 2,
    };
    expect(pointInObb(o, [1.1, 1.4])).toBe(true);
    expect(pointInObb(o, [1.4, 1.1])).toBe(false);
    expect(distToObb(o, [1, 2])).toBeCloseTo(0.5);
  });

  it('пустая комната и предмет у стены проходимы', () => {
    expect(isWalkable(z, [], 0.22)).toBe(true);
    const wardrobe = shapeOf(get('wardrobe100'), {
      position: [1.5, 2.9 - 0.32],
      rotation: Math.PI,
    });
    expect(isWalkable(z, [wardrobe], 0.22)).toBe(true);
  });

  it('предмет за глухой перегородкой недоступен', () => {
    const wardrobe = shapeOf(get('wardrobe100'), {
      position: [1.5, 2.9 - 0.32],
      rotation: Math.PI,
    });
    expect(unreachableItems(z, [barrier(2.8), wardrobe], 0.22)).toContain(1);
  });

  it('узкий проход 0.5 м: невысокий посетитель пройдёт, крупный — нет', () => {
    const wardrobe = shapeOf(get('wardrobe100'), {
      position: [1.2, 2.9 - 0.32],
      rotation: Math.PI,
    });
    const shapes = [barrier(2.3), wardrobe];
    expect(isWalkable(z, shapes, collisionRadius(150))).toBe(true);
    expect(isWalkable(z, shapes, 0.28)).toBe(false);
  });

  it('у стула подход сзади, у кровати — сбоку', () => {
    const chair = shapeOf(get('chair'), { position: [1.5, 1.5], rotation: 0 });
    const behind = accessBoxes(chair, 0.2);
    expect(behind.some((b) => pointInObb(b, [1.5, 1.5 - 0.25 - 0.3]))).toBe(true);
    const bed = shapeOf(get('bed160'), { position: [1.5, 1.5], rotation: 0 });
    expect(accessBoxes(bed, 0.2).some((b) => pointInObb(b, [1.5 + 0.83 + 0.3, 1.5]))).toBe(true);
  });
});
