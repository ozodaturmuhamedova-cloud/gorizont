import { expect, test, type Page } from '@playwright/test';

/** Точка квартиры на экране (хук есть только в dev-сборке, на которой и идут e2e). */
async function apartmentPoint(page: Page, id: string) {
  await page.waitForFunction((x) => window.__gorizontPlan?.apartmentPoint(x) != null, id);
  const p = await page.evaluate((x) => window.__gorizontPlan!.apartmentPoint(x), id);
  return p!;
}

test.describe('поэтажный план', () => {
  test('canvas рисуется, клик по квартире открывает карточку и ведёт в 3D', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: /Поэтажный план/ })).toContainText(
      '9 этаж',
    );
    await expect(page.getByTestId('floor-plan').locator('canvas').first()).toBeVisible();

    const p = await apartmentPoint(page, 's1-f9-a3');
    await page.mouse.click(p.x, p.y);
    const card = page.getByRole('complementary', { name: 'Кв. 51' });
    await expect(card).toContainText('2-комн. · 63,0 м²');

    await card.getByRole('link', { name: 'Смотреть в 3D' }).click();
    await expect(page).toHaveURL(/\/apartment\/s1-f9-a3\/3d$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Квартира 51 в 3D' })).toBeVisible();

    await page.getByRole('link', { name: /Назад к плану/ }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('9 этаж');
  });

  test('проданная квартира не выбирается, но показывает тултип', async ({ page, isMobile }) => {
    await page.goto('/');
    const p = await apartmentPoint(page, 's1-f9-a2'); // кв. 50 продана
    if (!isMobile) {
      await page.mouse.move(p.x, p.y);
      await expect(page.getByRole('tooltip')).toContainText('Кв. 50');
      await expect(page.getByRole('tooltip')).toContainText('Продана');
    }
    await page.mouse.click(p.x, p.y);
    await expect(
      page.getByText('Выберите свободную квартиру на плане или в шахматке слева.'),
    ).toBeVisible();
  });

  test('шахматка переключает этажи, проданные ячейки недоступны', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /^3 этаж/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('3 этаж');
    const sold = page.getByRole('button', { name: /продана$/ }).first();
    await expect(sold).toBeDisabled();
  });

  test('масштаб кнопками и колесом не ломает выбор', async ({ page, isMobile }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Приблизить' }).click();
    await page.getByRole('button', { name: 'Весь этаж' }).click();
    if (!isMobile) {
      const p = await apartmentPoint(page, 's1-f9-a3');
      await page.mouse.move(p.x, p.y);
      await page.mouse.wheel(0, -300);
    }
    const p = await apartmentPoint(page, 's1-f9-a3');
    await page.mouse.click(p.x, p.y);
    await expect(page.getByRole('complementary', { name: 'Кв. 51' })).toBeVisible();
  });
});

test('неизвестный адрес и несуществующая квартира показывают 404', async ({ page }) => {
  for (const url of ['/no-such-page', '/apartment/s9-f99-a1/3d']) {
    await page.goto(url);
    await expect(page.getByRole('heading', { level: 1, name: 'Такой страницы нет' })).toBeVisible();
  }
});

test('страница без горизонтальной прокрутки', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('floor-plan').locator('canvas').first()).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
