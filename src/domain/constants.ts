/** Константы домена (CLAUDE.md §9: никаких магических чисел в коде). */

// ---------- общие ----------
/** Погрешность сравнения длин и координат, м. */
export const EPS = 1e-6;
/** Шаг сетки привязки, м. */
export const GRID_STEP = 0.1;

// ---------- здание ----------
export const CEILING_HEIGHT = 2.7;
export const WALL_EXTERIOR = 0.25;
export const WALL_INTERIOR = 0.1;
export const DOOR_HEIGHT = 2.1;
export const WINDOW_SILL = 0.85;
export const WINDOW_HEIGHT = 1.45;

// ---------- цены и данные ----------
/** Наценка за каждый этаж выше первого (+1,5 %). */
export const PRICE_FLOOR_STEP = 0.015;
/** Допуск между area в данных и площадью полигонов комнат, м². */
export const AREA_TOLERANCE = 0.5;

// ---------- 2D-план (§6) ----------
/** Масштаб относительно «вписанного» вида: от 0.5× до 4×. */
export const PLAN_ZOOM_MIN = 0.5;
export const PLAN_ZOOM_MAX = 4;
/** Шаг масштаба на одно деление колеса мыши. */
export const PLAN_WHEEL_STEP = 1.12;
/** Отступ при вписывании этажа в окно, px. */
export const PLAN_FIT_PADDING = 24;
/** Прозрачность квартир, не прошедших фильтр. */
export const PLAN_FILTERED_OPACITY = 0.25;

// ---------- прогулка (§7.1) ----------
export const HEIGHT_MIN_CM = 100;
export const HEIGHT_MAX_CM = 220;
export const HEIGHT_DEFAULT_CM = 170;
export const EYE_RATIO = 0.936;
export const CEILING_EYE_GAP = 0.1;

// ---------- расстановка мебели (§7.2) ----------
export const MAIN_PASSAGE = 0.8;
export const SECONDARY_PASSAGE = 0.6;
export const SNAP_DISTANCE = 0.15;
export const CORNER_SNAP_DISTANCE = 0.25;
export const LAYOUT_JITTER = 3;
