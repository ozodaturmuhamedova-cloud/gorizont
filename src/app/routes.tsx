import { Suspense, lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Layout } from './Layout';
import { PageLoader } from './PageLoader';
import { Tour3DPage } from './lazyPages';
import { PlanPage } from '../pages/PlanPage';
import { NotFound } from '../pages/NotFound';

/** /dev/random — только в dev: в прод-сборку генераторы не попадают (CLAUDE.md §10.1). */
const DevRandomPage = import.meta.env.DEV ? lazy(() => import('../pages/DevRandomPage')) : null;

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
      ...(DevRandomPage
        ? [
            {
              path: 'dev/random',
              element: (
                <Suspense fallback={<PageLoader />}>
                  <DevRandomPage />
                </Suspense>
              ),
            },
          ]
        : []),
      { path: '*', element: <NotFound /> },
    ],
  },
];
