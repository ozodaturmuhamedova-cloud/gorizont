/**
 * Скриншоты для визуальной проверки. В CI они публикуются в ветку ci-screens,
 * чтобы их можно было посмотреть без скачивания артефактов.
 */
import { test } from '@playwright/test';

test('скриншот: план 9 этажа с выбранной кв. 51', async ({ page }, info) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__gorizontPlan?.apartmentPoint('s1-f9-a3') != null);
  await page.getByRole('button', { name: 'Кв. 51, свободна' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `screens/plan-${info.project.name}.png`, fullPage: true });
});

test('скриншот: тултип над квартирой', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'на телефоне нет наведения');
  await page.goto('/');
  await page.waitForFunction(() => window.__gorizontPlan?.apartmentPoint('s1-f9-a5') != null);
  const p = await page.evaluate(() => window.__gorizontPlan!.apartmentPoint('s1-f9-a5'));
  await page.mouse.move(p!.x, p!.y);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `screens/tooltip-${info.project.name}.png` });
});
