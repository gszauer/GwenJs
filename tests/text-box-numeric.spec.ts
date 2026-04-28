// T105 — TextBoxNumeric
//
// Categories covered:
//   1  Render          — #10 pixel read: control produces non-background pixels
//   2  Visual baseline — Skipped: GPU/font/skin variance across CI machines
//   3  State visuals   — Skipped: inherits from TextBox; no extra visual states
//   4  Pointer input   — Skipped: inherits from TextBox (tested in text-box.spec.ts)
//   5  Touch input     — Skipped: inherits from TextBox
//   6  Keyboard        — covered by onChar filter tests (#2–#5, #8)
//   7  Events          — inherits TextBox onTextChange; filter prevents events
//   8  Resize          — N/A: fixed-size control

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T105 TextBoxNumeric', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction — default text "0"
  // =========================================================================

  test('1 — new TextBoxNumeric(canvas): constructs successfully; default text is "0"', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const tb = new G.TextBoxNumeric(canvas);
        const text = tb.getText();
        const editable = tb.isEditable();
        tb.dispose();
        return { threw: false, text, editable };
      } catch {
        return { threw: true, text: '', editable: false };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.text).toBe('0');
    expect(result.editable).toBe(true);
  });

  // =========================================================================
  // 2. onChar('5') is accepted; text grows
  // =========================================================================

  test('2 — onChar("5") accepted; cursor moves forward (text includes "5")', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tb = new G.TextBoxNumeric(canvas);
      // Default text is "0", cursor at 0; type "5" at pos 0 → "50"
      tb.setCursorPos(0);
      tb.setCursorEnd(0);
      const ret = tb.onChar('5');
      const text = tb.getText();
      const pos = tb.getCursorPos();
      tb.dispose();
      return { ret, text, pos };
    });
    expect(result.ret).toBe(true);
    expect(result.text).toContain('5');
    expect(result.pos).toBeGreaterThan(0);
  });

  // =========================================================================
  // 3. onChar('a') rejected; text unchanged
  // =========================================================================

  test('3 — onChar("a") rejected; text unchanged', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tb = new G.TextBoxNumeric(canvas);
      tb.setText('42');
      tb.setCursorPos(2);
      tb.setCursorEnd(2);
      const ret = tb.onChar('a');
      const text = tb.getText();
      tb.dispose();
      return { ret, text };
    });
    expect(result.ret).toBe(false);
    expect(result.text).toBe('42');
  });

  // =========================================================================
  // 4. onChar('.') accepted once; second '.' rejected
  // =========================================================================

  test('4 — onChar("."): first accepted; second rejected', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tb = new G.TextBoxNumeric(canvas);
      tb.setText('3');
      tb.setCursorPos(1);
      tb.setCursorEnd(1);

      const ret1 = tb.onChar('.');
      const textAfterFirst = tb.getText();

      const ret2 = tb.onChar('.');
      const textAfterSecond = tb.getText();

      tb.dispose();
      return { ret1, textAfterFirst, ret2, textAfterSecond };
    });
    expect(result.ret1).toBe(true);
    expect(result.textAfterFirst).toBe('3.');
    expect(result.ret2).toBe(false);
    expect(result.textAfterSecond).toBe('3.'); // unchanged
  });

  // =========================================================================
  // 5. onChar('-') accepted at pos 0 only, once
  // =========================================================================

  test('5 — onChar("-"): accepted at pos 0; second minus rejected; minus not at pos 0 rejected', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tb = new G.TextBoxNumeric(canvas);

      // Start fresh with empty text so we can test pos 0 acceptance cleanly
      tb.setText('');
      tb.setCursorPos(0);
      tb.setCursorEnd(0);
      const ret1 = tb.onChar('-');
      const textAfterFirst = tb.getText();

      // Second minus rejected (already has '-')
      const ret2 = tb.onChar('-');
      const textAfterSecond = tb.getText();

      // New box: minus at pos > 0 rejected
      const tb2 = new G.TextBoxNumeric(canvas);
      tb2.setText('5');
      tb2.setCursorPos(1); // pos 1, not 0
      tb2.setCursorEnd(1);
      const ret3 = tb2.onChar('-');
      const textAfterMidInsert = tb2.getText();

      tb.dispose();
      tb2.dispose();
      return { ret1, textAfterFirst, ret2, textAfterSecond, ret3, textAfterMidInsert };
    });
    expect(result.ret1).toBe(true);
    expect(result.textAfterFirst).toBe('-');
    expect(result.ret2).toBe(false);
    expect(result.textAfterSecond).toBe('-');
    expect(result.ret3).toBe(false);
    expect(result.textAfterMidInsert).toBe('5');
  });

  // =========================================================================
  // 6. getFloatFromText() on "3.14" returns 3.14
  // =========================================================================

  test('6 — getFloatFromText() on "3.14" returns 3.14', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tb = new G.TextBoxNumeric(canvas);
      // Bypass filter to force text to "3.14"
      tb.setText('3.14');
      const val = tb.getFloatFromText();
      tb.dispose();
      return val;
    });
    expect(result).toBeCloseTo(3.14, 10);
  });

  // =========================================================================
  // 7. getFloatFromText() on empty string returns 0
  // =========================================================================

  test('7 — getFloatFromText() on empty string returns 0', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tb = new G.TextBoxNumeric(canvas);
      tb.setText('');
      const val = tb.getFloatFromText();
      tb.dispose();
      return val;
    });
    expect(result).toBe(0);
  });

  // =========================================================================
  // 8. insertText('abc') rejected; insertText('42') accepted
  // =========================================================================

  test('8 — insertText("abc") rejected; insertText("42") accepted', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const tb1 = new G.TextBoxNumeric(canvas);
      tb1.setText('1');
      tb1.setCursorPos(1);
      tb1.setCursorEnd(1);
      tb1.insertText('abc');
      const textAfterBad = tb1.getText();
      tb1.dispose();

      const tb2 = new G.TextBoxNumeric(canvas);
      tb2.setText('1');
      tb2.setCursorPos(1);
      tb2.setCursorEnd(1);
      tb2.insertText('42');
      const textAfterGood = tb2.getText();
      tb2.dispose();

      return { textAfterBad, textAfterGood };
    });
    expect(result.textAfterBad).toBe('1');   // unchanged
    expect(result.textAfterGood).toBe('142');
  });

  // =========================================================================
  // 9. getFloatFromText() on lone '-' returns 0
  // =========================================================================

  test('9 — getFloatFromText() on lone "-" or "." returns 0', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tb = new G.TextBoxNumeric(canvas);

      tb.setText('-');
      const fromMinus = tb.getFloatFromText();

      tb.setText('.');
      const fromDot = tb.getFloatFromText();

      tb.dispose();
      return { fromMinus, fromDot };
    });
    expect(result.fromMinus).toBe(0);
    expect(result.fromDot).toBe(0);
  });

  // =========================================================================
  // 10. Render produces pixels
  // =========================================================================

  test('10 — render: TextBoxNumeric produces non-background pixels', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 220; htmlC.height = 40;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 220, 40);
      cvs.setDrawBackground(true);
      cvs.setBackgroundColor(G.color(0, 0, 0, 255));

      const tb = new G.TextBoxNumeric(cvs);
      tb.setBounds(10, 10, 200, 20);

      cvs.doThink();
      cvs.redraw();
      cvs.renderCanvas();

      const gl: WebGL2RenderingContext = renderer.gl;
      const W = 200; const H = 20;
      const glY = htmlC.height - (10 + H);
      const pixels = new Uint8Array(W * H * 4);
      gl.readPixels(10, glY, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

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
