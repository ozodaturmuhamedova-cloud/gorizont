import { furniture } from '../data';
import type { Apartment } from '../domain/types';
import { useStore } from '../store';
import { removeSelected, rotateSelected } from '../store/furnishActions';
import { strings } from './strings';

const btn =
  'rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs font-medium shadow-sm hover:border-brand';

/**
 * Подсказка и кнопки поверх сцены: что ставим или что выбрано. Кнопки дублируют клавиши
 * Q/E/Delete/Esc — на телефоне клавиатуры нет.
 */
export function FurnishToolbar({ apartment }: { apartment: Apartment }) {
  const placingId = useStore((s) => s.placingItemId);
  const selected = useStore((s) => s.selectedFurniture);
  const placed = useStore((s) => s.placed[apartment.id]);
  const setPlacing = useStore((s) => s.setPlacing);
  const selectFurniture = useStore((s) => s.selectFurniture);
  const f = strings.furnish;

  const placingItem = placingId ? furniture.byId.get(placingId) : undefined;
  const selectedItem =
    selected !== null ? furniture.byId.get(placed?.[selected]?.itemId ?? '') : undefined;
  if (!placingItem && !selectedItem) return null;

  return (
    <div
      className="pointer-events-auto absolute inset-x-2 bottom-2 flex flex-wrap items-center gap-2 rounded-xl bg-paper/95 p-2 text-xs shadow"
      data-testid="furnish-toolbar"
    >
      {placingItem ? (
        <>
          <span className="font-semibold">{f.placing(placingItem.name)}</span>
          <span className="hidden text-muted sm:inline">{f.placingHint}</span>
          <span className="text-muted sm:hidden">{f.placingHintTouch}</span>
          <button type="button" className={`${btn} ml-auto`} onClick={() => setPlacing(null)}>
            {f.cancel}
          </button>
        </>
      ) : (
        selectedItem && (
          <>
            <span className="font-semibold">{f.selected(selectedItem.name)}</span>
            <span className="hidden text-muted lg:inline">{f.selectedHint}</span>
            <span className="ml-auto flex gap-1">
              <button
                type="button"
                className={btn}
                aria-label={f.rotateLeft}
                onClick={() => rotateSelected(apartment, -1)}
              >
                ⟲
              </button>
              <button
                type="button"
                className={btn}
                aria-label={f.rotateRight}
                onClick={() => rotateSelected(apartment, 1)}
              >
                ⟳
              </button>
              <button type="button" className={btn} onClick={() => removeSelected(apartment)}>
                {f.remove}
              </button>
              <button type="button" className={btn} onClick={() => selectFurniture(null)}>
                {f.cancel}
              </button>
            </span>
          </>
        )
      )}
    </div>
  );
}
