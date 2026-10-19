import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

describe('createRng', () => {
  it('один seed — одна и та же последовательность', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let k = 0; k < 100; k++) expect(a.next()).toBe(b.next());
  });

  it('последовательность для seed 42 не меняется между версиями', () => {
    const r = createRng(42);
    expect([r.next(), r.next(), r.next()].map((x) => x.toFixed(6))).toEqual([
      '0.601104',
      '0.448291',
      '0.852466',
    ]);
  });

  it('разные seed — разные последовательности', () => {
    const a = createRng(1);
    const b = createRng(2);
    const same = Array.from({ length: 20 }, () => a.next() === b.next()).filter(Boolean);
    expect(same).toHaveLength(0);
  });

  it('next и float — в полуинтервале, среднее около середины', () => {
    const r = createRng(7);
    let s = 0;
    for (let k = 0; k < 10_000; k++) {
      const x = r.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      s += x;
    }
    expect(Math.abs(s / 10_000 - 0.5)).toBeLessThan(0.02);
    const f = r.float(2, 3);
    expect(f).toBeGreaterThanOrEqual(2);
    expect(f).toBeLessThan(3);
  });

  it('int включает обе границы и не выходит за них', () => {
    const r = createRng(3);
    const seen = new Set<number>();
    for (let k = 0; k < 600; k++) {
      const v = r.int(1, 6);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect(seen.size).toBe(6);
    expect(r.int(5, 5)).toBe(5);
    expect(() => r.int(3, 1)).toThrow(RangeError);
  });

  it('pick и shuffle', () => {
    const r = createRng(11);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(arr).toContain(r.pick(arr));
    const sh = r.shuffle(arr);
    expect([...sh].sort((a, b) => a - b)).toEqual(arr);
    expect(sh).not.toEqual(arr);
    expect(arr).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(() => r.pick([])).toThrow(RangeError);
  });

  it('chance(0) — никогда, chance(1) — всегда', () => {
    const r = createRng(5);
    for (let k = 0; k < 100; k++) {
      expect(r.chance(0)).toBe(false);
      expect(r.chance(1)).toBe(true);
    }
  });
});
