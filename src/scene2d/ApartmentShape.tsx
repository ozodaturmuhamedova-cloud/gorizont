import type { KonvaEventObject } from 'konva/lib/Node';
import { memo } from 'react';
import { Group, Line } from 'react-konva';
import { PLAN_FILTERED_OPACITY } from '../domain/constants';
import { bbox, polygonCentroid } from '../domain/geometry';
import type { Apartment } from '../domain/types';
import { strings } from '../ui/strings';
import { PLAN_COLORS, STATUS_COLORS } from './colors';
import { PlanLabel } from './PlanLabel';

/** Желаемые размеры подписей в метрах плана; на экране — в пределах min/max px. */
const NUMBER = { size: 0.95, minPx: 11, maxPx: 26 };
const META = { size: 0.42, minPx: 9, maxPx: 14 };
/** Мельче этого строка «2к · 63 м²» не показывается, px. */
const META_HIDE_BELOW_PX = 6;

export interface ApartmentShapeProps {
  apartment: Apartment;
  hovered: boolean;
  selected: boolean;
  /** Не прошла фильтр (фаза 3): остаётся на плане, но бледнее. */
  dimmed?: boolean;
  /** Масштаб плана, px/м — для подписей в экранных пикселях. */
  scale: number;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}

export const ApartmentShape = memo(function ApartmentShape({
  apartment: a,
  hovered,
  selected,
  dimmed = false,
  scale,
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
          <PlanLabel
            at={[cx, cy]}
            width={width}
            text={String(a.number)}
            scale={scale}
            {...NUMBER}
            line={-0.35}
            bold
            color={sold ? PLAN_COLORS.label : PLAN_COLORS.ink}
          />
          {META.size * scale >= META_HIDE_BELOW_PX && (
            <PlanLabel
              at={[cx, cy]}
              width={width}
              text={`${strings.apartment.roomsShort(a.rooms)} · ${a.area.toLocaleString('ru-RU')} м²`}
              scale={scale}
              {...META}
              line={1.3}
              color={PLAN_COLORS.label}
            />
          )}
        </>
      )}
    </Group>
  );
});
