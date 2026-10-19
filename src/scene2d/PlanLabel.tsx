import { Text } from 'react-konva';
import { labelPx } from '../domain/planView';
import type { Vec2 } from '../domain/types';
import { PLAN_COLORS } from './colors';

const FONT = 'Onest, system-ui, sans-serif';

export interface PlanLabelProps {
  /** Центр подписи на плане, м. */
  at: Vec2;
  /** Доступная ширина на плане, м: шире текст обрезается многоточием. */
  width: number;
  text: string;
  /** Текущий масштаб плана, px/м. */
  scale: number;
  /** Желаемый размер шрифта в метрах плана и границы в пикселях. */
  size: number;
  minPx: number;
  maxPx: number;
  /** Сдвиг по вертикали в долях размера шрифта (−1 — на строку выше). */
  line?: number;
  color?: string;
  bold?: boolean;
}

/**
 * Подпись на плане в экранных пикселях. Шрифт в долях метра браузер рисует с ошибками
 * межбуквенных расстояний («4 9»), поэтому текст компенсирует масштаб сцены (scale 1/s).
 */
export function PlanLabel({
  at,
  width,
  text,
  scale,
  size,
  minPx,
  maxPx,
  line = 0,
  color = PLAN_COLORS.ink,
  bold = false,
}: PlanLabelProps) {
  const px = labelPx(size, scale, minPx, maxPx);
  const w = width * scale;
  return (
    <Text
      x={at[0]}
      y={at[1]}
      scaleX={1 / scale}
      scaleY={1 / scale}
      width={w}
      offsetX={w / 2}
      offsetY={px / 2 - line * px * 1.15}
      align="center"
      wrap="none"
      ellipsis
      text={text}
      fontSize={px}
      fontFamily={FONT}
      fontStyle={bold ? '600' : 'normal'}
      fill={color}
      listening={false}
      perfectDrawEnabled={false}
    />
  );
}
