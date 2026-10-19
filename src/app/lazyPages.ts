import { lazy } from 'react';

/** 3D-страница грузится лениво: three.js не должен попадать в первый экран (CLAUDE.md §2). */
export const Tour3DPage = lazy(() => import('../pages/Tour3DPage'));
