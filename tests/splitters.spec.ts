// T307 — SplitterVertical + SplitterHorizontal
//
// Categories covered:
//   1  Render          — N/A: splitters defer all rendering to child panels and
//                        SplitterBar, which itself draws nothing (T306).
//   2  Visual baseline — Skipped: no dedicated skin art; the render tree is all
//                        child-drawn. Additional screenshots would duplicate the
//                        SplitterBar golden with no new signal.
//   3  State visuals   — N/A: no per-state visual on the container.
//   4  Pointer input   — #8 dragging the bar updates _size and layout.
//   5  Touch input     — #8t touch-style drag fires onDragged and updates split.
//   6  Keyboard        — N/A: no keyboard interaction defined.
//   7  Events          — Bar drag fires onDragged (via SplitterBar); covered by #8.
//   8  Resize          — #6 layout places bar + panels correctly after setBounds.

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T307 SplitterVertical + SplitterHorizontal', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. SplitterVertical construction: two panels + a SplitterBar child
  // =========================================================================

  test('1 — SplitterVertical: two panel children + one SplitterBar; default size 100×100', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const sv = new G.SplitterVertical(canvas);
        const b = sv.getBounds();
        const panelCount = sv._panels.length;
        const barIsInstance = sv._splitterBar instanceof G.SplitterBar;
        sv.dispose();
        return { threw: false, w: b.w, h: b.h, panelCount, barIsInstance };
      } catch {
        return { threw: true, w: 0, h: 0, panelCount: 0, barIsInstance: false };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.w).toBe(100);
    expect(result.h).toBe(100);
    expect(result.panelCount).toBe(2);
    expect(result.barIsInstance).toBe(true);
  });

  // =========================================================================
  // 2. setPanels reparents a and b into the two internal panel slots
  // =========================================================================

  test('2 — setPanels(a, b) reparents a and b with dock=Fill into internal panels', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const sv = new G.SplitterVertical(canvas);

      const a = new G.Base(canvas);
      const b = new G.Base(canvas);
      sv.setPanels(a, b);

      const aParentIsPanel0 = a.parent === sv._panels[0];
      const bParentIsPanel1 = b.parent === sv._panels[1];

      sv.dispose();
      return { aParentIsPanel0, bParentIsPanel1 };
    });
    expect(result.aParentIsPanel0).toBe(true);
    expect(result.bParentIsPanel1).toBe(true);
  });

  // =========================================================================
  // 3. Default split position is at _size = 100 (y=100) before layout
  // =========================================================================

  test('3 — default _size is 100; splitterPos() returns bar y-position', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const sv = new G.SplitterVertical(canvas);
      sv.setBounds(0, 0, 200, 300);
      canvas.doThink();
      const pos = sv.splitterPos();
      const size = sv._size;
      sv.dispose();
      return { pos, size };
    });
    expect(result.size).toBe(100);
    // After layout, bar y equals _size (not rightSided case).
    expect(result.pos).toBe(100);
  });

  // =========================================================================
  // 4. setScaling(false, 50) sets _size=50 and _rightSided=false
  // =========================================================================

  test('4 — setScaling(false, 50): _size becomes 50, _rightSided becomes false', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const sv = new G.SplitterVertical(canvas);
      sv.setScaling(false, 50);
      const size = sv._size;
      const rightSided = sv._rightSided;
      sv.dispose();
      return { size, rightSided };
    });
    expect(result.size).toBe(50);
    expect(result.rightSided).toBe(false);
  });

  // =========================================================================
  // 5. splitterPos() returns bar y coordinate after layout
  // =========================================================================

  test('5 — splitterPos() equals bar y after setScaling + layout', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const sv = new G.SplitterVertical(canvas);
      sv.setBounds(0, 0, 200, 400);
      sv.setScaling(false, 120);
      canvas.doThink();
      const pos = sv.splitterPos();
      const barY = sv._splitterBar.y();
      sv.dispose();
      return { pos, barY };
    });
    expect(result.pos).toBe(result.barY);
    expect(result.pos).toBe(120);
  });

  // =========================================================================
  // 6. Layout: bar + panels at correct bounds after setBounds
  // =========================================================================

  test('6 — layout places bar at y=_size; panel0 covers [0,_size); panel1 covers rest', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const sv = new G.SplitterVertical(canvas);
      sv.setBounds(0, 0, 200, 300);
      sv.setScaling(false, 80);
      canvas.doThink();

      const bar = sv._splitterBar.getBounds();
      const p0 = sv._panels[0].getBounds();
      const p1 = sv._panels[1].getBounds();
      const splitterSize = sv._splitterSize;

      sv.dispose();
      return {
        barX: bar.x, barY: bar.y, barW: bar.w, barH: bar.h,
        p0H: p0.h,
        p1Y: p1.y, p1H: p1.h,
        splitterSize,
      };
    });
    expect(result.barY).toBe(80);
    expect(result.barW).toBe(200);
    expect(result.barH).toBe(result.splitterSize);
    expect(result.p0H).toBe(80);
    expect(result.p1Y).toBe(80 + result.splitterSize);
    expect(result.p1H).toBe(300 - 80 - result.splitterSize);
  });

  // =========================================================================
  // 7. SplitterHorizontal mirrors behavior on x axis
  // =========================================================================

  test('7 — SplitterHorizontal: splitterPos() is bar x; layout places bar vertically', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const sh = new G.SplitterHorizontal(canvas);
      sh.setBounds(0, 0, 400, 200);
      sh.setScaling(false, 150);
      canvas.doThink();

      const pos = sh.splitterPos();
      const barBounds = sh._splitterBar.getBounds();
      const p0 = sh._panels[0].getBounds();
      const p1 = sh._panels[1].getBounds();
      const splitterSize = sh._splitterSize;

      sh.dispose();
      return {
        pos,
        barX: barBounds.x, barW: barBounds.w, barH: barBounds.h,
        p0W: p0.w,
        p1X: p1.x, p1W: p1.w,
        splitterSize,
      };
    });
    expect(result.pos).toBe(150);
    expect(result.barX).toBe(150);
    expect(result.barW).toBe(result.splitterSize);
    expect(result.barH).toBe(200);
    expect(result.p0W).toBe(150);
    expect(result.p1X).toBe(150 + result.splitterSize);
    expect(result.p1W).toBe(400 - 150 - result.splitterSize);
  });

  // =========================================================================
  // 8. Dragging bar updates _size and re-lays out panels (SplitterVertical)
  // =========================================================================

  test('8 — dragging SplitterBar updates _size; panel0 height changes accordingly', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const sv = new G.SplitterVertical(canvas);
      sv.setBounds(0, 0, 200, 300);
      sv.setScaling(false, 60);
      canvas.doThink();

      const sizeBefore = sv._size;

      // Simulate bar drag: press at bar position, move downward.
      const bar = sv._splitterBar;
      bar.onMouseClickLeft(0, 60, true);   // press on bar
      bar.onMouseMoved(0, 100, 0, 40);     // move 40px down
      bar.onMouseClickLeft(0, 100, false); // release

      // Trigger re-layout.
      canvas.doThink();

      const sizeAfter = sv._size;
      const p0H = sv._panels[0].getBounds().h;

      sv.dispose();
      return { sizeBefore, sizeAfter, p0H };
    });
    expect(result.sizeBefore).toBe(60);
    // After drag, _size should have updated (it should not equal 60 anymore).
    expect(result.sizeAfter).not.toBe(60);
    // The top panel height matches _size after layout.
    expect(result.p0H).toBe(result.sizeAfter);
  });

  // =========================================================================
  // 8t. Touch-style drag on SplitterHorizontal bar fires onDragged
  // =========================================================================

  test('8t — touch-style drag on SplitterHorizontal bar fires onDragged and updates split', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const sh = new G.SplitterHorizontal(canvas);
      sh.setBounds(0, 0, 400, 200);
      sh.setScaling(false, 100);
      canvas.doThink();

      let dragFired = false;
      sh._splitterBar.onDragged.on(() => { dragFired = true; });

      const bar = sh._splitterBar;
      // Touch: press, move, release.
      bar.onMouseClickLeft(100, 0, true);
      bar.onMouseMoved(160, 0, 60, 0);
      bar.onMouseClickLeft(160, 0, false);
      canvas.doThink();

      const sizeAfter = sh._size;
      sh.dispose();
      return { dragFired, sizeAfter };
    });
    expect(result.dragFired).toBe(true);
    expect(result.sizeAfter).not.toBe(100);
  });
});
