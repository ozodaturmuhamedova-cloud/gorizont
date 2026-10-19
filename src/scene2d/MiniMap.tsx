import type { MouseEvent } from 'react';
import { bbox } from '../domain/geometry';
import type { Bounds } from '../domain/planView';
import type { Apartment, FloorPlate, Vec2 } from '../domain/types';
import { strings } from '../ui/strings';
import { PLAN_COLORS, STATUS_COLORS } from './colors';

export interface MiniMapProps {
  floorPlate: FloorPlate;
  apartments: Apartment[];
  selectedId: string | null;
  /** Видимая часть плана в метрах. */
  visible: Bounds;
  onNavigate: (world: Vec2) => void;
}

const WIDTH = 132;

/** Мини-карта этажа с рамкой видимой области. Клик переносит вид в эту точку. */
export function MiniMap({ floorPlate, apartments, selectedId, visible, onNavigate }: MiniMapProps) {
  const { min, max } = bbox(floorPlate.outline);
  const w = max[0] - min[0];
  const h = max[1] - min[1];
  const pts = (poly: Vec2[]) => poly.map((p) => p.join(',')).join(' ');
  const vx = Math.max(min[0], visible.min[0]);
  const vy = Math.max(min[1], visible.min[1]);
  const vw = Math.min(max[0], visible.max[0]) - vx;
  const vh = Math.min(max[1], visible.max[1]) - vy;
  const showFrame = vw > 0 && vh > 0 && (vw < w - 0.01 || vh < h - 0.01);

  const onClick = (e: MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onNavigate([
      min[0] + ((e.clientX - r.left) / r.width) * w,
      min[1] + ((e.clientY - r.top) / r.height) * h,
    ]);
  };

  return (
    <svg
      role="img"
      aria-label={strings.plan.minimap}
      viewBox={`${min[0]} ${min[1]} ${w} ${h}`}
      width={WIDTH}
      height={(WIDTH * h) / w}
      onClick={onClick}
      className="cursor-pointer"
    >
      <polygon points={pts(floorPlate.outline)} fill={PLAN_COLORS.floor} />
      {floorPlate.core.map((c, i) => (
        <polygon key={i} points={pts(c.polygon)} fill={PLAN_COLORS.core} />
      ))}
      {apartments.map((a) => (
        <polygon
          key={a.id}
          points={pts(a.outline)}
          fill={STATUS_COLORS[a.status]}
          fillOpacity={a.id === selectedId ? 0.9 : 0.45}
          stroke={a.id === selectedId ? PLAN_COLORS.selected : 'none'}
          strokeWidth={0.4}
        />
      ))}
      {showFrame && (
        <rect
          x={vx}
          y={vy}
          width={vw}
          height={vh}
          fill="none"
          stroke={PLAN_COLORS.ink}
          strokeWidth={0.35}
        />
      )}
    </svg>
  );
}
