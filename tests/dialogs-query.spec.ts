// T502-T505 — Dialogs.query
//
// Categories covered:
//   1  Render        — #1 returned WindowControl is a WindowControl instance
//   2  Visual base   — Skipped: no pixel checks; API-surface focus only
//   3  State visuals — N/A: modal dialog visual states tested in T310/T305
//   4  Pointer input — #3 Yes button click via canvas input fires onYes handler;
//                     #4 Cancel button click fires onCancel handler
//   5  Touch input   — N/A: touch → same code path as pointer for buttons
//   6  Keyboard      — N/A: query dialog has no direct keyboard handling
//   7  Events        — #3 onYes fires once; #4 onCancel fires once; guard
//                     flag prevents double-fire
//   8  Resize        — N/A: WindowControl resize handled in T305
//
// NOTE: fileOpen / fileSave / folderOpen are NOT tested because they require
// an <input type="file"> click which Playwright cannot drive in headless mode.

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T502 Dialogs.query', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Dialogs.query returns a WindowControl
  // =========================================================================

  test('1 — Dialogs.query(canvas, text, onYes) returns a WindowControl instance', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        let y = 0;
        const win = G.Dialogs.query(canvas, 'Continue?', () => { y++; });
        const isWindow = win instanceof G.WindowControl;
        win.destroyModal();
        win.dispose();
        return { threw: false, isWindow };
      } catch {
        return { threw: true, isWindow: false };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.isWindow).toBe(true);
  });

  // =========================================================================
  // 2. The returned WindowControl has a Label child with the query text
  // =========================================================================

  test('2 — returned WindowControl has a Label child whose text matches the query string', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const queryText = 'Are you sure?';
      const win = G.Dialogs.query(canvas, queryText, () => {});

      // Walk direct children to find a Label.
      const children: any[] = Array.from(win.children ?? []);
      let labelText: string | null = null;
      for (const child of children) {
        if (child instanceof G.Label) {
          labelText = child.getText();
          break;
        }
      }

      win.destroyModal();
      win.dispose();
      return { labelText };
    });
    expect(result.labelText).toBe('Are you sure?');
  });

  // =========================================================================
  // 3. Clicking the Yes button invokes the onYes handler (2-button variant)
  // =========================================================================

  test('3 — clicking Yes button invokes onYes handler in Yes/No 2-button variant', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      let yCount = 0;
      let nCount = 0;
      const win = G.Dialogs.query(
        canvas,
        'Proceed?',
        () => { yCount++; },
        () => { nCount++; },
      );

      // Drive layout so button bounds are set.
      canvas.doThink();

      // Find the "Yes" Button among window's children.
      const children: any[] = Array.from(win.children ?? []);
      let yesBtn: any = null;
      for (const child of children) {
        if (child instanceof G.Button && child.getText() === 'Yes') {
          yesBtn = child;
          break;
        }
      }

      if (yesBtn) {
        // localPosToCanvas converts a local-space point to absolute canvas
        // coordinates, accounting for the modal reparenting that query() does.
        const local = { x: Math.floor(yesBtn.getBounds().w / 2), y: Math.floor(yesBtn.getBounds().h / 2) };
        const canvasPos = yesBtn.localPosToCanvas(local);
        canvas.inputMouseMoved(canvasPos.x, canvasPos.y, 0, 0);
        canvas.inputMouseButton(0, true);
        canvas.inputMouseButton(0, false);
      }

      return { yCount, nCount, foundYes: yesBtn !== null };
    });
    expect(result.foundYes).toBe(true);
    expect(result.yCount).toBe(1);
    expect(result.nCount).toBe(0);
  });

  // =========================================================================
  // 4. Clicking Cancel invokes onCancel handler (3-button variant)
  // =========================================================================

  test('4 — clicking Cancel button invokes onCancel in Yes/No/Cancel 3-button variant', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      let yCount = 0;
      let nCount = 0;
      let cCount = 0;
      const win = G.Dialogs.query(
        canvas,
        'Delete item?',
        () => { yCount++; },
        () => { nCount++; },
        () => { cCount++; },
      );

      canvas.doThink();

      // Find "Cancel" Button among window's children.
      const children: any[] = Array.from(win.children ?? []);
      let cancelBtn: any = null;
      for (const child of children) {
        if (child instanceof G.Button && child.getText() === 'Cancel') {
          cancelBtn = child;
          break;
        }
      }

      if (cancelBtn) {
        const local = { x: Math.floor(cancelBtn.getBounds().w / 2), y: Math.floor(cancelBtn.getBounds().h / 2) };
        const canvasPos = cancelBtn.localPosToCanvas(local);
        canvas.inputMouseMoved(canvasPos.x, canvasPos.y, 0, 0);
        canvas.inputMouseButton(0, true);
        canvas.inputMouseButton(0, false);
      }

      return { yCount, nCount, cCount, foundCancel: cancelBtn !== null };
    });
    expect(result.foundCancel).toBe(true);
    expect(result.cCount).toBe(1);
    expect(result.yCount).toBe(0);
    expect(result.nCount).toBe(0);
  });
});
