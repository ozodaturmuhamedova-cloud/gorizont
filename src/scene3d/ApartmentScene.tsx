import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { orbitHome, sceneFrame } from '../domain/scene3d';
import type { Apartment, Finish } from '../domain/types';
import { CameraRig } from './CameraRig';
import { Floors } from './Floors';
import { Lighting } from './Lighting';
import { Openings } from './Openings';
import { Walls } from './Walls';

const FOV = 50;
/** Фон сцены совпадает с фоном контейнера на странице. */
const BACKGROUND = '#e3e7e0';
/** Земля невидима, на ней видны только тени. */
const GROUND_SHADOW_OPACITY = 0.16;
const GROUND_SIZE = 120;
const GROUND_Y = -0.32;

export interface ApartmentSceneProps {
  apartment: Apartment;
  finish: Finish;
  /** «Срез стен»: стены по пояс, видно комнаты сверху. */
  cut: boolean;
  /** Смена значения возвращает камеру в вид «3/4». */
  resetKey: number;
}

declare global {
  interface Window {
    /** Только в dev: статистика последнего кадра — для e2e (draw calls, треугольники). */
    __gorizont3d?: { calls: () => number; triangles: () => number; frames: () => number };
  }
}

/** Только в dev: отдаёт в window статистику рендера, чтобы e2e мог проверить draw calls. */
function DevStats() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__gorizont3d = {
      calls: () => gl.info.render.calls,
      triangles: () => gl.info.render.triangles,
      frames: () => gl.info.render.frame,
    };
    return () => {
      delete window.__gorizont3d;
    };
  }, [gl]);
  return null;
}

/**
 * 3D-тур по квартире (§7). Геометрия — из тех же данных, что и 2D-план; квартира сдвигается
 * так, чтобы её центр (centerOf(outline)) оказался в начале координат.
 */
export default function ApartmentScene({ apartment, finish, cut, resetKey }: ApartmentSceneProps) {
  const frame = useMemo(() => sceneFrame(apartment.outline), [apartment]);
  // стартовая позиция до первого кадра; дальше вид ведёт CameraRig с учётом пропорций окна
  const home = useMemo(() => orbitHome(frame, FOV), [frame]);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      frameloop="demand"
      camera={{ fov: FOV, position: home.position, near: 0.1, far: 200 }}
      // нужен для скриншота сцены в заявку (фаза 6)
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      // нейтральная тональная компрессия: цвета отделки на экране совпадают с образцами
      // (ACES, который R3F ставит по умолчанию, делает светлые стены серыми)
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 1;
      }}
      data-testid="scene-3d"
    >
      <color attach="background" args={[BACKGROUND]} />
      <Lighting radius={frame.radius} />
      <group position={[-frame.center[0], 0, -frame.center[1]]}>
        <Floors apartment={apartment} finish={finish} />
        <Walls apartment={apartment} color={finish.wall} cut={cut} />
        <Openings apartment={apartment} cut={cut} />
      </group>
      <mesh rotation-x={-Math.PI / 2} position={[0, GROUND_Y, 0]} receiveShadow>
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
        <shadowMaterial transparent opacity={GROUND_SHADOW_OPACITY} />
      </mesh>
      <CameraRig frame={frame} fov={FOV} resetKey={resetKey} />
      <DevStats />
    </Canvas>
  );
}
