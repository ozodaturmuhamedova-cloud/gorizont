/**
 * Процедурные модели мебели (§7: «если .glb нет — процедурная модель по size»).
 * Модель — набор прямоугольных деталей в локальных координатах предмета:
 * x — ширина (−w/2…w/2), y — вверх (0…h), z — глубина: спинка −d/2, перед +d/2.
 * В 3D это совпадает с планом: x = x, z = y плана, поворот группы rotationY = −rotation.
 */
import type { FurnitureItem } from './types';

export type PartTone = 'main' | 'dark' | 'light' | 'white' | 'black' | 'metal' | 'fabric' | 'glass';

export interface Part {
  min: [number, number, number];
  max: [number, number, number];
  tone: PartTone;
}

const LEG = 0.04;

function part(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  tone: PartTone,
): Part {
  return { min: [x0, y0, z0], max: [x1, y1, z1], tone };
}

/** Четыре ножки по углам прямоугольника, высотой h. */
function legs(w: number, d: number, h: number, inset = 0.03, tone: PartTone = 'dark'): Part[] {
  const x = w / 2 - inset;
  const z = d / 2 - inset;
  return [
    [-x, -z],
    [x - LEG, -z],
    [-x, z - LEG],
    [x - LEG, z - LEG],
  ].map(([px, pz]) => part(px!, px! + LEG, 0, h, pz!, pz! + LEG, tone));
}

/** Шкаф/тумба: корпус + двери (тонкие панели спереди) + ручки. */
function cabinet(w: number, d: number, h: number, doors: number, y0 = 0): Part[] {
  const out: Part[] = [part(-w / 2, w / 2, y0, h, -d / 2, d / 2 - 0.02, 'main')];
  const gap = 0.006;
  const dw = w / doors;
  for (let i = 0; i < doors; i++) {
    const x0 = -w / 2 + i * dw + gap;
    const x1 = x0 + dw - 2 * gap;
    out.push(part(x0, x1, y0 + 0.03, h - 0.03, d / 2 - 0.02, d / 2, 'light'));
    const hx = i % 2 === 0 ? x1 - 0.05 : x0 + 0.03;
    const hy = Math.min(y0 + (h - y0) * 0.55, y0 + 1.1);
    out.push(part(hx, hx + 0.02, hy - 0.1, hy + 0.1, d / 2, d / 2 + 0.015, 'metal'));
  }
  return out;
}

function bed(w: number, d: number, h: number): Part[] {
  const head = 0.08;
  const out = [
    part(-w / 2, w / 2, 0.08, 0.3, -d / 2 + head, d / 2, 'main'),
    part(-w / 2 + 0.03, w / 2 - 0.03, 0.3, 0.5, -d / 2 + head, d / 2 - 0.03, 'white'),
    part(-w / 2, w / 2, 0, h, -d / 2, -d / 2 + head, 'main'),
    part(-w / 2 + 0.02, w / 2 - 0.02, 0.46, 0.53, d / 2 - 0.8, d / 2 - 0.03, 'fabric'),
    ...legs(w, d, 0.08),
  ];
  const pillows = w > 1.2 ? 2 : 1;
  const pw = (w - 0.2) / pillows;
  for (let i = 0; i < pillows; i++) {
    const x0 = -w / 2 + 0.1 + i * pw + 0.03;
    out.push(
      part(x0, x0 + pw - 0.06, 0.5, 0.62, -d / 2 + head + 0.05, -d / 2 + head + 0.45, 'light'),
    );
  }
  return out;
}

function sofa(w: number, d: number, h: number): Part[] {
  const arm = Math.min(0.16, w * 0.12);
  const back = 0.2;
  const seat = 0.42;
  const out = [
    part(-w / 2, w / 2, 0.06, 0.3, -d / 2, d / 2, 'main'),
    part(-w / 2, w / 2, 0.06, h, -d / 2, -d / 2 + back, 'main'),
    part(-w / 2, -w / 2 + arm, 0.06, 0.62, -d / 2, d / 2, 'main'),
    part(w / 2 - arm, w / 2, 0.06, 0.62, -d / 2, d / 2, 'main'),
    ...legs(w, d, 0.06, 0.04, 'dark'),
  ];
  const n = w > 1.5 ? (w > 2 ? 3 : 2) : 1;
  const cw = (w - 2 * arm) / n;
  for (let i = 0; i < n; i++) {
    const x0 = -w / 2 + arm + i * cw + 0.01;
    out.push(part(x0, x0 + cw - 0.02, 0.3, seat, -d / 2 + back, d / 2 - 0.02, 'light'));
    out.push(
      part(x0, x0 + cw - 0.02, seat, h - 0.04, -d / 2 + back, -d / 2 + back + 0.14, 'light'),
    );
  }
  return out;
}

function table(w: number, d: number, h: number): Part[] {
  const top = 0.035;
  return [part(-w / 2, w / 2, h - top, h, -d / 2, d / 2, 'main'), ...legs(w, d, h - top, 0.05)];
}

function chair(w: number, d: number, h: number): Part[] {
  const seat = 0.46;
  return [
    part(-w / 2, w / 2, seat - 0.05, seat, -d / 2, d / 2, 'main'),
    part(-w / 2, w / 2, seat, h, -d / 2, -d / 2 + 0.05, 'main'),
    ...legs(w, d, seat - 0.05, 0.02, 'dark'),
  ];
}

function shelf(w: number, d: number, h: number): Part[] {
  const t = 0.025;
  const out = [
    part(-w / 2, -w / 2 + t, 0, h, -d / 2, d / 2, 'main'),
    part(w / 2 - t, w / 2, 0, h, -d / 2, d / 2, 'main'),
    part(-w / 2, w / 2, 0, h, -d / 2, -d / 2 + 0.01, 'dark'),
  ];
  const n = Math.max(2, Math.round(h / 0.36));
  for (let i = 0; i <= n; i++) {
    const y = Math.min(h - t, (i * (h - t)) / n);
    out.push(part(-w / 2 + t, w / 2 - t, y, y + t, -d / 2, d / 2, 'main'));
    if (i < n) {
      // корешки книг на полке
      const by = y + t;
      out.push(
        part(
          -w / 2 + 0.06,
          -w / 2 + 0.06 + (w - 0.2) * 0.55,
          by,
          by + 0.2,
          -d / 2 + 0.04,
          d / 2 - 0.06,
          i % 2 ? 'fabric' : 'dark',
        ),
      );
    }
  }
  return out;
}

function tvstand(w: number, d: number, h: number): Part[] {
  const body = 0.48;
  const tvW = Math.min(w - 0.1, 1.25);
  return [
    ...cabinet(w, d, body, 3, 0.05),
    ...legs(w, d, 0.05, 0.04, 'dark'),
    part(-0.12, 0.12, body, body + 0.04, -0.12, 0.02, 'black'),
    part(-0.03, 0.03, body + 0.04, body + 0.12, -0.05, -0.01, 'black'),
    part(-tvW / 2, tvW / 2, body + 0.1, h, -0.06, -0.025, 'black'),
  ];
}

function kitchen(w: number, d: number, h: number): Part[] {
  const base = 0.86;
  const upper = 0.35;
  const n = Math.max(1, Math.round(w / 0.6));
  return [
    part(-w / 2, w / 2, 0, 0.1, -d / 2, d / 2 - 0.06, 'dark'),
    ...cabinet(w, d, base - 0.04, n, 0.1),
    part(-w / 2, w / 2, base - 0.04, base, -d / 2, d / 2 + 0.01, 'white'),
    // мойка и варочная панель
    part(-w / 2 + 0.25, -w / 2 + 0.75, base, base + 0.005, -0.15, 0.15, 'metal'),
    part(w / 2 - 0.75, w / 2 - 0.15, base, base + 0.005, -0.2, 0.15, 'black'),
    ...cabinet(w, upper, h, n, 1.45).map((p) => ({
      ...p,
      min: [p.min[0], p.min[1], p.min[2] - d / 2 + upper / 2] as [number, number, number],
      max: [p.max[0], p.max[1], p.max[2] - d / 2 + upper / 2] as [number, number, number],
    })),
  ];
}

function fridge(w: number, d: number, h: number): Part[] {
  const split = h * 0.62;
  return [
    part(-w / 2, w / 2, 0, h, -d / 2, d / 2 - 0.02, 'white'),
    part(-w / 2 + 0.01, w / 2 - 0.01, 0.02, split - 0.01, d / 2 - 0.02, d / 2, 'white'),
    part(-w / 2 + 0.01, w / 2 - 0.01, split + 0.01, h - 0.02, d / 2 - 0.02, d / 2, 'white'),
    part(w / 2 - 0.07, w / 2 - 0.05, split - 0.4, split - 0.08, d / 2, d / 2 + 0.03, 'metal'),
    part(w / 2 - 0.07, w / 2 - 0.05, split + 0.08, split + 0.35, d / 2, d / 2 + 0.03, 'metal'),
  ];
}

function bathtub(w: number, d: number, h: number): Part[] {
  const rim = 0.07;
  return [
    part(-w / 2, w / 2, 0, h - 0.08, -d / 2, d / 2, 'white'),
    part(-w / 2 + rim, w / 2 - rim, h - 0.08, h - 0.07, -d / 2 + rim, d / 2 - rim, 'glass'),
    part(-w / 2, w / 2, h - 0.08, h, -d / 2, -d / 2 + rim, 'white'),
    part(-w / 2, w / 2, h - 0.08, h, d / 2 - rim, d / 2, 'white'),
    part(-w / 2, -w / 2 + rim, h - 0.08, h, -d / 2, d / 2, 'white'),
    part(w / 2 - rim, w / 2, h - 0.08, h, -d / 2, d / 2, 'white'),
    part(-w / 2 + 0.15, -w / 2 + 0.2, h, h + 0.15, -0.02, 0.02, 'metal'),
  ];
}

function shower(w: number, d: number, h: number): Part[] {
  const t = 0.02;
  return [
    part(-w / 2, w / 2, 0, 0.12, -d / 2, d / 2, 'white'),
    part(-w / 2, w / 2, 0.12, h, d / 2 - t, d / 2, 'glass'),
    part(w / 2 - t, w / 2, 0.12, h, -d / 2, d / 2, 'glass'),
    part(-w / 2, -w / 2 + t, 0.12, h, -d / 2, d / 2, 'glass'),
    part(-0.03, 0.03, 1.6, h - 0.05, -d / 2, -d / 2 + 0.05, 'metal'),
    part(-0.1, 0.1, h - 0.07, h - 0.05, -d / 2, -d / 2 + 0.2, 'metal'),
  ];
}

function toilet(w: number, d: number, h: number): Part[] {
  return [
    part(-w / 2 + 0.06, w / 2 - 0.06, 0, 0.32, -d / 2 + 0.15, d / 2 - 0.1, 'white'),
    part(-w / 2 + 0.02, w / 2 - 0.02, 0.32, 0.42, -d / 2 + 0.15, d / 2, 'white'),
    part(-w / 2, w / 2, 0.42, h, -d / 2, -d / 2 + 0.18, 'white'),
    part(-0.04, 0.04, h, h + 0.01, -d / 2 + 0.05, -d / 2 + 0.12, 'metal'),
  ];
}

function sink(w: number, d: number, h: number): Part[] {
  return [
    ...cabinet(w, d - 0.04, h - 0.12, 2, 0.12),
    part(-w / 2, w / 2, h - 0.12, h, -d / 2, d / 2, 'white'),
    part(-w / 2 + 0.08, w / 2 - 0.08, h - 0.005, h + 0.001, -d / 2 + 0.12, d / 2 - 0.06, 'glass'),
    part(-0.02, 0.02, h, h + 0.2, -d / 2 + 0.03, -d / 2 + 0.07, 'metal'),
    part(-0.02, 0.02, h + 0.17, h + 0.2, -d / 2 + 0.03, -d / 2 + 0.18, 'metal'),
  ];
}

function washer(w: number, d: number, h: number): Part[] {
  return [
    part(-w / 2, w / 2, 0, h, -d / 2, d / 2 - 0.02, 'white'),
    part(-0.2, 0.2, h * 0.2, h * 0.2 + 0.4, d / 2 - 0.02, d / 2, 'black'),
    part(-w / 2 + 0.03, w / 2 - 0.03, h - 0.1, h - 0.03, d / 2 - 0.02, d / 2, 'light'),
  ];
}

function bench(w: number, d: number, h: number): Part[] {
  return [
    part(-w / 2, w / 2, h - 0.08, h, -d / 2, d / 2, 'fabric'),
    part(-w / 2, w / 2, 0.12, 0.15, -d / 2 + 0.02, d / 2 - 0.02, 'main'),
    ...legs(w, d, h - 0.08, 0.02, 'main'),
  ];
}

/** Детали модели предмета: по id для особых предметов, иначе по категории. */
export function modelParts(item: FurnitureItem): Part[] {
  const [w, d, h] = item.size;
  switch (item.id) {
    case 'fridge':
      return fridge(w, d, h);
    case 'bathtub':
      return bathtub(w, d, h);
    case 'shower':
      return shower(w, d, h);
    case 'toilet':
      return toilet(w, d, h);
    case 'sink':
      return sink(w, d, h);
    case 'washer':
      return washer(w, d, h);
    case 'shelf':
      return shelf(w, d, h);
    case 'tvstand':
      return tvstand(w, d, h);
  }
  switch (item.category) {
    case 'bed':
      return bed(w, d, h);
    case 'sofa':
      return sofa(w, d, h);
    case 'table':
      return table(w, d, h);
    case 'chair':
      return chair(w, d, h);
    case 'kitchen':
      return kitchen(w, d, h);
    case 'storage':
      return [
        ...cabinet(w, d, h, Math.max(1, Math.round(w / 0.5)), h > 1.2 ? 0.05 : 0.08),
        ...(h > 1.2 ? [] : legs(w, d, 0.08, 0.04)),
      ];
    case 'decor':
      return bench(w, d, h);
    case 'plumbing':
    case 'tv':
      return [part(-w / 2, w / 2, 0, h, -d / 2, d / 2, 'main')];
  }
}

const hex = (c: string): [number, number, number] => {
  const v = parseInt(c.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
const toHex = (rgb: number[]) =>
  '#' +
  rgb
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
const mix = (a: string, b: string, t: number) => {
  const x = hex(a);
  const y = hex(b);
  return toHex(x.map((v, i) => v + (y[i]! - v) * t));
};

export const DEFAULT_FURNITURE_COLOR = '#b9a58d';

/** Цвет детали: оттенок основного цвета предмета или нейтральный материал. */
export function toneColor(base: string | undefined, tone: PartTone): string {
  const c = base ?? DEFAULT_FURNITURE_COLOR;
  switch (tone) {
    case 'main':
      return c;
    case 'dark':
      return mix(c, '#2a2520', 0.55);
    case 'light':
      return mix(c, '#ffffff', 0.35);
    case 'fabric':
      return mix(c, '#8e9aa6', 0.55);
    case 'white':
      return '#f2f1ec';
    case 'black':
      return '#1d1f22';
    case 'metal':
      return '#b9bec4';
    case 'glass':
      return '#cfe2ea';
  }
}
