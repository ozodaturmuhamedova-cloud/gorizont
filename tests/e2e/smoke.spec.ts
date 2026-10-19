import { expect, test } from '@playwright/test';

test('план открывается, демо-квартира ведёт на 3D-страницу и обратно', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Поэтажный план' })).toBeVisible();

  await page.getByRole('link', { name: 'Смотреть в 3D' }).click();
  await expect(page).toHaveURL(/\/apartment\/s1-f9-a3\/3d$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Квартира 51 в 3D' })).toBeVisible();

  await page.getByRole('link', { name: /Назад к плану/ }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('неизвестный адрес и несуществующая квартира показывают 404', async ({ page }) => {
  for (const url of ['/no-such-page', '/apartment/s9-f99-a1/3d']) {
    await page.goto(url);
    await expect(page.getByRole('heading', { level: 1, name: 'Такой страницы нет' })).toBeVisible();
  }
});

test('страница без горизонтальной прокрутки', async ({ page }) => {
  await page.goto('/');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
