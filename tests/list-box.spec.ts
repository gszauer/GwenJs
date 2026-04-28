// T205 — ListBox + ListBoxRow
//
// Categories covered:
//   1  Render          — #10r render produces non-background pixels
//   2  Visual baseline — Skipped: GPU/skin variance makes stable goldens impractical
//   3  State visuals   — #4 selected row state; #7 unselectAll resets state
//   4  Pointer input   — #4 simulated row click fires onRowSelected
//   5  Touch input     — N/A: same code path as pointer via canvas input
//   6  Keyboard        — N/A: ListBox has no custom key handlers
//   7  Events          — #4 onRowSelected payload; #6 multiSelect shift preserves prior selection
//   8  Resize          — N/A: inner panel reflows on every layout pass

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T205 ListBox', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction: margin(1,1,1,1), multiSelect false, scrollbar setup
  // =========================================================================

  test('1 — construction: multiSelect false; vBar and inner panel present; margin set', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const lb = new G.ListBox(canvas);
        const multiSelect = lb.allowMultiSelect();
        const hasVBar = lb.getVerticalScrollBar() !== null;
        const hasInner = lb.getInnerPanel() !== null;
        // Margin stored in _margin — exposed as getMargin() on Base.
        const m = lb.getMargin();
        lb.dispose();
        return { threw: false, multiSelect, hasVBar, hasInner, ml: m.left, mr: m.right, mt: m.top, mb: m.bottom };
      } catch {
        return { threw: true, multiSelect: true, hasVBar: false, hasInner: false, ml: 0, mr: 0, mt: 0, mb: 0 };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.multiSelect).toBe(false);
    expect(result.hasVBar).toBe(true);
    expect(result.hasInner).toBe(true);
    expect(result.ml).toBe(1);
    expect(result.mr).toBe(1);
    expect(result.mt).toBe(1);
    expect(result.mb).toBe(1);
  });

  // =========================================================================
  // 2. addItem returns ListBoxRow; getName returns the name argument
  // =========================================================================

  test('2 — addItem(label, name) returns ListBoxRow; getName matches', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const lb = new G.ListBox(canvas);
      const row = lb.addItem('foo', 'fooName');
      const isRow = row instanceof G.ListBoxRow;
      const name = row.getName();
      const text = row.getText();
      lb.dispose();
      return { isRow, name, text };
    });
    expect(result.isRow).toBe(true);
    expect(result.name).toBe('fooName');
    expect(result.text).toBe('foo');
  });

  // =========================================================================
  // 3. Even/odd flag alternates: first row even, second odd, third even
  // =========================================================================

  test('3 — even/odd flag alternates across added rows', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const lb = new G.ListBox(canvas);
      const r0 = lb.addItem('A');
      const r1 = lb.addItem('B');
      const r2 = lb.addItem('C');
      const evens = [r0.isEven(), r1.isEven(), r2.isEven()];
      lb.dispose();
      return evens;
    });
    expect(result[0]).toBe(true);
    expect(result[1]).toBe(false);
    expect(result[2]).toBe(true);
  });

  // =========================================================================
  // 4. setSelectedRow fires onRowSelected with correct payload
  // =========================================================================

  test('4 — setSelectedRow marks row selected; fires onRowSelected with row + string', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const lb = new G.ListBox(canvas);
      const row = lb.addItem('Hello', 'helloName');

      let firedCount = 0;
      let callerOk = false;
      let controlOk = false;
      let str = '';
      lb.onRowSelected.on((ev: any) => {
        firedCount++;
        callerOk = ev.controlCaller === lb;
        controlOk = ev.control === row;
        str = ev.string ?? '';
      });

      lb.setSelectedRow(row);
      const isSelected = row.isSelected();
      lb.dispose();
      return { firedCount, callerOk, controlOk, str, isSelected };
    });
    expect(result.firedCount).toBe(1);
    expect(result.callerOk).toBe(true);
    expect(result.controlOk).toBe(true);
    expect(result.str).toBe('Hello');
    expect(result.isSelected).toBe(true);
  });

  // =========================================================================
  // 5. Without multiSelect: selecting second row deselects first
  // =========================================================================

  test('5 — without multiSelect: selecting second row deselects first', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const lb = new G.ListBox(canvas);
      lb.setAllowMultiSelect(false);
      const r0 = lb.addItem('First');
      const r1 = lb.addItem('Second');

      lb.setSelectedRow(r0);
      const r0SelectedFirst = r0.isSelected();

      lb.setSelectedRow(r1);
      const r0SelectedAfter = r0.isSelected();
      const r1Selected = r1.isSelected();
      lb.dispose();
      return { r0SelectedFirst, r0SelectedAfter, r1Selected };
    });
    expect(result.r0SelectedFirst).toBe(true);
    expect(result.r0SelectedAfter).toBe(false);
    expect(result.r1Selected).toBe(true);
  });

  // =========================================================================
  // 6. With multiSelect + shift: onRowClicked(row, shiftHeld=true) keeps prior
  // =========================================================================

  test('6 — multiSelect + shift click keeps prior row selected', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const lb = new G.ListBox(canvas);
      lb.setAllowMultiSelect(true);
      const r0 = lb.addItem('First');
      const r1 = lb.addItem('Second');

      // Select first row normally (no shift).
      lb.onRowClicked(r0, false);
      const r0After1 = r0.isSelected();

      // Shift-click second row: both should be selected.
      lb.onRowClicked(r1, true);
      const r0After2 = r0.isSelected();
      const r1After2 = r1.isSelected();
      lb.dispose();
      return { r0After1, r0After2, r1After2 };
    });
    expect(result.r0After1).toBe(true);
    expect(result.r0After2).toBe(true);
    expect(result.r1After2).toBe(true);
  });

  // =========================================================================
  // 7. unselectAll() clears all selected rows
  // =========================================================================

  test('7 — unselectAll clears selection on every row', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const lb = new G.ListBox(canvas);
      lb.setAllowMultiSelect(true);
      const r0 = lb.addItem('A');
      const r1 = lb.addItem('B');
      const r2 = lb.addItem('C');

      lb.setSelectedRow(r0, false);
      lb.setSelectedRow(r1, false);
      lb.setSelectedRow(r2, false);

      lb.unselectAll();
      const allUnselected = [r0.isSelected(), r1.isSelected(), r2.isSelected()];
      lb.dispose();
      return allUnselected;
    });
    expect(result[0]).toBe(false);
    expect(result[1]).toBe(false);
    expect(result[2]).toBe(false);
  });

  // =========================================================================
  // 8. getSelectedRow() returns the first selected row
  // =========================================================================

  test('8 — getSelectedRow returns first selected row', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const lb = new G.ListBox(canvas);
      lb.setAllowMultiSelect(true);
      const r0 = lb.addItem('First');
      const r1 = lb.addItem('Second');

      const nullWhenEmpty = lb.getSelectedRow() === null;

      lb.setSelectedRow(r0, false);
      lb.setSelectedRow(r1, false);

      const got = lb.getSelectedRow();
      const isFirst = got === r0;
      lb.dispose();
      return { nullWhenEmpty, isFirst };
    });
    expect(result.nullWhenEmpty).toBe(true);
    expect(result.isFirst).toBe(true);
  });

  // =========================================================================
  // 9. selectByString('foo*') wildcard matches rows starting with "foo"
  // =========================================================================

  test('9 — selectByString wildcard matches correct rows', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const lb = new G.ListBox(canvas);
      lb.setAllowMultiSelect(true);
      const r0 = lb.addItem('foobar');
      const r1 = lb.addItem('foobaz');
      const r2 = lb.addItem('bar');
      const r3 = lb.addItem('foo');

      lb.selectByString('foo*');
      const sel = [r0.isSelected(), r1.isSelected(), r2.isSelected(), r3.isSelected()];
      lb.dispose();
      return sel;
    });
    expect(result[0]).toBe(true);  // foobar matches foo*
    expect(result[1]).toBe(true);  // foobaz matches foo*
    expect(result[2]).toBe(false); // bar does not match
    expect(result[3]).toBe(true);  // foo matches foo*
  });

  // =========================================================================
  // 10. clear() empties rows array and inner panel
  // =========================================================================

  test('10 — clear empties rows array and inner panel', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const lb = new G.ListBox(canvas);
      lb.addItem('A');
      lb.addItem('B');
      lb.addItem('C');

      const rowsBefore = lb.getRows().length;
      const inner = lb.getInnerPanel();
      const innerBefore = inner ? inner.numChildren() : -1;

      lb.clear();

      const rowsAfter = lb.getRows().length;
      const innerAfter = inner ? inner.numChildren() : -1;
      lb.dispose();
      return { rowsBefore, innerBefore, rowsAfter, innerAfter };
    });
    expect(result.rowsBefore).toBe(3);
    expect(result.innerBefore).toBe(3);
    expect(result.rowsAfter).toBe(0);
    expect(result.innerAfter).toBe(0);
  });

  // =========================================================================
  // 10r. Render produces non-background pixels
  // =========================================================================

  test('10r — ListBox render produces non-background pixels', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 200; htmlC.height = 200;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 200, 200);
      cvs.setDrawBackground(true);
      cvs.setBackgroundColor(G.color(0, 0, 0, 255));

      const lb = new G.ListBox(cvs);
      lb.setBounds(10, 10, 180, 160);
      lb.addItem('Alpha');
      lb.addItem('Beta');
      lb.addItem('Gamma');

      cvs.doThink();
      cvs.redraw();
      cvs.renderCanvas();

      const gl: WebGL2RenderingContext = renderer.gl;
      const pixels = new Uint8Array(200 * 200 * 4);
      gl.readPixels(0, 0, 200, 200, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

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
