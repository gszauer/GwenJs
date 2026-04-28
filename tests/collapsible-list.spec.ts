// T210 — CollapsibleList
//
// Categories covered:
//   1  Render          — #6 render produces non-background pixels
//   2  Visual baseline — Skipped: GPU/skin variance makes stable goldens impractical
//   3  State visuals   — #3 cross-category exclusion; #5 unselectAll clears all
//   4  Pointer input   — N/A: row click is simulated via onPress.emit (same code path)
//   5  Touch input     — N/A: same code path as pointer
//   6  Keyboard        — N/A: CollapsibleList has no key handlers
//   7  Events          — #3 onSelection fires; #3 sibling category is deselected
//   8  Resize          — N/A: ScrollControl reflows on every layout pass

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T210 CollapsibleList', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction: vertical-only scroll; autoHide bars; margin set
  // =========================================================================

  test('1 — new CollapsibleList: vertical scroll only; autoHide bars; margin set', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const list = new G.CollapsibleList(canvas);
        // _canScrollH should be false (set via setScroll(false, true)).
        const canScrollH = (list as any)._canScrollH;
        const canScrollV = (list as any)._canScrollV;
        const autoHide = (list as any)._autoHideBars;
        const m = list.getMargin();
        list.dispose();
        return { threw: false, canScrollH, canScrollV, autoHide, ml: m.left, mr: m.right, mt: m.top, mb: m.bottom };
      } catch {
        return { threw: true, canScrollH: true, canScrollV: false, autoHide: false, ml: 0, mr: 0, mt: 0, mb: 0 };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.canScrollH).toBe(false);
    expect(result.canScrollV).toBe(true);
    expect(result.autoHide).toBe(true);
    // margin(left=1, top=0, right=1, bottom=1) per CollapsibleList constructor
    expect(result.ml).toBe(1);
    expect(result.mr).toBe(1);
    expect(result.mt).toBe(0);
    expect(result.mb).toBe(1);
  });

  // =========================================================================
  // 2. add('Category1') returns CollapsibleCategory docked Top
  // =========================================================================

  test('2 — add("Category1") returns CollapsibleCategory; docked Top; getText() correct', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const list = new G.CollapsibleList(canvas);
      const cat = list.add('Category1');
      const isCategory = cat instanceof G.CollapsibleCategory;
      const dock = cat.getDock();
      const text = cat.getText();
      list.dispose();
      return { isCategory, dock, topFlag: G.Pos.Top, text };
    });
    expect(result.isCategory).toBe(true);
    expect(result.dock).toBe(result.topFlag);
    expect(result.text).toBe('Category1');
  });

  // =========================================================================
  // 3. Clicking item in cat1 unselects items in cat2; onSelection fires
  // =========================================================================

  test('3 — item click in cat1 deselects cat2 items; onSelection fires with cat1 caller', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const list = new G.CollapsibleList(canvas);
      list.setBounds(0, 0, 300, 400);

      const cat1 = list.add('Cat1');
      const cat2 = list.add('Cat2');
      const row1 = cat1.add('Row1A');
      const row2 = cat2.add('Row2A');

      canvas.doThink();

      // First: select something in cat2 so it is known-selected.
      row2.onPress.emit({ controlCaller: row2 });
      const cat2SelectedBefore = row2.getToggleState();

      let selectionFired = 0;
      let callerIsCat1 = false;
      list.onSelection.on((ev: any) => {
        selectionFired++;
        callerIsCat1 = ev.controlCaller === cat1;
      });

      // Now click a row in cat1 — this should deselect cat2's rows.
      row1.onPress.emit({ controlCaller: row1 });

      const row1Selected = row1.getToggleState();
      const row2SelectedAfter = row2.getToggleState();

      list.dispose();
      return { cat2SelectedBefore, row1Selected, row2SelectedAfter, selectionFired, callerIsCat1 };
    });
    expect(result.cat2SelectedBefore).toBe(true);
    expect(result.row1Selected).toBe(true);
    expect(result.row2SelectedAfter).toBe(false);
    expect(result.selectionFired).toBe(1);
    expect(result.callerIsCat1).toBe(true);
  });

  // =========================================================================
  // 4. getSelected() returns the selected button
  // =========================================================================

  test('4 — getSelected() returns the selected button from the active category', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const list = new G.CollapsibleList(canvas);

      const cat1 = list.add('Cat1');
      const cat2 = list.add('Cat2');
      const row1 = cat1.add('R1');
      cat2.add('R2');

      const nullWhenEmpty = list.getSelected() === null;

      row1.onPress.emit({ controlCaller: row1 });
      const sel = list.getSelected();
      const isRow1 = sel === row1;

      list.dispose();
      return { nullWhenEmpty, isRow1 };
    });
    expect(result.nullWhenEmpty).toBe(true);
    expect(result.isRow1).toBe(true);
  });

  // =========================================================================
  // 5. unselectAll() clears all selections across all categories
  // =========================================================================

  test('5 — unselectAll() clears selection in all categories', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const list = new G.CollapsibleList(canvas);

      const cat1 = list.add('Cat1');
      const cat2 = list.add('Cat2');
      const row1 = cat1.add('R1');
      const row2 = cat2.add('R2');

      // Directly toggle each row without going through cross-exclusion logic
      // so both end up selected simultaneously.
      row1.setToggleState(true);
      row2.setToggleState(true);

      list.unselectAll();

      const row1After = row1.getToggleState();
      const row2After = row2.getToggleState();
      const selAfter = list.getSelected();

      list.dispose();
      return { row1After, row2After, selNull: selAfter === null };
    });
    expect(result.row1After).toBe(false);
    expect(result.row2After).toBe(false);
    expect(result.selNull).toBe(true);
  });

  // =========================================================================
  // 6. Render produces non-background pixels
  // =========================================================================

  test('6 — CollapsibleList render produces non-background pixels', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 200; htmlC.height = 300;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 200, 300);
      cvs.setDrawBackground(true);
      cvs.setBackgroundColor(G.color(0, 0, 0, 255));

      const list = new G.CollapsibleList(cvs);
      list.setBounds(10, 10, 180, 280);
      const cat = list.add('Shapes');
      cat.add('Circle');
      cat.add('Square');

      cvs.doThink();
      cvs.redraw();
      cvs.renderCanvas();

      const gl: WebGL2RenderingContext = renderer.gl;
      const pixels = new Uint8Array(200 * 300 * 4);
      gl.readPixels(0, 0, 200, 300, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

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
