import { APARTMENT_STATUSES, type Apartment } from '../domain/types';
import { strings } from '../ui/strings';
import { STATUS_COLORS } from './colors';

/** Легенда статусов с количеством квартир на текущем этаже. */
export function Legend({ apartments }: { apartments: Apartment[] }) {
  return (
    <ul aria-label={strings.legend.label} className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {APARTMENT_STATUSES.map((s) => (
        <li key={s} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: STATUS_COLORS[s] }}
          />
          <span>{strings.status[s]}</span>
          <span className="tabular-nums text-muted">
            {apartments.filter((a) => a.status === s).length}
          </span>
        </li>
      ))}
    </ul>
  );
}
