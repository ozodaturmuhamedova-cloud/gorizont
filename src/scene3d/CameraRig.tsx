import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { orbitHome, type SceneFrame } from '../domain/scene3d';

export interface CameraRigProps {
  frame: SceneFrame;
  fov: number;
  /** Смена значения возвращает камеру в домашний вид «3/4». */
  resetKey: number;
}

/** Режим Orbit (§7): вращение, масштаб, сдвиг; не уходит под пол. Walk появится в фазе 5а. */
export function CameraRig({ frame, fov, resetKey }: CameraRigProps) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const aspect = useThree((s) => s.size.width / Math.max(s.size.height, 1));
  // домашний вид зависит от пропорций окна: на телефоне камера дальше
  const home = useMemo(() => orbitHome(frame, fov, aspect), [frame, fov, aspect]);
  const radius = frame.radius;

  useEffect(() => {
    camera.position.set(...home.position);
    controls.current?.target.set(...home.target);
    controls.current?.update();
    invalidate();
  }, [camera, home, resetKey, invalidate]);

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
