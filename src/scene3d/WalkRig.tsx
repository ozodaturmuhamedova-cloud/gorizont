/**
 * Режим прогулки (§7.1): камера на высоте глаз посетителя, WASD/стрелки или джойстик,
 * обзор мышью (pointer lock) или свайпом. Коллизии и точка старта — в domain/walk.ts,
 * здесь только ввод, анимация и перенос позиции в камеру.
 */
import { PointerLockControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { furniture } from '../data';
import { CAMERA_TRANSITION, WALK_PITCH_LIMIT, WALK_SPRINT } from '../domain/constants';
import type { Apartment, PlacedFurniture, Vec2 } from '../domain/types';
import {
  cameraHeight,
  ceilingOf,
  collisionRadius,
  moveCircle,
  nearestFree,
  startPose,
  walkObstacles,
  walkSpeed,
} from '../domain/walk';
import { useStore } from '../store';
import { resetWalkInput, walkInput } from './walkInput';

const EMPTY: PlacedFurniture[] = [];
/** Чувствительность свайпа, рад на пиксель. */
const SWIPE_SENSITIVITY = 0.005;
/** Как часто позиция уходит в стор (для HUD и мини-плана), мс. */
const POSE_SYNC_MS = 100;
/** Скорость подстройки высоты камеры при смене роста, 1/с. */
const HEIGHT_LERP = 4;

const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

declare global {
  interface Window {
    /** Только в dev: позиция посетителя на плане и высота глаз — для e2e. */
    __gorizontWalk?: { pose: () => { x: number; y: number; heading: number; eye: number } };
  }
}

/** Направление взгляда на плане ↔ поворот камеры вокруг вертикали (камера смотрит в −z). */
const yawFromHeading = (h: number) => Math.atan2(-Math.cos(h), -Math.sin(h));
const headingFromYaw = (y: number) => Math.atan2(-Math.cos(y), -Math.sin(y));

export interface WalkRigProps {
  apartment: Apartment;
  /** Сдвиг сцены: план → мир. */
  center: Vec2;
  heightCm: number;
  /** Сенсорный экран: без pointer lock, обзор свайпом. */
  touch: boolean;
}

export function WalkRig({ apartment, center, heightCm, touch }: WalkRigProps) {
  const camera = useThree((s) => s.camera);
  const placed = useStore((s) => s.placed[apartment.id]) ?? EMPTY;
  const setWalkPose = useStore((s) => s.setWalkPose);
  const setPointerLocked = useStore((s) => s.setPointerLocked);

  const obstacles = useMemo(() => walkObstacles(apartment, placed, furniture), [apartment, placed]);
  const ceiling = useMemo(() => ceilingOf(apartment), [apartment]);
  const radius = collisionRadius(heightCm);

  const pos = useRef<Vec2 | null>(null);
  const eye = useRef(cameraHeight(heightCm, ceiling));
  const keys = useRef(new Set<string>());
  const sprint = useRef(false);
  const lastSync = useRef(0);
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), []);
  // переход из орбиты: из текущей камеры в точку старта
  const tween = useRef<{
    t: number;
    fromPos: THREE.Vector3;
    fromQuat: THREE.Quaternion;
    toQuat: THREE.Quaternion;
  } | null>(null);

  // старт — один раз при входе в прогулку
  useEffect(() => {
    const start = startPose(apartment, heightCm, obstacles);
    pos.current = start.position;
    setWalkPose(start);
    eye.current = cameraHeight(heightCm, ceiling);
    const toQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, yawFromHeading(start.heading), 0, 'YXZ'),
    );
    tween.current = {
      t: 0,
      fromPos: camera.position.clone(),
      fromQuat: camera.quaternion.clone(),
      toQuat,
    };
    resetWalkInput();
    return () => {
      resetWalkInput();
      delete window.__gorizontWalk;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- только при входе
  }, [apartment]);

  // сменился рост или мебель — если посетитель оказался в препятствии, переносим его
  useEffect(() => {
    if (pos.current) pos.current = nearestFree(pos.current, radius, obstacles, apartment.outline);
  }, [radius, obstacles, apartment]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.code in MOVE_KEYS) {
        keys.current.add(e.code);
        e.preventDefault();
      }
      if (e.key === 'Shift') sprint.current = true;
    };
    const up = (e: KeyboardEvent) => {
      keys.current.delete(e.code);
      if (e.key === 'Shift') sprint.current = false;
    };
    const blur = () => {
      keys.current.clear();
      sprint.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__gorizontWalk = {
      pose: () => {
        euler.setFromQuaternion(camera.quaternion, 'YXZ');
        const p = pos.current ?? [0, 0];
        return { x: p[0], y: p[1], heading: headingFromYaw(euler.y), eye: camera.position.y };
      },
    };
  }, [camera, euler]);

  useFrame((_, rawDelta) => {
    const p = pos.current;
    if (!p) return;
    // после вкладки в фоне delta бывает огромной — не «телепортируемся»
    const delta = Math.min(rawDelta, 0.1);
    const targetEye = cameraHeight(heightCm, ceiling);
    eye.current += (targetEye - eye.current) * Math.min(1, delta * HEIGHT_LERP);

    const tw = tween.current;
    if (tw) {
      tw.t = Math.min(1, tw.t + delta / CAMERA_TRANSITION);
      const k = tw.t * tw.t * (3 - 2 * tw.t);
      const to = new THREE.Vector3(p[0] - center[0], eye.current, p[1] - center[1]);
      camera.position.lerpVectors(tw.fromPos, to, k);
      camera.quaternion.slerpQuaternions(tw.fromQuat, tw.toQuat, k);
      if (tw.t >= 1) tween.current = null;
      return;
    }

    // обзор: мышь меняет камеру сама (PointerLockControls), свайп — здесь
    euler.setFromQuaternion(camera.quaternion, 'YXZ');
    if (walkInput.look[0] !== 0 || walkInput.look[1] !== 0) {
      euler.y -= walkInput.look[0] * SWIPE_SENSITIVITY;
      euler.x -= walkInput.look[1] * SWIPE_SENSITIVITY;
      walkInput.look = [0, 0];
    }
    euler.x = Math.max(-WALK_PITCH_LIMIT, Math.min(WALK_PITCH_LIMIT, euler.x));
    euler.z = 0;
    camera.quaternion.setFromEuler(euler);

    // движение: клавиши + джойстик, относительно направления взгляда
    let strafe = walkInput.move[0];
    let forward = walkInput.move[1];
    for (const code of keys.current) {
      const m = MOVE_KEYS[code];
      if (m) {
        strafe += m[0];
        forward += m[1];
      }
    }
    const len = Math.hypot(strafe, forward);
    if (len > 1e-3) {
      const scale = Math.min(1, len) / len;
      const h = headingFromYaw(euler.y);
      const f: Vec2 = [Math.cos(h), Math.sin(h)];
      const r: Vec2 = [-Math.sin(h), Math.cos(h)];
      const step = walkSpeed(heightCm) * (sprint.current ? WALK_SPRINT : 1) * delta * scale;
      const d: Vec2 = [
        (f[0] * forward + r[0] * strafe) * step,
        (f[1] * forward + r[1] * strafe) * step,
      ];
      pos.current = moveCircle(p, d, radius, obstacles);
    }
    const q = pos.current!;
    camera.position.set(q[0] - center[0], eye.current, q[1] - center[1]);

    const now = performance.now();
    if (now - lastSync.current > POSE_SYNC_MS) {
      lastSync.current = now;
      setWalkPose({ position: [q[0], q[1]], heading: headingFromYaw(euler.y) });
    }
  });

  if (touch) return null;
  return (
    <PointerLockControls
      selector="#walk-resume"
      onLock={() => setPointerLocked(true)}
      onUnlock={() => setPointerLocked(false)}
    />
  );
}
