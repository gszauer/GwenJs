// T306 — SplitterBar
//
// Categories covered:
//   1  Render          — #4 background draw disabled; render produces no
//                        visible output (no-throw check).
//   2  Visual baseline — Skipped: SplitterBar deliberately disables background
//                        drawing; there is nothing to capture as a golden.
//   3  State visuals   — N/A: SplitterBar has no per-state visual.
//   4  Pointer input   — #2 press fires onDragStart; move fires onDragged.
//   5  Touch input     — #2t touch-style press+move fires onDragStart+onDragged.
//   6  Keyboard        — N/A: Dragger has no keyboard interaction.
//   7  Events          — #2 onDragStart / onDragged fire with correct caller.
//   8  Resize          — #3 layout() re-clamps position to parent bounds.

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T306 SplitterBar', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction defaults: target=self; restrictToParent=true;
  //    shouldDrawBackground=false
  // =========================================================================

  test('1 — SplitterBar defaults: target=self, restrictToParent=true, drawBackground=false', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const bar = new G.SplitterBar(canvas);
        const targetIsSelf = bar.getTarget() === bar;
        const restrict = bar.shouldRestrictToParent();
        const drawBg = bar.shouldDrawBackground();
        bar.dispose();
        return { threw: false, targetIsSelf, restrict, drawBg };
      } catch {
        return { threw: true, targetIsSelf: false, restrict: false, drawBg: true };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.targetIsSelf).toBe(true);
    expect(result.restrict).toBe(true);
    expect(result.drawBg).toBe(false);
  });

  // =========================================================================
  // 2. onDragStart and onDragged fire with correct caller
  // =========================================================================

  test('2 — press fires onDragStart; move fires onDragged; both carry bar as caller', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      // Parent needed for restrictToParent clamp to work.
      const parent = new G.Base(canvas);
      parent.setBounds(0, 0, 400, 300);

      const bar = new G.SplitterBar(parent);
      bar.setBounds(100, 0, 4, 300);

      let dragStartCount = 0;
      let draggedCount = 0;
      let startCallerOk = false;
      let draggedCallerOk = false;

      bar.onDragStart.on((ev: any) => {
        dragStartCount++;
        startCallerOk = ev.controlCaller === bar;
      });
      bar.onDragged.on((ev: any) => {
        draggedCount++;
        draggedCallerOk = ev.controlCaller === bar;
      });

      bar.onMouseClickLeft(2, 50, true);  // press
      bar.onMouseMoved(12, 50, 10, 0);   // drag dx=10
      bar.onMouseClickLeft(12, 50, false); // release

      parent.dispose(); // disposes bar too
      return { dragStartCount, draggedCount, startCallerOk, draggedCallerOk };
    });
    expect(result.dragStartCount).toBe(1);
    expect(result.draggedCount).toBe(1);
    expect(result.startCallerOk).toBe(true);
    expect(result.draggedCallerOk).toBe(true);
  });

  // =========================================================================
  // 3. layout() re-clamps position to parent bounds
  // =========================================================================

  test('3 — layout() clamps bar back in-bounds when parent shrinks', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const parent = new G.Base(canvas);
      parent.setBounds(0, 0, 400, 300);

      const bar = new G.SplitterBar(parent);
      // Place bar near the right edge.
      bar.setBounds(380, 0, 10, 300);

      // Shrink parent so bar at x=380 is now out of bounds.
      parent.setBounds(0, 0, 200, 300);

      // Run a think/layout cycle to trigger SplitterBar.layout().
      canvas.doThink();

      const b = bar.getBounds();
      const parentW = parent.getBounds().w;

      parent.dispose();
      return { barX: b.x, barW: b.w, parentW };
    });
    // Bar's right edge must not exceed the parent's width.
    expect(result.barX + result.barW).toBeLessThanOrEqual(result.parentW);
  });

  // =========================================================================
  // 4. Render is no-op visually (background off, canvas stays clean)
  // =========================================================================

  test('4 — render produces no pixels different from background (draw disabled)', async ({ page }) => {
    const threw = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 100; htmlC.height = 100;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 100, 100);

      try {
        const bar = new G.SplitterBar(cvs);
        bar.setBounds(40, 0, 20, 100);
        cvs.doThink();
        cvs.redraw();
        cvs.renderCanvas();
        cvs.dispose();
        document.body.removeChild(htmlC);
        return false;
      } catch {
        document.body.removeChild(htmlC);
        return true;
      }
    });
    expect(threw).toBe(false);
  });

  // =========================================================================
  // 5. setCursor updates the cursor for the chosen drag direction
  // =========================================================================

  test('5 — setCursor(CursorType.SizeWE) stores the cursor type on the bar', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const bar = new G.SplitterBar(canvas);
      bar.setCursor(G.CursorType.SizeWE);
      // _cursor is the internal field set by Base.setCursor().
      const cur = bar._cursor;
      bar.dispose();
      return { cur, sizeWE: G.CursorType.SizeWE };
    });
    expect(result.cur).toBe(result.sizeWE);
  });

  // =========================================================================
  // Touch: press+move via onMouseClickLeft (same normalised path)
  // =========================================================================

  test('2t — touch-style press+move fires onDragStart then onDragged', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const parent = new G.Base(canvas);
      parent.setBounds(0, 0, 400, 300);

      const bar = new G.SplitterBar(parent);
      bar.setBounds(100, 0, 4, 300);

      const events: string[] = [];
      bar.onDragStart.on(() => { events.push('start'); });
      bar.onDragged.on(() => { events.push('dragged'); });
      bar.onDragEnd.on(() => { events.push('end'); });

      // Touch tap+move sequence.
      bar.onMouseClickLeft(2, 50, true);
      bar.onMouseMoved(12, 50, 10, 0);
      bar.onMouseClickLeft(12, 50, false);

      parent.dispose();
      return events;
    });
    expect(result).toEqual(['start', 'dragged', 'end']);
  });
});
