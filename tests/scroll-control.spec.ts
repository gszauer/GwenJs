// T201 — ScrollControl
//
// Categories covered:
//   1  Render          — #12 pixel read confirms skin draws something
//   2  Visual baseline — Skipped: GPU/skin variance makes stable goldens impractical
//   3  State visuals   — Skipped: scroll-bar depressed state not directly observable externally
//   4  Pointer input   — #7 onMouseWheeled scrolls V bar; #8 wheel fallback to H bar
//   5  Touch input     — N/A: same code path as pointer via canvas input
//   6  Keyboard        — N/A: ScrollControl has no custom key handlers
//   7  Events          — N/A: ScrollControl emits no public signals (bar callbacks are internal)
//   8  Resize          — N/A: inner panel offset is recomputed on every layout() call;
//                        no separate resize hook to test independently

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T201 ScrollControl', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction: V+H scrollbars present; innerPanel set; mouseInput off
  // =========================================================================

  test('1 — construction: vBar, hBar, innerPanel present; mouseInput disabled', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const sc = new G.ScrollControl(canvas);
        const hasVBar = sc.getVerticalScrollBar() !== null;
        const hasHBar = sc.getHorizontalScrollBar() !== null;
        const hasInner = sc.getInnerPanel() !== null;
        // mouseInputEnabled is a protected field; test via isMouseInputEnabled if exposed,
        // otherwise infer from the fact that the control was constructed successfully.
        // The ScrollControl constructor calls setMouseInputEnabled(false).
        // Base exposes isMouseInputEnabled() for querying.
        const mouseOff = sc.getMouseInputEnabled() === false;
        sc.dispose();
        return { threw: false, hasVBar, hasHBar, hasInner, mouseOff };
      } catch {
        return { threw: true, hasVBar: false, hasHBar: false, hasInner: false, mouseOff: false };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.hasVBar).toBe(true);
    expect(result.hasHBar).toBe(true);
    expect(result.hasInner).toBe(true);
    expect(result.mouseOff).toBe(true);
  });

  // =========================================================================
  // 2. setScroll(true, false) — canScrollH true, canScrollV false
  // =========================================================================

  test('2 — setScroll(true, false): canScrollH=true, canScrollV=false', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const sc = new G.ScrollControl(canvas);
      sc.setScroll(true, false);
      const h = sc.canScrollH();
      const v = sc.canScrollV();
      sc.dispose();
      return { h, v };
    });
    expect(result.h).toBe(true);
    expect(result.v).toBe(false);
  });

  // =========================================================================
  // 3. setAutoHideBars(true) — autohide flag stored
  // =========================================================================

  test('3 — setAutoHideBars(true): _autoHideBars becomes true', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const sc = new G.ScrollControl(canvas);
      sc.setAutoHideBars(true);
      // _autoHideBars is protected; read directly from the instance.
      const stored = (sc as any)._autoHideBars;
      sc.dispose();
      return stored;
    });
    expect(result).toBe(true);
  });

  // =========================================================================
  // 4. Adding tall content: vBar.contentSize > vBar.viewableContentSize
  // =========================================================================

  test('4 — tall child causes vBar contentSize > viewableContentSize after layout', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const sc = new G.ScrollControl(canvas);
      sc.setBounds(0, 0, 200, 200);

      // Add a child to the inner panel directly; it's tall enough to overflow.
      const inner = sc.getInnerPanel();
      const child = new G.Base(inner);
      child.setSize(100, 500);

      canvas.doThink();

      const vBar = sc.getVerticalScrollBar();
      const contentSize = vBar.getContentSize();
      const viewSize = vBar.getViewableContentSize();

      sc.dispose();
      return { contentSize, viewSize };
    });
    expect(result.contentSize).toBeGreaterThan(result.viewSize);
  });

  // =========================================================================
  // 5. scrollToBottom() — vBar.scrolledAmount becomes 1; innerPanel y < 0
  // =========================================================================

  test('5 — scrollToBottom(): vBar.scrolledAmount===1; innerPanel y is negative', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const sc = new G.ScrollControl(canvas);
      sc.setBounds(0, 0, 200, 200);

      const inner = sc.getInnerPanel();
      const child = new G.Base(inner);
      child.setSize(100, 500);

      canvas.doThink();
      sc.scrollToBottom();
      canvas.doThink();

      const amount = sc.getVerticalScrollBar().getScrolledAmount();
      const innerY = inner.y();

      sc.dispose();
      return { amount, innerY };
    });
    expect(result.amount).toBe(1);
    expect(result.innerY).toBeLessThan(0);
  });

  // =========================================================================
  // 6. scrollToTop() — vBar.scrolledAmount becomes 0
  // =========================================================================

  test('6 — scrollToTop(): vBar.scrolledAmount===0', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const sc = new G.ScrollControl(canvas);
      sc.setBounds(0, 0, 200, 200);

      const inner = sc.getInnerPanel();
      const child = new G.Base(inner);
      child.setSize(100, 500);

      canvas.doThink();
      sc.scrollToBottom();
      canvas.doThink();
      sc.scrollToTop();
      canvas.doThink();

      const amount = sc.getVerticalScrollBar().getScrolledAmount();
      sc.dispose();
      return amount;
    });
    expect(result).toBe(0);
  });

  // =========================================================================
  // 7. Mouse wheel scrolls vertically: positive delta scrolls up (decreases amount)
  // =========================================================================

  test('7 — onMouseWheeled(60) when V enabled: vBar scrolledAmount decreases from 1', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const sc = new G.ScrollControl(canvas);
      sc.setBounds(0, 0, 200, 200);
      sc.setScroll(true, true);

      const inner = sc.getInnerPanel();
      const child = new G.Base(inner);
      child.setSize(100, 500);

      canvas.doThink();
      sc.scrollToBottom();
      canvas.doThink();

      const before = sc.getVerticalScrollBar().getScrolledAmount();
      sc.onMouseWheeled(60);
      const after = sc.getVerticalScrollBar().getScrolledAmount();

      sc.dispose();
      return { before, after };
    });
    // Positive delta = scroll up → amount decreases from 1
    expect(result.before).toBe(1);
    expect(result.after).toBeLessThan(result.before);
  });

  // =========================================================================
  // 8. Wheel when V hidden (canScrollV=false) but H enabled: H bar scrolls
  // =========================================================================

  test('8 — onMouseWheeled when V disabled but H enabled: hBar scrolledAmount changes', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const sc = new G.ScrollControl(canvas);
      sc.setBounds(0, 0, 200, 200);
      // Disable V, enable H only
      sc.setScroll(true, false);

      const inner = sc.getInnerPanel();
      // Wide child to create horizontal overflow
      const child = new G.Base(inner);
      child.setSize(500, 100);

      canvas.doThink();
      sc.scrollToRight();
      canvas.doThink();

      const before = sc.getHorizontalScrollBar().getScrolledAmount();
      // Positive delta = would scroll up V, but V is off; falls through to H
      sc.onMouseWheeled(60);
      const after = sc.getHorizontalScrollBar().getScrolledAmount();

      sc.dispose();
      return { before, after };
    });
    // H should have been scrolled (amount should differ from 1)
    expect(result.before).toBe(1);
    expect(result.after).toBeLessThan(result.before);
  });

  // =========================================================================
  // 9. clear() empties innerPanel children
  // =========================================================================

  test('9 — clear() removes all children from innerPanel', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const sc = new G.ScrollControl(canvas);
      sc.setBounds(0, 0, 200, 200);

      const inner = sc.getInnerPanel();
      new G.Base(inner);
      new G.Base(inner);
      new G.Base(inner);

      const before = inner.numChildren();
      sc.clear();
      const after = inner.numChildren();

      sc.dispose();
      return { before, after };
    });
    expect(result.before).toBe(3);
    expect(result.after).toBe(0);
  });

  // =========================================================================
  // 10. getVerticalScrollBar() returns VerticalScrollBar instance
  // =========================================================================

  test('10 — getVerticalScrollBar() returns a VerticalScrollBar', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const sc = new G.ScrollControl(canvas);
      const bar = sc.getVerticalScrollBar();
      const isVBar = bar instanceof G.VerticalScrollBar;
      sc.dispose();
      return isVBar;
    });
    expect(result).toBe(true);
  });

  // =========================================================================
  // 11. getHorizontalScrollBar() returns HorizontalScrollBar instance
  // =========================================================================

  test('11 — getHorizontalScrollBar() returns a HorizontalScrollBar', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const sc = new G.ScrollControl(canvas);
      const bar = sc.getHorizontalScrollBar();
      const isHBar = bar instanceof G.HorizontalScrollBar;
      sc.dispose();
      return isHBar;
    });
    expect(result).toBe(true);
  });

  // =========================================================================
  // 12. Render produces non-background pixels
  // =========================================================================

  test('12 — render produces non-background pixels', async ({ page }) => {
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

      try {
        const sc = new G.ScrollControl(cvs);
        sc.setBounds(0, 0, 300, 200);
        sc.setScroll(true, true);

        const inner = sc.getInnerPanel();
        const child = new G.Base(inner);
        child.setSize(100, 500);

        cvs.doThink();
        cvs.redraw();
        cvs.renderCanvas();

        const gl = renderer.gl;
        const pixels = new Uint8Array(300 * 200 * 4);
        gl.readPixels(0, 0, 300, 200, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

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
      } catch {
        cvs.dispose();
        document.body.removeChild(htmlC);
        return false;
      }
    });
    expect(result).toBe(true);
  });
});
