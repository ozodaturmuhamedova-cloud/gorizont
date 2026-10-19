import { Group, Line } from 'react-konva';
import { formatArea } from '../domain/format';
import { bbox, openingSpan, polygonArea, polygonCentroid } from '../domain/geometry';
import { labelPx } from '../domain/planView';
import type { Apartment } from '../domain/types';
import { strings } from '../ui/strings';
import { PLAN_COLORS } from './colors';
import { PlanLabel } from './PlanLabel';

const NAME = { size: 0.36, minPx: 9, maxPx: 15 };
const AREA = { size: 0.3, minPx: 8, maxPx: 13 };
/** Перекрытие проёма чуть шире стены, чтобы не оставалось щелей. */
const OPENING_OVERLAP = 0.02;
/** Подписи не показываются, если комната на экране уже/ниже, px. */
const MIN_ROOM_WIDTH_PX = 44;
const MIN_ROOM_HEIGHT_PX = 34;

/** Детализация выбранной квартиры: комнаты с подписями, стены, двери, окна. Без событий. */
export function ApartmentRooms({ apartment: a, scale }: { apartment: Apartment; scale: number }) {
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
        const { min, max } = bbox(r.polygon);
        const width = max[0] - min[0];
        const height = max[1] - min[1];
        if (width * scale < MIN_ROOM_WIDTH_PX) return null;
        const at = polygonCentroid(r.polygon);
        const twoLines =
          height * scale >= MIN_ROOM_HEIGHT_PX + labelPx(AREA.size, scale, AREA.minPx, AREA.maxPx);
        return (
          <Group key={`l-${r.id}`}>
            <PlanLabel
              at={at}
              width={width}
              text={strings.roomTypes[r.type]}
              scale={scale}
              {...NAME}
              line={twoLines ? -0.55 : 0}
              bold
            />
            {twoLines && (
              <PlanLabel
                at={at}
                width={width}
                text={formatArea(polygonArea(r.polygon))}
                scale={scale}
                {...AREA}
                line={0.75}
                color={PLAN_COLORS.label}
              />
            )}
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
