import { NavLink, Outlet } from 'react-router-dom';
import { strings } from '../ui/strings';

export function Layout() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <NavLink to="/" className="flex min-w-0 flex-col">
            <span className="font-display text-lg font-semibold tracking-tight">
              {strings.brand.name}
            </span>
            <span className="truncate text-xs text-muted">{strings.brand.tagline}</span>
          </NavLink>
          <nav aria-label={strings.nav.main} className="ml-auto flex gap-1 text-sm">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `rounded-full px-3 py-1.5 font-medium ${
                  isActive ? 'bg-brand text-white' : 'text-muted hover:bg-brand-soft'
                }`
              }
            >
              {strings.nav.plan}
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
