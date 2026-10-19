import { fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../app/routes';
import { building } from '../data';
import { DEFAULT_FILTERS, filterApartments } from '../domain/filters';
import { initialStoreState, useStore } from '../store';
import { strings } from '../ui/strings';

// Konva в jsdom не рисует: canvas проверяется в e2e
vi.mock('../scene2d/FloorPlanStage', () => ({
  FloorPlanStage: () => <div data-testid="floor-plan" />,
}));

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}
const count = (patch: Partial<typeof DEFAULT_FILTERS>) =>
  filterApartments(building.apartments, { ...DEFAULT_FILTERS, ...patch }).length;
const list = () => screen.getByRole('region', { name: strings.list.label });

describe('фильтры на странице плана', () => {
  beforeEach(() => useStore.setState(initialStoreState, true));

  it('без фильтров найдены все квартиры дома', () => {
    renderAt('/');
    expect(screen.getByRole('status')).toHaveTextContent(
      strings.filters.found(building.apartments.length),
    );
    expect(within(list()).getAllByRole('listitem')).toHaveLength(building.apartments.length);
  });

  it('комнатность: список и счётчик сужаются, адрес обновляется', () => {
    const router = renderAt('/');
    fireEvent.click(screen.getByRole('button', { name: '2-комнатные' }));
    expect(screen.getByRole('button', { name: '2-комнатные' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      strings.filters.found(count({ rooms: [2] })),
    );
    expect(within(list()).getAllByRole('listitem')).toHaveLength(count({ rooms: [2] }));
    expect(router.state.location.search).toBe('?rooms=2');
  });

  it('цена «до 8 млн» и «только свободные»', () => {
    const router = renderAt('/');
    fireEvent.change(screen.getByLabelText('Цена, млн ₽, до'), { target: { value: '8' } });
    fireEvent.click(screen.getByLabelText(strings.filters.onlyFree));
    const n = count({ priceRange: [-Infinity, 8_000_000], onlyFree: true });
    expect(screen.getByRole('status')).toHaveTextContent(strings.filters.found(n));
    expect(router.state.location.search).toBe('?price=-8000000&free=1');
  });

  it('квартиры, не прошедшие фильтр, в шахматке бледные', () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('button', { name: 'Студии' }));
    expect(screen.getByRole('button', { name: 'Кв. 51, свободна' })).toHaveClass('opacity-25');
    expect(screen.getByRole('button', { name: 'Кв. 49, свободна' })).not.toHaveClass('opacity-25');
  });

  it('клик в списке выбирает квартиру и открывает карточку с мини-планом', () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('button', { name: '3-комнатные' }));
    const row = within(list())
      .getAllByRole('button')
      .find((b) => !b.hasAttribute('disabled'))!;
    fireEvent.click(row);
    const id = useStore.getState().apartmentId!;
    const apt = building.apartments.find((a) => a.id === id)!;
    expect(apt.rooms).toBe(3);
    const card = screen.getByRole('complementary', { name: `Кв. ${apt.number}` });
    expect(
      within(card).getByRole('img', { name: strings.card.miniPlan(apt.number) }),
    ).toBeVisible();
  });

  it('сброс возвращает все квартиры', () => {
    renderAt('/');
    fireEvent.click(screen.getByLabelText(strings.filters.onlyFree));
    fireEvent.click(screen.getByRole('button', { name: strings.filters.reset }));
    expect(screen.getByRole('status')).toHaveTextContent(
      strings.filters.found(building.apartments.length),
    );
  });

  it('состояние восстанавливается из ссылки', () => {
    renderAt('/?rooms=3&free=1&apt=s1-f9-a6&area=70-');
    expect(screen.getByRole('button', { name: '3-комнатные' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByLabelText(strings.filters.onlyFree)).toBeChecked();
    expect(screen.getByLabelText('Площадь, м², от')).toHaveValue(70);
    expect(screen.getByRole('complementary', { name: 'Кв. 54' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('9 этаж');
  });

  it('мусор в ссылке не ломает страницу', () => {
    renderAt('/?rooms=x&area=abc&floor=99&apt=nope');
    expect(screen.getByRole('status')).toHaveTextContent(
      strings.filters.found(building.apartments.length),
    );
    expect(screen.getByText(strings.card.empty)).toBeInTheDocument();
  });
});
