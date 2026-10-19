/**
 * Вид 2D-плана: чистая математика перевода метров в пиксели, без Konva.
 * screen = world * scale + offset, где scale — пикселей на метр.
 */
import { PLAN_FIT_PADDING, PLAN_ZOOM_MAX, PLAN_ZOOM_MIN } from './constants';
import type { Vec2 } from './types';

export interface PlanView {
  /** Пикселей на метр. */
  scale: number;
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Bounds {
  min: Vec2;
  max: Vec2;
}

/** Вписать область в окно по центру с отступом. */
export function fitView(bounds: Bounds, size: Size, padding = PLAN_FIT_PADDING): PlanView {
  const w = Math.max(bounds.max[0] - bounds.min[0], 1e-6);
  const h = Math.max(bounds.max[1] - bounds.min[1], 1e-6);
  const availW = Math.max(size.width - 2 * padding, 1);
  const availH = Math.max(size.height - 2 * padding, 1);
  const scale = Math.min(availW / w, availH / h);
  return {
    scale,
    x: (size.width - w * scale) / 2 - bounds.min[0] * scale,
    y: (size.height - h * scale) / 2 - bounds.min[1] * scale,
  };
}

export function worldToScreen(v: PlanView, p: Vec2): Vec2 {
  return [p[0] * v.scale + v.x, p[1] * v.scale + v.y];
}

export function screenToWorld(v: PlanView, p: Vec2): Vec2 {
  return [(p[0] - v.x) / v.scale, (p[1] - v.y) / v.scale];
}

/** Допустимый масштаб: от 0.5× до 4× относительно вписанного. */
export function clampScale(scale: number, fitScale: number): number {
  return Math.min(fitScale * PLAN_ZOOM_MAX, Math.max(fitScale * PLAN_ZOOM_MIN, scale));
}

/** Масштаб к точке: точка под курсором остаётся на месте. */
export function zoomAt(v: PlanView, pointer: Vec2, factor: number, fitScale: number): PlanView {
  const scale = clampScale(v.scale * factor, fitScale);
  const world = screenToWorld(v, pointer);
  return { scale, x: pointer[0] - world[0] * scale, y: pointer[1] - world[1] * scale };
}

export function panBy(v: PlanView, dx: number, dy: number): PlanView {
  return { ...v, x: v.x + dx, y: v.y + dy };
}

/** Видимая область в метрах — для рамки на мини-карте. */
export function visibleBounds(v: PlanView, size: Size): Bounds {
  return {
    min: screenToWorld(v, [0, 0]),
    max: screenToWorld(v, [size.width, size.height]),
  };
}

/** Поставить точку плана в центр окна, не меняя масштаб. */
export function centerOn(v: PlanView, size: Size, world: Vec2): PlanView {
  return {
    scale: v.scale,
    x: size.width / 2 - world[0] * v.scale,
    y: size.height / 2 - world[1] * v.scale,
  };
}

/** Шаг pinch-жеста: масштаб по изменению расстояния между пальцами и сдвиг за центром жеста. */
export function pinchStep(
  v: PlanView,
  prev: { center: Vec2; dist: number },
  next: { center: Vec2; dist: number },
  fitScale: number,
): PlanView {
  const zoomed = zoomAt(v, prev.center, next.dist / Math.max(prev.dist, 1e-6), fitScale);
  return panBy(zoomed, next.center[0] - prev.center[0], next.center[1] - prev.center[1]);
}

/** Размер подписи на экране, px: растёт с масштабом, но в пределах [minPx, maxPx]. */
export function labelPx(size: number, scale: number, minPx: number, maxPx: number): number {
  return Math.min(maxPx, Math.max(minPx, size * scale));
}
