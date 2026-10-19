import { act, fireEvent, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../app/routes';
import { findApartment, findFinish, furniture } from '../data';
import { formatPrice } from '../domain/format';
import { zonesFor } from '../domain/layout';
import { estimate, finishCost } from '../domain/pricing';
import type { ApartmentSceneProps } from '../scene3d/ApartmentScene';
import { hasWebGL } from '../scene3d/webgl';
import { initialStoreState, useStore } from '../store';
import { strings } from '../ui/strings';

// WebGL в jsdom нет: сцену проверяет e2e, здесь — заглушка, показывающая свои свойства
vi.mock('../scene3d/ApartmentScene', () => ({
  default: (p: ApartmentSceneProps) => (
    <div
      data-testid="scene"
      data-apartment={p.apartment.id}
      data-finish={p.finish.id}
      data-cut={String(p.cut)}
      data-reset={p.resetKey}
    />
  ),
}));
vi.mock('../scene3d/webgl', () => ({ hasWebGL: vi.fn(() => true) }));
// роутер подключает и страницу плана, а Konva в jsdom не работает
vi.mock('../scene2d/FloorPlanStage', () => ({ FloorPlanStage: () => null }));

const ID = 's1-f9-a3';
const apt = findApartment(ID)!;
const flat = (s: string | null) => (s ?? '').replace(/\s/g, ' ');

function renderTour() {
  const router = createMemoryRouter(routes, { initialEntries: [`/apartment/${ID}/3d`] });
  render(<RouterProvider router={router} />);
}

describe('страница 3D-тура', () => {
  beforeEach(() => {
    localStorage.clear();
    useStore.setState(initialStoreState, true);
    vi.mocked(hasWebGL).mockReturnValue(true);
  });

  it('показывает сцену выбранной квартиры с отделкой по умолчанию', async () => {
    renderTour();
    const scene = await screen.findByTestId('scene');
    expect(scene).toHaveAttribute('data-apartment', ID);
    expect(scene).toHaveAttribute('data-finish', 'scandi');
    expect(scene).toHaveAttribute('data-cut', 'false');
    expect(screen.getByTestId('finish-cost')).toHaveTextContent(strings.tour.finishIncluded);
    expect(flat(screen.getByTestId('total').textContent)).toBe(flat(formatPrice(apt.price)));
  });

  it('смена отделки меняет сцену и смету', async () => {
    renderTour();
    fireEvent.click(await screen.findByRole('button', { name: /Лофт/ }));
    expect(screen.getByRole('button', { name: /Лофт/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('scene')).toHaveAttribute('data-finish', 'loft');
    const cost = finishCost(findFinish('loft')!, apt.area);
    expect(flat(screen.getByTestId('finish-cost').textContent)).toBe(flat(formatPrice(cost)));
    expect(flat(screen.getByTestId('total').textContent)).toBe(flat(formatPrice(apt.price + cost)));
  });

  it('«Срез стен» и «Вид 3/4» передаются в сцену', async () => {
    renderTour();
    fireEvent.click(await screen.findByRole('button', { name: strings.tour.cut }));
    expect(screen.getByTestId('scene')).toHaveAttribute('data-cut', 'true');
    fireEvent.click(screen.getByRole('button', { name: strings.tour.resetView }));
    expect(screen.getByTestId('scene')).toHaveAttribute('data-reset', '1');
  });

  it('без WebGL — сообщение и 2D-планировка вместо сцены', async () => {
    vi.mocked(hasWebGL).mockReturnValue(false);
    renderTour();
    expect(await screen.findByText(strings.tour.noWebGL)).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: strings.card.miniPlan(apt.number) }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('scene')).toBeNull();
  });

  it('«Готовый комплект» расставляет мебель и добавляет её в смету, «Очистить» убирает', async () => {
    renderTour();
    expect(screen.getByText(strings.furnish.empty)).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: strings.furnish.preset }));
    const placed = useStore.getState().placed[ID] ?? [];
    expect(placed.length).toBeGreaterThan(10);
    const e = estimate(apt, placed, furniture, findFinish('scandi')!);
    expect(e.furnitureTotal).toBeGreaterThan(0);
    expect(flat(screen.getByTestId('furniture-cost').textContent)).toBe(
      flat(formatPrice(e.furnitureTotal)),
    );
    expect(flat(screen.getByTestId('total').textContent)).toBe(flat(formatPrice(e.total)));
    // второй вариант — другая расстановка того же набора
    fireEvent.click(screen.getByRole('button', { name: strings.furnish.presetAgain }));
    expect(useStore.getState().placed[ID]).not.toEqual(placed);
    fireEvent.click(screen.getByRole('button', { name: strings.furnish.clear }));
    expect(useStore.getState().placed[ID]).toEqual([]);
    expect(flat(screen.getByTestId('total').textContent)).toBe(flat(formatPrice(apt.price)));
  });

  it('каталог: вкладки по комнатам, выбор предмета показывает подсказку и отмену', async () => {
    renderTour();
    fireEvent.click(await screen.findByRole('tab', { name: strings.roomTypes.bath }));
    const toilet = furniture.byId.get('toilet')!;
    fireEvent.click(screen.getByRole('button', { name: strings.furnish.addLabel(toilet.name) }));
    expect(useStore.getState().placingItemId).toBe('toilet');
    expect(screen.getByTestId('furnish-toolbar')).toHaveTextContent(
      strings.furnish.placing(toilet.name),
    );
    fireEvent.click(screen.getByRole('button', { name: strings.furnish.cancel }));
    expect(useStore.getState().placingItemId).toBeNull();
    expect(screen.queryByTestId('furnish-toolbar')).toBeNull();
  });

  it('выбранный предмет: поворот и удаление кнопками', async () => {
    renderTour();
    const bedroom = apt.roomsGeometry.find((r) => r.type === 'bedroom')!;
    const z = zonesFor(apt, bedroom);
    const c: [number, number] = [
      (z.inner.min[0] + z.inner.max[0]) / 2,
      (z.inner.min[1] + z.inner.max[1]) / 2,
    ];
    act(() =>
      useStore.getState().addFurniture(ID, { itemId: 'dresser', position: c, rotation: 0 }),
    );
    fireEvent.click(await screen.findByRole('button', { name: strings.furnish.rotateRight }));
    expect(useStore.getState().placed[ID]![0]!.rotation).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: strings.furnish.remove }));
    expect(useStore.getState().placed[ID]).toEqual([]);
  });

  it('прогулка: окно роста, проверка диапазона, HUD и выход', async () => {
    renderTour();
    fireEvent.click(await screen.findByRole('button', { name: strings.walk.start }));
    const dialog = screen.getByRole('dialog', { name: strings.walk.dialogTitle });
    const input = screen.getByRole('spinbutton', { name: strings.walk.heightLabel });
    expect(dialog).toBeInTheDocument();
    fireEvent.change(input, { target: { value: '50' } });
    expect(screen.getByRole('button', { name: strings.walk.begin })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(strings.walk.outOfRange);
    fireEvent.change(input, { target: { value: '185' } });
    fireEvent.click(screen.getByRole('button', { name: strings.walk.begin }));
    expect(useStore.getState().cameraMode).toBe('walk');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('walk-height')).toHaveTextContent(strings.walk.height(185));
    fireEvent.click(screen.getByRole('button', { name: strings.walk.exit }));
    expect(useStore.getState().cameraMode).toBe('orbit');
  });

  it('рост уже указан — прогулка без окна, «Изменить рост» открывает его снова', async () => {
    act(() => useStore.getState().setHeight(160));
    renderTour();
    fireEvent.click(await screen.findByRole('button', { name: strings.walk.start }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('walk-height')).toHaveTextContent(strings.walk.height(160));
    fireEvent.click(screen.getByRole('button', { name: strings.walk.changeHeight }));
    const input = screen.getByRole('spinbutton', { name: strings.walk.heightLabel });
    fireEvent.change(input, { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: strings.walk.save }));
    expect(screen.getByTestId('walk-height')).toHaveTextContent(strings.walk.height(200));
    expect(useStore.getState().cameraMode).toBe('walk');
  });
});
