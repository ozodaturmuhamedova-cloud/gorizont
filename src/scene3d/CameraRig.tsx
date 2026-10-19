import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { CAMERA_TRANSITION } from '../domain/constants';
import { orbitHome, type SceneFrame } from '../domain/scene3d';
import type { Apartment } from '../domain/types';
import { useStore } from '../store';
import { WalkRig } from './WalkRig';

export interface CameraRigProps {
  apartment: Apartment;
  frame: SceneFrame;
  fov: number;
  /** Смена значения возвращает камеру в домашний вид «3/4». */
  resetKey: number;
  /** Сенсорный экран — в прогулке джойстик и свайп вместо pointer lock. */
  touch: boolean;
}

/**
 * Камера (§7): Orbit — вращение, масштаб, сдвиг; Walk — прогулка на высоте глаз (§7.1).
 * Без указанного роста прогулка не включается, даже если стор просит её.
 */
export function CameraRig({ apartment, frame, fov, resetKey, touch }: CameraRigProps) {
  const mode = useStore((s) => s.cameraMode);
  const heightCm = useStore((s) => s.heightCm);
  if (mode === 'walk' && heightCm !== null) {
    return (
      <WalkRig apartment={apartment} center={frame.center} heightCm={heightCm} touch={touch} />
    );
  }
  return <OrbitRig frame={frame} fov={fov} resetKey={resetKey} />;
}

function OrbitRig({ frame, fov, resetKey }: Omit<CameraRigProps, 'apartment' | 'touch'>) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const aspect = useThree((s) => s.size.width / Math.max(s.size.height, 1));
  // домашний вид зависит от пропорций окна: на телефоне камера дальше
  const home = useMemo(() => orbitHome(frame, fov, aspect), [frame, fov, aspect]);
  const radius = frame.radius;
  const tween = useRef<{ t: number; from: THREE.Vector3; fromTarget: THREE.Vector3 } | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    // после прогулки камера плавно возвращается к виду 3/4 (§7.1)
    if (!mounted.current && camera.position.y < frame.radius * 0.5) {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      tween.current = {
        t: 0,
        from: camera.position.clone(),
        fromTarget: camera.position.clone().add(dir.multiplyScalar(2)),
      };
      mounted.current = true;
      invalidate();
      return;
    }
    mounted.current = true;
    tween.current = null;
    camera.position.set(...home.position);
    controls.current?.target.set(...home.target);
    controls.current?.update();
    invalidate();
  }, [camera, home, resetKey, invalidate, frame.radius]);

  useFrame((_, delta) => {
    const tw = tween.current;
    const c = controls.current;
    if (!tw || !c) return;
    tw.t = Math.min(1, tw.t + Math.min(delta, 0.1) / CAMERA_TRANSITION);
    const k = tw.t * tw.t * (3 - 2 * tw.t);
    camera.position.lerpVectors(tw.from, new THREE.Vector3(...home.position), k);
    c.target.lerpVectors(tw.fromTarget, new THREE.Vector3(...home.target), k);
    c.update();
    if (tw.t >= 1) tween.current = null;
    invalidate();
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={home.target}
      enableDamping
      dampingFactor={0.1}
      maxPolarAngle={Math.PI * 0.47}
      minDistance={Math.max(2, radius * 0.4)}
      maxDistance={Math.max(radius * 6, Math.hypot(...home.position) * 1.5)}
    />
  );
}
