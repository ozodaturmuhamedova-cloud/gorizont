import type { Apartment } from '../domain/types';
import { STATUS_COLORS } from '../scene2d/colors';
import { strings } from './strings';

export interface FloorSwitcherProps {
  floors: number;
  apartments: Apartment[];
  currentFloor: number;
  selectedId: string | null;
  /** id квартир, прошедших фильтр; undefined — фильтр не задан. */
  matchingIds?: ReadonlySet<string>;
  onFloor: (floor: number) => void;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

/**
 * «Шахматка»: этажи сверху вниз, в каждом ряду — квартиры этажа цветом статуса.
 * Это и переключатель этажей, и доступная с клавиатуры альтернатива клику по canvas.
 */
export function FloorSwitcher(p: FloorSwitcherProps) {
  const floors = Array.from({ length: p.floors }, (_, i) => p.floors - i);
  return (
    <nav aria-label={strings.floors.label} className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
        {strings.floors.title}
      </h2>
      <ul className="flex flex-col gap-1">
        {floors.map((f) => {
          const onFloor = p.apartments
            .filter((a) => a.floor === f)
            .sort((a, b) => a.number - b.number);
          const free = onFloor.filter((a) => a.status === 'free').length;
          const current = f === p.currentFloor;
          return (
            <li key={f} className="flex items-center gap-1.5">
              <button
                type="button"
                aria-pressed={current}
                aria-label={strings.floors.floorButton(f, free)}
                onClick={() => p.onFloor(f)}
                className={`h-7 w-8 shrink-0 rounded-md text-sm tabular-nums ${
                  current ? 'bg-brand font-semibold text-white' : 'text-muted hover:bg-brand-soft'
                }`}
              >
                {strings.floors.floor(f)}
              </button>
              <div className="flex gap-1">
                {onFloor.map((a) => {
                  const sold = a.status === 'sold';
                  const selected = a.id === p.selectedId;
                  const dimmed = p.matchingIds ? !p.matchingIds.has(a.id) : false;
                  const label = strings.floors.cell(a.number, strings.status[a.status]);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      disabled={sold}
                      aria-label={label}
                      aria-pressed={selected}
                      title={label}
                      onClick={() => p.onSelect(a.id)}
                      onMouseEnter={() => p.onHover(a.id)}
                      onMouseLeave={() => p.onHover(null)}
                      onFocus={() => p.onHover(a.id)}
                      onBlur={() => p.onHover(null)}
                      className={`h-5 w-5 rounded ${
                        selected ? 'ring-2 ring-brand ring-offset-1' : ''
                      } ${sold ? 'cursor-not-allowed' : 'hover:brightness-95'} ${
                        dimmed ? 'opacity-25' : sold ? 'opacity-50' : ''
                      }`}
                      style={{ background: STATUS_COLORS[a.status] }}
                    />
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
