import { formatArea } from '../domain/format';
import { polygonArea } from '../domain/geometry';
import type { Apartment } from '../domain/types';
import { ceilingOf, ceilingTooLow, roomContaining } from '../domain/walk';
import { useStore } from '../store';
import { ApartmentMiniPlan } from './ApartmentMiniPlan';
import { LookArea, MobileJoystick } from './MobileJoystick';
import { strings } from './strings';

const btn =
  'pointer-events-auto rounded-lg border border-line bg-paper/95 px-2.5 py-1.5 text-xs font-medium shadow-sm hover:border-brand';

/**
 * HUD прогулки (§7.1): комната и её площадь, рост, «Изменить рост», «Выйти», мини-план с точкой
 * и направлением взгляда. На десктопе — пауза-оверлей до захвата мыши, на телефоне — джойстик.
 */
export function WalkHUD({ apartment, touch }: { apartment: Apartment; touch: boolean }) {
  const heightCm = useStore((s) => s.heightCm);
  const pose = useStore((s) => s.walkPose);
  const locked = useStore((s) => s.pointerLocked);
  const w = strings.walk;
  if (heightCm === null) return null;

  const room = pose ? roomContaining(apartment, pose.position) : undefined;
  const lowCeiling = ceilingTooLow(heightCm, ceilingOf(apartment));
  const exit = () => {
    if (document.pointerLockElement) document.exitPointerLock();
    useStore.getState().setCameraMode('orbit');
  };

  return (
    <div className="pointer-events-none absolute inset-0" aria-label={w.hud} role="region">
      {/* пауза: клик захватывает мышь (PointerLockControls слушает этот элемент) */}
      {!touch && (
        <button
          id="walk-resume"
          type="button"
          className={`pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/30 text-white ${
            locked ? 'invisible' : ''
          }`}
        >
          <span className="rounded-xl bg-ink/70 px-4 py-2 text-base font-semibold">{w.resume}</span>
          <span className="max-w-xs text-center text-xs">{w.keysHint}</span>
        </button>
      )}
      {touch && (
        <>
          <LookArea />
          <MobileJoystick />
        </>
      )}

      <div className="absolute left-2 top-2 flex flex-col gap-1 rounded-xl bg-paper/95 px-3 py-2 text-xs shadow">
        <span className="font-semibold" data-testid="walk-room">
          {room
            ? `${strings.roomTypes[room.type]} · ${formatArea(polygonArea(room.polygon))}`
            : w.outside}
        </span>
        <span data-testid="walk-height">{w.height(heightCm)}</span>
        {lowCeiling && <span className="font-medium text-[#b45309]">{w.ceilingLow}</span>}
        {touch && <span className="text-muted">{w.touchHint}</span>}
      </div>

      <div className="absolute right-2 top-2 flex flex-wrap justify-end gap-1">
        <button
          type="button"
          className={btn}
          onClick={() => {
            if (document.pointerLockElement) document.exitPointerLock();
            useStore.getState().setHeightDialogOpen(true);
          }}
        >
          {w.changeHeight}
        </button>
        <button type="button" className={btn} onClick={exit}>
          {w.exit}
        </button>
      </div>

      <div className="absolute bottom-2 right-2 w-32 rounded-xl bg-paper/90 p-1.5 shadow sm:w-40">
        <ApartmentMiniPlan apartment={apartment} marker={pose} className="h-auto w-full" />
      </div>
    </div>
  );
}
