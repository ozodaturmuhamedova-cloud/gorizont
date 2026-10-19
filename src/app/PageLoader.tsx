import { strings } from '../ui/strings';

/** Заглушка, пока лениво грузится страница. */
export function PageLoader() {
  return (
    <p role="status" className="p-6 text-muted">
      {strings.tour.loading}
    </p>
  );
}
