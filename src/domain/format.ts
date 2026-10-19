const rub = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});
const area1 = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** «9 870 000 ₽» (CLAUDE.md §9). */
export function formatPrice(value: number): string {
  return rub.format(value);
}

/** «64,4 м²». */
export function formatArea(value: number): string {
  return `${area1.format(value)} м²`;
}

const mln = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

/** «10,44 млн ₽» — для компактных списков. */
export function formatMillions(value: number): string {
  return `${mln.format(value / 1_000_000)} млн ₽`;
}

/** Русское склонение по числу: 1 квартира, 2 квартиры, 5 квартир. */
export function pluralRu(n: number, one: string, few: string, many: string): string {
  const m10 = Math.abs(n) % 10;
  const m100 = Math.abs(n) % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
