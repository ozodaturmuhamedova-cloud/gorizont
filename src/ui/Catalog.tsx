import { furniture } from '../data';
import { formatPrice } from '../domain/format';
import type { RoomType } from '../domain/types';
import { useStore } from '../store';
import { strings } from './strings';

/** Вкладки каталога — по типам комнат (балкон не обставляем). */
export const CATALOG_ROOMS: RoomType[] = ['living', 'bedroom', 'kitchen', 'bath', 'hall'];

/** Каталог мебели (§7): вкладки по комнатам, кнопка ставит предмет «призраком» в сцену. */
export function Catalog({ disabled = false }: { disabled?: boolean }) {
  const room = useStore((s) => s.catalogRoom);
  const setRoom = useStore((s) => s.setCatalogRoom);
  const placing = useStore((s) => s.placingItemId);
  const setPlacing = useStore((s) => s.setPlacing);
  const setCut = useStore((s) => s.setWallsCut);
  const items = furniture.items.filter((i) => !i.allowedRooms || i.allowedRooms.includes(room));
  const s = strings.furnish;

  return (
    <section
      aria-label={s.catalog}
      className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-4"
    >
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{s.catalog}</h2>
      <div role="tablist" className="flex flex-wrap gap-1">
        {CATALOG_ROOMS.map((r) => (
          <button
            key={r}
            type="button"
            role="tab"
            aria-selected={r === room}
            onClick={() => setRoom(r)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
              r === room ? 'bg-ink text-white' : 'bg-ground text-muted hover:text-ink'
            }`}
          >
            {strings.roomTypes[r]}
          </button>
        ))}
      </div>
      <ul role="tabpanel" className="flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
        {items.map((item) => {
          const active = placing === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                disabled={disabled}
                aria-pressed={active}
                aria-label={s.addLabel(item.name)}
                onClick={() => {
                  // стены по пояс, чтобы видеть пол и мебель
                  if (!active) setCut(true);
                  setPlacing(active ? null : item.id);
                }}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm disabled:opacity-50 ${
                  active ? 'border-brand bg-brand-soft' : 'border-transparent hover:border-line'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="h-6 w-6 shrink-0 rounded-md border border-line"
                  style={{ background: item.color ?? '#b9a58d' }}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium leading-snug">{item.name}</span>
                  <span className="text-xs text-muted">{s.size(item.size[0], item.size[1])}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted">{formatPrice(item.price)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
