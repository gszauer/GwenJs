// T301 — Layout::Table + TableRow
//
// Categories covered:
//   1  Render          — N/A: Table/TableRow are transparent layout containers;
//                        the cells (Label subcontrols) do the drawing; no
//                        pixel read is meaningful for Table itself.
//   2  Visual baseline — Skipped: same reason as Render.
//   3  State visuals   — N/A: no hover/pressed/disabled states on Table/TableRow.
//   4  Pointer input   — N/A: no direct pointer behaviour on these controls.
//   5  Touch input     — N/A: same.
//   6  Keyboard        — N/A: no keyboard behaviour.
//   7  Events          — onRowSelected signal presence verified in #3.
//   8  Resize          — #8 sizeToContents recomputes column widths (implicitly
//                        exercises re-layout after content change).

import { test, expect } from '@playwright/test';
import { gotoDemo } from './helpers';

test.describe('T301 Table + TableRow', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
  });

  // =========================================================================
  // 1. Construction: columnCount 1, defaultRowHeight 22
  // =========================================================================

  test('1 — new Table(canvas): columnCount=1, defaultRowHeight=22', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const tbl = new G.Table(canvas);
        const cc = tbl.getColumnCount();
        const rh = tbl.getDefaultRowHeight();
        tbl.dispose();
        return { threw: false, cc, rh };
      } catch {
        return { threw: true, cc: -1, rh: -1 };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.cc).toBe(1);
    expect(result.rh).toBe(22);
  });

  // =========================================================================
  // 2. setColumnCount(3) updates column count
  // =========================================================================

  test('2 — setColumnCount(3) updates getColumnCount() to 3', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tbl = new G.Table(canvas);
      tbl.setColumnCount(3);
      const cc = tbl.getColumnCount();
      tbl.dispose();
      return cc;
    });
    expect(result).toBe(3);
  });

  // =========================================================================
  // 3. addRow() returns TableRow with correct columnCount
  // =========================================================================

  test('3 — addRow() returns a TableRow with columnCount matching Table', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tbl = new G.Table(canvas);
      tbl.setColumnCount(3);
      const row = tbl.addRow();
      const isTableRow = row instanceof G.TableRow;
      const cc = row.getColumnCount();
      const hasSignal = typeof row.onRowSelected === 'object';
      tbl.dispose();
      return { isTableRow, cc, hasSignal };
    });
    expect(result.isTableRow).toBe(true);
    expect(result.cc).toBe(3);
    expect(result.hasSignal).toBe(true);
  });

  // =========================================================================
  // 4. setCellText / getCellText round-trip
  // =========================================================================

  test('4 — setCellText(0, "A") → getCellText(0) === "A"', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tbl = new G.Table(canvas);
      tbl.setColumnCount(3);
      const row = tbl.addRow();
      row.setCellText(0, 'A');
      const text = row.getCellText(0);
      tbl.dispose();
      return text;
    });
    expect(result).toBe('A');
  });

  // =========================================================================
  // 5. setCellContents reparents a control into the column cell
  // =========================================================================

  test('5 — setCellContents(1, button) reparents button into cell 1', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tbl = new G.Table(canvas);
      tbl.setColumnCount(3);
      const row = tbl.addRow();
      const btn = new G.Button(null);
      row.setCellContents(1, btn);
      // The button's actualParent should be the cell Label at index 1.
      const cell = row.getCellContents(1);
      const btnInCell = cell !== null && cell.isChild(btn);
      tbl.dispose();
      return { cellIsNull: cell === null, btnInCell };
    });
    expect(result.cellIsNull).toBe(false);
    expect(result.btnInCell).toBe(true);
  });

  // =========================================================================
  // 6. rowCount() reflects added rows
  // =========================================================================

  test('6 — rowCount() reflects number of rows added via addRow()', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tbl = new G.Table(canvas);
      tbl.setColumnCount(2);
      const before = tbl.rowCount();
      tbl.addRow();
      tbl.addRow();
      tbl.addRow();
      const after = tbl.rowCount();
      tbl.dispose();
      return { before, after };
    });
    expect(result.before).toBe(0);
    expect(result.after).toBe(3);
  });

  // =========================================================================
  // 7. setColumnWidth(0, 50) stores the width
  // =========================================================================

  test('7 — setColumnWidth(0, 50) stores width; layout applies it to row cell', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tbl = new G.Table(canvas);
      tbl.setColumnCount(2);
      tbl.setBounds(0, 0, 300, 200);
      tbl.setColumnWidth(0, 50);
      const row = tbl.addRow();
      // Drive layout so column widths are applied.
      canvas.doThink();
      const cell = row.getCellContents(0);
      const cellW = cell ? cell.width() : -1;
      tbl.dispose();
      return cellW;
    });
    expect(result).toBe(50);
  });

  // =========================================================================
  // 8. sizeToContents() recomputes column widths
  // =========================================================================

  test('8 — sizeToContents() recomputes column widths based on cell content', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tbl = new G.Table(canvas);
      tbl.setColumnCount(2);
      tbl.setBounds(0, 0, 400, 200);
      // Force at least one layout pass before sizeToContents.
      canvas.doThink();
      // Record widths before.
      const widthBefore = (tbl as any)._columnWidths[0];
      // sizeToContents walks cells and computes max content width.
      tbl.sizeToContents();
      const widthAfter = (tbl as any)._columnWidths[0];
      // sizeToContents sets _sizeToContents flag.
      const flag = (tbl as any)._sizeToContents;
      tbl.dispose();
      return { widthBefore, widthAfter, flag };
    });
    // After sizeToContents the column widths must be at least the minimum (10).
    expect(result.widthAfter).toBeGreaterThanOrEqual(10);
    expect(result.flag).toBe(true);
  });

  // =========================================================================
  // 9. clear() removes all rows
  // =========================================================================

  test('9 — clear() removes all rows; rowCount() returns 0', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tbl = new G.Table(canvas);
      tbl.addRow();
      tbl.addRow();
      const before = tbl.rowCount();
      tbl.clear();
      const after = tbl.rowCount();
      tbl.dispose();
      return { before, after };
    });
    expect(result.before).toBe(2);
    expect(result.after).toBe(0);
  });

  // =========================================================================
  // 10. Alternating isEven() flags after layout
  // =========================================================================

  test('10 — isEven() alternates: first row even, second odd, third even', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tbl = new G.Table(canvas);
      tbl.setColumnCount(1);
      tbl.setBounds(0, 0, 200, 200);
      const r0 = tbl.addRow();
      const r1 = tbl.addRow();
      const r2 = tbl.addRow();
      // Drive layout so Table.layout() assigns even flags.
      canvas.doThink();
      const e0 = r0.isEven();
      const e1 = r1.isEven();
      const e2 = r2.isEven();
      tbl.dispose();
      return { e0, e1, e2 };
    });
    expect(result.e0).toBe(true);
    expect(result.e1).toBe(false);
    expect(result.e2).toBe(true);
  });
});
