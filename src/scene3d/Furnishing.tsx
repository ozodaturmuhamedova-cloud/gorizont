/**
 * Ручная расстановка в 3D (§7): призрак предмета из каталога следует за указателем по полу,
 * клик ставит; поставленный предмет можно выбрать и перетащить; Q/E — поворот на 15°,
 * Delete — удалить, Esc — отмена. Статус считает domain/layout (через store/furnishActions),
 * здесь он только показывается: цвет предмета, зона подхода на полу и подсказка.
 */
import { Html } from '@react-three/drei';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { furniture } from '../data';
import { CLICK_TOLERANCE_PX, ROTATE_STEP } from '../domain/constants';
import { centerOf } from '../domain/geometry';
import { clearanceBox, footprint, type PlacementStatus } from '../domain/layout';
import type { Apartment, Obb, PlacedFurniture, Vec2 } from '../domain/types';
import { useStore } from '../store';
import { checkPose, removeSelected, rotateSelected, type PoseCheck } from '../store/furnishActions';
import { strings } from '../ui/strings';
import { furnitureGeometry } from './furnitureGeometry';
import { FurnitureLayer } from './FurnitureLayer';

export const STATUS_COLOR: Record<PlacementStatus, string> = {
  ok: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
};

const EMPTY: PlacedFurniture[] = [];

declare global {
  interface Window {
    /** Только в dev: экранные координаты центра комнаты (по типу или id) — для e2e. */
    __gorizontFurnish?: { roomPoint: (room: string) => { x: number; y: number } | null };
  }
}
const FLOOR = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

interface Active extends PoseCheck {
  itemId: string;
  /** Индекс перетаскиваемого предмета; null — призрак из каталога. */
  index: number | null;
}

interface Drag {
  index: number;
  /** Позиция предмета минус точка захвата. */
  offset: Vec2;
  moved: boolean;
}

const statusMaterials = new Map<PlacementStatus, THREE.MeshStandardMaterial>();
function activeMaterial(status: PlacementStatus) {
  let m = statusMaterials.get(status);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.75,
      transparent: true,
      opacity: 0.88,
      emissive: new THREE.Color(STATUS_COLOR[status]),
      emissiveIntensity: 0.35,
    });
    statusMaterials.set(status, m);
  }
  return m;
}

/** Прямоугольник на полу: след или зона подхода. */
function FloorBox({
  obb,
  color,
  opacity,
  y,
}: {
  obb: Obb;
  color: string;
  opacity: number;
  y: number;
}) {
  return (
    <mesh
      position={[obb.center[0], y, obb.center[1]]}
      rotation={[-Math.PI / 2, 0, -obb.rotation]}
      renderOrder={2}
      raycast={() => null}
    >
      <planeGeometry args={[obb.half[0] * 2, obb.half[1] * 2]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

function ActiveItem({ active }: { active: Active }) {
  const item = furniture.byId.get(active.itemId);
  if (!item) return null;
  const { status, reasons } = active.check;
  const color = STATUS_COLOR[status];
  const [x, y] = active.pose.position;
  const fp = footprint(item, active.pose);
  const cb = clearanceBox(item, active.pose);
  const reason = reasons[0];
  return (
    <group>
      <mesh
        geometry={furnitureGeometry(item)}
        material={activeMaterial(status)}
        position={[x, 0.002, y]}
        rotation-y={-active.pose.rotation}
        raycast={() => null}
      />
      <FloorBox obb={cb} color={color} opacity={0.18} y={0.012} />
      <FloorBox obb={fp} color={color} opacity={0.35} y={0.014} />
      {reason && (
        <Html position={[x, item.size[2] + 0.25, y]} center zIndexRange={[20, 0]}>
          <div
            data-testid="placement-reason"
            className="pointer-events-none whitespace-nowrap rounded-lg px-2 py-1 text-xs font-medium text-white shadow"
            style={{ background: color }}
          >
            {strings.furnish.reasons[reason]}
          </div>
        </Html>
      )}
    </group>
  );
}

export interface FurnishingProps {
  apartment: Apartment;
  /** Сдвиг сцены: план → мир (центр квартиры в начале координат). */
  center: Vec2;
  editable: boolean;
}

export function Furnishing({ apartment, center, editable }: FurnishingProps) {
  const aptId = apartment.id;
  const placed = useStore((s) => s.placed[aptId]) ?? EMPTY;
  const placingId = useStore((s) => s.placingItemId);
  const selected = useStore((s) => s.selectedFurniture);
  const gl = useThree((s) => s.gl);
  // элемент, на котором R3F и OrbitControls слушают указатель: наши обработчики добавляются
  // позже и срабатывают после них — нажатие на предмет уже обработано (drag.current)
  const connected: unknown = useThree((s) => s.events.connected);
  const target = connected instanceof HTMLElement ? connected : gl.domElement;
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;
  const invalidate = useThree((s) => s.invalidate);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);

  const [active, setActive] = useState<Active | null>(null);
  const drag = useRef<Drag | null>(null);
  const ghostRotation = useRef(0);
  const lastPoint = useRef<Vec2 | null>(null);
  const down = useRef<{ x: number; y: number; onItem: boolean } | null>(null);
  const frame = useRef(0);

  /** Точка пола под указателем, в координатах плана. */
  const planPoint = useCallback(
    (clientX: number, clientY: number): Vec2 | null => {
      const r = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - r.left) / r.width) * 2 - 1,
        -((clientY - r.top) / r.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.ray.intersectPlane(FLOOR, new THREE.Vector3());
      return hit ? [hit.x + center[0], hit.z + center[1]] : null;
    },
    [gl, camera, raycaster, center],
  );

  const evaluate = useCallback(
    (p: Vec2): Active | null => {
      const d = drag.current;
      if (d) {
        const item = placed[d.index];
        if (!item) return null;
        const pose = {
          position: [p[0] + d.offset[0], p[1] + d.offset[1]] as Vec2,
          rotation: item.rotation,
        };
        const c = checkPose(apartment, item.itemId, pose, d.index);
        return c && { ...c, itemId: item.itemId, index: d.index };
      }
      if (!placingId) return null;
      const c = checkPose(apartment, placingId, { position: p, rotation: ghostRotation.current });
      return c && { ...c, itemId: placingId, index: null };
    },
    [apartment, placed, placingId],
  );

  // новый предмет из каталога: призрак без поворота, пока указатель не на полу
  useEffect(() => {
    ghostRotation.current = 0;
    setActive(null);
    gl.domElement.style.cursor = placingId ? 'crosshair' : '';
    invalidate();
  }, [placingId, gl, invalidate]);

  useEffect(() => {
    if (!editable) return;
    const el = target;
    const onMove = (e: PointerEvent) => {
      if (!drag.current && !useStore.getState().placingItemId) return;
      const p = planPoint(e.clientX, e.clientY);
      if (!p) return;
      lastPoint.current = p;
      if (drag.current) drag.current.moved = true;
      // не чаще раза за кадр
      if (frame.current) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        if (lastPoint.current) setActive(evaluate(lastPoint.current));
      });
    };
    const onDown = (e: PointerEvent) => {
      down.current = { x: e.clientX, y: e.clientY, onItem: drag.current !== null };
    };
    const onUp = (e: PointerEvent) => {
      const start = down.current;
      down.current = null;
      const click =
        start !== null && Math.hypot(e.clientX - start.x, e.clientY - start.y) < CLICK_TOLERANCE_PX;
      const store = useStore.getState();
      const d = drag.current;
      if (d) {
        const p = planPoint(e.clientX, e.clientY);
        // короткое нажатие без сдвига — только выбор, позицию не трогаем
        const result = d.moved && !click && p ? evaluate(p) : null;
        drag.current = null;
        if (controls) controls.enabled = true;
        if (result && result.check.status !== 'error') {
          store.moveFurniture(aptId, d.index, result.pose);
        }
        setActive(null);
        return;
      }
      if (store.placingItemId && click) {
        const p = planPoint(e.clientX, e.clientY);
        const result = p ? evaluate(p) : null;
        if (result && result.check.status !== 'error') {
          store.setPlacing(null);
          store.addFurniture(aptId, { itemId: result.itemId, ...result.pose });
          setActive(null);
        } else setActive(result);
        return;
      }
      if (click && !start?.onItem) store.selectFurniture(null);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [editable, gl, target, planPoint, evaluate, controls, aptId]);

  // клавиатура: Q/E — поворот, Delete — удалить, Esc — отмена
  useEffect(() => {
    if (!editable) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const store = useStore.getState();
      const key = e.key.toLowerCase();
      const dir = key === 'q' || key === 'й' ? -1 : key === 'e' || key === 'у' ? 1 : 0;
      if (dir !== 0) {
        if (store.placingItemId) {
          ghostRotation.current += dir * ROTATE_STEP;
          if (lastPoint.current) setActive(evaluate(lastPoint.current));
        } else if (store.selectedFurniture !== null) {
          rotateSelected(apartment, dir);
        }
        e.preventDefault();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && store.selectedFurniture !== null) {
        removeSelected(apartment);
        e.preventDefault();
        return;
      }
      if (e.key === 'Escape') {
        drag.current = null;
        if (controls) controls.enabled = true;
        setActive(null);
        store.setPlacing(null);
        store.selectFurniture(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editable, apartment, evaluate, controls]);

  const onItemDown = useCallback(
    (index: number, e: ThreeEvent<PointerEvent>) => {
      if (!editable || useStore.getState().placingItemId) return;
      e.stopPropagation();
      const item = placed[index];
      const p = planPoint(e.nativeEvent.clientX, e.nativeEvent.clientY);
      if (!item || !p) return;
      useStore.getState().selectFurniture(index);
      drag.current = {
        index,
        offset: [item.position[0] - p[0], item.position[1] - p[1]],
        moved: false,
      };
      // пока тащим предмет, камера стоит на месте
      if (controls) controls.enabled = false;
    },
    [editable, placed, planPoint, controls],
  );

  useEffect(() => invalidate(), [active, placed, selected, invalidate]);

  // только в dev: экранная точка центра комнаты — e2e кликает по полу как пользователь
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__gorizontFurnish = {
      roomPoint: (type) => {
        const room = apartment.roomsGeometry.find((r) => r.type === type || r.id === type);
        if (!room) return null;
        const [x, y] = centerOf(room.polygon);
        const v = new THREE.Vector3(x - center[0], 0, y - center[1]).project(camera);
        const r = gl.domElement.getBoundingClientRect();
        return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
      },
    };
    return () => {
      delete window.__gorizontFurnish;
    };
  }, [apartment, center, camera, gl]);

  const dragging = active?.index ?? null;
  return (
    <>
      <FurnitureLayer
        placed={placed}
        catalog={furniture}
        hidden={dragging}
        selected={selected}
        onPointerDown={onItemDown}
      />
      {active && <ActiveItem active={active} />}
    </>
  );
}
