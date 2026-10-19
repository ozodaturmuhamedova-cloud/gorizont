import { describe, expect, it } from 'vitest';
import { PLAN_ZOOM_MAX, PLAN_ZOOM_MIN } from './constants';
import {
  centerOn,
  fitView,
  labelPx,
  pinchStep,
  screenToWorld,
  visibleBounds,
  worldToScreen,
  zoomAt,
} from './planView';
import type { Bounds } from './planView';

const floor: Bounds = { min: [0, 0], max: [26, 17] };
const size = { width: 800, height: 600 };

describe('вписывание этажа', () => {
  it('этаж 26×17 м целиком помещается и стоит по центру', () => {
    const v = fitView(floor, size, 20);
    expect(v.scale).toBeCloseTo((800 - 40) / 26, 9);
    const [x0, y0] = worldToScreen(v, floor.min);
    const [x1, y1] = worldToScreen(v, floor.max);
    expect(x0).toBeCloseTo(20, 9);
    expect(x1).toBeCloseTo(780, 9);
    expect((y0 + y1) / 2).toBeCloseTo(300, 9);
  });

  it('узкое окно: вписывается по ширине, высокое — по высоте', () => {
    expect(fitView(floor, { width: 300, height: 900 }, 0).scale).toBeCloseTo(300 / 26, 9);
    expect(fitView(floor, { width: 2000, height: 170 }, 0).scale).toBeCloseTo(10, 9);
  });
});

describe('экран ↔ план', () => {
  it('преобразования взаимно обратны', () => {
    const v = { scale: 31.5, x: -12, y: 40 };
    const [x, y] = screenToWorld(v, worldToScreen(v, [7.3, 11.1]));
    expect(x).toBeCloseTo(7.3, 9);
    expect(y).toBeCloseTo(11.1, 9);
  });
});

describe('масштаб к курсору', () => {
  const v = fitView(floor, size);

  it('точка под курсором остаётся на месте', () => {
    const pointer: [number, number] = [530, 210];
    const before = screenToWorld(v, pointer);
    const after = screenToWorld(zoomAt(v, pointer, 1.7, v.scale), pointer);
    expect(after[0]).toBeCloseTo(before[0], 9);
    expect(after[1]).toBeCloseTo(before[1], 9);
  });

  it('масштаб ограничен 0.5×…4× от вписанного', () => {
    let z = v;
    for (let k = 0; k < 50; k++) z = zoomAt(z, [400, 300], 1.5, v.scale);
    expect(z.scale).toBeCloseTo(v.scale * PLAN_ZOOM_MAX, 9);
    for (let k = 0; k < 50; k++) z = zoomAt(z, [400, 300], 0.5, v.scale);
    expect(z.scale).toBeCloseTo(v.scale * PLAN_ZOOM_MIN, 9);
  });
});

describe('pinch, видимая область, центрирование', () => {
  const v = fitView(floor, size);

  it('раздвинули пальцы вдвое — масштаб вдвое, центр жеста неподвижен', () => {
    const c: [number, number] = [400, 300];
    const z = pinchStep(v, { center: c, dist: 100 }, { center: c, dist: 200 }, v.scale);
    expect(z.scale).toBeCloseTo(v.scale * 2, 9);
    const w0 = screenToWorld(v, c);
    const w1 = screenToWorld(z, c);
    expect(w1[0]).toBeCloseTo(w0[0], 9);
  });

  it('сдвиг двумя пальцами без изменения расстояния — чистое панорамирование', () => {
    const z = pinchStep(
      v,
      { center: [100, 100], dist: 80 },
      { center: [130, 90], dist: 80 },
      v.scale,
    );
    expect(z.scale).toBeCloseTo(v.scale, 9);
    expect(z.x - v.x).toBeCloseTo(30, 9);
    expect(z.y - v.y).toBeCloseTo(-10, 9);
  });

  it('видимая область во вписанном виде покрывает весь этаж', () => {
    const b = visibleBounds(v, size);
    expect(b.min[0]).toBeLessThanOrEqual(0);
    expect(b.max[0]).toBeGreaterThanOrEqual(26);
  });

  it('centerOn ставит точку в центр окна', () => {
    const z = centerOn(v, size, [5, 5]);
    const [x, y] = worldToScreen(z, [5, 5]);
    expect(x).toBeCloseTo(400, 9);
    expect(y).toBeCloseTo(300, 9);
  });
});

describe('размер подписей', () => {
  it('растёт с масштабом в пределах границ', () => {
    expect(labelPx(0.95, 5, 11, 26)).toBe(11);
    expect(labelPx(0.95, 20, 11, 26)).toBeCloseTo(19, 9);
    expect(labelPx(0.95, 100, 11, 26)).toBe(26);
  });
});
