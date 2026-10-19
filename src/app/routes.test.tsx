import { fireEvent, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from './routes';
import { initialStoreState, useStore } from '../store';
import { DEMO_APARTMENT_ID, strings } from '../ui/strings';

// Konva в jsdom не рисует: canvas проверяется в e2e, здесь — всё вокруг него
vi.mock('../scene2d/FloorPlanStage', () => ({
  FloorPlanStage: () => <div data-testid="floor-plan" />,
}));
// в jsdom нет WebGL: страница 3D покажет 2D-планировку
vi.mock('../scene3d/webgl', () => ({ hasWebGL: () => false }));

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('маршруты', () => {
  beforeEach(() => useStore.setState(initialStoreState, true));

  it('/ показывает план верхнего этажа, шахматку и пустую карточку', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { level: 1, name: /Поэтажный план/ })).toHaveTextContent(
      '9 этаж',
    );
    expect(screen.getByTestId('floor-plan')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: strings.floors.label })).toBeInTheDocument();
    expect(screen.getByText(strings.card.empty)).toBeInTheDocument();
  });

  it('клик по квартире в шахматке открывает карточку с данными дома и ссылкой на 3D', () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('button', { name: 'Кв. 51, свободна' }));
    const card = screen.getByRole('complementary', { name: 'Кв. 51' });
    expect(card).toHaveTextContent('9 этаж · 2-комн. · 63,0 м²');
    expect(screen.getByRole('link', { name: strings.plan.open3d })).toHaveAttribute(
      'href',
      `/apartment/${DEMO_APARTMENT_ID}/3d`,
    );
  });

  it('проданные квартиры в шахматке недоступны', () => {
    renderAt('/');
    const sold = screen.getAllByRole('button', { name: /продана$/ });
    expect(sold.length).toBeGreaterThan(0);
    for (const b of sold) expect(b).toBeDisabled();
  });

  it('переключение этажа меняет заголовок и снимает выбор', () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('button', { name: 'Кв. 51, свободна' }));
    fireEvent.click(screen.getByRole('button', { name: /^2 этаж/ }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('2 этаж');
    expect(screen.getByText(strings.card.empty)).toBeInTheDocument();
  });

  it('/apartment/:id/3d лениво загружает страницу тура с номером квартиры', async () => {
    renderAt(`/apartment/${DEMO_APARTMENT_ID}/3d`);
    expect(
      await screen.findByRole('heading', { level: 1, name: strings.tour.title(51) }),
    ).toBeInTheDocument();
  });

  it('несуществующая квартира показывает 404', async () => {
    renderAt('/apartment/s9-f99-a1/3d');
    expect(
      await screen.findByRole('heading', { level: 1, name: strings.notFound.title }),
    ).toBeInTheDocument();
  });

  it('неизвестный адрес показывает 404', () => {
    renderAt('/no-such-page');
    expect(
      screen.getByRole('heading', { level: 1, name: strings.notFound.title }),
    ).toBeInTheDocument();
  });

  it('шапка с названием ЖК есть на всех страницах', () => {
    renderAt('/no-such-page');
    expect(screen.getByText(strings.brand.name)).toBeInTheDocument();
  });
});
