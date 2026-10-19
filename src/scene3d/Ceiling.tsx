import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Apartment } from '../domain/types';

const CEILING_COLOR = '#f7f6f2';

/** Потолок по контуру квартиры (виден только в прогулке, §7). Нормаль смотрит вниз. */
export function Ceiling({ apartment, height }: { apartment: Apartment; height: number }) {
  const geometry = useMemo(() => {
    const pts = apartment.outline.map(([x, y]) => new THREE.Vector2(x, y));
    // точка (x, y) после поворота на +π/2 вокруг X попадает в (x, 0, y), нормаль — вниз
    return new THREE.ShapeGeometry(new THREE.Shape(pts)).rotateX(Math.PI / 2);
  }, [apartment]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} position-y={height} raycast={() => null}>
      <meshStandardMaterial color={CEILING_COLOR} roughness={0.95} side={THREE.DoubleSide} />
    </mesh>
  );
}
