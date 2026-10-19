import { formatMillions } from '../domain/format';
import type { Apartment } from '../domain/types';
import { STATUS_COLORS } from '../scene2d/colors';
import { strings } from './strings';

export interface ApartmentListProps {
  apartments: Apartment[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

/**
 * Подходящие под фильтры квартиры всех этажей. Наведение подсвечивает квартиру на плане
 * (если она на текущем этаже), клик выбирает и переключает этаж. Проданные — без кнопки.
 */
export function ApartmentList({
  apartments,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
}: ApartmentListProps) {
  return (
    <section aria-label={strings.list.label} className="flex min-h-0 flex-col gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
        {strings.list.title} <span className="tabular-nums">· {apartments.length}</span>
      </h2>
      {apartments.length === 0 ? (
        <p className="text-sm text-muted">{strings.filters.none}</p>
      ) : (
        <ul className="flex max-h-[360px] flex-col gap-1 overflow-y-auto pr-1">
          {apartments.map((a) => {
            const sold = a.status === 'sold';
            const active = a.id === selectedId || a.id === hoveredId;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  disabled={sold}
                  aria-current={a.id === selectedId ? 'true' : undefined}
                  onClick={() => onSelect(a.id)}
                  onMouseEnter={() => onHover(a.id)}
                  onMouseLeave={() => onHover(null)}
                  onFocus={() => onHover(a.id)}
                  onBlur={() => onHover(null)}
                  className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 rounded-lg border px-3 py-2 text-left text-sm ${
                    active ? 'border-brand bg-brand-soft' : 'border-transparent hover:bg-brand-soft'
                  } ${sold ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: STATUS_COLORS[a.status] }}
                  />
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{strings.apartment.number(a.number)}</span>
                    <span className="text-muted">
                      {' · '}
                      {strings.list.floorShort(a.floor)} · {strings.apartment.rooms(a.rooms)} ·{' '}
                      {a.area.toLocaleString('ru-RU')} м²
                    </span>
                  </span>
                  <span className="tabular-nums">
                    {sold ? strings.status.sold : formatMillions(a.price)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
