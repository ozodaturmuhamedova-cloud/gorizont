import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Layer, Line, Stage } from 'react-konva';
import { PLAN_WHEEL_STEP } from '../domain/constants';
import { formatArea, formatPrice } from '../domain/format';
import { bbox, polygonCentroid } from '../domain/geometry';
import {
  centerOn,
  fitView,
  pinchStep,
  visibleBounds,
  worldToScreen,
  zoomAt,
  type PlanView,
  type Size,
} from '../domain/planView';
import type { Apartment, FloorPlate, Vec2 } from '../domain/types';
import { strings } from '../ui/strings';
import { ApartmentRooms } from './ApartmentRooms';
import { ApartmentShape } from './ApartmentShape';
import { PLAN_COLORS, STATUS_COLORS } from './colors';
import { MiniMap } from './MiniMap';
import { PlanLabel } from './PlanLabel';

// Чтобы pinch работал, пока сцена перетаскивается одним пальцем
Konva.hitOnDragEnabled = true;

/** Подписи подложки: желаемый размер в метрах и границы в пикселях. */
const BG_LABEL = { size: 0.45, minPx: 9, maxPx: 13 };
/** Сдвиг до того, как нажатие считается перетаскиванием, а не кликом, px. */
const DRAG_DISTANCE = 4;
const TOOLTIP_OFFSET = 14;

export interface FloorPlanStageProps {
  floor: number;
  floorPlate: FloorPlate;
  apartments: Apartment[];
  selectedId: string | null;
  hoveredId: string | null;
  /** id квартир, прошедших фильтр; undefined — фильтр не задан. */
  matchingIds?: ReadonlySet<string>;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}

interface Pinch {
  center: Vec2;
  dist: number;
}

declare global {
  interface Window {
    /** Только в dev: координаты квартиры на экране — для e2e-тестов клика по canvas. */
    __gorizontPlan?: { apartmentPoint: (id: string) => { x: number; y: number } | null };
  }
}

export function FloorPlanStage(props: FloorPlanStageProps) {
  const { floor, floorPlate, apartments, selectedId, hoveredId, matchingIds, onHover, onSelect } =
    props;
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [view, setView] = useState<PlanView | null>(null);
  const [pointer, setPointer] = useState<Vec2 | null>(null);
  const pinch = useRef<Pinch | null>(null);

  const bounds = useMemo(() => bbox(floorPlate.outline), [floorPlate]);
  const fit = useMemo(
    () => (size.width > 0 && size.height > 0 ? fitView(bounds, size) : null),
    [bounds, size],
  );

  // Размер сцены следует за контейнером
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width: Math.round(width), height: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // При смене этажа или размера окна — снова весь этаж (до отрисовки, без кадра со старым видом)
  useLayoutEffect(() => {
    if (fit) setView(fit);
  }, [fit, floor]);

  // Мини-карта нужна, только когда виден не весь этаж
  const zoomedIn = useMemo(() => {
    if (!view) return false;
    const v = visibleBounds(view, size);
    const eps = 0.05;
    return (
      v.min[0] > bounds.min[0] + eps ||
      v.min[1] > bounds.min[1] + eps ||
      v.max[0] < bounds.max[0] - eps ||
      v.max[1] < bounds.max[1] - eps
    );
  }, [view, size, bounds]);

  const selected = apartments.find((a) => a.id === selectedId) ?? null;
  const hovered = apartments.find((a) => a.id === hoveredId) ?? null;

  const zoomBy = useCallback(
    (factor: number, at?: Vec2) => {
      if (!fit) return;
      setView((v) =>
        v ? zoomAt(v, at ?? [size.width / 2, size.height / 2], factor, fit.scale) : v,
      );
    },
    [fit, size],
  );

  const onWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const p = e.target.getStage()?.getPointerPosition();
    if (!p) return;
    zoomBy(e.evt.deltaY > 0 ? 1 / PLAN_WHEEL_STEP : PLAN_WHEEL_STEP, [p.x, p.y]);
  };

  const touchState = (e: KonvaEventObject<TouchEvent>): Pinch | null => {
    const t = e.evt.touches;
    const rect = containerRef.current?.getBoundingClientRect();
    if (t.length !== 2 || !rect) return null;
    const a: Vec2 = [t[0]!.clientX - rect.left, t[0]!.clientY - rect.top];
    const b: Vec2 = [t[1]!.clientX - rect.left, t[1]!.clientY - rect.top];
    return {
      center: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      dist: Math.hypot(a[0] - b[0], a[1] - b[1]),
    };
  };

  const onTouchMove = (e: KonvaEventObject<TouchEvent>) => {
    const next = touchState(e);
    if (!next || !fit) return;
    e.evt.preventDefault();
    e.target.getStage()?.stopDrag();
    const prev = pinch.current;
    if (prev) setView((v) => (v ? pinchStep(v, prev, next, fit.scale) : v));
    pinch.current = next;
  };

  // Только в dev: точка квартиры на экране для e2e
  useEffect(() => {
    if (!import.meta.env.DEV || !view) return;
    window.__gorizontPlan = {
      apartmentPoint: (id) => {
        const a = apartments.find((x) => x.id === id);
        const rect = containerRef.current?.getBoundingClientRect();
        if (!a || !rect) return null;
        const [x, y] = worldToScreen(view, polygonCentroid(a.outline));
        return { x: rect.left + x, y: rect.top + y };
      },
    };
    return () => {
      delete window.__gorizontPlan;
    };
  }, [view, apartments]);

  const tooltip =
    hovered && pointer ? (
      <div
        role="tooltip"
        className="pointer-events-none absolute z-20 max-w-[240px] rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white shadow-lg"
        style={{
          left: Math.min(pointer[0] + TOOLTIP_OFFSET, Math.max(0, size.width - 240)),
          top: Math.min(pointer[1] + TOOLTIP_OFFSET, Math.max(0, size.height - 64)),
        }}
      >
        <div className="font-medium">
          {strings.apartment.number(hovered.number)} · {strings.apartment.rooms(hovered.rooms)} ·{' '}
          {formatArea(hovered.area)}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 opacity-90">
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full"
            style={{ background: STATUS_COLORS[hovered.status] }}
          />
          {strings.status[hovered.status]}
          {hovered.status !== 'sold' && <> · {formatPrice(hovered.price)}</>}
        </div>
      </div>
    ) : null;

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-[320px] w-full touch-none overflow-hidden rounded-2xl border border-line bg-paper"
      aria-label={strings.plan.canvasLabel(floor)}
      data-testid="floor-plan"
    >
      {view && (
        <Stage
          width={size.width}
          height={size.height}
          x={view.x}
          y={view.y}
          scaleX={view.scale}
          scaleY={view.scale}
          draggable
          dragDistance={DRAG_DISTANCE}
          onDragMove={(e) => {
            const s = e.target;
            if (s instanceof Konva.Stage) setView((v) => (v ? { ...v, x: s.x(), y: s.y() } : v));
          }}
          onWheel={onWheel}
          onTouchMove={onTouchMove}
          onTouchEnd={() => {
            pinch.current = null;
          }}
          onMouseMove={(e) => {
            const p = e.target.getStage()?.getPointerPosition();
            if (p) setPointer([p.x, p.y]);
          }}
          onMouseLeave={() => setPointer(null)}
        >
          {/* Подложка: этаж, коридор, лестница и лифты. Статичная, без событий. */}
          <Layer listening={false}>
            <Line
              points={floorPlate.outline.flat()}
              closed
              fill={PLAN_COLORS.floor}
              stroke={PLAN_COLORS.floorStroke}
              strokeWidth={2}
              strokeScaleEnabled={false}
            />
            <Line points={floorPlate.corridor.flat()} closed fill={PLAN_COLORS.corridor} />
            {floorPlate.core.map((c, i) => (
              <Line
                key={i}
                points={c.polygon.flat()}
                closed
                fill={PLAN_COLORS.core}
                stroke={PLAN_COLORS.coreStroke}
                strokeWidth={1}
                strokeScaleEnabled={false}
              />
            ))}
            {floorPlate.core.map((c, i) => {
              const { min, max } = bbox(c.polygon);
              return (
                <PlanLabel
                  key={`t-${i}`}
                  at={polygonCentroid(c.polygon)}
                  width={max[0] - min[0]}
                  text={c.type === 'stairs' ? strings.plan.stairs : strings.plan.lift}
                  scale={view.scale}
                  {...BG_LABEL}
                  color={PLAN_COLORS.label}
                />
              );
            })}
            <PlanLabel
              at={polygonCentroid(floorPlate.corridor)}
              width={bbox(floorPlate.corridor).max[0] - bbox(floorPlate.corridor).min[0]}
              text={strings.plan.corridor}
              scale={view.scale}
              {...BG_LABEL}
              color={PLAN_COLORS.label}
            />
          </Layer>

          {/* Квартиры: единственный интерактивный слой */}
          <Layer>
            {apartments.map((a) => (
              <ApartmentShape
                key={a.id}
                apartment={a}
                hovered={a.id === hoveredId}
                selected={a.id === selectedId}
                dimmed={matchingIds ? !matchingIds.has(a.id) : false}
                scale={view.scale}
                onHover={onHover}
                onSelect={onSelect}
              />
            ))}
          </Layer>

          {/* Детализация выбранной квартиры поверх, без событий */}
          <Layer listening={false}>
            {selected && <ApartmentRooms apartment={selected} scale={view.scale} />}
          </Layer>
        </Stage>
      )}

      {tooltip}

      <div className="absolute right-3 top-3 z-10 flex flex-col overflow-hidden rounded-xl border border-line bg-paper/95 text-lg shadow-sm">
        <button
          type="button"
          aria-label={strings.plan.zoomIn}
          className="h-9 w-9 hover:bg-brand-soft"
          onClick={() => zoomBy(PLAN_WHEEL_STEP * PLAN_WHEEL_STEP)}
        >
          +
        </button>
        <button
          type="button"
          aria-label={strings.plan.zoomOut}
          className="h-9 w-9 border-t border-line hover:bg-brand-soft"
          onClick={() => zoomBy(1 / (PLAN_WHEEL_STEP * PLAN_WHEEL_STEP))}
        >
          −
        </button>
        <button
          type="button"
          aria-label={strings.plan.fit}
          title={strings.plan.fit}
          className="h-9 w-9 border-t border-line text-sm hover:bg-brand-soft"
          onClick={() => fit && setView(fit)}
        >
          ⤢
        </button>
      </div>

      {view && zoomedIn && (
        <div className="absolute bottom-3 right-3 z-10 rounded-lg border border-line bg-paper/95 p-1.5 shadow-sm">
          <MiniMap
            floorPlate={floorPlate}
            apartments={apartments}
            selectedId={selectedId}
            visible={visibleBounds(view, size)}
            onNavigate={(w) => setView((v) => (v ? centerOn(v, size, w) : v))}
          />
        </div>
      )}
    </div>
  );
}
