/**
 * Действия с выбранным предметом, общие для клавиатуры в 3D-сцене и кнопок панели:
 * поворот с проверкой расстановки, удаление.
 */
import { furniture } from '../data';
import { snapPose, validatePlacement, type PlacementCheck } from '../domain/layout';
import type { Apartment, PlacedFurniture } from '../domain/types';
import { ROTATE_STEP } from '../domain/constants';
import { useStore } from './index';

export interface PoseCheck {
  pose: Omit<PlacedFurniture, 'itemId'>;
  check: PlacementCheck;
}

/** Поставить предмет itemId в pose: притяжение к стене/углу/сетке и проверка (§7.2). */
export function checkPose(
  apt: Apartment,
  itemId: string,
  pose: Omit<PlacedFurniture, 'itemId'>,
  exclude: number | null = null,
): PoseCheck | null {
  const item = furniture.byId.get(itemId);
  if (!item) return null;
  const snapped = snapPose(apt, item, pose).pose;
  const others = (useStore.getState().placed[apt.id] ?? []).filter((_, i) => i !== exclude);
  return { pose: snapped, check: validatePlacement(apt, item, snapped, others, furniture) };
}

const normalize = (r: number) => {
  const t = r % (2 * Math.PI);
  return t < 0 ? t + 2 * Math.PI : t;
};

/** Повернуть выбранный предмет на шаг 15°. Если так он не встаёт — не поворачивать. */
export function rotateSelected(apt: Apartment, dir: 1 | -1): PoseCheck | null {
  const { selectedFurniture: i, placed, moveFurniture } = useStore.getState();
  const p = i === null ? undefined : placed[apt.id]?.[i];
  if (i === null || !p) return null;
  const item = furniture.byId.get(p.itemId);
  if (!item) return null;
  const pose = { position: p.position, rotation: normalize(p.rotation + dir * ROTATE_STEP) };
  const others = (placed[apt.id] ?? []).filter((_, j) => j !== i);
  const check = validatePlacement(apt, item, pose, others, furniture);
  if (check.status !== 'error') moveFurniture(apt.id, i, pose);
  return { pose, check };
}

export function removeSelected(apt: Apartment): void {
  const { selectedFurniture: i, removeFurniture } = useStore.getState();
  if (i !== null) removeFurniture(apt.id, i);
}
