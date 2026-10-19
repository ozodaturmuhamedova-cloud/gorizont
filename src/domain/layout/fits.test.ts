/**
 * След, зона подхода и таблица правил §7.2 — по тесту на строку.
 */
import { describe, expect, it } from 'vitest';
import { building, furniture } from '../../data';
import { rectApartment } from '../../testing/fixtures/rectRoom';
import { bbox, obbCorners } from '../geometry';
import type { FurnitureItem, Obb } from '../types';
import { WALL_GAP } from './candidates';
import { clearanceBox, fits, footprint, shapeOf, violations, type Pose, type Rule } from './fits';
import { validatePlacement } from './validate';
import { zonesFor } from './zones';

const get = (id: string): FurnitureItem => {
  const item = furniture.byId.get(id);
  if (!item) throw new Error(id);
  return item;
};
const box = (o: Obb) => {
  const b = bbox(obbCorners(o));
  return [b.min[0], b.min[1], b.max[0], b.max[1]].map((v) => Math.round(v * 1000) / 1000);
};
const rules = (
  item: FurnitureItem,
  pose: Pose,
  others: [FurnitureItem, Pose][] = [],
  apt = room4,
) =>
  violations(
    shapeOf(item, pose),
    zonesFor(apt, apt.roomsGeometry[0]!),
    others.map(([i, p]) => shapeOf(i, p)),
  ).map((v) => v.rule);

// 4 × 4 м: пол [0.1, 3.9]², дверь в левой стене (y 0.3–1.1), окно в нижней (x 1.5–2.7)
const room4 = rectApartment(4, 4, [
  { wall: 'left', offset: 0.3, width: 0.8, kind: 'door' },
  { wall: 'bottom', offset: 1.5, width: 1.2, kind: 'window' },
]);
const wardrobe = get('wardrobe160'); // 1.6 × 0.6, перед 0.9, blocksWindow
const dresser = get('dresser'); // 1.0 × 0.45, перед 0.7
/** Шкаф спинкой к верхней стене, x = 2.5. */
const atTop = (item: FurnitureItem, x = 2.5): Pose => ({
  position: [x, 0.1 + item.size[1] / 2 + WALL_GAP],
  rotation: 0,
});

describe('след и зона подхода', () => {
  it('clearanceBox при повороте 0/90/180/270° вытянут вперёд предмета', () => {
    const at = (rotation: number) => box(clearanceBox(wardrobe, { position: [2, 2], rotation }));
    // ширина 1.6, глубина 0.6 + перед 0.9
    expect(at(0)).toEqual([1.2, 1.7, 2.8, 3.2]);
    expect(at(Math.PI / 2)).toEqual([0.8, 1.2, 2.3, 2.8]);
    expect(at(Math.PI)).toEqual([1.2, 0.8, 2.8, 2.3]);
    expect(at((3 * Math.PI) / 2)).toEqual([1.7, 1.2, 3.2, 2.8]);
  });

  it('footprint — ширина × глубина с поворотом', () => {
    expect(box(footprint(wardrobe, { position: [2, 2], rotation: 0 }))).toEqual([
      1.2, 1.7, 2.8, 2.3,
    ]);
    expect(box(footprint(wardrobe, { position: [2, 2], rotation: Math.PI / 2 }))).toEqual([
      1.7, 1.2, 2.3, 2.8,
    ]);
  });
});

describe('таблица правил §7.2', () => {
  it('footprint × footprint — никогда', () => {
    expect(rules(dresser, atTop(dresser), [[wardrobe, atTop(wardrobe)]])).toContain<Rule>(
      'overlap',
    );
  });

  it('footprint × чужая зона подхода — нельзя (с обеих сторон)', () => {
    const inFront: Pose = { position: [2.5, 1.3], rotation: 0 };
    expect(rules(dresser, inFront, [[wardrobe, atTop(wardrobe)]])).toContain<Rule>('blocksAccess');
    expect(rules(wardrobe, atTop(wardrobe), [[dresser, inFront]])).toContain<Rule>('noClearance');
  });

  it('зона подхода × зона подхода — можно (общий проход)', () => {
    // 4 × 2.8: шкафы у верхней и нижней стен, их зоны подхода пересекаются
    const narrow = rectApartment(4, 2.8, [{ wall: 'left', offset: 0.3, width: 0.8, kind: 'door' }]);
    const top = atTop(wardrobe);
    const bottom: Pose = { position: [2.5, 2.7 - 0.3 - WALL_GAP], rotation: Math.PI };
    expect(box(clearanceBox(wardrobe, top))[3]).toBeGreaterThan(
      box(clearanceBox(wardrobe, bottom))[1]!,
    );
    expect(rules(wardrobe, top, [[wardrobe, bottom]], narrow)).toEqual([]);
    expect(rules(wardrobe, bottom, [[wardrobe, top]], narrow)).toEqual([]);
  });

  it('footprint × стена или контур комнаты — нельзя', () => {
    expect(rules(dresser, { position: [2.5, 0.15], rotation: 0 })).toContain<Rule>('outside');
  });

  it('зона подхода × стена — только спинкой', () => {
    expect(rules(wardrobe, atTop(wardrobe))).toEqual([]);
    const facingWall: Pose = { ...atTop(wardrobe), rotation: Math.PI };
    expect(rules(wardrobe, facingWall)).toContain<Rule>('clearanceWall');
  });

  it('footprint × зона двери — нельзя, зона подхода × зона двери — предупреждение', () => {
    // дверь в левой стене y 0.3–1.1, зона открывания 0.8 вглубь
    expect(rules(dresser, { position: [0.5, 0.7], rotation: -Math.PI / 2 })).toContain<Rule>(
      'door',
    );
    // комод лицом к левой стене: след вне зоны двери, а зона подхода заходит в неё
    const nearDoor: Pose = { position: [1.5, 1.5], rotation: Math.PI / 2 };
    const r = rules(dresser, nearDoor);
    expect(r).toContain<Rule>('doorClearance');
    expect(r).not.toContain<Rule>('door');
  });

  it('высокий предмет (blocksWindow) × зона окна — нельзя, низкий — можно', () => {
    const atWindow = (item: FurnitureItem): Pose => ({
      position: [2.1, 3.9 - item.size[1] / 2 - WALL_GAP],
      rotation: Math.PI,
    });
    expect(rules(wardrobe, atWindow(wardrobe))).toContain<Rule>('window');
    expect(rules(dresser, atWindow(dresser))).not.toContain<Rule>('window');
  });

  it('предмет между двумя комнатами — нельзя', () => {
    const apt = building.apartments.find((a) => a.layoutId === 'k1-42')!;
    const kitchen = zonesFor(apt, apt.roomsGeometry.find((r) => r.type === 'kitchen')!);
    // по центру межкомнатной стены кухни
    const x = kitchen.inner.max[0] + 0.05;
    const check = validatePlacement(
      apt,
      dresser,
      { position: [x, 2], rotation: Math.PI / 2 },
      [],
      furniture,
    );
    expect(check.status).toBe('error');
    expect(check.reasons).toContain<Rule>('outside');
  });

  it('предметы одной группы могут стоять в зонах подхода друг друга', () => {
    const table = get('dining140');
    const chair = get('chair');
    const tablePose: Pose = { position: [2, 2], rotation: 0 };
    const chairPose: Pose = { position: [2, 2 + 0.425 + 0.25 + 0.02], rotation: Math.PI };
    expect(rules(chair, chairPose, [[table, tablePose]])).toEqual([]);
    expect(rules(dresser, chairPose, [[table, tablePose]])).toContain<Rule>('blocksAccess');
  });

  it('fits: строгий уровень совпадает с violations, мягкие — пропускают зоны подхода', () => {
    const z = zonesFor(room4, room4.roomsGeometry[0]!);
    const w = shapeOf(wardrobe, atTop(wardrobe));
    const d = shapeOf(dresser, { position: [2.5, 1.3], rotation: 0 });
    expect(fits(d, z, [w])).toBe(false);
    expect(fits(d, z, [w], 'tight')).toBe(true);
    const nearDoor = shapeOf(dresser, { position: [1.5, 1.5], rotation: Math.PI / 2 });
    expect(fits(nearDoor, z, [])).toBe(false);
    expect(fits(nearDoor, z, [], 'door')).toBe(true);
  });
});
