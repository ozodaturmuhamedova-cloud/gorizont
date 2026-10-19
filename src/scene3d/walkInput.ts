/**
 * Ввод прогулки с сенсорного экрана: джойстик и свайп пишут сюда, WalkRig читает в useFrame.
 * Обычный объект, а не стор: значения меняются десятки раз в секунду и не должны вызывать
 * перерисовку React (CLAUDE.md §8).
 */
export const walkInput = {
  /** Джойстик: x — вправо, y — вперёд, длина ≤ 1. */
  move: [0, 0] as [number, number],
  /** Накопленный свайп обзора в пикселях; WalkRig обнуляет после чтения. */
  look: [0, 0] as [number, number],
};

export function resetWalkInput(): void {
  walkInput.move = [0, 0];
  walkInput.look = [0, 0];
}
