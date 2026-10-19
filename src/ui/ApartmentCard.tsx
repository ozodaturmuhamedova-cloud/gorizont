import { Link } from 'react-router-dom';
import { formatArea, formatPrice } from '../domain/format';
import { polygonArea } from '../domain/geometry';
import { pricePerM2 } from '../domain/pricing';
import type { Apartment } from '../domain/types';
import { STATUS_COLORS } from '../scene2d/colors';
import { strings } from './strings';

export interface ApartmentCardProps {
  apartment: Apartment | null;
  onClose: () => void;
}

/** Карточка выбранной квартиры. Мини-план появится в фазе 3. */
export function ApartmentCard({ apartment: a, onClose }: ApartmentCardProps) {
  if (!a) {
    return (
      <aside className="rounded-2xl border border-dashed border-line bg-paper p-5 text-sm text-muted">
        {strings.card.empty}
      </aside>
    );
  }
  const rooms = [...a.roomsGeometry].sort(
    (x, y) => polygonArea(y.polygon) - polygonArea(x.polygon),
  );
  return (
    <aside
      aria-label={strings.apartment.number(a.number)}
      className="flex flex-col gap-4 rounded-2xl border border-line bg-paper p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-xl font-semibold tracking-tight">
            {strings.apartment.number(a.number)}
          </h2>
          <p className="text-sm text-muted">
            {[
              strings.apartment.floor(a.floor),
              strings.apartment.rooms(a.rooms),
              formatArea(a.area),
            ].join(' · ')}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={strings.card.close}
          className="-mr-1 -mt-1 h-8 w-8 rounded-lg text-muted hover:bg-brand-soft"
        >
          ✕
        </button>
      </div>

      <span
        className="inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs"
        style={{ borderColor: STATUS_COLORS[a.status], color: STATUS_COLORS[a.status] }}
      >
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: STATUS_COLORS[a.status] }}
        />
        {strings.status[a.status]}
      </span>

      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-2xl font-semibold tabular-nums">
          {formatPrice(a.price)}
        </span>
        <span className="text-xs tabular-nums text-muted">
          {formatPrice(pricePerM2(a))} {strings.plan.perM2}
        </span>
      </div>

      <div>
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
          {strings.card.rooms}
        </h3>
        <ul className="flex flex-col gap-1 text-sm">
          {rooms.map((r) => (
            <li key={r.id} className="flex justify-between gap-3">
              <span>{strings.roomTypes[r.type]}</span>
              <span className="tabular-nums text-muted">{formatArea(polygonArea(r.polygon))}</span>
            </li>
          ))}
        </ul>
      </div>

      {a.status === 'reserved' && <p className="text-xs text-muted">{strings.card.reservedNote}</p>}

      <Link
        to={`/apartment/${a.id}/3d`}
        className="inline-flex justify-center rounded-xl bg-brand px-4 py-2 font-medium text-white hover:opacity-90"
      >
        {strings.plan.open3d}
      </Link>
    </aside>
  );
}
