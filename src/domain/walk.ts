/**
 * Рост посетителя → параметры прогулки (§7.1). Расстановка мебели (§7.2) использует
 * collisionRadius, чтобы проверить, что к каждому предмету можно подойти.
 */
import { CEILING_EYE_GAP, EYE_RATIO, HEIGHT_MAX_CM, HEIGHT_MIN_CM } from './constants';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Рост в допустимом диапазоне 100–220 см. */
export function isValidHeight(cm: number): boolean {
  return Number.isFinite(cm) && cm >= HEIGHT_MIN_CM && cm <= HEIGHT_MAX_CM;
}

/** Высота глаз, м. */
export function eyeHeight(cm: number): number {
  return round2((cm / 100) * EYE_RATIO);
}

/** Высота камеры: глаза, но не выше потолка минус зазор. */
export function cameraHeight(cm: number, ceiling: number): number {
  return Math.min(eyeHeight(cm), round2(ceiling - CEILING_EYE_GAP));
}

/** «Плечи» посетителя — радиус круга коллизий, м. */
export function collisionRadius(cm: number): number {
  return clamp((cm / 100) * 0.13, 0.18, 0.28);
}

/** Скорость шага, м/с. */
export function walkSpeed(cm: number): number {
  return clamp((cm / 100) * 0.8, 1.0, 1.6);
}
