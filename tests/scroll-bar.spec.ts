// T200 — ScrollBar family
//
// Categories covered:
//   1  Render         — #12 pixel read confirms skin draws something
//   2  Visual baseline — Skipped: GPU/skin variance
//   3  State visuals   — Skipped: internal depressed flag not directly testable via skin read
//   4  Pointer input   — #8 track click left of bar scrolls start; #9 track click right scrolls end
//   5  Touch input     — N/A: same path as pointer (canvas input methods)
//   6  Keyboard        — N/A: BaseScrollBar exposes no key handlers
//   7  Events          — #4 onBarMoved fires; #6 same-value no-signal
//   8  Resize          — N/A: ScrollBar does not auto-resize on parent resize

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T200 ScrollBar', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. BaseScrollBar is abstract — HScrollBar + VScrollBar instantiate fine
  // =========================================================================

  test('1 — HorizontalScrollBar and VerticalScrollBar instantiate; BaseScrollBar is abstract', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const h = new G.HorizontalScrollBar(canvas);
        const v = new G.VerticalScrollBar(canvas);
        h.dispose();
        v.dispose();
        return { threw: false, hasBase: typeof G.BaseScrollBar === 'function' };
      } catch {
        return { threw: true, hasBase: false };
      }
    });
    expect(result.threw).toBe(false);
    // BaseScrollBar is exported and is a constructor (abstract class compiles to function).
    expect(result.hasBase).toBe(true);
  });

  // =========================================================================
  // 2. Construction: HScrollBar default 15×15 bounds
  // =========================================================================

  test('2 — HorizontalScrollBar default bounds are 15×15', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const h = new G.HorizontalScrollBar(canvas);
      const b = h.getBounds();
      h.dispose();
      return { w: b.w, h: b.h };
    });
    expect(result.w).toBe(15);
    expect(result.h).toBe(15);
  });

  // =========================================================================
  // 3. setContentSize / setViewableContentSize store values
  // =========================================================================

  test('3 — setContentSize(1000) + setViewableContentSize(100) are stored', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const h = new G.HorizontalScrollBar(canvas);
      h.setContentSize(1000);
      h.setViewableContentSize(100);
      const cs = h.getContentSize();
      const vs = h.getViewableContentSize();
      h.dispose();
      return { cs, vs };
    });
    expect(result.cs).toBe(1000);
    expect(result.vs).toBe(100);
  });

  // =========================================================================
  // 4. setScrolledAmount(0.5, true) → getScrolledAmount() === 0.5; fires onBarMoved
  // =========================================================================

  test('4 — setScrolledAmount(0.5, true): value stored and onBarMoved fires', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const h = new G.HorizontalScrollBar(canvas);
      let fired = 0;
      h.onBarMoved.on(() => { fired++; });
      h.setScrolledAmount(0.5, true);
      const val = h.getScrolledAmount();
      h.dispose();
      return { val, fired };
    });
    expect(result.val).toBe(0.5);
    expect(result.fired).toBeGreaterThanOrEqual(1);
  });

  // =========================================================================
  // 5. Clamping: negative → 0; > 1 → 1
  // =========================================================================

  test('5 — setScrolledAmount(-0.5) clamps to 0; setScrolledAmount(1.5) clamps to 1', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const h = new G.HorizontalScrollBar(canvas);
      h.setScrolledAmount(-0.5, true);
      const low = h.getScrolledAmount();
      h.setScrolledAmount(1.5, true);
      const high = h.getScrolledAmount();
      h.dispose();
      return { low, high };
    });
    expect(result.low).toBe(0);
    expect(result.high).toBe(1);
  });

  // =========================================================================
  // 6. setScrolledAmount(same, false) — no signal
  // =========================================================================

  test('6 — setScrolledAmount(same value, false): no onBarMoved signal', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const h = new G.HorizontalScrollBar(canvas);
      h.setScrolledAmount(0.5, true); // prime
      let fired = 0;
      h.onBarMoved.on(() => { fired++; });
      h.setScrolledAmount(0.5, false); // same, no force
      h.dispose();
      return fired;
    });
    expect(result).toBe(0);
  });

  // =========================================================================
  // 7. getNudgeAmount: nudge / contentSize when not depressed
  // =========================================================================

  test('7 — getNudgeAmount() returns nudge/contentSize', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const h = new G.HorizontalScrollBar(canvas);
      h.setContentSize(200);
      h.setNudgeAmount(20);
      const nudge = h.getNudgeAmount();
      h.dispose();
      return nudge;
    });
    // 20 / 200 = 0.1
    expect(result).toBeCloseTo(0.1, 5);
  });

  // =========================================================================
  // 8. Click on track left of bar scrolls toward start
  // =========================================================================

  test('8 — click on track left of bar decreases scrolledAmount', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const h = new G.HorizontalScrollBar(canvas);
      h.setBounds(0, 0, 200, 15);
      h.setContentSize(1000);
      h.setViewableContentSize(100);
      h.setScrolledAmount(0.5, true);
      canvas.doThink();

      const before = h.getScrolledAmount();
      // Bar is at ~0.5 * travel + buttonSize. Click to the left of the bar.
      // Button size = height = 15. Bar left edge is at about 15 + 0.5 * (200 - 30 - barW).
      // Just click near x=20 (after left button, before bar center) in canvas coords.
      h.onMouseClickLeft(20, 7, true);
      const after = h.getScrolledAmount();
      h.dispose();
      return { before, after };
    });
    expect(result.after).toBeLessThan(result.before);
  });

  // =========================================================================
  // 9. Click on track right of bar scrolls toward end
  // =========================================================================

  test('9 — click on track right of bar increases scrolledAmount', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const h = new G.HorizontalScrollBar(canvas);
      h.setBounds(0, 0, 200, 15);
      h.setContentSize(1000);
      h.setViewableContentSize(100);
      h.setScrolledAmount(0.0, true);
      canvas.doThink();

      const before = h.getScrolledAmount();
      // Click well to the right of the bar — near x=170 (before right button).
      h.onMouseClickLeft(170, 7, true);
      const after = h.getScrolledAmount();
      h.dispose();
      return { before, after };
    });
    expect(result.after).toBeGreaterThan(result.before);
  });

  // =========================================================================
  // 10. VerticalScrollBar mirrors: setScrolledAmount, clamping, onBarMoved
  // =========================================================================

  test('10 — VerticalScrollBar: setScrolledAmount/clamping/onBarMoved work identically', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const v = new G.VerticalScrollBar(canvas);
      v.setContentSize(500);
      v.setViewableContentSize(50);
      let fired = 0;
      v.onBarMoved.on(() => { fired++; });
      v.setScrolledAmount(0.7, true);
      const val = v.getScrolledAmount();
      v.setScrolledAmount(2.0, true);
      const clamped = v.getScrolledAmount();
      v.dispose();
      return { val, clamped, fired };
    });
    expect(result.val).toBe(0.7);
    expect(result.clamped).toBe(1);
    expect(result.fired).toBeGreaterThanOrEqual(2);
  });

  // =========================================================================
  // 11. Scroll buttons trigger scroll (left/right for H; top/bottom for V)
  // =========================================================================

  test('11 — HScrollBar: left scroll button press decreases amount; right increases', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const h = new G.HorizontalScrollBar(canvas);
      h.setContentSize(100);
      h.setViewableContentSize(10);
      h.setScrolledAmount(0.5, true);
      canvas.doThink();

      const before = h.getScrolledAmount();
      // _scrollButtons[0] is left (scrollToLeft).
      h._scrollButtons[0].onPress.emit({ controlCaller: h._scrollButtons[0] });
      const afterLeft = h.getScrolledAmount();
      // _scrollButtons[1] is right (scrollToRight).
      h._scrollButtons[1].onPress.emit({ controlCaller: h._scrollButtons[1] });
      const afterRight = h.getScrolledAmount();
      h.dispose();
      return { before, afterLeft, afterRight };
    });
    expect(result.afterLeft).toBeLessThan(result.before);
    expect(result.afterRight).toBeGreaterThan(result.afterLeft);
  });

  // =========================================================================
  // 12. Render: HScrollBar produces pixels
  // =========================================================================

  test('12 — HorizontalScrollBar render produces non-background pixels', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 200; htmlC.height = 20;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 200, 20);
      cvs.setDrawBackground(true);
      cvs.setBackgroundColor(G.color(0, 0, 0, 255));

      const h = new G.HorizontalScrollBar(cvs);
      h.setBounds(0, 0, 200, 15);
      h.setContentSize(1000);
      h.setViewableContentSize(200);
      h.setScrolledAmount(0.5, true);

      cvs.doThink();
      cvs.redraw();
      cvs.renderCanvas();

      const gl: WebGL2RenderingContext = renderer.gl;
      const pixels = new Uint8Array(200 * 15 * 4);
      gl.readPixels(0, htmlC.height - 15, 200, 15, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

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
