import { Environment, Lightformer } from '@react-three/drei';

/**
 * Свет: небо/земля, солнце с тенями и мягкое окружение для отражений.
 * Окружение собирается из светящихся панелей (Lightformer) на месте — без загрузки HDR
 * из сети, поэтому сцена работает офлайн и стабильно в CI.
 */
export function Lighting({ radius }: { radius: number }) {
  const r = Math.max(radius * 1.4, 6);
  return (
    <>
      <hemisphereLight args={['#f4f7ff', '#8a8170', 0.7]} />
      <directionalLight
        position={[r * 0.8, r * 1.6, r * 0.6]}
        intensity={1.6}
        color="#fff1dc"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-r}
        shadow-camera-right={r}
        shadow-camera-top={r}
        shadow-camera-bottom={-r}
        shadow-camera-near={0.5}
        shadow-camera-far={r * 5}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <Environment resolution={128} frames={1}>
        <Lightformer
          form="rect"
          intensity={1.6}
          position={[0, 6, 0]}
          rotation-x={Math.PI / 2}
          scale={[12, 12, 1]}
        />
        <Lightformer
          form="rect"
          intensity={0.8}
          position={[-8, 3, 0]}
          rotation-y={Math.PI / 2}
          scale={[10, 4, 1]}
        />
        <Lightformer
          form="rect"
          intensity={0.6}
          position={[8, 3, 4]}
          rotation-y={-Math.PI / 2}
          scale={[10, 4, 1]}
        />
      </Environment>
    </>
  );
}
