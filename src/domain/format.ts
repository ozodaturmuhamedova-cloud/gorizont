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
