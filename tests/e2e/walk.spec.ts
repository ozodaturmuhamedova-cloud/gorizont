import { expect, test, type Page } from '@playwright/test';

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // pointer lock в headless-браузере может быть недоступен — это не ошибка приложения
    if (m.type() === 'error' && !/pointer ?lock/i.test(m.text())) errors.push(m.text());
  });
  return errors;
}

async function open3d(page: Page) {
  await page.goto('/apartment/s1-f9-a3/3d');
  await page.waitForFunction(() => (window.__gorizont3d?.frames() ?? 0) >= 1, null, {
    timeout: 20_000,
  });
}

const pose = (page: Page) => page.evaluate(() => window.__gorizontWalk!.pose());

test.describe('прогулка с учётом роста', () => {
  test('рост 50 не принимается, 185 — прогулка, движение, сохранение после перезагрузки', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await open3d(page);
    await page.getByRole('button', { name: 'Прогуляться' }).click();
    const dialog = page.getByRole('dialog', { name: 'Ваш рост' });
    await expect(dialog).toBeVisible();
    const input = dialog.getByRole('spinbutton', { name: 'Ваш рост, см' });
    await input.fill('50');
    await expect(dialog.getByRole('button', { name: 'Начать' })).toBeDisabled();
    await input.fill('185');
    await dialog.getByRole('button', { name: 'Начать' }).click();
    await expect(page.getByTestId('walk-height')).toHaveText('Рост: 185 см');
    await expect(page.getByTestId('walk-room')).toContainText('Прихожая');

    await page.waitForFunction(() => window.__gorizontWalk != null);
    // переход камеры из орбиты занимает 0.8 с
    await page.waitForTimeout(1200);
    const start = await pose(page);
    expect(start.eye).toBeCloseTo(1.73, 1);

    await page.keyboard.down('KeyW');
    await page.waitForTimeout(700);
    await page.keyboard.up('KeyW');
    const moved = await pose(page);
    expect(Math.hypot(moved.x - start.x, moved.y - start.y)).toBeGreaterThan(0.3);

    await page.reload();
    await open3d(page);
    await page.getByRole('button', { name: 'Прогуляться' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByTestId('walk-height')).toHaveText('Рост: 185 см');

    await page.getByRole('button', { name: 'Выйти из прогулки' }).click();
    await expect(page.getByRole('button', { name: 'Прогуляться' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('сквозь стену не пройти: долго идём вперёд — остаёмся в квартире', async ({ page }) => {
    await open3d(page);
    await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('gorizont') ?? '{"state":{},"version":1}') as {
        state: Record<string, unknown>;
      };
      raw.state.heightCm = 150;
      localStorage.setItem('gorizont', JSON.stringify(raw));
    });
    await open3d(page);
    await page.getByRole('button', { name: 'Прогуляться' }).click();
    await page.waitForFunction(() => window.__gorizontWalk != null);
    await page.waitForTimeout(1000);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(4000);
    await page.keyboard.up('KeyW');
    const p = await pose(page);
    expect(p.eye).toBeCloseTo(1.4, 1);
    // упёрлись в стену и остались внутри квартиры, в какой-то комнате
    await expect(page.getByTestId('walk-room')).not.toHaveText('Между комнатами');
  });
});
