import { useMemo } from 'react';
import { apartmentsOnFloor, building, findApartment } from '../data';
import { FloorPlanStage } from '../scene2d/FloorPlanStage';
import { Legend } from '../scene2d/Legend';
import { useStore } from '../store';
import { ApartmentCard } from '../ui/ApartmentCard';
import { FloorSwitcher } from '../ui/FloorSwitcher';
import { strings } from '../ui/strings';

export function PlanPage() {
  const floor = useStore((s) => s.floor);
  const apartmentId = useStore((s) => s.apartmentId);
  const hoveredId = useStore((s) => s.hoveredId);
  const setFloor = useStore((s) => s.setFloor);
  const selectApartment = useStore((s) => s.selectApartment);
  const setHovered = useStore((s) => s.setHovered);

  const onFloor = useMemo(() => apartmentsOnFloor(floor), [floor]);
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

      <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)_300px]">
        <FloorSwitcher
          floors={building.floors}
          apartments={building.apartments}
          currentFloor={floor}
          selectedId={apartmentId}
          onFloor={setFloor}
          onSelect={selectApartment}
          onHover={setHovered}
        />
        <div className="flex min-w-0 flex-col gap-2">
          <div className="h-[56vh] min-h-[340px] lg:h-[min(640px,calc(100vh-240px))]">
            <FloorPlanStage
              floor={floor}
              floorPlate={building.floorPlate}
              apartments={onFloor}
              selectedId={apartmentId}
              hoveredId={hoveredId}
              onHover={setHovered}
              onSelect={selectApartment}
            />
          </div>
          <p className="text-xs text-muted">{strings.plan.hint}</p>
        </div>
        <ApartmentCard apartment={selected} onClose={() => selectApartment(null)} />
      </div>
    </section>
  );
}
