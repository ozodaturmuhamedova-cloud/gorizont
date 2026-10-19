/**
 * Единственная точка входа к данным. JSON проверяется один раз при загрузке модуля:
 * если данные битые, приложение падает сразу с понятным путём до поля, а не где-то в сцене.
 */
import buildingJson from './building.json';
import finishesJson from './finishes.json';
import furnitureJson from './furniture.json';
import { parseBuilding, parseFinishes, parseFurniture } from '../domain/data';
import type { Apartment, Finish } from '../domain/types';

export const building = parseBuilding(buildingJson);
export const furniture = parseFurniture(furnitureJson);
export const finishes = parseFinishes(finishesJson);

const apartmentsById = new Map(building.apartments.map((a) => [a.id, a]));

export function findApartment(id: string): Apartment | undefined {
  return apartmentsById.get(id);
}

export function apartmentsOnFloor(floor: number): Apartment[] {
  return building.apartments.filter((a) => a.floor === floor);
}

export function findFinish(id: string): Finish | undefined {
  return finishes.find((f) => f.id === id);
}

export const defaultFinish: Finish = finishes[0]!;
