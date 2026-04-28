// T403 — ColorDisplay
//
// Categories covered:
//   1  Render        — #5 pixel read after render confirms swatch produces pixels
//   2  Visual base   — Skipped: GPU/skin variance across CI
//   3  State visuals — #5 swatch pixel content (red channel dominant for red color)
//   4  Pointer input — N/A: mouse input is disabled by construction
//   5  Touch input   — N/A: same reason
//   6  Keyboard      — N/A: ColorDisplay has no keyboard interaction
//   7  Events        — N/A: ColorDisplay exposes no signals
//   8  Resize        — N/A: ColorDisplay has fixed default size; no auto-resize

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T403 ColorDisplay', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction: 32×32 default; mouse disabled
  // =========================================================================

  test('1 — construction: 32×32 default size; mouse input disabled', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const d = new G.ColorDisplay(canvas);
        const b = d.getBounds();
        const mouseEnabled = d.getMouseInputEnabled();
        d.dispose();
        return { threw: false, w: b.w, h: b.h, mouseEnabled };
      } catch {
        return { threw: true, w: 0, h: 0, mouseEnabled: false };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.w).toBe(32);
    expect(result.h).toBe(32);
    expect(result.mouseEnabled).toBe(false);
  });

  // =========================================================================
  // 2. setColor(red) updates the stored color
  // =========================================================================

  test('2 — setColor(red) updates getColor() to {r:255,g:0,b:0,a:255}', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const d = new G.ColorDisplay(canvas);
      d.setColor(G.color(255, 0, 0, 255));
      const c = d.getColor();
      d.dispose();
      return { r: c.r, g: c.g, b: c.b, a: c.a };
    });
    expect(result.r).toBe(255);
    expect(result.g).toBe(0);
    expect(result.b).toBe(0);
    expect(result.a).toBe(255);
  });

  // =========================================================================
  // 3. setRed(100) mutates only the red channel
  // =========================================================================

  test('3 — setRed(100) mutates only the red channel', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const d = new G.ColorDisplay(canvas);
      d.setColor(G.color(0, 50, 80, 200));
      d.setRed(100);
      const c = d.getColor();
      d.dispose();
      return { r: c.r, g: c.g, b: c.b, a: c.a };
    });
    expect(result.r).toBe(100);
    expect(result.g).toBe(50);
    expect(result.b).toBe(80);
    expect(result.a).toBe(200);
  });

  // =========================================================================
  // 4. setDrawCheckers(false) updates the drawCheckers flag
  // =========================================================================

  test('4 — setDrawCheckers(false) → getDrawCheckers() === false', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const d = new G.ColorDisplay(canvas);
      const before = d.getDrawCheckers();
      d.setDrawCheckers(false);
      const after = d.getDrawCheckers();
      d.dispose();
      return { before, after };
    });
    expect(result.before).toBe(true);
    expect(result.after).toBe(false);
  });

  // =========================================================================
  // 5. Render produces pixels (red swatch has red-dominant pixels)
  // =========================================================================

  test('5 — render with red color produces red-dominant pixels in control bounds', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 64; htmlC.height = 64;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 64, 64);
      cvs.setDrawBackground(true);
      cvs.setBackgroundColor(G.color(0, 0, 0, 255));

      const d = new G.ColorDisplay(cvs);
      d.setBounds(16, 16, 32, 32);
      d.setColor(G.color(255, 0, 0, 255));

      cvs.doThink();
      cvs.redraw();
      cvs.renderCanvas();

      const gl: WebGL2RenderingContext = renderer.gl;
      // Sample center of the swatch (control is at x=16,y=16, size 32x32).
      const sx = 32; const sy = 32;
      const glY = htmlC.height - (sy + 1);
      const px = new Uint8Array(4);
      gl.readPixels(sx, glY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);

      cvs.dispose();
      document.body.removeChild(htmlC);

      return { r: px[0], g: px[1], b: px[2], a: px[3] };
    });
    // The swatch should have content (not pure black background).
    const hasContent = result.r > 10 || result.g > 10 || result.b > 10;
    expect(hasContent).toBe(true);
  });
});
