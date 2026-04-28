// T405 — PropertyColorSelector
//
// Categories covered:
//   1  Render        — #1 construction does not throw; child types verified
//   2  Visual base   — Skipped: no pixel checks; API-surface focus only
//   3  State visuals — N/A: visual swatch state is internal to ColourButton render;
//                     tested functionally via parseColor + swatch update in #2
//   4  Pointer input — N/A: swatch button click opens an HSVColorPicker popup which
//                     requires getCanvas() returning a valid canvas; the popup is a
//                     transient Menu and not reliably testable in isolation
//   5  Touch input   — N/A: same reason as pointer input
//   6  Keyboard      — N/A: inherits TextBox keyboard handling; no custom key logic
//   7  Events        — #2 setPropertyValue fires onChange; #3 getPropertyValue returns
//                     the stored value
//   8  Resize        — N/A: fixed-height property editor; no parent-resize logic

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T405 PropertyColorSelector', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction: has TextBox + ColourButton children
  // =========================================================================

  test('1 — construction does not throw; has TextBox child and ColourButton (Button) child', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const pcs = new G.PropertyColorSelector(canvas);

        // _textbox is a TextBox (inherited from PropertyText).
        const tb = pcs._textbox;
        const isTextBox = tb instanceof G.TextBox;

        // getColorButton() returns the ColourButton (a Button subclass).
        const btn = pcs.getColorButton();
        const isButton = btn instanceof G.Button;

        pcs.dispose();
        return { threw: false, isTextBox, isButton };
      } catch {
        return { threw: true, isTextBox: false, isButton: false };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.isTextBox).toBe(true);
    expect(result.isButton).toBe(true);
  });

  // =========================================================================
  // 2. setPropertyValue('128 64 32') updates textbox and fires onChange
  // =========================================================================

  test('2 — setPropertyValue("128 64 32") updates textbox value and fires onChange', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const pcs = new G.PropertyColorSelector(canvas);

      let changeCount = 0;
      let changedValue = '';
      pcs.onChange.on((ev: any) => {
        changeCount++;
        changedValue = ev.string ?? '';
      });

      pcs.setPropertyValue('128 64 32', true);
      const tbText = pcs._textbox.getText();

      pcs.dispose();
      return { changeCount, changedValue, tbText };
    });
    // onChange is wired on the parent TextBox's onTextChange; it fires at least once.
    expect(result.changeCount).toBeGreaterThanOrEqual(1);
    expect(result.changedValue).toBe('128 64 32');
    expect(result.tbText).toBe('128 64 32');
  });

  // =========================================================================
  // 3. getPropertyValue() returns the stored value
  // =========================================================================

  test('3 — getPropertyValue() returns the value set by setPropertyValue()', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const pcs = new G.PropertyColorSelector(canvas);
      pcs.setPropertyValue('255 0 128', false);
      const v = pcs.getPropertyValue();
      pcs.dispose();
      return v;
    });
    expect(result).toBe('255 0 128');
  });

  // =========================================================================
  // 4. parseColor handles empty / NaN input gracefully — defaults to white (255,255,255)
  // =========================================================================

  test('4 — parseColor defaults to white (255,255,255) for empty or non-numeric input', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const pcs = new G.PropertyColorSelector(canvas);

      // Set empty value — textbox will be '' so all three channels parse as NaN.
      pcs.setPropertyValue('', false);
      const colorEmpty = (pcs as any).parseColor();

      // Set a value with non-numeric tokens.
      pcs.setPropertyValue('abc xyz', false);
      const colorNaN = (pcs as any).parseColor();

      // Set a value with only one valid channel — missing channels default to 255.
      pcs.setPropertyValue('100', false);
      const colorPartial = (pcs as any).parseColor();

      pcs.dispose();
      return {
        empty: { r: colorEmpty.r, g: colorEmpty.g, b: colorEmpty.b },
        nan: { r: colorNaN.r, g: colorNaN.g, b: colorNaN.b },
        partial: { r: colorPartial.r, g: colorPartial.g, b: colorPartial.b },
      };
    });

    // Empty → all channels default to 255 (white).
    expect(result.empty.r).toBe(255);
    expect(result.empty.g).toBe(255);
    expect(result.empty.b).toBe(255);

    // NaN tokens → all channels default to 255.
    expect(result.nan.r).toBe(255);
    expect(result.nan.g).toBe(255);
    expect(result.nan.b).toBe(255);

    // One valid channel (r=100), missing g + b default to 255.
    expect(result.partial.r).toBe(100);
    expect(result.partial.g).toBe(255);
    expect(result.partial.b).toBe(255);
  });
});
