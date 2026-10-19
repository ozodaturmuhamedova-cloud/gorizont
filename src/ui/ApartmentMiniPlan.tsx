import { furniture } from '../data';
import { bbox, footprintObb, obbCorners, openingSpan } from '../domain/geometry';
import type { Apartment, PlacedFurniture, RoomType, Vec2 } from '../domain/types';
import { PLAN_COLORS } from '../scene2d/colors';
import { strings } from './strings';

/** Мягкие цвета помещений для мини-плана. */
const ROOM_FILL: Record<RoomType, string> = {
  living: '#e3eedb',
  bedroom: '#e6e2ef',
  kitchen: '#f3e3cc',
  bath: '#d8e8ee',
  hall: '#ece7dc',
  balcony: '#e4e4e4',
};

export interface ApartmentMiniPlanProps {
  apartment: Apartment;
  /** Мебель поверх плана (страница без WebGL, /dev/random). */
  placed?: readonly PlacedFurniture[];
  /** Посетитель в прогулке: точка и направление взгляда. */
  marker?: { position: Vec2; heading: number } | null;
  className?: string;
}

/** Планировка квартиры для карточки: SVG из тех же данных, что и 2D/3D-сцены. */
export function ApartmentMiniPlan({
  apartment: a,
  placed,
  marker,
  className = 'h-auto max-h-44 w-full',
}: ApartmentMiniPlanProps) {
  const { min, max } = bbox(a.outline);
  const pad = 0.3;
  const w = max[0] - min[0] + 2 * pad;
  const h = max[1] - min[1] + 2 * pad;
  const pts = (poly: Vec2[]) => poly.map((p) => p.join(',')).join(' ');
  return (
    <svg
      role="img"
      aria-label={strings.card.miniPlan(a.number)}
      viewBox={`${min[0] - pad} ${min[1] - pad} ${w} ${h}`}
      className={className}
    >
      {a.roomsGeometry.map((r) => (
        <polygon key={r.id} points={pts(r.polygon)} fill={ROOM_FILL[r.type]} />
      ))}
      {placed?.map((p, i) => {
        const item = furniture.byId.get(p.itemId);
        if (!item) return null;
        return (
          <polygon
            key={`f-${i}`}
            points={pts(obbCorners(footprintObb(item.size, p.position, p.rotation)))}
            fill={item.color ?? '#b9a58d'}
            stroke="#5b6761"
            strokeWidth={0.02}
            data-item={p.itemId}
          />
        );
      })}
      {a.walls.map((wl, i) => (
        <line
          key={i}
          x1={wl.a[0]}
          y1={wl.a[1]}
          x2={wl.b[0]}
          y2={wl.b[1]}
          stroke={PLAN_COLORS.wall}
          strokeWidth={wl.thickness}
          strokeLinecap="square"
        />
      ))}
      {a.openings.map((o, i) => {
        const wl = a.walls[o.wallIndex];
        if (!wl) return null;
        const [p0, p1] = openingSpan(wl, o);
        const door = o.kind === 'door';
        return (
          <line
            key={`o-${i}`}
            x1={p0[0]}
            y1={p0[1]}
            x2={p1[0]}
            y2={p1[1]}
            stroke={door ? '#ffffff' : PLAN_COLORS.window}
            strokeWidth={door ? wl.thickness + 0.02 : wl.thickness * 0.55}
          />
        );
      })}
      {marker && (
        <g data-testid="walk-marker">
          <line
            x1={marker.position[0]}
            y1={marker.position[1]}
            x2={marker.position[0] + Math.cos(marker.heading) * 0.9}
            y2={marker.position[1] + Math.sin(marker.heading) * 0.9}
            stroke={PLAN_COLORS.window}
            strokeWidth={0.14}
            strokeLinecap="round"
          />
          <circle
            cx={marker.position[0]}
            cy={marker.position[1]}
            r={0.28}
            fill="#2c6a57"
            stroke="#fff"
            strokeWidth={0.07}
          />
        </g>
      )}
    </svg>
  );
}
