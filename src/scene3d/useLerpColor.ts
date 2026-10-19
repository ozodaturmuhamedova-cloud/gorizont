import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';

/** Скорость перехода цвета: за ~0.4 с цвет почти доходит до нового. */
const RATE = 8;
const DONE = 1e-3;

type ColorMaterial = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;

/**
 * Плавная смена цвета материала при смене отделки. Сцена рисуется по требованию
 * (frameloop="demand"), поэтому, пока цвет не дошёл, просим следующий кадр.
 * Принимает материал или ref на него.
 */
export function useLerpColor(
  material: RefObject<ColorMaterial | null> | ColorMaterial,
  hex: string,
): void {
  const ref = useMemo(() => ('current' in material ? material : { current: material }), [material]);
  const target = useMemo(() => new THREE.Color(hex), [hex]);
  const invalidate = useThree((s) => s.invalidate);
  const first = useRef(true);

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    if (first.current) {
      m.color.copy(target);
      first.current = false;
    }
    invalidate();
  }, [ref, target, invalidate]);

  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    const c = m.color;
    if (
      Math.abs(c.r - target.r) < DONE &&
      Math.abs(c.g - target.g) < DONE &&
      Math.abs(c.b - target.b) < DONE
    ) {
      if (!c.equals(target)) c.copy(target);
      return;
    }
    c.lerp(target, 1 - Math.exp(-Math.min(dt, 0.1) * RATE));
    invalidate();
  });
}
