import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { modelParts, toneColor } from '../domain/furnitureModel';
import type { FurnitureItem } from '../domain/types';

const cache = new Map<string, THREE.BufferGeometry>();

/**
 * Одна геометрия на предмет каталога: детали модели слиты в один буфер с цветами вершин —
 * так каждый вид мебели рисуется одним вызовом (InstancedMesh), сколько бы его ни стояло.
 */
export function furnitureGeometry(item: FurnitureItem): THREE.BufferGeometry {
  const hit = cache.get(item.id);
  if (hit) return hit;
  const color = new THREE.Color();
  const parts = modelParts(item).map((p) => {
    const sx = p.max[0] - p.min[0];
    const sy = p.max[1] - p.min[1];
    const sz = p.max[2] - p.min[2];
    const g = new THREE.BoxGeometry(Math.max(sx, 1e-3), Math.max(sy, 1e-3), Math.max(sz, 1e-3));
    g.translate((p.min[0] + p.max[0]) / 2, (p.min[1] + p.max[1]) / 2, (p.min[2] + p.max[2]) / 2);
    // при включённом ColorManagement set() уже переводит sRGB в линейное пространство
    color.set(toneColor(item.color, p.tone));
    const n = g.attributes.position!.count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colors.set([color.r, color.g, color.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  });
  const merged = mergeGeometries(parts, false) ?? new THREE.BoxGeometry(...item.size);
  parts.forEach((g) => g.dispose());
  merged.computeBoundingSphere();
  cache.set(item.id, merged);
  return merged;
}

/** Освободить кеш при уходе со страницы 3D. */
export function disposeFurnitureGeometries(): void {
  cache.forEach((g) => g.dispose());
  cache.clear();
}
