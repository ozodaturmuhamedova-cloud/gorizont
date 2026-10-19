/**
 * Наборы seed'ов для property-тестов (CLAUDE.md §10.1).
 *
 * Если тест упал на каком-то seed, добавь его в REGRESSION_SEEDS с пояснением, что ломалось:
 * так поломка не вернётся незамеченной, даже если основной диапазон потом поменяется.
 */
export interface RegressionSeed {
  seed: number;
  note: string;
}

export const REGRESSION_SEEDS: RegressionSeed[] = [
  // Найдено test:fuzz: прихожая ровно 14,0 м² считалась «больше 14» из-за 14.000000000000002.
  // Исправлено: проверка размеров перенесена в plausibilityViolations с допуском EPS.
  { seed: 1433, note: 'прихожая на границе 14 м²' },
  { seed: 2337, note: 'прихожая на границе 14 м²' },
];

export const DEFAULT_SEED_COUNT = 200;
export const FUZZ_SEED_COUNT = 5000;

/** 1…200 по умолчанию, 1…5000 в `npm run test:fuzz` (переменная FUZZ задаётся в vite.config.ts). */
export function seedRange(): number[] {
  const n = process.env.FUZZ ? FUZZ_SEED_COUNT : DEFAULT_SEED_COUNT;
  return Array.from({ length: n }, (_, i) => i + 1);
}
