import { test, expect } from '@playwright/test';
import { gotoDemo } from './helpers';

test.describe('pipeline bootstrap', () => {
  test('demo page loads and exposes window.Gwen', async ({ page }) => {
    await gotoDemo(page);
    const version = await page.evaluate(() =>
      (window as unknown as { Gwen: { VERSION: string } }).Gwen.VERSION
    );
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('canvas element is present and sized', async ({ page }) => {
    await gotoDemo(page);
    const size = await page.evaluate(() => {
      const c = document.getElementById('gwen-canvas') as HTMLCanvasElement;
      return { w: c.width, h: c.height };
    });
    expect(size.w).toBeGreaterThan(0);
    expect(size.h).toBeGreaterThan(0);
  });
});
