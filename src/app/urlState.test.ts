import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS } from '../domain/filters';
import { formatRange, hasUrlState, parseRange, parseUrlState, toSearchParams } from './urlState';

const ctx = { floors: 9, apartmentExists: (id: string) => /^s1-f[1-9]-a[1-6]$/.test(id) };
const parse = (q: string) => parseUrlState(new URLSearchParams(q), ctx);

describe('диапазоны в адресе', () => {
  it('закрытый и открытые с любой стороны', () => {
    expect(parseRange('40-80')).toEqual([40, 80]);
    expect(parseRange('40-')).toEqual([40, Infinity]);
    expect(parseRange('-80')).toEqual([-Infinity, 80]);
    expect(parseRange('80-40')).toEqual([40, 80]);
    expect(parseRange('5.5-7')).toEqual([5.5, 7]);
  });

  it('мусор отбрасывается', () => {
    for (const s of ['', '-', 'abc', '40', '1-2-3', 'x-10', '10-y'])
      expect(parseRange(s)).toBeNull();
  });

  it('formatRange обратна parseRange', () => {
    for (const s of ['40-80', '40-', '-80']) expect(formatRange(parseRange(s)!)).toBe(s);
  });
});

describe('состояние плана в адресе', () => {
  it('пустой адрес — значения по умолчанию', () => {
    expect(parse('')).toEqual({ floor: null, apartmentId: null, filters: DEFAULT_FILTERS });
    expect(hasUrlState(new URLSearchParams(''))).toBe(false);
  });

  it('все параметры разбираются', () => {
    const s = parse('floor=5&apt=s1-f5-a3&rooms=2,1,2&area=40-80&price=6000000-&free=1');
    expect(s).toEqual({
      floor: 5,
      apartmentId: 's1-f5-a3',
      filters: {
        rooms: [1, 2],
        areaRange: [40, 80],
        priceRange: [6_000_000, Infinity],
        onlyFree: true,
      },
    });
  });

  it('неверные этаж, квартира и комнатность отбрасываются', () => {
    const s = parse('floor=12&apt=nope&rooms=7,x,3');
    expect(s.floor).toBeNull();
    expect(s.apartmentId).toBeNull();
    expect(s.filters.rooms).toEqual([3]);
    expect(parse('floor=2.5').floor).toBeNull();
  });

  it('туда и обратно без потерь; значения по умолчанию не пишутся', () => {
    const q = 'floor=5&apt=s1-f5-a3&rooms=1%2C2&area=40-80&price=6000000-&free=1';
    const s = parse(q);
    expect(toSearchParams(s, 9).toString()).toBe(q);
    expect(toSearchParams(parse('floor=9'), 9).toString()).toBe('');
  });
});
