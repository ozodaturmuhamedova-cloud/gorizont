import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { Vec3 } from '../domain/scene3d';

export interface CameraRigProps {
  home: { position: Vec3; target: Vec3 };
  /** Радиус квартиры — от него ограничения приближения. */
  radius: number;
  /** Смена значения возвращает камеру в домашний вид «3/4». */
  resetKey: number;
}

/** Режим Orbit (§7): вращение, масштаб, сдвиг; не уходит под пол. Walk появится в фазе 5а. */
export function CameraRig({ home, radius, resetKey }: CameraRigProps) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);

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
      maxDistance={radius * 6}
    />
  );
}
