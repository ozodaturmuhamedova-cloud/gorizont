import { Instance, Instances } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import type * as THREE from 'three';
import { WALL_CUT_HEIGHT } from '../domain/constants';
import { openingsByWall, pieceBox, wallPieces } from '../domain/scene3d';
import type { Apartment } from '../domain/types';
import { useLerpColor } from './useLerpColor';

/** Стены из сегментов вокруг проёмов. Все сегменты — один вызов отрисовки (InstancedMesh). */
export function Walls({
  apartment,
  color,
  cut,
}: {
  apartment: Apartment;
  color: string;
  cut: boolean;
}) {
  const boxes = useMemo(() => {
    const byWall = openingsByWall(apartment.openings);
    return apartment.walls.flatMap((w, i) =>
      wallPieces(w, byWall.get(i) ?? [], cut ? WALL_CUT_HEIGHT : Infinity).map((p) =>
        pieceBox(w, p),
      ),
    );
  }, [apartment, cut]);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useLerpColor(mat, color);

  return (
    <Instances key={boxes.length} limit={boxes.length} castShadow receiveShadow name="walls">
      <boxGeometry />
      <meshStandardMaterial ref={mat} roughness={0.92} />
      {boxes.map((b, i) => (
        <Instance key={i} position={b.position} rotation={[0, b.rotationY, 0]} scale={b.size} />
      ))}
    </Instances>
  );
}
