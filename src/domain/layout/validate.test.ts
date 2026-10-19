import { describe, expect, it } from 'vitest';
import { furniture } from '../../data';
import { rectApartment } from '../../testing/fixtures/rectRoom';
import { WALL_GAP } from './candidates';
import { snapPose, validatePlacement } from './validate';

const get = (id: string) => furniture.byId.get(id)!;
const apt = rectApartment(4, 4, [{ wall: 'left', offset: 0.3, width: 0.8, kind: 'door' }]);
const dresser = get('dresser');

describe('validatePlacement', () => {
  it('ok / warning / error', () => {
    const atTop = { position: [2.5, 0.1 + 0.225 + WALL_GAP] as [number, number], rotation: 0 };
    expect(validatePlacement(apt, dresser, atTop, [], furniture)).toEqual({
      status: 'ok',
      reasons: [],
      roomId: 'r',
    });
    const placed = [{ itemId: 'dresser', ...atTop }];
    const inFront = validatePlacement(
      apt,
      dresser,
      { position: [2.5, 1.0], rotation: 0 },
      placed,
      furniture,
    );
    expect(inFront.status).toBe('warning');
    expect(inFront.reasons).toContain('blocksAccess');
    const onTop = validatePlacement(apt, dresser, atTop, placed, furniture);
    expect(onTop.status).toBe('error');
    expect(onTop.reasons[0]).toBe('overlap');
  });

  it('вне квартиры — ошибка', () => {
    expect(
      validatePlacement(apt, dresser, { position: [9, 9], rotation: 0 }, [], furniture).status,
    ).toBe('error');
  });
});

describe('snapPose', () => {
  it('спинка ближе 0.15 м к стене — предмет разворачивается и прижимается', () => {
    const near = {
      position: [2.53, 0.1 + 0.225 + WALL_GAP + 0.1] as [number, number],
      rotation: 0.4,
    };
    const { pose, kind } = snapPose(apt, dresser, near);
    expect(kind).toBe('wall');
    expect(pose.rotation).toBe(0);
    expect(pose.position[0]).toBeCloseTo(2.5);
    expect(pose.position[1]).toBeCloseTo(0.1 + 0.225 + WALL_GAP);
    const right = snapPose(apt, dresser, { position: [3.9 - 0.3, 2.04], rotation: 0 });
    expect(right.kind).toBe('wall');
    expect(right.pose.rotation).toBeCloseTo(Math.PI / 2);
    expect(right.pose.position[0]).toBeCloseTo(3.9 - 0.225 - WALL_GAP);
  });

  it('далеко от стен — только сетка 0.1 м, поворот не меняется', () => {
    const { pose, kind } = snapPose(apt, dresser, { position: [2.04, 2.07], rotation: 0.3 });
    expect(kind).toBe('grid');
    expect(pose.position[0]).toBeCloseTo(2.0);
    expect(pose.position[1]).toBeCloseTo(2.1);
    expect(pose.rotation).toBe(0.3);
  });

  it('угловой предмет в радиусе 0.25 м от угла встаёт в угол', () => {
    const chair = get('armchair'); // 0.85 × 0.85, placement corner
    const corner = 3.9 - 0.425 - WALL_GAP;
    const { pose, kind } = snapPose(apt, chair, {
      position: [corner - 0.1, corner - 0.12],
      rotation: 0,
    });
    expect(kind).toBe('corner');
    expect(pose.position[0]).toBeCloseTo(corner);
    expect(pose.position[1]).toBeCloseTo(corner);
  });
});
