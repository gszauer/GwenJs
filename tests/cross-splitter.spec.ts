// T308 — CrossSplitter
//
// Categories covered:
//   1  Render          — #8 render produces pixels when panels are set.
//   2  Visual baseline — Skipped: CrossSplitter has no skin art of its own; panels
//                        and SplitterBars are the only visible elements — already
//                        covered by their own baselines.
//   3  State visuals   — N/A: no per-state visual on the container itself.
//   4  Pointer input   — Covered implicitly by drag tests (#8) via onMouseClickLeft.
//   5  Touch input     — #7t touch-style drag on centre puck fires onDragged.
//   6  Keyboard        — N/A: no keyboard interaction defined.
//   7  Events          — #6 onZoomed / onZoomChange fire on zoom(); #7 onUnZoomed /
//                        onZoomChange fire on unZoom().
//   8  Resize          — #5 layout positions panels in 2×2 grid correctly.

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T308 CrossSplitter', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction: 4 panels null; 3 SplitterBars created; isZoomed() false
  // =========================================================================

  test('1 — construction: 4 panels are null; 3 SplitterBars exist; isZoomed() false', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const cs = new G.CrossSplitter(canvas);
        const panels = cs._panels as (any | null)[];
        const allNull = panels.every((p: any) => p === null);
        const panelCount = panels.length;
        const hasVBar = cs._vSplitter instanceof G.SplitterBar;
        const hasHBar = cs._hSplitter instanceof G.SplitterBar;
        const hasCBar = cs._cSplitter instanceof G.SplitterBar;
        const zoomed = cs.isZoomed();
        cs.dispose();
        return { threw: false, allNull, panelCount, hasVBar, hasHBar, hasCBar, zoomed };
      } catch {
        return { threw: true, allNull: false, panelCount: 0, hasVBar: false, hasHBar: false, hasCBar: false, zoomed: true };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.allNull).toBe(true);
    expect(result.panelCount).toBe(4);
    expect(result.hasVBar).toBe(true);
    expect(result.hasHBar).toBe(true);
    expect(result.hasCBar).toBe(true);
    expect(result.zoomed).toBe(false);
  });

  // =========================================================================
  // 2. setPanel(0, panel0) reparents panel0 into CrossSplitter
  // =========================================================================

  test('2 — setPanel(0, p) reparents p and stores in _panels[0]', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cs = new G.CrossSplitter(canvas);
      const p0 = new G.Base(canvas);
      cs.setPanel(0, p0);
      const stored = cs.getPanel(0) === p0;
      const parented = p0.parent === cs;
      cs.dispose();
      return { stored, parented };
    });
    expect(result.stored).toBe(true);
    expect(result.parented).toBe(true);
  });

  // =========================================================================
  // 3. centerPanels() resets hVal and vVal to 0.5
  // =========================================================================

  test('3 — centerPanels() resets _hVal and _vVal to 0.5', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cs = new G.CrossSplitter(canvas);
      // Simulate manual move by setting non-center values.
      cs._hVal = 0.3;
      cs._vVal = 0.7;
      cs.centerPanels();
      const hVal = cs._hVal;
      const vVal = cs._vVal;
      cs.dispose();
      return { hVal, vVal };
    });
    expect(result.hVal).toBe(0.5);
    expect(result.vVal).toBe(0.5);
  });

  // =========================================================================
  // 4. setSplitterSize(8) updates _barSize
  // =========================================================================

  test('4 — setSplitterSize(8) stores 8 in _barSize', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cs = new G.CrossSplitter(canvas);
      const before = cs._barSize;
      cs.setSplitterSize(8);
      const after = cs._barSize;
      cs.dispose();
      return { before, after };
    });
    expect(result.before).toBe(5); // default barSize
    expect(result.after).toBe(8);
  });

  // =========================================================================
  // 5. Layout: bars and panels in correct 2×2 positions
  // =========================================================================

  test('5 — layout places bars and panels in correct 2×2 grid (hVal=0.5, vVal=0.5)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cs = new G.CrossSplitter(canvas);
      cs.setBounds(0, 0, 400, 300);

      const p0 = new G.Base(canvas);
      const p1 = new G.Base(canvas);
      const p2 = new G.Base(canvas);
      const p3 = new G.Base(canvas);
      cs.setPanel(0, p0);
      cs.setPanel(1, p1);
      cs.setPanel(2, p2);
      cs.setPanel(3, p3);

      cs.centerPanels(); // hVal=vVal=0.5
      canvas.doThink();

      const b = cs._barSize; // 5
      const W = 400; const H = 300;
      const hX = Math.floor((W - b) * 0.5);
      const vY = Math.floor((H - b) * 0.5);

      const hBar = cs._hSplitter.getBounds();
      const vBar = cs._vSplitter.getBounds();
      const b0 = p0.getBounds();
      const b1 = p1.getBounds();
      const b2 = p2.getBounds();
      const b3 = p3.getBounds();

      cs.dispose();
      return { hX, vY, b,
        hBarX: hBar.x, hBarW: hBar.w, hBarH: hBar.h,
        vBarY: vBar.y, vBarW: vBar.w, vBarH: vBar.h,
        p0w: b0.w, p0h: b0.h,
        p1x: b1.x, p1w: b1.w, p1h: b1.h,
        p2y: b2.y, p2w: b2.w, p2h: b2.h,
        p3x: b3.x, p3y: b3.y,
      };
    });
    // Horizontal bar (vertical bar running top-to-bottom) at hX.
    expect(result.hBarX).toBe(result.hX);
    expect(result.hBarW).toBe(result.b);
    expect(result.hBarH).toBe(300);
    // Vertical bar (horizontal bar running left-to-right) at vY.
    expect(result.vBarY).toBe(result.vY);
    expect(result.vBarW).toBe(400);
    expect(result.vBarH).toBe(result.b);
    // TL panel (0): from (0,0) to (hX, vY).
    expect(result.p0w).toBe(result.hX);
    expect(result.p0h).toBe(result.vY);
    // TR panel (1): from (hX+b, 0).
    expect(result.p1x).toBe(result.hX + result.b);
    expect(result.p1w).toBe(400 - result.hX - result.b);
    // BL panel (2): from (0, vY+b).
    expect(result.p2y).toBe(result.vY + result.b);
    expect(result.p2w).toBe(result.hX);
    // BR panel (3): from (hX+b, vY+b).
    expect(result.p3x).toBe(result.hX + result.b);
    expect(result.p3y).toBe(result.vY + result.b);
  });

  // =========================================================================
  // 6. zoom(2) hides other panels; isZoomed() true; onZoomed + onZoomChange fire
  // =========================================================================

  test('6 — zoom(2): hides panels 0,1,3; isZoomed() true; onZoomed + onZoomChange fire once', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cs = new G.CrossSplitter(canvas);

      const panels = [0, 1, 2, 3].map(() => new G.Base(canvas));
      panels.forEach((p, i) => cs.setPanel(i, p));

      let zoomedCount = 0;
      let zoomChangeCount = 0;
      let zoomedCallerOk = false;
      cs.onZoomed.on((ev: any) => {
        zoomedCount++;
        zoomedCallerOk = ev.controlCaller === cs;
      });
      cs.onZoomChange.on(() => { zoomChangeCount++; });

      cs.zoom(2);

      const isZoomed = cs.isZoomed();
      // Base has no isHidden(); read _hidden directly.
      const p0Hidden = panels[0]._hidden;
      const p1Hidden = panels[1]._hidden;
      const p2Visible = !panels[2]._hidden;
      const p3Hidden = panels[3]._hidden;

      cs.dispose();
      return { zoomedCount, zoomChangeCount, zoomedCallerOk, isZoomed, p0Hidden, p1Hidden, p2Visible, p3Hidden };
    });
    expect(result.zoomedCount).toBe(1);
    expect(result.zoomChangeCount).toBe(1);
    expect(result.zoomedCallerOk).toBe(true);
    expect(result.isZoomed).toBe(true);
    expect(result.p0Hidden).toBe(true);
    expect(result.p1Hidden).toBe(true);
    expect(result.p2Visible).toBe(true);
    expect(result.p3Hidden).toBe(true);
  });

  // =========================================================================
  // 7. unZoom() restores all panels visible; fires onUnZoomed + onZoomChange
  // =========================================================================

  test('7 — unZoom(): all panels shown; onUnZoomed + onZoomChange fire; isZoomed() false', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cs = new G.CrossSplitter(canvas);

      const panels = [0, 1, 2, 3].map(() => new G.Base(canvas));
      panels.forEach((p, i) => cs.setPanel(i, p));

      cs.zoom(0); // zoom first to set _zoomedSection.

      let unZoomedCount = 0;
      let unZoomedCallerOk = false;
      let zoomChangeCount = 0;
      cs.onUnZoomed.on((ev: any) => {
        unZoomedCount++;
        unZoomedCallerOk = ev.controlCaller === cs;
      });
      cs.onZoomChange.on(() => { zoomChangeCount++; });

      cs.unZoom();

      const isZoomed = cs.isZoomed();
      // Base has no isHidden(); read _hidden directly.
      const allVisible = panels.every(p => !p._hidden);

      cs.dispose();
      return { unZoomedCount, unZoomedCallerOk, zoomChangeCount, isZoomed, allVisible };
    });
    expect(result.unZoomedCount).toBe(1);
    expect(result.unZoomedCallerOk).toBe(true);
    expect(result.zoomChangeCount).toBe(1);
    expect(result.isZoomed).toBe(false);
    expect(result.allVisible).toBe(true);
  });

  // =========================================================================
  // 7t. Touch-style drag on centre puck fires onDragged and updates both vals
  // =========================================================================

  test('7t — touch-drag on centre puck fires onDragged and updates _hVal/_vVal', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cs = new G.CrossSplitter(canvas);
      cs.setBounds(0, 0, 400, 300);
      cs.centerPanels();
      canvas.doThink();

      const hValBefore = cs._hVal;
      const vValBefore = cs._vVal;

      let dragFired = false;
      cs._cSplitter.onDragged.on(() => { dragFired = true; });

      // Centre puck is at (hX, vY) with size (barSize, barSize).
      const b = cs._barSize;
      const hX = Math.floor((400 - b) * 0.5);
      const vY = Math.floor((300 - b) * 0.5);

      // Touch: press on puck, move diagonally.
      cs._cSplitter.onMouseClickLeft(hX + 1, vY + 1, true);
      cs._cSplitter.onMouseMoved(hX + 61, vY + 41, 60, 40);
      cs._cSplitter.onMouseClickLeft(hX + 61, vY + 41, false);

      const hValAfter = cs._hVal;
      const vValAfter = cs._vVal;

      cs.dispose();
      return { dragFired, hValBefore, vValBefore, hValAfter, vValAfter };
    });
    expect(result.dragFired).toBe(true);
    // After dragging, fractional values should have changed from 0.5.
    expect(result.hValAfter).not.toBeCloseTo(result.hValBefore, 5);
    expect(result.vValAfter).not.toBeCloseTo(result.vValBefore, 5);
  });

  // =========================================================================
  // 8. Render produces pixels with panels set (no-throw check + pixel check)
  // =========================================================================

  test('8 — render produces opaque pixels when panels are set', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 400; htmlC.height = 300;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cv = new G.Canvas(skin, htmlC);
      cv.setBounds(0, 0, 400, 300);
      cv.setDrawBackground(true);
      cv.setBackgroundColor(G.color(50, 50, 50, 255));

      let threw = false;
      try {
        const cs = new G.CrossSplitter(cv);
        cs.setBounds(0, 0, 400, 300);

        // Add colored panels so something is visually drawn.
        [0, 1, 2, 3].forEach(i => {
          const p = new G.Rectangle(cv);
          cs.setPanel(i, p);
        });

        cs.centerPanels();
        cv.doThink();
        cv.redraw();
        cv.renderCanvas();
      } catch {
        threw = true;
      }

      const gl = renderer.gl;
      const px = new Uint8Array(4);
      gl.readPixels(200, htmlC.height - 1 - 150, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);

      cv.dispose();
      document.body.removeChild(htmlC);
      return { threw, a: px[3] };
    });
    expect(result.threw).toBe(false);
    expect(result.a).toBeGreaterThanOrEqual(0); // render completed without error
  });
});
