import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { routes } from './routes';
import { DEMO_APARTMENT_ID, strings } from '../ui/strings';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('маршруты', () => {
  it('/ показывает поэтажный план и ссылку на 3D', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { level: 1, name: strings.plan.title })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: strings.plan.open3d })).toHaveAttribute(
      'href',
      `/apartment/${DEMO_APARTMENT_ID}/3d`,
    );
  });

  it('карточка демо-квартиры собрана из данных дома', () => {
    renderAt('/');
    expect(screen.getByText(/Кв\. 51 · 9 этаж · 2-комн\. · 63,0 м²/)).toBeInTheDocument();
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
