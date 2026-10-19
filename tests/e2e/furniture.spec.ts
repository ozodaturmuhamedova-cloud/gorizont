import { expect, test, type Page } from '@playwright/test';

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

async function open3d(page: Page, id = 's1-f9-a3') {
  await page.goto(`/apartment/${id}/3d`);
  await page.waitForFunction(() => (window.__gorizont3d?.frames() ?? 0) >= 1, null, {
    timeout: 20_000,
  });
  await page.waitForFunction(() => window.__gorizontFurnish != null);
}

/** Сохранённая расстановка квартиры из localStorage (persist). */
async function savedFurniture(page: Page, id = 's1-f9-a3') {
  return page.evaluate((aptId) => {
    const raw = JSON.parse(localStorage.getItem('gorizont') ?? '{}') as {
      state?: {
        placed?: Record<string, { itemId: string; position: number[]; rotation: number }[]>;
      };
    };
    return raw.state?.placed?.[aptId] ?? [];
  }, id);
}

const money = (s: string | null) => Number((s ?? '').replace(/\D/g, ''));

test.describe('мебель в 3D', () => {
  test('«Готовый комплект»: мебель в смете, сцена в бюджете draw calls', async ({ page }) => {
    const errors = collectErrors(page);
    await open3d(page);
    expect(money(await page.getByTestId('furniture-cost').textContent())).toBe(0);
    const before = money(await page.getByTestId('total').textContent());
    await page.getByRole('button', { name: 'Готовый комплект' }).click();
    await expect(page.getByTestId('furniture-cost')).not.toHaveText(/^0/);
    const furnitureCost = money(await page.getByTestId('furniture-cost').textContent());
    expect(money(await page.getByTestId('total').textContent())).toBe(before + furnitureCost);
    const frames = await page.evaluate(() => window.__gorizont3d!.frames());
    await page.waitForFunction((n) => window.__gorizont3d!.frames() > n, frames);
    const calls = await page.evaluate(() => window.__gorizont3d!.calls());
    expect(calls).toBeLessThan(150);
    expect((await savedFurniture(page)).length).toBeGreaterThan(10);
    expect(errors).toEqual([]);
  });

  test('ручная расстановка: поставить, передвинуть, повернуть, удалить; сохраняется', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await open3d(page);
    await page.getByRole('tab', { name: 'Спальня' }).click();
    await page.getByRole('button', { name: /^Поставить «Комод/ }).click();
    await expect(page.getByTestId('furnish-toolbar')).toContainText('Ставим');
    // на телефоне каталог ниже сцены — возвращаемся к ней
    await page.locator('canvas').scrollIntoViewIfNeeded();
    const p = await page.evaluate(() => window.__gorizontFurnish!.roomPoint('bedroom'));
    expect(p).not.toBeNull();
    await page.mouse.move(p!.x - 5, p!.y);
    await page.mouse.move(p!.x, p!.y);
    await page.mouse.click(p!.x, p!.y);
    await expect(page.getByTestId('furnish-toolbar')).toContainText('Выбрано');
    expect(money(await page.getByTestId('furniture-cost').textContent())).toBeGreaterThan(0);
    const [placed] = await savedFurniture(page);
    expect(placed?.itemId).toBe('dresser');

    // перетаскивание: камера стоит, предмет едет
    await page.mouse.move(p!.x, p!.y);
    await page.mouse.down();
    await page.mouse.move(p!.x + 20, p!.y + 10, { steps: 4 });
    await page.mouse.move(p!.x + 40, p!.y + 20, { steps: 4 });
    await page.mouse.up();
    const [moved] = await savedFurniture(page);
    expect(moved!.position).not.toEqual(placed!.position);

    await page.keyboard.press('e');
    const [rotated] = await savedFurniture(page);
    expect(rotated!.rotation).not.toBe(moved!.rotation);

    await page.reload();
    await page.waitForFunction(() => (window.__gorizont3d?.frames() ?? 0) >= 1);
    expect(money(await page.getByTestId('furniture-cost').textContent())).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Очистить' }).click();
    expect(money(await page.getByTestId('furniture-cost').textContent())).toBe(0);
    expect(errors).toEqual([]);
  });

  test('/dev/random: случайная квартира с мебелью без нарушений', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/dev/random?seed=42&rooms=2&density=normal');
    await expect(page.getByTestId('dev-summary')).toContainText('seed=42');
    await expect(page.getByTestId('dev-problems')).toContainText('Инварианты выполнены');
    await page.waitForFunction(() => (window.__gorizont3d?.frames() ?? 0) >= 1, null, {
      timeout: 20_000,
    });
    await page.getByRole('button', { name: 'Случайная квартира' }).click();
    await expect(page.getByTestId('dev-summary')).not.toContainText('seed=42');
    expect(errors).toEqual([]);
  });
});
