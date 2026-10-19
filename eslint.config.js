import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results', 'prototype'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  // Генераторы тестовых данных не попадают в прод-бандл (CLAUDE.md §10.1, §11)
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}', 'src/testing/**', 'src/pages/DevRandomPage.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/testing', '**/testing/*', '**/testing/**'],
              message: 'src/testing — только для тестов и страницы /dev/random (CLAUDE.md §10.1).',
            },
          ],
        },
      ],
    },
  },
  // Вся случайность в генераторах и тестах — только через createRng(seed)
  {
    files: ['src/testing/**/*.{ts,tsx}', 'src/**/*.test.{ts,tsx}', 'src/domain/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message:
            'Используйте createRng(seed) из domain/rng.ts — результат должен воспроизводиться.',
        },
      ],
    },
  },
  prettier,
);
