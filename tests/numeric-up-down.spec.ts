// T108 — NumericUpDown
//
// Categories covered:
//   1  Render          — #10 pixel read: textbox + buttons produce pixels
//   2  Visual baseline — Skipped: GPU/font/skin variance across CI machines
//   3  State visuals   — Skipped: button depressed state requires pointer routing
//   4  Pointer input   — #6–#7 simulate button onPress via event emission
//   5  Touch input     — Skipped: button press tested via event routing (not touch)
//   6  Keyboard        — #8 arrow up/down keys adjust value ±1
//   7  Events          — #3 onChange fires on setIntValue; #5 no fire when value unchanged
//   8  Resize          — N/A: fixed layout with docked buttons
//
// Notes on button access:
//   _upButton and _downButton are declared as `protected` on NumericUpDown.
//   In JS at runtime, protected is not enforced, so direct access works.
//   We use `upDown._upButton.onPress.emit(eventInfo())` to trigger the action
//   without going through the full input router.

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T108 NumericUpDown', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction — default min=0, max=100, value=0, text "0"
  // =========================================================================

  test('1 — new NumericUpDown(canvas): min=0, max=100, value=0, text="0"', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const ud = new G.NumericUpDown(canvas);
        const minV = ud.getMin();
        const maxV = ud.getMax();
        const val  = ud.getIntValue();
        const text = ud.getText();
        ud.dispose();
        return { threw: false, minV, maxV, val, text };
      } catch {
        return { threw: true, minV: -1, maxV: -1, val: -1, text: '' };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.minV).toBe(0);
    expect(result.maxV).toBe(100);
    expect(result.val).toBe(0);
    expect(result.text).toBe('0');
  });

  // =========================================================================
  // 2. setMin / setMax
  // =========================================================================

  test('2 — setMin(-10) setMax(20): getMin()===-10; getMax()===20', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const ud = new G.NumericUpDown(canvas);
      ud.setMin(-10);
      ud.setMax(20);
      const minV = ud.getMin();
      const maxV = ud.getMax();
      ud.dispose();
      return { minV, maxV };
    });
    expect(result.minV).toBe(-10);
    expect(result.maxV).toBe(20);
  });

  // =========================================================================
  // 3. setIntValue(5) — getIntValue()===5; text "5"; fires onChange
  // =========================================================================

  test('3 — setIntValue(5): getIntValue()===5; text==="5"; onChange fires once', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const ud = new G.NumericUpDown(canvas);

      let changeCount = 0;
      let callerOk = false;
      ud.onChange.on((ev: any) => {
        changeCount++;
        callerOk = ev.controlCaller === ud;
      });

      ud.setIntValue(5);
      const val  = ud.getIntValue();
      const text = ud.getText();
      ud.dispose();
      return { val, text, changeCount, callerOk };
    });
    expect(result.val).toBe(5);
    expect(result.text).toBe('5');
    expect(result.changeCount).toBe(1);
    expect(result.callerOk).toBe(true);
  });

  // =========================================================================
  // 4. Clamping — setIntValue beyond bounds clamps to min/max
  // =========================================================================

  test('4 — setIntValue(-100) clamps to min(0); setIntValue(500) clamps to max(100)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const ud = new G.NumericUpDown(canvas);

      ud.setIntValue(-100);
      const valAfterMin = ud.getIntValue();
      const textAfterMin = ud.getText();

      ud.setIntValue(500);
      const valAfterMax = ud.getIntValue();
      const textAfterMax = ud.getText();

      ud.dispose();
      return { valAfterMin, textAfterMin, valAfterMax, textAfterMax };
    });
    expect(result.valAfterMin).toBe(0);
    expect(result.textAfterMin).toBe('0');
    expect(result.valAfterMax).toBe(100);
    expect(result.textAfterMax).toBe('100');
  });

  // =========================================================================
  // 5. setIntValue(same) — no onChange fired
  // =========================================================================

  test('5 — setIntValue(same value): onChange does NOT fire', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const ud = new G.NumericUpDown(canvas);

      ud.setIntValue(10); // set to 10; fires once

      let changeCount = 0;
      ud.onChange.on(() => { changeCount++; });

      ud.setIntValue(10); // same value; should NOT fire

      ud.dispose();
      return changeCount;
    });
    expect(result).toBe(0);
  });

  // =========================================================================
  // 6. Up button press: value increases by 1
  // =========================================================================

  test('6 — up button onPress: value increases by 1; onChange fires', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const ud = new G.NumericUpDown(canvas);
      ud.setIntValue(5);

      let changeCount = 0;
      ud.onChange.on(() => { changeCount++; });

      // Trigger the up button's onPress signal directly
      const info = G.eventInfo();
      info.controlCaller = ud._upButton;
      ud._upButton.onPress.emit(info);

      const val = ud.getIntValue();
      ud.dispose();
      return { val, changeCount };
    });
    expect(result.val).toBe(6);
    expect(result.changeCount).toBe(1);
  });

  // =========================================================================
  // 7. Down button press: value decreases by 1
  // =========================================================================

  test('7 — down button onPress: value decreases by 1; onChange fires', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const ud = new G.NumericUpDown(canvas);
      ud.setIntValue(5);

      let changeCount = 0;
      ud.onChange.on(() => { changeCount++; });

      const info = G.eventInfo();
      info.controlCaller = ud._downButton;
      ud._downButton.onPress.emit(info);

      const val = ud.getIntValue();
      ud.dispose();
      return { val, changeCount };
    });
    expect(result.val).toBe(4);
    expect(result.changeCount).toBe(1);
  });

  // =========================================================================
  // 8. Arrow up/down keys: value ±1
  // =========================================================================

  test('8 — onKeyUp(true): value +1; onKeyDown(true): value -1', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const ud = new G.NumericUpDown(canvas);
      ud.setIntValue(10);

      let changeCount = 0;
      ud.onChange.on(() => { changeCount++; });

      ud.onKeyUp(true);
      const valAfterUp = ud.getIntValue();

      ud.onKeyDown(true);
      ud.onKeyDown(true);
      const valAfterTwoDown = ud.getIntValue();

      ud.dispose();
      return { valAfterUp, valAfterTwoDown, changeCount };
    });
    expect(result.valAfterUp).toBe(11);
    expect(result.valAfterTwoDown).toBe(9);
    expect(result.changeCount).toBe(3);
  });

  // =========================================================================
  // 9. Typing a valid number via onChar updates _value via syncFromText
  // =========================================================================

  test('9 — typing valid number via onChar: _value syncs if in range', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const ud = new G.NumericUpDown(canvas);
      // Clear the text, type "7"
      ud.setText('');
      ud.setCursorPos(0);
      ud.setCursorEnd(0);

      let changeCount = 0;
      ud.onChange.on(() => { changeCount++; });

      ud.onChar('7'); // triggers insertText → setText → onTextChange → syncFromText
      const val  = ud.getIntValue();
      const text = ud.getText();
      ud.dispose();
      return { val, text, changeCount };
    });
    expect(result.text).toBe('7');
    expect(result.val).toBe(7);
    expect(result.changeCount).toBeGreaterThanOrEqual(1);
  });

  // =========================================================================
  // 10. Render: produces pixels (textbox + two buttons visible)
  // =========================================================================

  test('10 — render: NumericUpDown produces non-background pixels', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 120; htmlC.height = 40;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 120, 40);
      cvs.setDrawBackground(true);
      cvs.setBackgroundColor(G.color(0, 0, 0, 255));

      const ud = new G.NumericUpDown(cvs);
      ud.setBounds(10, 10, 100, 20);

      cvs.doThink();
      cvs.redraw();
      cvs.renderCanvas();

      const gl: WebGL2RenderingContext = renderer.gl;
      const W = 100; const H = 20;
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
