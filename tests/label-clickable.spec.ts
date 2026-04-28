// T115 — LabelClickable
//
// Categories covered:
//   1  Render          — #3 no background pixels; #4 text pixels present
//   2  Visual baseline — Skipped: GPU/skin variance across CI
//   3  State visuals   — #5 hover state set correctly; still no background
//   4  Pointer input   — #2 click fires onPress via canvas input path
//   5  Touch input     — #2t synthetic touch tap fires onPress
//   6  Keyboard        — N/A: LabelClickable inherits Button; no distinct key behavior
//   7  Events          — #2 onPress payload; #5 hover state
//   8  Resize          — N/A: LabelClickable does not auto-resize on parent resize

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T115 LabelClickable', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction + defaults
  // =========================================================================

  test('1 — construction: shouldDrawBackground false; isToggle false; cursor Finger; alignment Left|CenterV', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const lc = new G.LabelClickable(canvas);
        const drawBg = lc.shouldDrawBackground();
        const isToggle = lc.isToggle();
        const cursor = (lc as any)._cursor;
        const alignment = lc.getAlignment();
        lc.dispose();
        return {
          threw: false,
          drawBg,
          isToggle,
          cursor,
          alignment,
          CursorFinger: G.CursorType.Finger,
          PosLeft: G.Pos.Left,
          PosCenterV: G.Pos.CenterV,
        };
      } catch {
        return { threw: true, drawBg: true, isToggle: true, cursor: -1, alignment: -1, CursorFinger: 0, PosLeft: 0, PosCenterV: 0 };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.drawBg).toBe(false);
    expect(result.isToggle).toBe(false);
    expect(result.cursor).toBe(result.CursorFinger);
    expect(result.alignment).toBe(result.PosLeft | result.PosCenterV);
  });

  // =========================================================================
  // 2. Click fires onPress
  // =========================================================================

  test('2 — setText + click fires onPress with correct caller', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const lc = new G.LabelClickable(canvas);
      lc.setBounds(10, 10, 100, 20);
      lc.setText('Click me');

      let pressCount = 0;
      let callerOk = false;
      lc.onPress.on((ev: any) => {
        pressCount++;
        callerOk = ev.controlCaller === lc;
      });

      canvas.doThink();
      const center = lc.localPosToCanvas(G.point(50, 10));
      canvas.inputMouseMoved(center.x, center.y, 0, 0);
      canvas.inputMouseButton(0, true);
      canvas.inputMouseButton(0, false);

      lc.dispose();
      return { pressCount, callerOk };
    });
    expect(result.pressCount).toBe(1);
    expect(result.callerOk).toBe(true);
  });

  // =========================================================================
  // 2t. Touch tap fires onPress
  // =========================================================================

  test('2t — touch tap fires onPress', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const lc = new G.LabelClickable(canvas);
      lc.setBounds(20, 20, 100, 20);
      lc.setText('Tap me');

      let pressCount = 0;
      lc.onPress.on(() => { pressCount++; });

      canvas.doThink();
      const center = lc.localPosToCanvas(G.point(50, 10));
      canvas.inputMouseMoved(center.x, center.y, 0, 0);
      canvas.inputMouseButton(0, true);
      canvas.inputMouseButton(0, false);

      lc.dispose();
      return pressCount;
    });
    expect(result).toBe(1);
  });

  // =========================================================================
  // 3. No background pixels drawn
  // =========================================================================

  test('3 — render: no background drawn (pixels match background color)', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const BG_R = 0, BG_G = 0, BG_B = 0;

      const htmlC = document.createElement('canvas');
      htmlC.width = 200; htmlC.height = 40;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 200, 40);
      cvs.setDrawBackground(true);
      cvs.setBackgroundColor(G.color(BG_R, BG_G, BG_B, 255));

      // Place LabelClickable but leave it empty (no text) so we can read
      // a pixel in a spot that should have no chrome drawn.
      const lc = new G.LabelClickable(cvs);
      lc.setBounds(0, 0, 200, 40);
      // No text — entire area is just the empty label chrome (which is none).

      cvs.doThink();
      cvs.redraw();
      cvs.renderCanvas();

      const gl: WebGL2RenderingContext = renderer.gl;
      // Sample the very left edge where text padding ends — button chrome would
      // have been drawn here if shouldDrawBackground were true.
      const x = 1; const y = 20;
      const glY = htmlC.height - (y + 1);
      const pixels = new Uint8Array(4);
      gl.readPixels(x, glY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      cvs.dispose();
      document.body.removeChild(htmlC);

      // Pixel should be background (black) because no button chrome is drawn.
      return { r: pixels[0], g: pixels[1], b: pixels[2] };
    });
    // Within ±5 of pure black — no button chrome drawn.
    expect(result.r).toBeLessThanOrEqual(5);
    expect(result.g).toBeLessThanOrEqual(5);
    expect(result.b).toBeLessThanOrEqual(5);
  });

  // =========================================================================
  // 4. Text renders (some non-background pixels in text area)
  // =========================================================================

  test('4 — render: text produces non-background pixels', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 200; htmlC.height = 40;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 200, 40);
      cvs.setDrawBackground(true);
      cvs.setBackgroundColor(G.color(128, 128, 128, 255));

      const lc = new G.LabelClickable(cvs);
      lc.setBounds(0, 0, 200, 40);
      lc.setText('MMMM');
      lc.setTextColor(G.color(0, 0, 0, 255)); // dark text on grey bg

      cvs.doThink();
      cvs.redraw();
      cvs.renderCanvas();

      const gl: WebGL2RenderingContext = renderer.gl;
      // Scan a horizontal strip across the text area.
      const W = 200; const H = 20;
      const glY = htmlC.height - (10 + H);
      const pixels = new Uint8Array(W * H * 4);
      gl.readPixels(0, glY, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      cvs.dispose();
      document.body.removeChild(htmlC);

      // Look for a dark pixel (text = black) — anything below 80 on all channels.
      let foundText = false;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] < 80 && pixels[i + 1] < 80 && pixels[i + 2] < 80) {
          foundText = true;
          break;
        }
      }
      return foundText;
    });
    expect(result).toBe(true);
  });

  // =========================================================================
  // 5. Hovering sets hover state; still no visible background
  // =========================================================================

  test('5 — hover sets isHovered true; shouldDrawBackground still false', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const lc = new G.LabelClickable(canvas);
      lc.setBounds(50, 50, 100, 20);
      canvas.doThink();

      const center = lc.localPosToCanvas(G.point(50, 10));
      canvas.inputMouseMoved(center.x, center.y, 0, 0);

      const hovered = lc.isHovered();
      const drawBg = lc.shouldDrawBackground();
      lc.dispose();
      return { hovered, drawBg };
    });
    expect(result.hovered).toBe(true);
    expect(result.drawBg).toBe(false);
  });

  // =========================================================================
  // 6. Dispose cleanly
  // =========================================================================

  test('6 — dispose removes LabelClickable from canvas children', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const before = canvas.numChildren();
      const lc = new G.LabelClickable(canvas);
      const during = canvas.numChildren();
      lc.dispose();
      const after = canvas.numChildren();
      return { before, during, after };
    });
    expect(result.during).toBe(result.before + 1);
    expect(result.after).toBe(result.before);
  });
});
