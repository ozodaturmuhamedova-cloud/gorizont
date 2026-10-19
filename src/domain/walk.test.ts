import { describe, expect, it } from 'vitest';
import { building, furniture } from '../data';
import { rectApartment } from '../testing/fixtures/rectRoom';
import { pointInPolygon } from './geometry';
import type { Obb, Vec2 } from './types';
import {
  cameraHeight,
  ceilingOf,
  ceilingTooLow,
  collides,
  collisionRadius,
  eyeHeight,
  isValidHeight,
  moveCircle,
  nearestFree,
  reachableFrom,
  roomContaining,
  startPose,
  walkObstacles,
  walkSpeed,
} from './walk';

describe('walk: рост → параметры прогулки', () => {
  it('eyeHeight для 100 / 170 / 220 см', () => {
    expect(eyeHeight(100)).toBe(0.94);
    expect(eyeHeight(170)).toBe(1.59);
    expect(eyeHeight(220)).toBe(2.06);
  });

  it('камера не выше потолка минус зазор', () => {
    expect(cameraHeight(170, 2.7)).toBe(1.59);
    expect(cameraHeight(220, 2.1)).toBe(2.0);
  });

  it('диапазон роста 100–220 см', () => {
    expect(isValidHeight(50)).toBe(false);
    expect(isValidHeight(100)).toBe(true);
    expect(isValidHeight(185)).toBe(true);
    expect(isValidHeight(221)).toBe(false);
    expect(isValidHeight(Number.NaN)).toBe(false);
  });

  it('радиус и скорость растут с ростом и ограничены', () => {
    expect(collisionRadius(100)).toBe(0.18);
    expect(collisionRadius(170)).toBeCloseTo(0.221);
    expect(collisionRadius(220)).toBe(0.28);
    expect(walkSpeed(100)).toBe(1.0);
    expect(walkSpeed(170)).toBeCloseTo(1.36);
    expect(walkSpeed(220)).toBe(1.6);
  });
});

/** Прямая стена-перегородка вдоль y = 2 с проёмом шириной gap посередине (x от 0 до 4). */
function partition(gap: number): Obb[] {
  const left = 2 - gap / 2;
  const right = 2 + gap / 2;
  return [
    { center: [left / 2, 2], half: [left / 2, 0.05], rotation: 0 },
    { center: [(right + 4) / 2, 2], half: [(4 - right) / 2, 0.05], rotation: 0 },
  ];
}

/** Идём от (2, 1) прямо вниз через проём: дошли ли до y > 3. */
function walkThrough(gap: number, cm: number): boolean {
  let p: Vec2 = [2, 1];
  for (let k = 0; k < 40; k++) p = moveCircle(p, [0, 0.1], collisionRadius(cm), partition(gap));
  return p[1] > 3;
}

describe('walk: коллизии', () => {
  it('проход через дверь: широкая пропускает, узкая — нет; крупному нужна шире', () => {
    expect(walkThrough(0.8, 170)).toBe(true);
    expect(walkThrough(0.3, 170)).toBe(false);
    // 0.5 м: радиус 0.195 (150 см) проходит, 0.2535 (195 см) — нет
    expect(walkThrough(0.5, 150)).toBe(true);
    expect(walkThrough(0.5, 195)).toBe(false);
  });

  it('упор в стену под углом — скольжение вдоль неё, сквозь стену не пройти', () => {
    const wall: Obb[] = [{ center: [2, 2], half: [5, 0.05], rotation: 0 }];
    const r = 0.22;
    let p: Vec2 = [0, 1.5];
    for (let k = 0; k < 30; k++) p = moveCircle(p, [0.07, 0.07], r, wall);
    expect(p[0]).toBeGreaterThan(1.5);
    expect(p[1]).toBeLessThanOrEqual(2 - 0.05 - r + 1e-6);
    // большой шаг за один кадр тоже не «перепрыгивает» стену
    expect(moveCircle([2, 1.6], [0, 3], r, wall)[1]).toBeLessThan(2);
  });

  it('выталкивание: из препятствия — в ближайшую свободную точку', () => {
    const apt = rectApartment(4, 4);
    const box: Obb = { center: [2, 2], half: [0.5, 0.5], rotation: 0 };
    const r = 0.22;
    const q = nearestFree([2.1, 2], r, [box, ...walkObstacles(apt)], apt.outline);
    expect(collides(q, r, [box])).toBe(false);
    expect(Math.hypot(q[0] - 2.1, q[1] - 2)).toBeLessThan(1);
  });

  it('препятствия: проёмы межкомнатных дверей открыты, входная дверь и окна — нет', () => {
    const apt = building.apartments.find((a) => a.layoutId === 'k2-63')!;
    const obs = walkObstacles(apt);
    for (const o of apt.openings) {
      const w = apt.walls[o.wallIndex]!;
      const t = o.offset + o.width / 2;
      const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
      const p: Vec2 = [
        w.a[0] + ((w.b[0] - w.a[0]) / len) * t,
        w.a[1] + ((w.b[1] - w.a[1]) / len) * t,
      ];
      const blocked = collides(p, 0.01, obs);
      expect(blocked, `${o.kind}${o.entry ? ' entry' : ''} @${p}`).toBe(
        o.kind === 'window' || o.entry === true,
      );
    }
    expect(
      walkObstacles(apt, [{ itemId: 'dresser', position: [1, 1], rotation: 0 }], furniture),
    ).toHaveLength(obs.length + 1);
  });
});

describe('walk: старт, комнаты, потолок', () => {
  it('старт — в прихожей у входной двери, взгляд внутрь квартиры', () => {
    for (const l of building.layouts) {
      const apt = building.apartments.find((a) => a.layoutId === l.id)!;
      const s = startPose(apt, 170);
      expect(roomContaining(apt, s.position)?.type, l.id).toBe('hall');
      // в метре перед глазами — квартира, а не коридор
      const ahead: Vec2 = [
        s.position[0] + Math.cos(s.heading),
        s.position[1] + Math.sin(s.heading),
      ];
      expect(pointInPolygon(ahead, apt.outline), l.id).toBe(true);
    }
  });

  it('без прихожей — центр самой большой комнаты', () => {
    const apt = rectApartment(
      5,
      4,
      [{ wall: 'top', offset: 1, width: 0.9, kind: 'door' }],
      'living',
    );
    const s = startPose(apt, 170);
    expect(s.position[0]).toBeCloseTo(2.5);
    expect(s.position[1]).toBeCloseTo(2);
  });

  it('из старта дойти до каждой комнаты (150 и 195 см)', () => {
    for (const l of building.layouts) {
      const apt = building.apartments.find((a) => a.layoutId === l.id)!;
      for (const cm of [150, 195]) {
        const obs = walkObstacles(apt);
        const reach = reachableFrom(
          apt,
          startPose(apt, cm, obs).position,
          collisionRadius(cm),
          obs,
        );
        for (const r of apt.roomsGeometry) {
          const c: Vec2 = [
            r.polygon.reduce((s, p) => s + p[0], 0) / r.polygon.length,
            r.polygon.reduce((s, p) => s + p[1], 0) / r.polygon.length,
          ];
          expect(reach(c), `${l.id} ${cm} ${r.id}`).toBe(true);
        }
      }
    }
  });

  it('высота потолка квартиры и предупреждение о низком потолке', () => {
    const apt = building.apartments[0]!;
    expect(ceilingOf(apt)).toBe(Math.max(...apt.walls.map((w) => w.height)));
    expect(ceilingTooLow(170, 2.7)).toBe(false);
    expect(ceilingTooLow(220, 2.1)).toBe(true);
  });
});
