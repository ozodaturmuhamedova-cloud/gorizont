import { useEffect, useState } from 'react';
import { isDefaultFilters, rangeFrom, type ApartmentFilters, type Range } from '../domain/filters';
import type { RoomCount } from '../domain/types';
import { strings } from './strings';

export interface FiltersProps {
  filters: ApartmentFilters;
  /** Комнатности, которые вообще есть в доме. */
  roomOptions: RoomCount[];
  found: number;
  onChange: (patch: Partial<ApartmentFilters>) => void;
  onReset: () => void;
}

const MLN = 1_000_000;

/** Граница диапазона как текст поля: Infinity и null — пусто. */
function boundText(r: Range | null, i: 0 | 1, k: number): string {
  const v = r?.[i];
  return v === undefined || !Number.isFinite(v) ? '' : String(Number((v / k).toFixed(2)));
}

function parseBound(s: string): number | null {
  const v = Number(s.replace(',', '.').trim());
  return s.trim() === '' || !Number.isFinite(v) || v < 0 ? null : v;
}

/** Текст поля уже соответствует значению границы — не трогаем то, что человек печатает. */
function sameBound(text: string, v: number | undefined, k: number): boolean {
  const p = parseBound(text);
  if (v === undefined || !Number.isFinite(v)) return p === null;
  return p !== null && Math.abs(p * k - v) < 1e-6 * Math.max(1, k);
}

/** Значение поля в единицах хранения, без хвостов float (5.7 млн → 5 700 000). */
const toStored = (v: number | null, k: number) => (v === null ? null : Number((v * k).toFixed(2)));

/** Пара полей «от — до». Значение применяется при вводе, текст поля не прыгает. */
function RangeField({
  id,
  label,
  range,
  k,
  step,
  onChange,
}: {
  id: string;
  label: string;
  range: Range | null;
  /** Делитель: цена хранится в рублях, а вводится в миллионах. */
  k: number;
  step: number;
  onChange: (r: Range | null) => void;
}) {
  const [lo, setLo] = useState(boundText(range, 0, k));
  const [hi, setHi] = useState(boundText(range, 1, k));
  // внешний сброс или ссылка с параметрами
  useEffect(() => {
    setLo((cur) => (sameBound(cur, range?.[0], k) ? cur : boundText(range, 0, k)));
    setHi((cur) => (sameBound(cur, range?.[1], k) ? cur : boundText(range, 1, k)));
  }, [range, k]);

  const commit = (a: string, b: string) =>
    onChange(rangeFrom(toStored(parseBound(a), k), toStored(parseBound(b), k)));
  const input =
    'w-full min-w-0 rounded-lg border border-line bg-paper px-2 py-1.5 text-sm tabular-nums';
  return (
    <fieldset className="flex min-w-0 flex-col gap-1">
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
      </legend>
      <div className="flex items-center gap-1.5">
        <input
          id={`${id}-min`}
          type="number"
          inputMode="decimal"
          min={0}
          step={step}
          aria-label={`${label}, ${strings.filters.from}`}
          placeholder={strings.filters.from}
          value={lo}
          onChange={(e) => {
            setLo(e.target.value);
            commit(e.target.value, hi);
          }}
          className={input}
        />
        <span aria-hidden="true" className="text-muted">
          —
        </span>
        <input
          id={`${id}-max`}
          type="number"
          inputMode="decimal"
          min={0}
          step={step}
          aria-label={`${label}, ${strings.filters.to}`}
          placeholder={strings.filters.to}
          value={hi}
          onChange={(e) => {
            setHi(e.target.value);
            commit(lo, e.target.value);
          }}
          className={input}
        />
      </div>
    </fieldset>
  );
}

export function Filters({ filters: f, roomOptions, found, onChange, onReset }: FiltersProps) {
  const toggleRoom = (n: RoomCount) =>
    onChange({
      rooms: f.rooms.includes(n)
        ? f.rooms.filter((x) => x !== n)
        : [...f.rooms, n].sort((a, b) => a - b),
    });

  return (
    <section
      aria-label={strings.filters.label}
      className="grid gap-4 rounded-2xl border border-line bg-paper p-4 sm:grid-cols-2 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end"
    >
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
          {strings.filters.rooms}
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {roomOptions.map((n) => {
            const on = f.rooms.includes(n);
            return (
              <button
                key={n}
                type="button"
                aria-pressed={on}
                aria-label={strings.filters.roomsAria(n)}
                onClick={() => toggleRoom(n)}
                className={`h-9 min-w-9 rounded-lg border px-3 text-sm font-medium ${
                  on
                    ? 'border-brand bg-brand text-white'
                    : 'border-line bg-paper hover:border-brand'
                }`}
              >
                {strings.filters.roomsChip(n)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <RangeField
        id="area"
        label={strings.filters.area}
        range={f.areaRange}
        k={1}
        step={1}
        onChange={(r) => onChange({ areaRange: r })}
      />
      <RangeField
        id="price"
        label={strings.filters.price}
        range={f.priceRange}
        k={MLN}
        step={0.1}
        onChange={(r) => onChange({ priceRange: r })}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:col-span-2 lg:col-span-1 lg:flex-col lg:items-start">
        <label htmlFor="only-free" className="inline-flex items-center gap-2 text-sm">
          <input
            id="only-free"
            type="checkbox"
            checked={f.onlyFree}
            onChange={(e) => onChange({ onlyFree: e.target.checked })}
            className="h-4 w-4 accent-brand"
          />
          {strings.filters.onlyFree}
        </label>
        <div className="flex items-center gap-3">
          <span role="status" className="text-sm tabular-nums text-muted">
            {strings.filters.found(found)}
          </span>
          {!isDefaultFilters(f) && (
            <button
              type="button"
              onClick={onReset}
              className="text-sm font-medium text-brand hover:underline"
            >
              {strings.filters.reset}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
