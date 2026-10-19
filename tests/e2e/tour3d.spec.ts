import { expect, test, type Page } from '@playwright/test';

/** Ошибки страницы и консоли: 3D-сцена не должна их порождать. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

async function waitForFrames(page: Page, min = 1) {
  await page.waitForFunction((n) => (window.__gorizont3d?.frames() ?? 0) >= n, min, {
    timeout: 20_000,
  });
}

test.describe('3D-тур', () => {
  test('сцена рисуется без ошибок и укладывается в бюджет draw calls', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/apartment/s1-f9-a3/3d');
    await expect(page.getByRole('heading', { level: 1, name: 'Квартира 51 в 3D' })).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();
    await waitForFrames(page);
    const calls = await page.evaluate(() => window.__gorizont3d!.calls());
    expect(calls).toBeGreaterThan(0);
    expect(calls).toBeLessThan(150);
    expect(errors).toEqual([]);
  });

  test('отделка, срез стен и сброс вида работают без ошибок', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/apartment/s1-f9-a6/3d');
    await waitForFrames(page);
    await page.getByRole('button', { name: /Классика/ }).click();
    await expect(page.getByTestId('finish-cost')).not.toHaveText('в стоимости');
    await page.getByRole('button', { name: 'Срез стен' }).click();
    await expect(page.getByRole('button', { name: 'Срез стен' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: 'Вид 3/4' }).click();
    const before = await page.evaluate(() => window.__gorizont3d!.frames());
    await waitForFrames(page, before + 1);
    expect(errors).toEqual([]);
  });

  test('каждая планировка открывается в 3D', async ({ page }) => {
    const errors = collectErrors(page);
    for (const id of ['s1-f1-a1', 's1-f1-a2', 's1-f1-a3', 's1-f1-a4', 's1-f1-a5', 's1-f1-a6']) {
      await page.goto(`/apartment/${id}/3d`);
      await waitForFrames(page);
    }
    expect(errors).toEqual([]);
  });
});
