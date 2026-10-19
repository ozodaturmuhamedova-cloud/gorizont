import { Link } from 'react-router-dom';
import { strings } from '../ui/strings';

export function NotFound() {
  const s = strings.notFound;
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <p className="font-mono text-sm text-muted">{s.code}</p>
      <h1 className="font-display text-2xl font-semibold tracking-tight">{s.title}</h1>
      <p className="text-muted">{s.text}</p>
      <Link
        to="/"
        className="mt-2 rounded-xl bg-brand px-4 py-2 font-medium text-white hover:opacity-90"
      >
        {s.home}
      </Link>
    </section>
  );
}
