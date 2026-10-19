import type { ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { FurnitureCatalog, FurnitureItem, PlacedFurniture } from '../domain/types';
import { furnitureGeometry } from './furnitureGeometry';

export interface FurnitureLayerProps {
  placed: readonly PlacedFurniture[];
  catalog: Pick<FurnitureCatalog, 'byId'>;
  /** Индекс предмета, который сейчас рисуется отдельно (перетаскивается). */
  hidden?: number | null;
  /** Индекс выбранного предмета — подсвечивается. */
  selected?: number | null;
  onPointerDown?: (index: number, e: ThreeEvent<PointerEvent>) => void;
}

const SELECTED_TINT = new THREE.Color('#9fd3ff');
const WHITE = new THREE.Color('#ffffff');

/** Общий материал мебели: цвета — в вершинах геометрии. */
export const furnitureMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.75,
  metalness: 0.02,
});

interface Group {
  item: FurnitureItem;
  /** Индексы в placed. */
  indices: number[];
}

/** Один InstancedMesh на вид предмета: десятки стульев — один вызов отрисовки. */
function ItemInstances({
  group,
  placed,
  selected,
  onPointerDown,
}: {
  group: Group;
  placed: readonly PlacedFurniture[];
  selected?: number | null;
  onPointerDown?: FurnitureLayerProps['onPointerDown'];
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = furnitureGeometry(group.item);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const one = new THREE.Vector3(1, 1, 1);
    group.indices.forEach((idx, i) => {
      const p = placed[idx]!;
      q.setFromAxisAngle(up, -p.rotation);
      m.compose(new THREE.Vector3(p.position[0], 0, p.position[1]), q, one);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, idx === selected ? SELECTED_TINT : WHITE);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [group, placed, selected]);

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, furnitureMaterial, group.indices.length]}
      castShadow
      receiveShadow
      onPointerDown={(e) => {
        if (e.instanceId === undefined || !onPointerDown) return;
        const idx = group.indices[e.instanceId];
        if (idx !== undefined) onPointerDown(idx, e);
      }}
    />
  );
}

export function FurnitureLayer({
  placed,
  catalog,
  hidden,
  selected,
  onPointerDown,
}: FurnitureLayerProps) {
  const groups = useMemo(() => {
    const m = new Map<string, Group>();
    placed.forEach((p, i) => {
      if (i === hidden) return;
      const item = catalog.byId.get(p.itemId);
      if (!item) return;
      const g = m.get(item.id) ?? { item, indices: [] };
      g.indices.push(i);
      m.set(item.id, g);
    });
    return [...m.values()];
  }, [placed, catalog, hidden]);

  return (
    <group name="furniture">
      {groups.map((g) => (
        <ItemInstances
          // новый счётчик — новый буфер инстансов
          key={`${g.item.id}-${g.indices.length}`}
          group={g}
          placed={placed}
          selected={selected}
          onPointerDown={onPointerDown}
        />
      ))}
    </group>
  );
}
