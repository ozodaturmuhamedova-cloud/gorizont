import { Group, Line, Text } from 'react-konva';
import { formatArea } from '../domain/format';
import { bbox, openingSpan, polygonArea, polygonCentroid } from '../domain/geometry';
import type { Apartment } from '../domain/types';
import { strings } from '../ui/strings';
import { PLAN_COLORS } from './colors';

const LABEL_SIZE = 0.36;
const AREA_SIZE = 0.3;
const FONT = 'Onest, system-ui, sans-serif';
/** Перекрытие проёма чуть шире стены, чтобы не оставалось щелей. */
const OPENING_OVERLAP = 0.02;

/** Детализация выбранной квартиры: комнаты с подписями, стены, двери, окна. Без событий. */
export function ApartmentRooms({ apartment: a }: { apartment: Apartment }) {
  return (
    <Group listening={false} name="apartment-rooms">
      {a.roomsGeometry.map((r) => (
        <Line key={`f-${r.id}`} points={r.polygon.flat()} closed fill={PLAN_COLORS.roomFill} />
      ))}
      {a.walls.map((w, i) => (
        <Line
          key={`w-${i}`}
          points={[...w.a, ...w.b]}
          stroke={PLAN_COLORS.wall}
          strokeWidth={w.thickness}
          lineCap="square"
        />
      ))}
      {a.openings.map((o, i) => {
        const w = a.walls[o.wallIndex];
        if (!w) return null;
        const [p0, p1] = openingSpan(w, o);
        const door = o.kind === 'door';
        return (
          <Line
            key={`o-${i}`}
            points={[...p0, ...p1]}
            stroke={door ? PLAN_COLORS.roomFill : PLAN_COLORS.window}
            strokeWidth={door ? w.thickness + OPENING_OVERLAP : w.thickness * 0.55}
          />
        );
      })}
      {a.roomsGeometry.map((r) => {
        const [cx, cy] = polygonCentroid(r.polygon);
        const { min, max } = bbox(r.polygon);
        const width = max[0] - min[0];
        return (
          <Group key={`l-${r.id}`}>
            <Text
              x={cx - width / 2}
              y={cy - LABEL_SIZE}
              width={width}
              align="center"
              text={strings.roomTypes[r.type]}
              fontSize={LABEL_SIZE}
              fontFamily={FONT}
              fontStyle="600"
              fill={PLAN_COLORS.ink}
            />
            <Text
              x={cx - width / 2}
              y={cy + 0.05}
              width={width}
              align="center"
              text={formatArea(polygonArea(r.polygon))}
              fontSize={AREA_SIZE}
              fontFamily={FONT}
              fill={PLAN_COLORS.label}
            />
          </Group>
        );
      })}
      <Line
        points={a.outline.flat()}
        closed
        stroke={PLAN_COLORS.selected}
        strokeWidth={3}
        strokeScaleEnabled={false}
      />
    </Group>
  );
}
