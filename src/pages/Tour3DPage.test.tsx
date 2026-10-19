import { fireEvent, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../app/routes';
import { findApartment, findFinish } from '../data';
import { formatPrice } from '../domain/format';
import { finishCost } from '../domain/pricing';
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
});
