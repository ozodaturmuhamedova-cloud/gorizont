import { useMemo } from 'react';
import { useUrlSync } from '../app/useUrlSync';
import { apartmentsOnFloor, building, findApartment } from '../data';
import { filterApartments, isDefaultFilters } from '../domain/filters';
import type { RoomCount } from '../domain/types';
import { FloorPlanStage } from '../scene2d/FloorPlanStage';
import { Legend } from '../scene2d/Legend';
import { useStore } from '../store';
import { ApartmentCard } from '../ui/ApartmentCard';
import { ApartmentList } from '../ui/ApartmentList';
import { Filters } from '../ui/Filters';
import { FloorSwitcher } from '../ui/FloorSwitcher';
import { strings } from '../ui/strings';

/** Комнатности, которые есть в доме, — только по ним показываем кнопки фильтра. */
const ROOM_OPTIONS = [...new Set(building.apartments.map((a) => a.rooms))].sort(
  (a, b) => a - b,
) as RoomCount[];

export function PlanPage() {
  useUrlSync();
  const floor = useStore((s) => s.floor);
  const apartmentId = useStore((s) => s.apartmentId);
  const hoveredId = useStore((s) => s.hoveredId);
  const filters = useStore((s) => s.filters);
  const setFloor = useStore((s) => s.setFloor);
  const selectApartment = useStore((s) => s.selectApartment);
  const setHovered = useStore((s) => s.setHovered);
  const setFilters = useStore((s) => s.setFilters);
  const resetFilters = useStore((s) => s.resetFilters);

  const onFloor = useMemo(() => apartmentsOnFloor(floor), [floor]);
  const matching = useMemo(
    () =>
      filterApartments(building.apartments, filters).sort(
        (a, b) => b.floor - a.floor || a.number - b.number,
      ),
    [filters],
  );
  const matchingIds = useMemo(
    () => (isDefaultFilters(filters) ? undefined : new Set(matching.map((a) => a.id))),
    [filters, matching],
  );
  const selected = apartmentId ? (findApartment(apartmentId) ?? null) : null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex max-w-2xl flex-col gap-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {strings.plan.title}
            <span className="ml-2 text-base font-normal text-muted">
              {strings.apartment.floor(floor)}
            </span>
          </h1>
          <p className="text-muted">{strings.plan.lead}</p>
        </div>
        <Legend apartments={onFloor} />
      </div>

      <Filters
        filters={filters}
        roomOptions={ROOM_OPTIONS}
        found={matching.length}
        onChange={setFilters}
        onReset={resetFilters}
      />

      <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)_320px]">
        <div className="order-3 lg:order-none">
          <FloorSwitcher
            floors={building.floors}
            apartments={building.apartments}
            currentFloor={floor}
            selectedId={apartmentId}
            matchingIds={matchingIds}
            onFloor={setFloor}
            onSelect={selectApartment}
            onHover={setHovered}
          />
        </div>
        <div className="order-1 flex min-w-0 flex-col gap-2 lg:order-none">
          <div className="h-[56vh] min-h-[340px] lg:h-[min(640px,calc(100vh-240px))]">
            <FloorPlanStage
              floor={floor}
              floorPlate={building.floorPlate}
              apartments={onFloor}
              selectedId={apartmentId}
              hoveredId={hoveredId}
              matchingIds={matchingIds}
              onHover={setHovered}
              onSelect={selectApartment}
            />
          </div>
          <p className="text-xs text-muted">
            <span className="lg:hidden">{strings.plan.hintTouch}</span>
            <span className="hidden lg:inline">{strings.plan.hint}</span>
          </p>
        </div>
        {/* На телефоне: план → карточка → шахматка → список; на десктопе — колонка справа */}
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4">
          <div className="order-2 lg:order-none">
            <ApartmentCard apartment={selected} onClose={() => selectApartment(null)} />
          </div>
          <div className="order-4 lg:order-none">
            <ApartmentList
              apartments={matching}
              selectedId={apartmentId}
              hoveredId={hoveredId}
              onSelect={selectApartment}
              onHover={setHovered}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
