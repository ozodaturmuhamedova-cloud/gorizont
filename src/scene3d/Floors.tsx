import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { bbox } from '../domain/geometry';
import { floorShapePoints, type Vec3 } from '../domain/scene3d';
import type { Apartment, Finish, RoomType } from '../domain/types';
import { tileTexture, woodTexture } from './textures';
import { useLerpColor } from './useLerpColor';

/** Где плитка, а где паркет. */
const TILED: ReadonlySet<RoomType> = new Set<RoomType>(['bath', 'balcony']);
const SLAB_COLOR = '#8f948f';
const SLAB_DEPTH = 0.3;
const SLAB_MARGIN = 0.25;
/** Пол чуть выше плиты, чтобы не мерцал. */
const FLOOR_LIFT = 0.001;

function shapeGeometry(polygon: Apartment['outline']): THREE.BufferGeometry {
  const pts = floorShapePoints(polygon).map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.ShapeGeometry(new THREE.Shape(pts)).rotateX(-Math.PI / 2);
}

/**
 * Полы по полигонам комнат (§7): паркет или плитка, цвет — из отделки.
 * Два общих материала на все комнаты: смена отделки плавно меняет их цвет. Под квартирой — плита.
 */
export function Floors({ apartment, finish }: { apartment: Apartment; finish: Finish }) {
  const rooms = useMemo(
    () =>
      apartment.roomsGeometry.map((r) => ({
        id: r.id,
        tiled: TILED.has(r.type),
        geometry: shapeGeometry(r.polygon),
      })),
    [apartment],
  );
  useEffect(() => () => rooms.forEach((r) => r.geometry.dispose()), [rooms]);

  const materials = useMemo(
    () => ({
      wood: new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.7 }),
      tile: new THREE.MeshStandardMaterial({ map: tileTexture(), roughness: 0.35 }),
    }),
    [],
  );
  useEffect(
    () => () => {
      materials.wood.dispose();
      materials.tile.dispose();
    },
    [materials],
  );
  useLerpColor(materials.wood, finish.floor.wood);
  useLerpColor(materials.tile, finish.floor.tile);

  const slab = useMemo(() => {
    const { min, max } = bbox(apartment.outline);
    const position: Vec3 = [
      (min[0] + max[0]) / 2,
      -SLAB_DEPTH / 2 - FLOOR_LIFT,
      (min[1] + max[1]) / 2,
    ];
    const size: Vec3 = [max[0] - min[0] + SLAB_MARGIN, SLAB_DEPTH, max[1] - min[1] + SLAB_MARGIN];
    return { position, size };
  }, [apartment]);

  return (
    <group name="floors">
      {rooms.map((r) => (
        <mesh
          key={r.id}
          geometry={r.geometry}
          material={r.tiled ? materials.tile : materials.wood}
          position={[0, FLOOR_LIFT, 0]}
          receiveShadow
        />
      ))}
      <mesh position={slab.position} receiveShadow>
        <boxGeometry args={slab.size} />
        <meshStandardMaterial color={SLAB_COLOR} roughness={0.95} />
      </mesh>
    </group>
  );
}
