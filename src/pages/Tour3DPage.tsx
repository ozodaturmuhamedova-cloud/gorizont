import { Link, useParams } from 'react-router-dom';
import { findApartment } from '../data';
import { formatArea } from '../domain/format';
import { strings } from '../ui/strings';
import { NotFound } from './NotFound';

export default function Tour3DPage() {
  const { id = '' } = useParams();
  const apt = findApartment(id);
  if (!apt) return <NotFound />;
  const s = strings.tour;
  return (
    <section className="flex flex-col gap-4">
      <Link to="/" className="w-fit text-sm text-brand hover:underline">
        ← {s.back}
      </Link>
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
      <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-line bg-paper p-6 text-center text-muted">
        {s.stub}
      </div>
    </section>
  );
}
