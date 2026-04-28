// T310 — Modal + Highlight
//
// Categories covered:
//   1  Render          — #3 (Modal dim overlay produces pixels),
//                        #5 (Highlight magenta produces pixels)
//   2  Visual baseline — Skipped: Skin palette determinism is covered by the
//                        dynamic-skin and renderer specs; an additional screenshot
//                        here would duplicate that coverage with no new signal.
//   3  State visuals   — N/A: neither control has hover/pressed/disabled states.
//   4  Pointer input   — N/A: Modal consumes all pointer input (black-box);
//                        Highlight explicitly disables mouse input.
//   5  Touch input     — N/A: no touch-specific behaviour beyond pointer.
//   6  Keyboard        — N/A: Modal enables keyboard input at construction but
//                        defines no key handlers; Highlight ignores keyboard.
//   7  Events          — N/A: neither control exposes user-facing signals.
//   8  Resize          — #2 (Modal.layout sets bounds to canvas size).

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T310 Modal + Highlight', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Modal construction: keyboard + mouse enabled; shouldDrawBackground true
  // =========================================================================

  test('1 — new Modal(canvas): keyboard+mouse enabled; shouldDrawBackground true', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const modal = new G.Modal(canvas);
        const kb = modal.getKeyboardInputEnabled();
        const mouse = modal.getMouseInputEnabled();
        const bg = modal.shouldDrawBackground();
        modal.dispose();
        return { threw: false, kb, mouse, bg };
      } catch {
        return { threw: true, kb: false, mouse: false, bg: false };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.kb).toBe(true);
    expect(result.mouse).toBe(true);
    expect(result.bg).toBe(true);
  });

  // =========================================================================
  // 2. Modal.layout sets bounds to canvas size
  // =========================================================================

  test('2 — Modal.layout sets its bounds to match canvas width × height', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;

      // Use an isolated canvas with known dimensions so we can verify precisely.
      const htmlC = document.createElement('canvas');
      htmlC.width = 320; htmlC.height = 240;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cv = new G.Canvas(skin, htmlC);
      cv.setBounds(0, 0, 320, 240);

      const modal = new G.Modal(cv);
      // Drive layout.
      cv.doThink();

      const b = modal.getBounds();
      cv.dispose();
      document.body.removeChild(htmlC);
      return { x: b.x, y: b.y, w: b.w, h: b.h };
    });
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(result.w).toBe(320);
    expect(result.h).toBe(240);
  });

  // =========================================================================
  // 3. Modal render produces pixels (dim overlay over background)
  // =========================================================================

  test('3 — Modal render produces a visible dim overlay (non-background pixels)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 200; htmlC.height = 200;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cv = new G.Canvas(skin, htmlC);
      cv.setBounds(0, 0, 200, 200);
      // Bright cyan background so we can detect the darkening overlay.
      cv.setDrawBackground(true);
      cv.setBackgroundColor(G.color(0, 255, 255, 255));

      const modal = new G.Modal(cv);
      cv.doThink();
      cv.redraw();
      cv.renderCanvas();

      const gl = renderer.gl;
      const px = new Uint8Array(4);
      // Sample center — Modal should have drawn over the background.
      gl.readPixels(100, htmlC.height - 100 - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);

      cv.dispose();
      document.body.removeChild(htmlC);
      // Return raw pixel so the test can reason about it.
      return { r: px[0], g: px[1], b: px[2], a: px[3] };
    });
    // The modal draws a semi-transparent dark overlay. With a cyan background
    // (r=0, g=255, b=255) a darkening pass will reduce g+b significantly;
    // the pixel should not still be pure cyan.
    const isCyanUnchanged = result.r === 0 && result.g === 255 && result.b === 255;
    expect(isCyanUnchanged).toBe(false);
  });

  // =========================================================================
  // 4. Highlight construction: mouse input disabled
  // =========================================================================

  test('4 — new Highlight(canvas): mouse input is disabled', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const hl = new G.Highlight(canvas);
        const mouse = hl.getMouseInputEnabled();
        hl.dispose();
        return { threw: false, mouse };
      } catch {
        return { threw: true, mouse: true };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.mouse).toBe(false);
  });

  // =========================================================================
  // 5. Highlight render produces magenta pixels
  // =========================================================================

  test('5 — Highlight render produces magenta pixels (255, ~100, 255)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 200; htmlC.height = 200;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cv = new G.Canvas(skin, htmlC);
      cv.setBounds(0, 0, 200, 200);
      cv.setDrawBackground(true);
      cv.setBackgroundColor(G.color(0, 0, 0, 255));

      const hl = new G.Highlight(cv);
      hl.setBounds(20, 20, 100, 100);

      cv.doThink();
      cv.redraw();
      cv.renderCanvas();

      const gl = renderer.gl;
      const px = new Uint8Array(4);
      // Center of highlight (20,20,100,100) → (70, 70).
      gl.readPixels(70, htmlC.height - 70 - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);

      cv.dispose();
      document.body.removeChild(htmlC);
      return { r: px[0], g: px[1], b: px[2] };
    });
    // Highlight draws color(255, 100, 255, 255) — magenta (high R, medium G, high B).
    expect(result.r).toBeGreaterThan(200);
    expect(result.g).toBeLessThan(150);
    expect(result.b).toBeGreaterThan(200);
  });

  // =========================================================================
  // 6. Both Modal and Highlight accept setBounds without throwing
  // =========================================================================

  test('6 — Modal and Highlight both accept setBounds(x,y,w,h) without error', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const modal = new G.Modal(canvas);
        modal.setBounds(10, 10, 200, 150);
        const mb = modal.getBounds();

        const hl = new G.Highlight(canvas);
        hl.setBounds(5, 5, 80, 40);
        const hb = hl.getBounds();

        modal.dispose();
        hl.dispose();
        return {
          threw: false,
          modal: { x: mb.x, y: mb.y, w: mb.w, h: mb.h },
          highlight: { x: hb.x, y: hb.y, w: hb.w, h: hb.h },
        };
      } catch {
        return { threw: true, modal: null, highlight: null };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.modal).toMatchObject({ x: 10, y: 10, w: 200, h: 150 });
    expect(result.highlight).toMatchObject({ x: 5, y: 5, w: 80, h: 40 });
  });
});
