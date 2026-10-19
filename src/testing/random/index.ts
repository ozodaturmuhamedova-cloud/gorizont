/**
 * Генераторы случайных квартир и мебели для тестов и /dev/random.
 * В прод-код не импортировать (ESLint это запрещает, CLAUDE.md §11).
 */
import type { Apartment } from '../../domain/types';

export { createRng, type Rng } from './rng';
export { AREA_LIMITS, randomApartment, type RandomApartmentOptions, type Shape } from './roomsGen';
export {
  randomFurnished,
  type Density,
  type FurnishedApartment,
  type RandomFurnishedOptions,
  type SkippedItem,
} from './furnitureGen';
export {
  apartmentViolations,
  doorGraph,
  doorZones,
  furnitureViolations,
  plausibilityViolations,
  windowZones,
  type FurnitureViolation,
} from './invariants';
export { REGRESSION_SEEDS, seedRange, type RegressionSeed } from './seeds';

/** Квартиры в формате building.json — чтобы прогнать их через ту же валидацию parseBuilding. */
export function asBuildingJson(apartments: readonly Apartment[]): unknown {
  return {
    complex: 'Тестовый дом',
    section: 1,
    floors: Math.max(1, ...apartments.map((a) => a.floor)),
    ceilingHeight: Math.max(...apartments.flatMap((a) => a.walls.map((w) => w.height))),
    floorPlate: {
      outline: [
        [-100, -100],
        [100, -100],
        [100, 100],
        [-100, 100],
      ],
      corridor: [
        [-100, -2],
        [100, -2],
        [100, 0],
        [-100, 0],
      ],
      core: [],
    },
    layouts: apartments.map((a) => ({
      id: a.layoutId,
      rooms: a.rooms,
      area: a.area,
      outline: a.outline,
      roomsGeometry: a.roomsGeometry,
      walls: a.walls,
      openings: a.openings,
    })),
    apartments: apartments.map((a) => ({
      id: a.id,
      number: a.number,
      floor: a.floor,
      layoutId: a.layoutId,
      price: a.price,
      status: a.status,
    })),
  };
}
