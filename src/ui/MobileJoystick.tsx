import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { walkInput } from '../scene3d/walkInput';
import { strings } from './strings';

const SIZE = 112;
const KNOB = 44;

/** Джойстик движения (§7.1, телефон): отклонение ручки → walkInput.move. */
export function MobileJoystick() {
  const [knob, setKnob] = useState<[number, number]>([0, 0]);
  const active = useRef<number | null>(null);
  const r = (SIZE - KNOB) / 2;

  const update = (e: ReactPointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    let dx = e.clientX - (box.left + box.width / 2);
    let dy = e.clientY - (box.top + box.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > r) {
      dx = (dx / len) * r;
      dy = (dy / len) * r;
    }
    setKnob([dx, dy]);
    walkInput.move = [dx / r, -dy / r];
  };
  const release = () => {
    active.current = null;
    setKnob([0, 0]);
    walkInput.move = [0, 0];
  };

  return (
    <div
      role="application"
      aria-label={strings.walk.joystick}
      data-testid="joystick"
      className="pointer-events-auto absolute bottom-4 left-4 touch-none rounded-full border border-white/70 bg-ink/20"
      style={{ width: SIZE, height: SIZE }}
      onPointerDown={(e) => {
        active.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => {
        if (active.current === e.pointerId) update(e);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <div
        className="absolute rounded-full bg-paper/90 shadow"
        style={{
          width: KNOB,
          height: KNOB,
          left: SIZE / 2 - KNOB / 2 + knob[0],
          top: SIZE / 2 - KNOB / 2 + knob[1],
        }}
      />
    </div>
  );
}

/** Правая половина экрана: свайп поворачивает взгляд (walkInput.look). */
export function LookArea() {
  const last = useRef<{ id: number; x: number; y: number } | null>(null);
  return (
    <div
      aria-label={strings.walk.lookArea}
      className="pointer-events-auto absolute inset-y-0 right-0 w-1/2 touch-none"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        last.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        const l = last.current;
        if (!l || l.id !== e.pointerId) return;
        walkInput.look = [walkInput.look[0] + e.clientX - l.x, walkInput.look[1] + e.clientY - l.y];
        last.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      }}
      onPointerUp={() => (last.current = null)}
      onPointerCancel={() => (last.current = null)}
    />
  );
}
