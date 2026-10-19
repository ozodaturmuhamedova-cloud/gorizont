import type { ApartmentStatus } from '../domain/types';

/** Цвета статусов (CLAUDE.md §6). */
export const STATUS_COLORS: Record<ApartmentStatus, string> = {
  free: '#22c55e',
  reserved: '#f59e0b',
  sold: '#9ca3af',
};

/** Цвета подложки плана. */
export const PLAN_COLORS = {
  floor: '#f3f4f1',
  floorStroke: '#3a403c',
  corridor: '#e4e7e1',
  core: '#d4d8d1',
  coreStroke: '#9aa29b',
  label: '#5b6761',
  ink: '#1b221f',
  selected: '#2c6a57',
  roomFill: '#fbfbf9',
  wall: '#2a2f2c',
  window: '#5aa9e6',
} as const;
