import { describe, expect, it } from 'vitest';
import { furniture } from '../data';
import { modelParts, toneColor } from './furnitureModel';

describe('процедурные модели мебели', () => {
  it('у каждого предмета каталога есть модель в пределах его габаритов', () => {
    for (const item of furniture.items) {
      const [w, d, h] = item.size;
      const parts = modelParts(item);
      expect(parts.length, item.id).toBeGreaterThan(0);
      expect(parts.length, item.id).toBeLessThanOrEqual(40);
      for (const p of parts) {
        // ручки и краны чуть выступают — допуск
        expect(p.min[0], item.id).toBeGreaterThanOrEqual(-w / 2 - 1e-9);
        expect(p.max[0], item.id).toBeLessThanOrEqual(w / 2 + 1e-9);
        expect(p.min[1], item.id).toBeGreaterThanOrEqual(0);
        expect(p.max[1], item.id).toBeLessThanOrEqual(h + 0.25);
        expect(p.min[2], item.id).toBeGreaterThanOrEqual(-d / 2 - 1e-9);
        expect(p.max[2], item.id).toBeLessThanOrEqual(d / 2 + 0.035);
        for (let k = 0; k < 3; k++) expect(p.max[k]!, item.id).toBeGreaterThanOrEqual(p.min[k]!);
      }
      // модель заполняет габарит: самая высокая деталь доходит почти до высоты предмета
      expect(Math.max(...parts.map((p) => p.max[1])), item.id).toBeGreaterThan(h * 0.9);
    }
  });

  it('спинка у кровати и дивана — сзади (−z)', () => {
    for (const id of ['bed160', 'sofa3']) {
      const item = furniture.byId.get(id)!;
      const tallest = modelParts(item).reduce((a, b) => (b.max[1] > a.max[1] ? b : a));
      expect(tallest.min[2], id).toBeCloseTo(-item.size[1] / 2);
    }
  });

  it('оттенки: основной цвет без изменений, тёмный темнее, светлый светлее', () => {
    const lum = (c: string) => {
      const v = parseInt(c.slice(1), 16);
      return ((v >> 16) & 255) + ((v >> 8) & 255) + (v & 255);
    };
    expect(toneColor('#c9a77b', 'main')).toBe('#c9a77b');
    expect(lum(toneColor('#c9a77b', 'dark'))).toBeLessThan(lum('#c9a77b'));
    expect(lum(toneColor('#c9a77b', 'light'))).toBeGreaterThan(lum('#c9a77b'));
    expect(toneColor(undefined, 'main')).toMatch(/^#[0-9a-f]{6}$/);
  });
});
