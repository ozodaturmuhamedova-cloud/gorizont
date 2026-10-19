import { describe, expect, it } from 'vitest';
import { building, furniture } from '../../data';
import { rectApartment } from '../../testing/fixtures/rectRoom';
import { createRng } from '../rng';
import type { Apartment, FurnitureItem } from '../types';
import { collisionRadius } from '../walk';
import { autoLayout, furnishApartment, layoutOrder, presetFor } from './autoLayout';
import { WALL_GAP } from './candidates';
import { frontDir, HARD_RULES, localPoint, violations } from './fits';
import { isWalkable, WALK_CHECK_HEIGHT_CM } from './walkable';
import { zonesFor } from './zones';

const get = (id: string): FurnitureItem => {
  const item = furniture.byId.get(id);
  if (!item) throw new Error(id);
  return item;
};
const layoutIn = (apt: Apartment, ids: string[], seed = 1) =>
  autoLayout(apt, apt.roomsGeometry[0]!, ids.map(get), furniture, createRng(seed));
const sample = (layoutId: string) => building.apartments.find((a) => a.layoutId === layoutId)!;

describe('autoLayout: отдельные правила', () => {
  it('порядок: приоритет по убыванию, затем площадь', () => {
    const order = layoutOrder(['chair', 'nightstand', 'bed90', 'bed160'].map(get)).map((i) => i.id);
    expect(order).toEqual(['bed160', 'bed90', 'chair', 'nightstand']);
  });

  it('кровать в комнате 3×3 м встаёт изголовьем к стене', () => {
    const apt = rectApartment(3, 3);
    const z = zonesFor(apt, apt.roomsGeometry[0]!);
    const res = layoutIn(apt, ['bed160']);
    expect(res.skipped).toEqual([]);
    const bed = res.shapes[0]!;
    const [hx, hy] = localPoint(bed.pose, 0, -bed.item.size[1] / 2);
    const toWall = Math.min(
      hx - z.inner.min[0],
      z.inner.max[0] - hx,
      hy - z.inner.min[1],
      z.inner.max[1] - hy,
    );
    expect(toWall).toBeCloseTo(WALL_GAP, 6);
  });

  it('ТВ встаёт напротив дивана', () => {
    const apt = rectApartment(
      4,
      5.5,
      [{ wall: 'left', offset: 0.3, width: 0.8, kind: 'door' }],
      'living',
    );
    for (const seed of [1, 2, 3]) {
      const res = layoutIn(apt, ['tvstand', 'sofa3'], seed);
      const sofa = res.shapes.find((s) => s.item.id === 'sofa3')!;
      const tv = res.shapes.find((s) => s.item.id === 'tvstand')!;
      const [sx, sy] = frontDir(sofa.pose);
      const [tx, ty] = frontDir(tv.pose);
      expect(sx * tx + sy * ty, `seed=${seed}`).toBeLessThan(-0.95);
      const v = [
        tv.pose.position[0] - sofa.pose.position[0],
        tv.pose.position[1] - sofa.pose.position[1],
      ];
      const along = v[0]! * sx + v[1]! * sy;
      expect(along, `seed=${seed}`).toBeGreaterThanOrEqual(2);
      expect(Math.abs(v[0]! * -sy + v[1]! * sx), `seed=${seed}`).toBeLessThan(0.5);
    }
  });

  it('при нехватке места срабатывает compactAlt, а то, что не влезло, попадает в skipped', () => {
    // пол 1.2 × 1.7 м: шкаф 1.6 не встаёт, компактный 1.0 — встаёт; кровати места нет совсем
    const apt = rectApartment(1.4, 1.9, [
      { wall: 'bottom', offset: 0.3, width: 0.8, kind: 'door' },
    ]);
    const res = layoutIn(apt, ['wardrobe160', 'bed160']);
    expect(res.placed.map((p) => p.itemId)).toEqual(['wardrobe100']);
    expect(res.skipped).toEqual([{ itemId: 'bed160', roomId: 'r', reason: 'noSpace' }]);
  });

  it('стол ставится только вместе хотя бы с двумя стульями, стулья — лицом к столу', () => {
    for (const l of building.layouts) {
      const apt = sample(l.id);
      const res = furnishApartment(apt, furniture, createRng(3));
      for (const r of res.rooms) {
        const table = r.shapes.find(
          (s) => s.item.group === 'dining' && s.item.category === 'table',
        );
        const chairs = r.shapes.filter((s) => s.item.category === 'chair');
        if (!table) {
          expect(chairs, `${l.id}/${r.roomId}`).toEqual([]);
          continue;
        }
        expect(chairs.length, `${l.id}/${r.roomId}`).toBeGreaterThanOrEqual(2);
        for (const c of chairs) {
          const [fx, fy] = frontDir(c.pose);
          const to = [
            table.pose.position[0] - c.pose.position[0],
            table.pose.position[1] - c.pose.position[1],
          ];
          expect(fx * to[0]! + fy * to[1]!).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('autoLayout: детерминизм и качество', () => {
  it('один seed — одна расстановка; jitter даёт разные варианты, jitter = 0 — один', () => {
    const apt = sample('k2-63');
    const run = (seed: number, jitter?: number) =>
      JSON.stringify(
        furnishApartment(apt, furniture, createRng(seed), undefined, { jitter }).placed,
      );
    expect(run(5)).toBe(run(5));
    expect(new Set([1, 2, 3, 4, 5, 6].map((s) => run(s))).size).toBeGreaterThan(1);
    expect(run(1, 0)).toBe(run(2, 0));
  });

  it('квартиры дома: без нарушений, ко всему можно подойти, в санузле и на кухне есть главное', () => {
    const radius = collisionRadius(WALK_CHECK_HEIGHT_CM);
    for (const l of building.layouts) {
      const apt = sample(l.id);
      const res = furnishApartment(apt, furniture, createRng(1));
      for (const r of res.rooms) {
        const room = apt.roomsGeometry.find((x) => x.id === r.roomId)!;
        const z = zonesFor(apt, room);
        r.shapes.forEach((s, i) => {
          const hard = violations(
            s,
            z,
            r.shapes.filter((_, j) => j !== i),
          ).filter((v) => HARD_RULES.has(v.rule));
          expect(hard, `${l.id}/${r.roomId}/${s.item.id}`).toEqual([]);
        });
        expect(isWalkable(z, r.shapes, radius), `${l.id}/${r.roomId}`).toBe(true);
        const ids = r.placed.map((p) => p.itemId);
        if (room.type === 'bath') expect(ids, l.id).toContain('toilet');
        if (room.type === 'bath')
          expect(
            ids.some((id) => id === 'bathtub' || id === 'shower'),
            l.id,
          ).toBe(true);
        if (room.type === 'kitchen')
          expect(
            ids.some((id) => id.startsWith('kitchen')),
            l.id,
          ).toBe(true);
        if (room.type === 'bedroom')
          expect(
            ids.some((id) => id.startsWith('bed')),
            l.id,
          ).toBe(true);
        if (room.type === 'living')
          expect(
            ids.some((id) => id.startsWith('sofa')),
            l.id,
          ).toBe(true);
      }
    }
  });

  it('в студии кухня — часть гостиной', () => {
    const apt = sample('studio-35');
    const living = apt.roomsGeometry.find((r) => r.type === 'living')!;
    const ids = presetFor(apt, living, furniture).map((i) => i.id);
    expect(ids).toContain('sofa3');
    expect(ids).toContain('kitchen280');
  });

  it('бюджет: в среднем < 30 мс на комнату', () => {
    const rooms = building.layouts.flatMap((l) => {
      const apt = sample(l.id);
      return apt.roomsGeometry.map((room) => ({
        apt,
        room,
        items: presetFor(apt, room, furniture),
      }));
    });
    const t0 = performance.now();
    for (const { apt, room, items } of rooms) autoLayout(apt, room, items, furniture, createRng(1));
    expect((performance.now() - t0) / rooms.length).toBeLessThan(30);
  });
});
