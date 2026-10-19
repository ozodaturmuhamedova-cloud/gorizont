import { Link } from 'react-router-dom';
import { findApartment } from '../data';
import { formatArea, formatPrice } from '../domain/format';
import { pricePerM2 } from '../domain/pricing';
import { DEMO_APARTMENT_ID, strings } from '../ui/strings';

export function PlanPage() {
  const s = strings.plan;
  const demo = findApartment(DEMO_APARTMENT_ID);
  return (
    <section className="flex flex-col gap-6">
      <div className="flex max-w-2xl flex-col gap-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{s.title}</h1>
        <p className="text-muted">{s.lead}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-line bg-paper p-6 text-center text-muted">
          {s.stub}
        </div>

        {demo && (
          <article className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-base font-medium">{s.demoTitle}</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-status-free px-2 py-0.5 text-xs text-status-free">
                <span className="h-1.5 w-1.5 rounded-full bg-status-free" aria-hidden="true" />
                {strings.status[demo.status]}
              </span>
            </div>
            <p className="text-sm text-muted">
              {[
                strings.apartment.number(demo.number),
                strings.apartment.floor(demo.floor),
                strings.apartment.rooms(demo.rooms),
                formatArea(demo.area),
              ].join(' · ')}
            </p>
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-display text-xl font-semibold tabular-nums">
                {formatPrice(demo.price)}
              </span>
              <span className="text-xs tabular-nums text-muted">
                {formatPrice(pricePerM2(demo))} {s.perM2}
              </span>
            </div>
            <Link
              to={`/apartment/${demo.id}/3d`}
              className="mt-1 inline-flex justify-center rounded-xl bg-brand px-4 py-2 font-medium text-white hover:opacity-90"
            >
              {s.open3d}
            </Link>
          </article>
        )}
      </div>
    </section>
  );
}
