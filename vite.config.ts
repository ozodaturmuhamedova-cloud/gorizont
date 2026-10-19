import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        // 3D-библиотеки (появятся в фазе 4) уходят в отдельный чанк, первый экран остаётся лёгким
        manualChunks: (id) =>
          /node_modules\/(three|@react-three)\//.test(id) ? 'three' : undefined,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Чистые функции, данные и генераторы не требуют DOM — так быстрее
    environmentMatchGlobs: [
      ['src/domain/**', 'node'],
      ['src/data/**', 'node'],
      ['src/testing/**', 'node'],
    ],
    css: false,
    // npm run test:fuzz → vitest --mode fuzz → seedRange() отдаёт 1…5000 вместо 1…200
    env: { FUZZ: mode === 'fuzz' ? '1' : '' },
    testTimeout: mode === 'fuzz' ? 600_000 : 30_000,
  },
}));
