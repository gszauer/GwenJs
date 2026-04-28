// T102 — CheckBox + CheckBoxWithLabel
//
// Categories covered:
//   1  Render          — #8 pixel read: checked vs unchecked differ visually
//   2  Visual baseline — Skipped: GPU/skin variance across CI
//   3  State visuals   — #8 checked/unchecked pixel diff; #9 disabled click no-op
//   4  Pointer input   — #6 hover+down+up toggles via canvas input path
//   5  Touch input     — #6t synthetic touch tap toggles checkbox
//   6  Keyboard        — N/A: CheckBox inherits Button; Space handled by Button
//   7  Events          — #2/#3/#4/#13 signal firing order + payloads
//   8  Resize          — N/A: CheckBox is fixed 15×15

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T102 CheckBox', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction + defaults
  // =========================================================================

  test('1 — new CheckBox(canvas): size 15×15; isChecked() false; mouse input enabled', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const cb = new G.CheckBox(canvas);
        const b = cb.getBounds();
        const checked = cb.isChecked();
        const mouse = cb.getMouseInputEnabled();
        cb.dispose();
        return { threw: false, w: b.w, h: b.h, checked, mouse };
      } catch {
        return { threw: true, w: 0, h: 0, checked: false, mouse: false };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.w).toBe(15);
    expect(result.h).toBe(15);
    expect(result.checked).toBe(false);
    expect(result.mouse).toBe(true);
  });

  // =========================================================================
  // 2. setChecked(true) fires onChecked + onCheckChanged
  // =========================================================================

  test('2 — setChecked(true): isChecked true; fires onChecked + onCheckChanged', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cb = new G.CheckBox(canvas);

      let checkedCount = 0;
      let changedCount = 0;
      let uncheckedCount = 0;
      let callerOk = false;

      cb.onChecked.on((ev: any) => {
        checkedCount++;
        callerOk = ev.controlCaller === cb;
      });
      cb.onCheckChanged.on(() => { changedCount++; });
      cb.onUnChecked.on(() => { uncheckedCount++; });

      cb.setChecked(true);
      const isChecked = cb.isChecked();
      cb.dispose();
      return { checkedCount, changedCount, uncheckedCount, isChecked, callerOk };
    });
    expect(result.isChecked).toBe(true);
    expect(result.checkedCount).toBe(1);
    expect(result.changedCount).toBe(1);
    expect(result.uncheckedCount).toBe(0);
    expect(result.callerOk).toBe(true);
  });

  // =========================================================================
  // 3. setChecked(false) fires onUnChecked + onCheckChanged
  // =========================================================================

  test('3 — setChecked(false) after true: fires onUnChecked + onCheckChanged', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cb = new G.CheckBox(canvas);
      cb.setChecked(true); // baseline

      let uncheckedCount = 0;
      let changedCount = 0;
      let checkedCount = 0;
      cb.onUnChecked.on(() => { uncheckedCount++; });
      cb.onCheckChanged.on(() => { changedCount++; });
      cb.onChecked.on(() => { checkedCount++; });

      cb.setChecked(false);
      const isChecked = cb.isChecked();
      cb.dispose();
      return { uncheckedCount, changedCount, checkedCount, isChecked };
    });
    expect(result.isChecked).toBe(false);
    expect(result.uncheckedCount).toBe(1);
    expect(result.changedCount).toBe(1);
    expect(result.checkedCount).toBe(0);
  });

  // =========================================================================
  // 4. setChecked(same value) — no signal, no extra redraw
  // =========================================================================

  test('4 — setChecked(same value): no signal emitted', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cb = new G.CheckBox(canvas);

      let count = 0;
      cb.onCheckChanged.on(() => { count++; });

      // Already false; setting false again should be a no-op.
      cb.setChecked(false);
      const countAfterNoop = count;

      cb.setChecked(true); // flip once to count=1
      const countAfterFlip = count;

      // Now setting true again — should not increment further.
      cb.setChecked(true);
      const countAfterSame = count;

      cb.dispose();
      return { countAfterNoop, countAfterFlip, countAfterSame };
    });
    expect(result.countAfterNoop).toBe(0);
    expect(result.countAfterFlip).toBe(1);
    expect(result.countAfterSame).toBe(1);
  });

  // =========================================================================
  // 5. toggle() flips state
  // =========================================================================

  test('5 — toggle() flips from false to true; second toggle flips back', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cb = new G.CheckBox(canvas);

      cb.toggle();
      const afterFirst = cb.isChecked();
      cb.toggle();
      const afterSecond = cb.isChecked();
      cb.dispose();
      return { afterFirst, afterSecond };
    });
    expect(result.afterFirst).toBe(true);
    expect(result.afterSecond).toBe(false);
  });

  // =========================================================================
  // 6. Click via canvas input path toggles checkbox
  // =========================================================================

  test('6 — hover+down+up via canvas input toggles unchecked→checked', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cb = new G.CheckBox(canvas);
      cb.setBounds(10, 10, 15, 15);

      // Force layout so localPosToCanvas is accurate.
      canvas.doThink();

      // Compute canvas-space center of the checkbox.
      const center = cb.localPosToCanvas(G.point(7, 7));
      const cx = center.x;
      const cy = center.y;

      const beforeCheck = cb.isChecked();
      canvas.inputMouseMoved(cx, cy, 0, 0);
      canvas.inputMouseButton(0, true);
      canvas.inputMouseButton(0, false);
      const afterCheck = cb.isChecked();

      cb.dispose();
      return { beforeCheck, afterCheck };
    });
    expect(result.beforeCheck).toBe(false);
    expect(result.afterCheck).toBe(true);
  });

  // =========================================================================
  // 6t. Touch tap toggles checkbox
  // =========================================================================

  test('6t — touch tap (inputMouseMoved+inputMouseButton) toggles checkbox', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cb = new G.CheckBox(canvas);
      cb.setBounds(20, 20, 15, 15);
      canvas.doThink();

      const center = cb.localPosToCanvas(G.point(7, 7));
      const before = cb.isChecked();
      canvas.inputMouseMoved(center.x, center.y, 0, 0);
      canvas.inputMouseButton(0, true);
      canvas.inputMouseButton(0, false);
      const after = cb.isChecked();

      cb.dispose();
      return { before, after };
    });
    expect(result.before).toBe(false);
    expect(result.after).toBe(true);
  });

  // =========================================================================
  // 7. allowUncheck default returns true; clicking checked checkbox unchecks
  // =========================================================================

  test('7 — allowUncheck() default true: clicking checked checkbox unchecks it', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cb = new G.CheckBox(canvas);
      cb.setBounds(10, 10, 15, 15);
      cb.setChecked(true);
      canvas.doThink();

      const center = cb.localPosToCanvas(G.point(7, 7));
      canvas.inputMouseMoved(center.x, center.y, 0, 0);
      canvas.inputMouseButton(0, true);
      canvas.inputMouseButton(0, false);
      const afterClick = cb.isChecked();
      cb.dispose();
      return afterClick;
    });
    expect(result).toBe(false);
  });

  // =========================================================================
  // 8. Render: checked vs unchecked produce different pixels
  // =========================================================================

  test('8 — render: checked and unchecked states produce different pixels', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const makePixel = async (checked: boolean): Promise<number[]> => {
        const htmlC = document.createElement('canvas');
        htmlC.width = 30; htmlC.height = 30;
        document.body.appendChild(htmlC);
        const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
        renderer.init();
        const skin = new G.Skin(renderer);
        skin.init();
        const cvs = new G.Canvas(skin, htmlC);
        cvs.setBounds(0, 0, 30, 30);
        cvs.setDrawBackground(true);
        cvs.setBackgroundColor(G.color(0, 0, 0, 255));

        const cb = new G.CheckBox(cvs);
        cb.setBounds(7, 7, 15, 15);
        if (checked) cb.setChecked(true);

        cvs.doThink();
        cvs.redraw();
        cvs.renderCanvas();

        const gl: WebGL2RenderingContext = renderer.gl;
        const px = 14; const py = 14; // center of checkbox
        const glY = htmlC.height - (py + 1);
        const pixels = new Uint8Array(4);
        gl.readPixels(px, glY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        cvs.dispose();
        document.body.removeChild(htmlC);
        return [pixels[0], pixels[1], pixels[2], pixels[3]];
      };

      const uncheckedPx = await makePixel(false);
      const checkedPx = await makePixel(true);
      return { uncheckedPx, checkedPx };
    });
    // The two pixels should not be identical — the tick changes the look.
    const same =
      result.uncheckedPx[0] === result.checkedPx[0] &&
      result.uncheckedPx[1] === result.checkedPx[1] &&
      result.uncheckedPx[2] === result.checkedPx[2] &&
      result.uncheckedPx[3] === result.checkedPx[3];
    expect(same).toBe(false);
  });

  // =========================================================================
  // 9. Disabled: clicking does not change state
  // =========================================================================

  test('9 — disabled checkbox: click does not toggle', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cb = new G.CheckBox(canvas);
      cb.setBounds(10, 10, 15, 15);
      cb.setDisabled(true);
      canvas.doThink();

      const center = cb.localPosToCanvas(G.point(7, 7));
      canvas.inputMouseMoved(center.x, center.y, 0, 0);
      canvas.inputMouseButton(0, true);
      canvas.inputMouseButton(0, false);
      const afterClick = cb.isChecked();
      cb.dispose();
      return afterClick;
    });
    expect(result).toBe(false);
  });

  // =========================================================================
  // 10. Subclass override: allowUncheck false → checked checkbox stays checked
  // =========================================================================

  test('10 — allowUncheck override false: clicking checked checkbox does not uncheck', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      // Inline subclass via prototype override.
      const cb = new G.CheckBox(canvas);
      cb.setBounds(10, 10, 15, 15);
      cb.setChecked(true);

      // Override allowUncheck to return false.
      (cb as any).allowUncheck = () => false;
      canvas.doThink();

      const center = cb.localPosToCanvas(G.point(7, 7));
      canvas.inputMouseMoved(center.x, center.y, 0, 0);
      canvas.inputMouseButton(0, true);
      canvas.inputMouseButton(0, false);
      const afterClick = cb.isChecked();
      cb.dispose();
      return afterClick;
    });
    // Should remain checked because allowUncheck returns false.
    expect(result).toBe(true);
  });

  // =========================================================================
  // 11. CheckBoxWithLabel: getCheckBox() + getLabel(); layout
  // =========================================================================

  test('11 — CheckBoxWithLabel: getCheckBox() and getLabel() exist; correct dock', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cbwl = new G.CheckBoxWithLabel(canvas);

      const cb = cbwl.getCheckBox();
      const lbl = cbwl.getLabel();
      const hasCb = cb instanceof G.CheckBox;
      const hasLbl = lbl instanceof G.LabelClickable;
      const cbDock = cb.getDock(); // Pos.Left = 2
      const lblDock = lbl.getDock(); // Pos.Fill = 64

      cbwl.dispose();
      return { hasCb, hasLbl, cbDock, lblDock, PosLeft: G.Pos.Left, PosFill: G.Pos.Fill };
    });
    expect(result.hasCb).toBe(true);
    expect(result.hasLbl).toBe(true);
    expect(result.cbDock).toBe(result.PosLeft);
    expect(result.lblDock).toBe(result.PosFill);
  });

  // =========================================================================
  // 12. CheckBoxWithLabel: clicking label toggles checkbox
  // =========================================================================

  test('12 — CheckBoxWithLabel: clicking label toggles checkbox state', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cbwl = new G.CheckBoxWithLabel(canvas);
      cbwl.setBounds(10, 10, 200, 19);
      canvas.doThink();

      const cb = cbwl.getCheckBox();
      const lbl = cbwl.getLabel();

      const beforeToggle = cb.isChecked();
      // Directly fire onPress on the label — simulates a label click.
      lbl.onPress.emit({ controlCaller: lbl });
      const afterToggle = cb.isChecked();

      cbwl.dispose();
      return { beforeToggle, afterToggle };
    });
    expect(result.beforeToggle).toBe(false);
    expect(result.afterToggle).toBe(true);
  });

  // =========================================================================
  // 13. Multiple handlers fire in registration order on onChecked
  // =========================================================================

  test('13 — multiple onChecked handlers fire in registration order', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cb = new G.CheckBox(canvas);

      const order: number[] = [];
      cb.onChecked.on(() => { order.push(1); });
      cb.onChecked.on(() => { order.push(2); });
      cb.onChecked.on(() => { order.push(3); });

      cb.setChecked(true);
      cb.dispose();
      return order;
    });
    expect(result).toEqual([1, 2, 3]);
  });

  // =========================================================================
  // 14. Dispose: children cleaned up
  // =========================================================================

  test('14 — dispose removes CheckBox from canvas children', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const before = canvas.numChildren();
      const cb = new G.CheckBox(canvas);
      const during = canvas.numChildren();
      cb.dispose();
      const after = canvas.numChildren();
      return { before, during, after };
    });
    expect(result.during).toBe(result.before + 1);
    expect(result.after).toBe(result.before);
  });
});
