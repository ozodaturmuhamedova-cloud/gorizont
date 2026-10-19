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
  // fullPage только на телефоне: на десктопе страница и так помещается, а смена
  // размера окна при съёмке перерисовывает план
  await page.screenshot({
    path: `screens/plan-${info.project.name}.png`,
    fullPage: info.project.name === 'mobile',
  });
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

test('скриншот: приближенная выбранная квартира', async ({ page }, info) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__gorizontPlan?.apartmentPoint('s1-f9-a6') != null);
  await page.getByRole('button', { name: 'Кв. 54, свободна' }).click();
  for (let k = 0; k < 3; k++) await page.getByRole('button', { name: 'Приблизить' }).click();
  await page.waitForTimeout(200);
  await page
    .getByTestId('floor-plan')
    .screenshot({ path: `screens/zoomed-${info.project.name}.png` });
});

test('скриншот: фильтр «2-комн., до 11 млн» и список', async ({ page }, info) => {
  await page.goto('/?rooms=2&price=-11000000&apt=s1-f9-a3');
  const toggle = page.getByRole('button', { name: /^Фильтры/ });
  if (await toggle.isVisible()) await toggle.click();
  await page.waitForFunction(() => window.__gorizontPlan?.apartmentPoint('s1-f9-a3') != null);
  await page.waitForTimeout(300);
  await page.screenshot({
    path: `screens/filters-${info.project.name}.png`,
    fullPage: info.project.name === 'mobile',
  });
});

test('скриншот: первый экран телефона', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'только телефон');
  await page.goto('/?apt=s1-f9-a3');
  await page.waitForFunction(() => window.__gorizontPlan?.apartmentPoint('s1-f9-a3') != null);
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'screens/first-screen-mobile.png' });
});

test('скриншот: 3D-квартира, вид 3/4', async ({ page }, info) => {
  await page.goto('/apartment/s1-f9-a6/3d');
  await page.waitForFunction(() => (window.__gorizont3d?.frames() ?? 0) >= 1, null, {
    timeout: 20_000,
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `screens/3d-${info.project.name}.png` });
});

test('скриншот: 3D со срезом стен и отделкой «Лофт»', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'достаточно десктопа');
  await page.goto('/apartment/s1-f9-a3/3d');
  await page.waitForFunction(() => (window.__gorizont3d?.frames() ?? 0) >= 1, null, {
    timeout: 20_000,
  });
  await page.getByRole('button', { name: /Лофт/ }).click();
  await page.getByRole('button', { name: 'Срез стен' }).click();
  await page.waitForTimeout(1200);
  await page
    .getByRole('img', { name: '3D-модель квартиры 51' })
    .screenshot({ path: `screens/3d-cut-${info.project.name}.png` });
});
