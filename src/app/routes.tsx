import { Suspense, lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Layout } from './Layout';
import { PlanPage } from '../pages/PlanPage';
import { NotFound } from '../pages/NotFound';
import { strings } from '../ui/strings';

// 3D-страница грузится лениво: three.js не должен попадать в первый экран (CLAUDE.md §2)
const Tour3DPage = lazy(() => import('../pages/Tour3DPage'));

function PageLoader() {
  return (
    <p role="status" className="p-6 text-muted">
      {strings.tour.loading}
    </p>
  );
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <PlanPage /> },
      {
        path: 'apartment/:id/3d',
        element: (
          <Suspense fallback={<PageLoader />}>
            <Tour3DPage />
          </Suspense>
        ),
      },
      { path: '*', element: <NotFound /> },
    ],
  },
];
