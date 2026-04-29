// T212 — DockedTabControl
//
// Categories covered:
//   1  Render          — #8 pixel read confirms skin draws something
//   2  Visual baseline — Skipped: GPU/skin variance
//   3  State visuals   — #2 title bar hidden/shown state; #4 strip hidden at single-tab
//   4  Pointer input   — N/A: same tab-press path tested in T211 TabControl
//   5  Touch input     — N/A: same path as pointer
//   6  Keyboard        — N/A: no custom key handlers
//   7  Events          — N/A: DockedTabControl adds no new public signals beyond TabControl
//   8  Resize          — N/A: docking layout handled by parent; no separate resize hook

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T212 DockedTabControl', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction: docks Fill; strip configured as title-bar-with-tabs;
  //    allowReorder true. The dedicated TabTitleBar is gone — the strip
  //    plays its visual + drag role.
  // =========================================================================

  test('1 — construction: docks Fill; strip is header + drag source; allowReorder=true', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const dtc = new G.DockedTabControl(canvas);

        // dock() stores the Pos enum value on the control.
        const dockIsFill = (dtc as any)._dock === G.Pos.Fill;

        const strip = dtc.getTabStrip();
        const stripShowsAsHeader = strip.showsAsHeader();
        // setDockDragControl wires the strip up as the drag source.
        const stripDragControl = (strip as any)._dockDragControl === dtc;

        // allowReorder delegates to the strip.
        const reorder = dtc.allowReorder();

        dtc.dispose();
        return { threw: false, dockIsFill, stripShowsAsHeader, stripDragControl, reorder };
      } catch {
        return { threw: true, dockIsFill: false, stripShowsAsHeader: false, stripDragControl: false, reorder: false };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.dockIsFill).toBe(true);
    expect(result.stripShowsAsHeader).toBe(true);
    expect(result.stripDragControl).toBe(true);
    expect(result.reorder).toBe(true);
  });

  // =========================================================================
  // 2. Strip drag: starting a drag on the strip emits a TabWindowMove
  //    package whose `drawcontrol` points at the owning DockedTabControl,
  //    so DockBase's drop handler reparents the entire tab set.
  // =========================================================================

  test('2 — strip drag emits TabWindowMove with the DockedTabControl as drawcontrol', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const dtc = new G.DockedTabControl(canvas);
      dtc.setBounds(0, 0, 300, 200);

      const strip = dtc.getTabStrip();
      const pkg = {
        name: 'TabWindowMove', userdata: null, draggable: true,
        drawcontrol: null, holdoffset: { x: 0, y: 0 },
      };
      const started = strip.dragAndDrop_StartDragging(pkg, 50, 8);

      const r = {
        started,
        drawcontrolIsDtc: pkg.drawcontrol === dtc,
        pkgName: pkg.name,
      };
      dtc.dispose();
      return r;
    });
    expect(result.started).toBe(true);
    expect(result.drawcontrolIsDtc).toBe(true);
    expect(result.pkgName).toBe('TabWindowMove');
  });

  // =========================================================================
  // 3. addPage('A') + addPage('B') → tabCount=2; strip visible
  // =========================================================================

  test('3 — addPage x2: tabCount=2; strip becomes visible after layout', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const dtc = new G.DockedTabControl(canvas);
      dtc.setBounds(0, 0, 400, 300);

      dtc.addPage('A');
      dtc.addPage('B');

      const count = dtc.tabCount();

      // Force a layout pass so DockedTabControl.layout() decides strip visibility.
      canvas.doThink();

      const strip = dtc.getTabStrip();
      const stripVisible = !strip.hidden();

      dtc.dispose();
      return { count, stripVisible };
    });
    expect(result.count).toBe(2);
    expect(result.stripVisible).toBe(true);
  });

  // =========================================================================
  // 4. Single-tab mode: strip remains visible (it's the title bar). The
  //    earlier behaviour — hiding the strip when only one tab existed —
  //    no longer makes sense now that the strip *is* the title bar.
  // =========================================================================

  test('4 — single tab: strip stays visible (it is the title bar)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const dtc = new G.DockedTabControl(canvas);
      dtc.setBounds(0, 0, 400, 300);

      dtc.addPage('A');
      const btnB = dtc.addPage('B');

      canvas.doThink();

      dtc.removePage(btnB);

      canvas.doThink();

      const count = dtc.tabCount();
      const strip = dtc.getTabStrip();
      const stripHidden = strip.hidden();

      dtc.dispose();
      return { count, stripHidden };
    });
    expect(result.count).toBe(1);
    expect(result.stripHidden).toBe(false);
  });

  // =========================================================================
  // 5. Legacy `setShowTitlebar` / `updateTitleBar` shims are no-ops that
  //    don't throw. The strip itself plays the title-bar role, so these
  //    survive only for back-compat with code written against the old
  //    API.
  // =========================================================================

  test('5 — setShowTitlebar / updateTitleBar are safe no-ops', async ({ page }) => {
    const threw = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const dtc = new G.DockedTabControl(canvas);
        dtc.setBounds(0, 0, 400, 300);
        dtc.setShowTitlebar(true);
        dtc.setShowTitlebar(false);
        dtc.addPage('Hello');
        dtc.updateTitleBar();
        dtc.dispose();
        return false;
      } catch {
        return true;
      }
    });
    expect(threw).toBe(false);
  });

  // =========================================================================
  // 6. moveTabsTo(target) — moves all tabs from source to target
  // =========================================================================

  test('6 — moveTabsTo(target): source ends at 0 tabs; target gains source tabs', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const src = new G.DockedTabControl(canvas);
      src.setBounds(0, 0, 300, 200);
      src.addPage('Tab1');
      src.addPage('Tab2');

      const target = new G.DockedTabControl(canvas);
      target.setBounds(0, 0, 300, 200);

      const srcBefore = src.tabCount();
      const tgtBefore = target.tabCount();

      src.moveTabsTo(target);

      canvas.doThink();

      const srcAfter = src.tabCount();
      const tgtAfter = target.tabCount();

      src.dispose();
      target.dispose();
      return { srcBefore, tgtBefore, srcAfter, tgtAfter };
    });
    expect(result.srcBefore).toBe(2);
    expect(result.tgtBefore).toBe(0);
    expect(result.srcAfter).toBe(0);
    // Target should now hold the 2 moved tabs.
    expect(result.tgtAfter).toBe(2);
  });

  // =========================================================================
  // 7. layout() call does not throw
  // =========================================================================

  test('7 — layout() does not throw with zero or multiple tabs', async ({ page }) => {
    const threw = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const dtc = new G.DockedTabControl(canvas);
        dtc.setBounds(0, 0, 400, 300);
        canvas.doThink(); // layout with 0 tabs

        dtc.addPage('A');
        canvas.doThink(); // layout with 1 tab

        dtc.addPage('B');
        canvas.doThink(); // layout with 2 tabs

        dtc.dispose();
        return false;
      } catch {
        return true;
      }
    });
    expect(threw).toBe(false);
  });

  // =========================================================================
  // 8. Render produces non-background pixels
  // =========================================================================

  test('8 — render with two tabs produces non-background pixels', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 400; htmlC.height = 300;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 400, 300);
      cvs.setDrawBackground(true);
      cvs.setBackgroundColor(G.color(0, 0, 0, 255));

      try {
        const dtc = new G.DockedTabControl(cvs);
        dtc.setBounds(0, 0, 400, 300);
        dtc.addPage('Alpha');
        dtc.addPage('Beta');

        cvs.doThink();
        cvs.redraw();
        cvs.renderCanvas();

        const gl = renderer.gl;
        const pixels = new Uint8Array(400 * 300 * 4);
        gl.readPixels(0, 0, 400, 300, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

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
