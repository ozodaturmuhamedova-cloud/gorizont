import type { KonvaEventObject } from 'konva/lib/Node';
import { memo } from 'react';
import { Group, Line, Text } from 'react-konva';
import { PLAN_FILTERED_OPACITY } from '../domain/constants';
import { bbox, polygonCentroid } from '../domain/geometry';
import type { Apartment } from '../domain/types';
import { strings } from '../ui/strings';
import { PLAN_COLORS, STATUS_COLORS } from './colors';

/** Размеры подписей в метрах: масштабируются вместе с планом. */
const NUMBER_SIZE = 0.95;
const META_SIZE = 0.42;
const FONT = 'Onest, system-ui, sans-serif';

export interface ApartmentShapeProps {
  apartment: Apartment;
  hovered: boolean;
  selected: boolean;
  /** Не прошла фильтр (фаза 3): остаётся на плане, но бледнее. */
  dimmed?: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}

export const ApartmentShape = memo(function ApartmentShape({
  apartment: a,
  hovered,
  selected,
  dimmed = false,
  onHover,
  onSelect,
}: ApartmentShapeProps) {
  const color = STATUS_COLORS[a.status];
  const sold = a.status === 'sold';
  const points = a.outline.flat();
  const [cx, cy] = polygonCentroid(a.outline);
  const { min, max } = bbox(a.outline);
  const width = max[0] - min[0];

  const setCursor = (e: KonvaEventObject<MouseEvent>, cursor: string) => {
    const stage = e.target.getStage();
    if (stage) stage.container().style.cursor = cursor;
  };

  return (
    <Group
      name={`apartment-${a.id}`}
      opacity={dimmed ? PLAN_FILTERED_OPACITY : 1}
      onMouseEnter={(e) => {
        onHover(a.id);
        setCursor(e, sold ? 'not-allowed' : 'pointer');
      }}
      onMouseLeave={(e) => {
        onHover(null);
        setCursor(e, '');
      }}
      onClick={() => !sold && onSelect(a.id)}
      onTap={() => !sold && onSelect(a.id)}
    >
      <Line
        points={points}
        closed
        fill={color}
        opacity={selected ? 0.12 : hovered ? 0.55 : sold ? 0.28 : 0.38}
        strokeEnabled={false}
      />
      <Line
        points={points}
        closed
        stroke={selected ? PLAN_COLORS.selected : color}
        strokeWidth={selected ? 3 : hovered ? 2.5 : 1.5}
        strokeScaleEnabled={false}
        listening={false}
      />
      {!selected && (
        <>
          <Text
            x={cx - width / 2}
            y={cy - NUMBER_SIZE * 0.85}
            width={width}
            align="center"
            text={String(a.number)}
            fontSize={NUMBER_SIZE}
            fontFamily={FONT}
            fontStyle="600"
            fill={sold ? PLAN_COLORS.label : PLAN_COLORS.ink}
            listening={false}
          />
          <Text
            x={cx - width / 2}
            y={cy + NUMBER_SIZE * 0.3}
            width={width}
            align="center"
            text={`${strings.apartment.roomsShort(a.rooms)} · ${a.area.toLocaleString('ru-RU')} м²`}
            fontSize={META_SIZE}
            fontFamily={FONT}
            fill={PLAN_COLORS.label}
            listening={false}
          />
        </>
      )}
    </Group>
  );
});
