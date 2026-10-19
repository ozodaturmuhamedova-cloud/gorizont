import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageLoader } from '../app/PageLoader';
import { defaultFinish, findApartment, findFinish, finishes, furniture } from '../data';
import { formatArea, formatPrice } from '../domain/format';
import { furnishApartment } from '../domain/layout';
import { createRng } from '../domain/rng';
import type { PlacedFurniture } from '../domain/types';
import { hasWebGL } from '../scene3d/webgl';
import { useStore } from '../store';
import { ApartmentMiniPlan } from '../ui/ApartmentMiniPlan';
import { Catalog } from '../ui/Catalog';
import { EstimatePanel } from '../ui/Estimate';
import { FurnishToolbar } from '../ui/FurnishToolbar';
import { strings } from '../ui/strings';
import { NotFound } from './NotFound';

const ApartmentScene = lazy(() => import('../scene3d/ApartmentScene'));
const NO_FURNITURE: PlacedFurniture[] = [];

export default function Tour3DPage() {
  const { id = '' } = useParams();
  const apt = findApartment(id);
  const finishId = useStore((s) => s.finishId);
  const setFinish = useStore((s) => s.setFinish);
  const cut = useStore((s) => s.wallsCut);
  const setCut = useStore((s) => s.setWallsCut);
  const setFurniture = useStore((s) => s.setFurniture);
  const placed = useStore((s) => (apt ? s.placed[apt.id] : undefined)) ?? NO_FURNITURE;
  const [resetKey, setResetKey] = useState(0);
  const presetSeed = useRef(0);
  const webgl = useMemo(() => hasWebGL(), []);

  // уходя со страницы, не оставляем «призрак» и выбор
  useEffect(
    () => () => {
      useStore.getState().setPlacing(null);
      useStore.getState().selectFurniture(null);
    },
    [],
  );

  if (!apt) return <NotFound />;
  const s = strings.tour;
  const finish = findFinish(finishId) ?? defaultFinish;
  // «Готовый комплект»: каждое нажатие — новый вариант (seed 1, 2, 3…), воспроизводимый
  const onPreset = () => {
    presetSeed.current += 1;
    const res = furnishApartment(apt, furniture, createRng(presetSeed.current));
    setFurniture(apt.id, res.placed, res.skipped);
  };

  return (
    <section className="flex flex-col gap-4">
      <Link to="/" className="w-fit text-sm text-brand hover:underline">
        ← {s.back}
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {s.title(apt.number)}
          </h1>
          <p className="text-sm text-muted">
            {[
              strings.apartment.floor(apt.floor),
              strings.apartment.rooms(apt.rooms),
              formatArea(apt.area),
            ].join(' · ')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={cut}
            onClick={() => setCut(!cut)}
            className={`rounded-xl border px-3 py-2 text-sm font-medium ${
              cut ? 'border-brand bg-brand text-white' : 'border-line bg-paper hover:border-brand'
            }`}
          >
            {s.cut}
          </button>
          <button
            type="button"
            onClick={() => setResetKey((k) => k + 1)}
            className="rounded-xl border border-line bg-paper px-3 py-2 text-sm font-medium hover:border-brand"
          >
            {s.resetView}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-2">
          <div
            className="relative h-[min(70vh,680px)] min-h-[320px] overflow-hidden rounded-2xl border border-line bg-[#e3e7e0]"
            role="img"
            aria-label={s.sceneLabel(apt.number)}
          >
            {webgl ? (
              <>
                <Suspense fallback={<PageLoader />}>
                  <ApartmentScene apartment={apt} finish={finish} cut={cut} resetKey={resetKey} />
                </Suspense>
                <FurnishToolbar apartment={apt} />
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
                <p className="max-w-md text-sm text-muted">{s.noWebGL}</p>
                <div className="w-full max-w-md rounded-xl bg-paper p-3">
                  <ApartmentMiniPlan apartment={apt} placed={placed} />
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-muted">
            <span className="lg:hidden">{s.hintTouch}</span>
            <span className="hidden lg:inline">{s.hint}</span>
          </p>
        </div>

        <aside className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2 rounded-2xl border border-line bg-paper p-4">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">
              {s.finish}
            </legend>
            {finishes.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={f.id === finish.id}
                onClick={() => setFinish(f.id)}
                className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm ${
                  f.id === finish.id
                    ? 'border-brand bg-brand-soft'
                    : 'border-line hover:border-brand'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="flex overflow-hidden rounded-md border border-line"
                  >
                    <span className="h-5 w-3" style={{ background: f.floor.wood }} />
                    <span className="h-5 w-3" style={{ background: f.wall }} />
                    <span className="h-5 w-3" style={{ background: f.floor.tile }} />
                  </span>
                  <span className="font-medium">{f.name}</span>
                </span>
                <span className="tabular-nums text-muted">
                  {f.pricePerM2 === 0 ? s.finishIncluded : s.finishPerM2(formatPrice(f.pricePerM2))}
                </span>
              </button>
            ))}
          </fieldset>

          <EstimatePanel
            apartment={apt}
            finish={finish}
            onPreset={onPreset}
            onClear={() => setFurniture(apt.id, [])}
          />
          <Catalog disabled={!webgl} />
        </aside>
      </div>
    </section>
  );
}
