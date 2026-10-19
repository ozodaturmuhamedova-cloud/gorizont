import { furniture } from '../data';
import { formatPrice } from '../domain/format';
import { estimate } from '../domain/pricing';
import type { Apartment, Finish, PlacedFurniture } from '../domain/types';
import { useStore } from '../store';
import { strings } from './strings';

const EMPTY: PlacedFurniture[] = [];

export interface EstimateProps {
  apartment: Apartment;
  finish: Finish;
  onPreset: () => void;
  onClear: () => void;
}

/** Смета «квартира + отделка + мебель» (§1) и список того, что не поместилось. */
export function EstimatePanel({ apartment, finish, onPreset, onClear }: EstimateProps) {
  const placed = useStore((s) => s.placed[apartment.id]) ?? EMPTY;
  const skipped = useStore((s) => s.skipped[apartment.id]);
  const e = estimate(apartment, placed, furniture, finish);
  const t = strings.tour;
  const f = strings.furnish;
  const roomName = (roomId: string) => {
    const type = apartment.roomsGeometry.find((r) => r.id === roomId)?.type;
    return type ? strings.roomTypes[type].toLowerCase() : roomId;
  };

  return (
    <section
      aria-label={t.summary}
      className="flex flex-col gap-2 rounded-2xl border border-line bg-paper p-4 text-sm"
    >
      <div className="flex flex-wrap gap-2 pb-1">
        <button
          type="button"
          onClick={onPreset}
          className="rounded-xl bg-brand px-3 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          {placed.length > 0 ? f.presetAgain : f.preset}
        </button>
        {placed.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-xl border border-line px-3 py-2 text-sm font-medium hover:border-brand"
          >
            {f.clear}
          </button>
        )}
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted">{t.apartmentLine(apartment.number)}</span>
        <span className="tabular-nums">{formatPrice(e.apartment)}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted">{t.finishLine(finish.name)}</span>
        <span className="tabular-nums" data-testid="finish-cost">
          {e.finish.total === 0 ? t.finishIncluded : formatPrice(e.finish.total)}
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted">{f.furnitureLine}</span>
        <span className="tabular-nums" data-testid="furniture-cost">
          {formatPrice(e.furnitureTotal)}
        </span>
      </div>
      {e.furniture.length > 0 ? (
        <ul className="flex max-h-48 flex-col gap-0.5 overflow-y-auto border-l-2 border-line pl-3 text-xs">
          {e.furniture.map((l) => (
            <li key={l.itemId} className="flex justify-between gap-3">
              <span className="truncate text-muted">
                {l.name}
                {l.qty > 1 ? ` × ${l.qty}` : ''}
              </span>
              <span className="shrink-0 tabular-nums">{formatPrice(l.total)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted">{f.empty}</p>
      )}
      <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2">
        <span className="font-medium">{t.total}</span>
        <span className="font-display text-lg font-semibold tabular-nums" data-testid="total">
          {formatPrice(e.total)}
        </span>
      </div>
      {skipped && skipped.length > 0 && (
        <div
          className="flex flex-col gap-1 rounded-xl bg-[#fdf3e2] p-3 text-xs"
          data-testid="not-fitted"
        >
          <span className="font-semibold">{f.notFitted}</span>
          <ul className="flex flex-col gap-0.5">
            {skipped.map((k, i) => (
              <li key={`${k.roomId}-${k.itemId}-${i}`} className="text-muted">
                {furniture.byId.get(k.itemId)?.name ?? k.itemId} — {roomName(k.roomId)},{' '}
                {f.skipReasons[k.reason]}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
