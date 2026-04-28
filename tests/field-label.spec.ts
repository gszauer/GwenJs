// T116 — FieldLabel
//
// Categories covered:
//   1  Render          — N/A: FieldLabel inherits Label rendering; no new draw logic
//   2  Visual baseline — Skipped: font/skin variance
//   3  State visuals   — N/A: FieldLabel has no interactive states
//   4  Pointer input   — N/A: FieldLabel disables mouse input (Label default)
//   5  Touch input     — N/A: same
//   6  Keyboard        — N/A
//   7  Events          — N/A: FieldLabel exposes no signals
//   8  Resize          — N/A: explicit layout tested via #4 width check

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T116 FieldLabel', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction + default alignment
  // =========================================================================

  test('1 — new FieldLabel(canvas): default alignment Pos.CenterV | Pos.Left', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const fl = new G.FieldLabel(canvas);
        const align = fl.getAlignment();
        fl.dispose();
        return {
          threw: false,
          align,
          expected: G.Pos.CenterV | G.Pos.Left,
        };
      } catch {
        return { threw: true, align: 0, expected: 0 };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.align).toBe(result.expected);
  });

  // =========================================================================
  // 2. setField: field becomes child docked Right
  // =========================================================================

  test('2 — setField(inputBase): field parent becomes FieldLabel; docked Right', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const fl = new G.FieldLabel(canvas);
      const field = new G.Base(null);
      fl.setField(field);
      const parentOk = field.parent === fl;
      const dockOk = field.getDock() === G.Pos.Right;
      fl.dispose();
      return { parentOk, dockOk };
    });
    expect(result.parentOk).toBe(true);
    expect(result.dockOk).toBe(true);
  });

  // =========================================================================
  // 3. getField returns the set field
  // =========================================================================

  test('3 — getField() returns the control passed to setField()', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const fl = new G.FieldLabel(canvas);
      const field = new G.Base(null);
      fl.setField(field);
      const got = fl.getField() === field;
      fl.dispose();
      return got;
    });
    expect(result).toBe(true);
  });

  // =========================================================================
  // 4. Layout: field.width == parent.width - 70 (default offset)
  // =========================================================================

  test('4 — after layout with width=200, field.width === 200 - 70 === 130', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const fl = new G.FieldLabel(canvas);
      fl.setBounds(0, 0, 200, 30);
      const field = new G.Base(null);
      fl.setField(field);
      canvas.doThink(); // triggers layout
      const fieldW = field.getBounds().w;
      fl.dispose();
      return fieldW;
    });
    expect(result).toBe(130);
  });

  // =========================================================================
  // 5. FieldLabel.setup factory wraps an existing control
  // =========================================================================

  test('5 — FieldLabel.setup(control, text) returns FieldLabel with text and field set', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      // setup requires control to have a parent.
      const parentBase = new G.Base(canvas);
      parentBase.setBounds(0, 0, 300, 30);

      const control = new G.Base(parentBase);
      control.setBounds(0, 0, 300, 30);
      control.dock(G.Pos.None);

      const fl = G.FieldLabel.setup(control, 'Name:');
      const text = fl.getText();
      const fieldOk = fl.getField() === control;
      const isFL = fl instanceof G.FieldLabel;

      fl.dispose();
      parentBase.dispose();
      return { text, fieldOk, isFL };
    });
    expect(result.text).toBe('Name:');
    expect(result.fieldOk).toBe(true);
    expect(result.isFL).toBe(true);
  });
});
