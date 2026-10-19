import { Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Layout } from './Layout';
import { PageLoader } from './PageLoader';
import { Tour3DPage } from './lazyPages';
import { PlanPage } from '../pages/PlanPage';
import { NotFound } from '../pages/NotFound';

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
