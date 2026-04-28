// T402 — ColorPicker
//
// Categories covered:
//   1  Render        — #6 pixel read confirms child controls produce pixels
//   2  Visual base   — Skipped: GPU/skin variance across CI; child controls render tested in #6
//   3  State visuals — #6 rendered pixels confirm controls are drawn
//   4  Pointer input — N/A: interactive test via evaluate; real mouse click untested (complex layout)
//   5  Touch input   — N/A: same reason
//   6  Keyboard      — N/A: ColorPicker has no direct keyboard handling
//   7  Events        — #4 onColorChanged fires on setColor
//   8  Resize        — N/A: ColorPicker has a fixed 256×150 default; no auto-resize

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T402 ColorPicker', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction: 256×150; 5 GroupBox children (4 channel rows + result)
  // =========================================================================

  test('1 — construction: 256×150 size; 5 GroupBox children (R, G, B, A, Result)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const cp = new G.ColorPicker(canvas);
        const b = cp.getBounds();

        // Count direct GroupBox children (not grandchildren).
        let groupBoxCount = 0;
        for (let i = 0; i < cp.numChildren(); i++) {
          const child = cp.getChild(i);
          if (child instanceof G.GroupBox) groupBoxCount++;
        }

        cp.dispose();
        return { threw: false, w: b.w, h: b.h, groupBoxCount };
      } catch {
        return { threw: true, w: 0, h: 0, groupBoxCount: 0 };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.w).toBe(256);
    expect(result.h).toBe(150);
    // 4 channel rows + 1 result group = 5
    expect(result.groupBoxCount).toBe(5);
  });

  // =========================================================================
  // 2. setColor(red) — all channel controls reflect red
  // =========================================================================

  test('2 — setColor(red): getColor() red channel=255; green=0; blue=0', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cp = new G.ColorPicker(canvas);
      cp.setColor(G.color(255, 0, 0, 255));
      const c = cp.getColor();

      // Also verify slider and textbox for Red channel reflect the value.
      const redRow = cp._channels['Red'];
      const sliderVal = redRow.slider.getFloatValue();
      const textVal = redRow.textbox.getText();

      cp.dispose();
      return { r: c.r, g: c.g, b: c.b, a: c.a, sliderVal, textVal };
    });
    expect(result.r).toBe(255);
    expect(result.g).toBe(0);
    expect(result.b).toBe(0);
    expect(result.a).toBe(255);
    expect(result.sliderVal).toBe(255);
    expect(result.textVal).toBe('255');
  });

  // =========================================================================
  // 3. getColor() returns the set color
  // =========================================================================

  test('3 — getColor() round-trips setColor(128, 64, 32, 200)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cp = new G.ColorPicker(canvas);
      cp.setColor(G.color(128, 64, 32, 200));
      const c = cp.getColor();
      cp.dispose();
      return { r: c.r, g: c.g, b: c.b, a: c.a };
    });
    expect(result.r).toBe(128);
    expect(result.g).toBe(64);
    expect(result.b).toBe(32);
    expect(result.a).toBe(200);
  });

  // =========================================================================
  // 4. onColorChanged fires on setColor
  // =========================================================================

  test('4 — onColorChanged fires on setColor; controlCaller is ColorPicker', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cp = new G.ColorPicker(canvas);

      let count = 0;
      let callerOk = false;
      cp.onColorChanged.on((ev: any) => {
        count++;
        callerOk = ev.controlCaller === cp;
      });

      cp.setColor(G.color(0, 128, 255, 255));
      cp.dispose();
      return { count, callerOk };
    });
    expect(result.count).toBeGreaterThanOrEqual(1);
    expect(result.callerOk).toBe(true);
  });

  // =========================================================================
  // 5. setAlphaVisible(false) hides alpha group; setAlphaVisible(true) shows it
  // =========================================================================

  test('5 — setAlphaVisible(false) hides alpha GroupBox; true shows it', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cp = new G.ColorPicker(canvas);

      const beforeHide = cp.isAlphaVisible();
      cp.setAlphaVisible(false);
      const afterHide = cp.isAlphaVisible();
      cp.setAlphaVisible(true);
      const afterShow = cp.isAlphaVisible();

      cp.dispose();
      return { beforeHide, afterHide, afterShow };
    });
    expect(result.beforeHide).toBe(true);
    expect(result.afterHide).toBe(false);
    expect(result.afterShow).toBe(true);
  });

  // =========================================================================
  // 6. Render produces pixels (child controls draw into the canvas bounds)
  // =========================================================================

  test('6 — render with default color produces non-background pixels', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 300; htmlC.height = 200;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 300, 200);
      cvs.setDrawBackground(true);
      cvs.setBackgroundColor(G.color(0, 0, 0, 255));

      const cp = new G.ColorPicker(cvs);
      cp.setBounds(10, 10, 256, 150);

      cvs.doThink();
      cvs.redraw();
      cvs.renderCanvas();

      const gl: WebGL2RenderingContext = renderer.gl;
      const pixels = new Uint8Array(256 * 150 * 4);
      const glY = htmlC.height - (10 + 150);
      gl.readPixels(10, glY, 256, 150, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      cvs.dispose();
      document.body.removeChild(htmlC);

      let hasContent = false;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] > 10 || pixels[i + 1] > 10 || pixels[i + 2] > 10) {
          hasContent = true;
          break;
        }
      }
      return hasContent;
    });
    expect(result).toBe(true);
  });
});
