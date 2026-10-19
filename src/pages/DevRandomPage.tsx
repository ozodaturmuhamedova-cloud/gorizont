/**
 * /dev/random (только dev, CLAUDE.md §10.1): случайная квартира и мебель по seed — 2D-план и
 * 3D-сцена рядом, нарушения инвариантов списком. Seed и опции отражаются в URL.
 */
import { Suspense, lazy, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageLoader } from '../app/PageLoader';
import { defaultFinish, furniture } from '../data';
import { formatArea } from '../domain/format';
import { ROOM_COUNTS, type PlacedFurniture, type RoomCount } from '../domain/types';
import { useStore } from '../store';
import {
  apartmentViolations,
  furnitureViolations,
  plausibilityViolations,
  randomFurnished,
  type Density,
} from '../testing/random';
import { ApartmentMiniPlan } from '../ui/ApartmentMiniPlan';
import { FurnishToolbar } from '../ui/FurnishToolbar';

const ApartmentScene = lazy(() => import('../scene3d/ApartmentScene'));
const NONE: PlacedFurniture[] = [];
const DENSITIES: Density[] = ['sparse', 'normal', 'dense'];
const SHAPES = ['any', 'rect', 'L'] as const;

const field = 'rounded-lg border border-line bg-paper px-2 py-1 text-sm';

export default function DevRandomPage() {
  const [params, setParams] = useSearchParams();
  const seed = Math.max(1, Math.floor(Number(params.get('seed')) || 1));
  const roomsParam = params.get('rooms');
  const rooms: RoomCount | 'any' =
    ROOM_COUNTS.includes(Number(roomsParam) as RoomCount) &&
    roomsParam !== null &&
    roomsParam !== ''
      ? (Number(roomsParam) as RoomCount)
      : 'any';
  const shape = SHAPES.find((s) => s === params.get('shape')) ?? 'any';
  const density = DENSITIES.find((d) => d === params.get('density')) ?? 'normal';

  const result = useMemo(() => {
    const f = randomFurnished(seed, { rooms, shape, density });
    // своё id на каждый набор опций: мебель в сторе не перепутается
    const apartment = { ...f.apartment, id: `rnd-${seed}-${rooms}-${shape}-${density}` };
    return { ...f, apartment };
  }, [seed, rooms, shape, density]);
  const { apartment } = result;

  const setFurniture = useStore((s) => s.setFurniture);
  useEffect(() => {
    setFurniture(apartment.id, result.placed, result.skipped);
  }, [apartment.id, result, setFurniture]);
  const placed = useStore((s) => s.placed[apartment.id]) ?? NONE;

  const problems = [
    ...apartmentViolations(apartment),
    ...plausibilityViolations(apartment),
    ...furnitureViolations(apartment, placed, furniture).map((v) => v.message),
  ];

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) next.set(k, v);
    setParams(next, { replace: true });
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <h1 className="font-display text-xl font-semibold">Случайная квартира</h1>
        <label className="flex items-center gap-1 text-sm">
          seed
          <input
            type="number"
            min={1}
            value={seed}
            onChange={(e) => set({ seed: e.target.value })}
            className={`${field} w-24`}
            data-testid="seed"
          />
        </label>
        <label className="flex items-center gap-1 text-sm">
          комнат
          <select
            value={String(rooms)}
            onChange={(e) => set({ rooms: e.target.value === 'any' ? '' : e.target.value })}
            className={field}
          >
            <option value="any">любое</option>
            {ROOM_COUNTS.map((r) => (
              <option key={r} value={r}>
                {r === 0 ? 'студия' : r}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-sm">
          форма
          <select value={shape} onChange={(e) => set({ shape: e.target.value })} className={field}>
            {SHAPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-sm">
          мебель
          <select
            value={density}
            onChange={(e) => set({ density: e.target.value })}
            className={field}
          >
            {DENSITIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => set({ seed: String((seed * 7919 + 13) % 100000 || 1) })}
          className="rounded-xl bg-brand px-3 py-2 text-sm font-medium text-white"
        >
          Случайная квартира
        </button>
      </div>
      <p className="text-sm text-muted" data-testid="dev-summary">
        seed={seed} · {apartment.rooms === 0 ? 'студия' : `${apartment.rooms}-комн.`} ·{' '}
        {formatArea(apartment.area)} · мебели {placed.length}, не поместилось{' '}
        {result.skipped.length}
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-paper p-3">
          <ApartmentMiniPlan apartment={apartment} placed={placed} className="h-auto w-full" />
        </div>
        <div className="relative h-[min(60vh,560px)] min-h-[320px] overflow-hidden rounded-2xl border border-line bg-[#e3e7e0]">
          <Suspense fallback={<PageLoader />}>
            <ApartmentScene
              apartment={apartment}
              finish={defaultFinish}
              cut={false}
              resetKey={seed}
            />
          </Suspense>
          <FurnishToolbar apartment={apartment} />
        </div>
      </div>
      <section aria-label="Нарушения" className="text-sm" data-testid="dev-problems">
        {problems.length === 0 ? (
          <p className="text-brand">Инварианты выполнены.</p>
        ) : (
          <ul className="list-disc pl-5 text-[#b42318]">
            {problems.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
