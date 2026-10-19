/**
 * Детерминированный генератор псевдослучайных чисел (mulberry32).
 * Лежит в domain/, а не в testing/: им пользуется и прод-код (случайная добавка к оценке
 * в авторасстановке, §7.2), и генераторы тестовых данных (§10.1). Math.random() не используем.
 */
export interface Rng {
  /** Число в [0, 1). */
  next(): number;
  /** Целое в [a, b] включительно. */
  int(a: number, b: number): number;
  /** Число в [a, b). */
  float(a: number, b: number): number;
  /** Случайный элемент непустого массива. */
  pick<T>(arr: readonly T[]): T;
  /** Новый массив в случайном порядке (Фишер — Йейтс), исходный не меняется. */
  shuffle<T>(arr: readonly T[]): T[];
  /** true с вероятностью p. */
  chance(p: number): boolean;
}

export function createRng(seed: number): Rng {
  let state = seed | 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (a: number, b: number): number => {
    if (b < a) throw new RangeError(`int(${a}, ${b}): b меньше a`);
    return a + Math.floor(next() * (b - a + 1));
  };
  return {
    next,
    int,
    float: (a, b) => a + (b - a) * next(),
    pick<T>(arr: readonly T[]): T {
      if (arr.length === 0) throw new RangeError('pick: пустой массив');
      return arr[Math.floor(next() * arr.length)]!;
    },
    shuffle<T>(arr: readonly T[]): T[] {
      const out = [...arr];
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(0, i);
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
    chance: (p) => next() < p,
  };
}
