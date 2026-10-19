import { Suspense, lazy, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageLoader } from '../app/PageLoader';
import { defaultFinish, findApartment, findFinish, finishes } from '../data';
import { formatArea, formatPrice } from '../domain/format';
import { finishCost } from '../domain/pricing';
import { hasWebGL } from '../scene3d/webgl';
import { useStore } from '../store';
import { ApartmentMiniPlan } from '../ui/ApartmentMiniPlan';
import { strings } from '../ui/strings';
import { NotFound } from './NotFound';

const ApartmentScene = lazy(() => import('../scene3d/ApartmentScene'));

export default function Tour3DPage() {
  const { id = '' } = useParams();
  const apt = findApartment(id);
  const finishId = useStore((s) => s.finishId);
  const setFinish = useStore((s) => s.setFinish);
  const cut = useStore((s) => s.wallsCut);
  const setCut = useStore((s) => s.setWallsCut);
  const [resetKey, setResetKey] = useState(0);
  const webgl = useMemo(() => hasWebGL(), []);

  if (!apt) return <NotFound />;
  const s = strings.tour;
  const finish = findFinish(finishId) ?? defaultFinish;
  const finishTotal = finishCost(finish, apt.area);

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
            className="relative h-[min(70vh,680px)] min-h-[320px] overflow-hidden rounded-2xl border border-line bg-[#dde2db]"
            role="img"
            aria-label={s.sceneLabel(apt.number)}
          >
            {webgl ? (
              <Suspense fallback={<PageLoader />}>
                <ApartmentScene apartment={apt} finish={finish} cut={cut} resetKey={resetKey} />
              </Suspense>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
                <p className="max-w-md text-sm text-muted">{s.noWebGL}</p>
                <div className="w-full max-w-md rounded-xl bg-paper p-3">
                  <ApartmentMiniPlan apartment={apt} />
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

          <section
            aria-label={s.summary}
            className="flex flex-col gap-2 rounded-2xl border border-line bg-paper p-4 text-sm"
          >
            <div className="flex justify-between gap-3">
              <span className="text-muted">{s.apartmentLine(apt.number)}</span>
              <span className="tabular-nums">{formatPrice(apt.price)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted">{s.finishLine(finish.name)}</span>
              <span className="tabular-nums" data-testid="finish-cost">
                {finishTotal === 0 ? s.finishIncluded : formatPrice(finishTotal)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2">
              <span className="font-medium">{s.total}</span>
              <span className="font-display text-lg font-semibold tabular-nums" data-testid="total">
                {formatPrice(apt.price + finishTotal)}
              </span>
            </div>
            <p className="text-xs text-muted">{s.soon}</p>
          </section>
        </aside>
      </div>
    </section>
  );
}
