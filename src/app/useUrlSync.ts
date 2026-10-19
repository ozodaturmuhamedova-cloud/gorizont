import { useEffect, useLayoutEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { building, findApartment } from '../data';
import { useStore } from '../store';
import { hasUrlState, parseUrlState, toSearchParams } from './urlState';

const ctx = { floors: building.floors, apartmentExists: (id: string) => !!findApartment(id) };

/**
 * Двусторонняя связь стора плана с адресом страницы.
 * При открытии: если в адресе есть состояние — оно применяется к стору (ссылкой можно поделиться).
 * Если адрес пустой (например, возврат из 3D по «Назад к плану») — стор не трогаем.
 * Дальше любое изменение этажа, выбора или фильтров заменяет адрес без новой записи в истории.
 */
export function useUrlSync(): void {
  const [params, setParams] = useSearchParams();
  const hydrated = useRef(false);

  useLayoutEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    if (!hasUrlState(params)) return;
    const s = parseUrlState(params, ctx);
    const st = useStore.getState();
    st.setFilters(s.filters);
    if (s.floor !== null) st.setFloor(s.floor);
    if (s.apartmentId) st.selectApartment(s.apartmentId);
    // params читаем только при первом показе страницы
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const floor = useStore((s) => s.floor);
  const apartmentId = useStore((s) => s.apartmentId);
  const filters = useStore((s) => s.filters);

  useEffect(() => {
    // значения берём из стора, а не из замыкания: на первом проходе стор уже обновлён гидрацией
    const s = useStore.getState();
    const next = toSearchParams(
      { floor: s.floor, apartmentId: s.apartmentId, filters: s.filters },
      building.floors,
    );
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }, [floor, apartmentId, filters, params, setParams]);
}
