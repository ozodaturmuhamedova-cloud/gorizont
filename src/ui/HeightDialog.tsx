import { useEffect, useId, useRef, useState } from 'react';
import { HEIGHT_DEFAULT_CM, HEIGHT_MAX_CM, HEIGHT_MIN_CM } from '../domain/constants';
import { isValidHeight } from '../domain/walk';
import { useStore } from '../store';
import { strings } from './strings';

/**
 * Окно роста (§7.1): число + слайдер, 100–220 см. «Начать» сохраняет рост и входит в прогулку;
 * во время прогулки то же окно меняет рост на лету.
 */
export function HeightDialog() {
  const open = useStore((s) => s.heightDialogOpen);
  if (!open) return null;
  return <HeightDialogBody />;
}

function HeightDialogBody() {
  const heightCm = useStore((s) => s.heightCm);
  const walking = useStore((s) => s.cameraMode === 'walk');
  const [value, setValue] = useState(String(heightCm ?? HEIGHT_DEFAULT_CM));
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const w = strings.walk;
  const n = Number(value);
  const valid = value.trim() !== '' && Number.isInteger(n) && isValidHeight(n);

  const close = () => useStore.getState().setHeightDialogOpen(false);
  const submit = () => {
    if (!valid) return;
    const s = useStore.getState();
    s.setHeight(n);
    s.setHeightDialogOpen(false);
    if (!walking) s.setCameraMode('walk');
  };

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useStore.getState().setHeightDialogOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-paper p-5 shadow-xl"
      >
        <h2 id={`${id}-title`} className="font-display text-lg font-semibold">
          {w.dialogTitle}
        </h2>
        <p className="text-sm text-muted">{w.dialogText}</p>
        <label className="flex flex-col gap-2 text-sm font-medium" htmlFor={`${id}-cm`}>
          {w.heightLabel}
          <input
            ref={input}
            id={`${id}-cm`}
            type="number"
            inputMode="numeric"
            min={HEIGHT_MIN_CM}
            max={HEIGHT_MAX_CM}
            step={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={!valid}
            aria-describedby={valid ? undefined : `${id}-err`}
            className="rounded-xl border border-line bg-white px-3 py-2 text-base tabular-nums"
          />
        </label>
        <input
          type="range"
          aria-label={w.heightLabel}
          min={HEIGHT_MIN_CM}
          max={HEIGHT_MAX_CM}
          step={1}
          value={valid ? n : HEIGHT_DEFAULT_CM}
          onChange={(e) => setValue(e.target.value)}
          className="accent-brand"
        />
        {!valid && (
          <p id={`${id}-err`} role="alert" className="text-sm text-[#b42318]">
            {w.outOfRange}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="rounded-xl border border-line px-4 py-2 text-sm font-medium hover:border-brand"
          >
            {w.cancel}
          </button>
          <button
            type="submit"
            disabled={!valid}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {walking ? w.save : w.begin}
          </button>
        </div>
      </form>
    </div>
  );
}
