// T109 — Slider + SliderBar + HorizontalSlider + VerticalSlider
//
// Categories covered:
//   1  Render          — #15/#20 render does not throw; produces pixels
//   2  Visual baseline — Skipped: GPU/skin variance across CI
//   3  State visuals   — #15 track+thumb pixels present
//   4  Pointer input   — #13 track click moves bar; #14 bar drag updates value
//   5  Touch input     — #13t touch tap on track updates value
//   6  Keyboard        — #9/#10/#11 arrow/Home/End keys
//   7  Events          — #3/#6/#7 onValueChanged signal + forceUpdate
//   8  Resize          — N/A: Slider does not auto-resize on parent resize
//
// Floating-point note: tests #12 and #17 compare computed bar positions.
// They use toBeCloseTo() with tolerance 1 pixel to absorb integer rounding
// in moveTo(). Flag for gwen-feedback if they flake in CI.

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T109 Slider', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // HorizontalSlider — construction + defaults
  // =========================================================================

  test('1 — HorizontalSlider: default range 0..1; value 0; numNotches 5; clampToNotches false', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const s = new G.HorizontalSlider(canvas);
        const min = s.getMin();
        const max = s.getMax();
        const val = s.getFloatValue();
        const notches = s.getNotchCount();
        const clamp = s.isClampedToNotches();
        s.dispose();
        return { threw: false, min, max, val, notches, clamp };
      } catch {
        return { threw: true, min: -1, max: -1, val: -1, notches: -1, clamp: false };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.min).toBe(0);
    expect(result.max).toBe(1);
    expect(result.val).toBe(0);
    expect(result.notches).toBe(5);
    expect(result.clamp).toBe(false);
  });

  // =========================================================================
  // 2. setRange
  // =========================================================================

  test('2 — setRange(0, 100): min=0; max=100', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const s = new G.HorizontalSlider(canvas);
      s.setRange(0, 100);
      const min = s.getMin();
      const max = s.getMax();
      s.dispose();
      return { min, max };
    });
    expect(result.min).toBe(0);
    expect(result.max).toBe(100);
  });

  // =========================================================================
  // 3. setFloatValue within range fires onValueChanged
  // =========================================================================

  test('3 — setFloatValue(50) with range 0..100: value 50; fires onValueChanged', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const s = new G.HorizontalSlider(canvas);
      s.setRange(0, 100);

      let changeCount = 0;
      let callerOk = false;
      s.onValueChanged.on((ev: any) => {
        changeCount++;
        callerOk = ev.controlCaller === s;
      });

      s.setFloatValue(50);
      const val = s.getFloatValue();
      s.dispose();
      return { val, changeCount, callerOk };
    });
    expect(result.val).toBe(50);
    expect(result.changeCount).toBe(1);
    expect(result.callerOk).toBe(true);
  });

  // =========================================================================
  // 4. setFloatValue below min clamps to min
  // =========================================================================

  test('4 — setFloatValue(-10) clamps to min (0)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const s = new G.HorizontalSlider(canvas);
      s.setRange(0, 100);
      s.setFloatValue(-10);
      const val = s.getFloatValue();
      s.dispose();
      return val;
    });
    expect(result).toBe(0);
  });

  // =========================================================================
  // 5. setFloatValue above max clamps to max
  // =========================================================================

  test('5 — setFloatValue(150) clamps to max (100)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const s = new G.HorizontalSlider(canvas);
      s.setRange(0, 100);
      s.setFloatValue(150);
      const val = s.getFloatValue();
      s.dispose();
      return val;
    });
    expect(result).toBe(100);
  });

  // =========================================================================
  // 6. setFloatValue(same) — no signal
  // =========================================================================

  test('6 — setFloatValue(same value): no onValueChanged signal', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const s = new G.HorizontalSlider(canvas);
      s.setRange(0, 100);
      s.setFloatValue(50); // first set

      let count = 0;
      s.onValueChanged.on(() => { count++; });

      s.setFloatValue(50); // same — should not fire
      s.dispose();
      return count;
    });
    expect(result).toBe(0);
  });

  // =========================================================================
  // 7. setFloatValue(same, true) — force update fires signal
  // =========================================================================

  test('7 — setFloatValue(same, true): forceUpdate fires signal', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const s = new G.HorizontalSlider(canvas);
      s.setRange(0, 100);
      s.setFloatValue(50);

      let count = 0;
      s.onValueChanged.on(() => { count++; });

      s.setFloatValue(50, true); // forced
      s.dispose();
      return count;
    });
    expect(result).toBe(1);
  });

  // =========================================================================
  // 8. Notch clamping: setClampToNotches snaps to nearest notch
  //    Note: slightly float-point sensitive — using toBeCloseTo.
  // =========================================================================

  test('8 — clampToNotches: setFloatValue(37) with 4 notches snaps to 25 or 50', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const s = new G.HorizontalSlider(canvas);
      s.setRange(0, 100);
      s.setNotchCount(4);
      s.setClampToNotches(true);
      s.setFloatValue(37);
      const val = s.getFloatValue();
      s.dispose();
      return val;
    });
    // 37 normalized = 0.37; nearest 1/4 notch: 0.25 (25) or 0.50 (50).
    // floor(0.37 * 4 + 0.5) / 4 = floor(1.98) / 4 = 1/4 = 0.25 → 25.
    expect(result === 25 || result === 50).toBe(true);
  });

  // =========================================================================
  // 9. Arrow key right increases value by 1
  // =========================================================================

  test('9 — onKeyRight(true) increases value by 1', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const s = new G.HorizontalSlider(canvas);
      s.setRange(0, 100);
      s.setFloatValue(50);
      s.onKeyRight(true);
      const val = s.getFloatValue();
      s.dispose();
      return val;
    });
    expect(result).toBe(51);
  });

  // =========================================================================
  // 10. Arrow key left decreases value by 1; clamped to min
  // =========================================================================

  test('10 — onKeyLeft(true) decreases value; clamps to min at 0', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const s = new G.HorizontalSlider(canvas);
      s.setRange(0, 100);
      s.setFloatValue(1);
      s.onKeyLeft(true);  // 1 → 0
      const atMin = s.getFloatValue();
      s.onKeyLeft(true);  // 0 → clamped to 0
      const stillMin = s.getFloatValue();
      s.dispose();
      return { atMin, stillMin };
    });
    expect(result.atMin).toBe(0);
    expect(result.stillMin).toBe(0);
  });

  // =========================================================================
  // 11. Home key → min; End key → max
  // =========================================================================

  test('11 — Home → min; End → max', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const s = new G.HorizontalSlider(canvas);
      s.setRange(0, 100);
      s.setFloatValue(50);
      s.onKeyHome(true);
      const atMin = s.getFloatValue();
      s.onKeyEnd(true);
      const atMax = s.getFloatValue();
      s.dispose();
      return { atMin, atMax };
    });
    expect(result.atMin).toBe(0);
    expect(result.atMax).toBe(100);
  });

  // =========================================================================
  // 12. Layout with value 0.5 + width 200: bar x ≈ 92.5 (float-sensitive)
  // =========================================================================

  test('12 — layout: value 0.5 on 200px wide slider → bar.x near 92 (±2)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const s = new G.HorizontalSlider(canvas);
      s.setRange(0, 1);
      s.setBounds(0, 0, 200, 20);
      s.setFloatValue(0.5);
      canvas.doThink();

      const barX = s._bar.x();
      s.dispose();
      return barX;
    });
    // (200 - 15) * 0.5 = 92.5 → truncated to 92 or 93.
    expect(result).toBeGreaterThanOrEqual(91);
    expect(result).toBeLessThanOrEqual(94);
  });

  // =========================================================================
  // 13. Track click: clicking x=100 on 200-wide slider updates bar/value
  // =========================================================================

  test('13 — track click at x=100 on 200px slider moves bar and fires onValueChanged', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const s = new G.HorizontalSlider(canvas);
      s.setRange(0, 100);
      s.setBounds(10, 10, 200, 20);
      canvas.doThink();

      let changed = false;
      s.onValueChanged.on(() => { changed = true; });

      // Compute canvas-space position x=110 (relative to slider start) = local x=100.
      const canvasX = 10 + 100; // slider starts at x=10, click at local x=100
      const canvasY = 10 + 10;  // vertical center
      s.onMouseClickLeft(canvasX, canvasY, true);

      const val = s.getFloatValue();
      s.dispose();
      return { val, changed };
    });
    expect(result.changed).toBe(true);
    // Bar placed at local x=100 - 7.5 ≈ 92. value ≈ 92/(200-15) ≈ 49-50.
    expect(result.val).toBeGreaterThan(40);
    expect(result.val).toBeLessThan(60);
  });

  // =========================================================================
  // 13t. Touch tap on track updates value
  // =========================================================================

  test('13t — touch tap on track (canvas input) updates value', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const s = new G.HorizontalSlider(canvas);
      s.setRange(0, 100);
      s.setBounds(10, 10, 200, 20);
      canvas.doThink();

      let changed = false;
      s.onValueChanged.on(() => { changed = true; });

      // Simulate touch tap at slider center.
      const cx = 10 + 100; const cy = 10 + 10;
      canvas.inputMouseMoved(cx, cy, 0, 0);
      canvas.inputMouseButton(0, true);
      canvas.inputMouseButton(0, false);

      const val = s.getFloatValue();
      s.dispose();
      return { val, changed };
    });
    expect(result.changed).toBe(true);
    expect(result.val).toBeGreaterThan(0);
  });

  // =========================================================================
  // 14. Drag bar: simulate onDragged → value updates
  // =========================================================================

  test('14 — bar drag via onMoved callback updates value', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const s = new G.HorizontalSlider(canvas);
      s.setRange(0, 100);
      s.setBounds(0, 0, 200, 20);
      canvas.doThink();

      let changeCount = 0;
      s.onValueChanged.on(() => { changeCount++; });

      // Manually move the bar to x=100, then call onMoved to recalculate value.
      s._bar.moveTo(100, 0);
      (s as any).onMoved();

      const val = s.getFloatValue();
      s.dispose();
      return { val, changeCount };
    });
    expect(result.changeCount).toBeGreaterThan(0);
    // bar at x=100, track=200-15=185. normalized=100/185≈0.541. value≈54.
    expect(result.val).toBeGreaterThan(40);
    expect(result.val).toBeLessThan(70);
  });

  // =========================================================================
  // 15. Render: HorizontalSlider produces pixels (track + thumb)
  // =========================================================================

  test('15 — HorizontalSlider render: produces non-background pixels', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 200; htmlC.height = 40;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 200, 40);
      cvs.setDrawBackground(true);
      cvs.setBackgroundColor(G.color(0, 0, 0, 255));

      const s = new G.HorizontalSlider(cvs);
      s.setBounds(10, 10, 180, 20);
      s.setRange(0, 1);
      s.setFloatValue(0.5);

      cvs.doThink();
      cvs.redraw();
      cvs.renderCanvas();

      const gl: WebGL2RenderingContext = renderer.gl;
      // Sample a wide strip along the track.
      const W = 180; const H = 20;
      const glY = htmlC.height - (10 + H);
      const pixels = new Uint8Array(W * H * 4);
      gl.readPixels(10, glY, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      cvs.dispose();
      document.body.removeChild(htmlC);

      // At least one pixel should differ from pure black.
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

  // =========================================================================
  // VerticalSlider
  // =========================================================================

  test('16 — VerticalSlider: bar width fills control width after layout', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const s = new G.VerticalSlider(canvas);
      s.setBounds(0, 0, 20, 200);
      canvas.doThink();
      const barW = s._bar.width();
      const sliderW = s.width();
      s.dispose();
      return { barW, sliderW };
    });
    // VerticalSlider layout sets bar.w = this.width().
    expect(result.barW).toBe(result.sliderW);
  });

  test('17 — VerticalSlider: value 0.5 + height 200 → bar.y near 92 (±2) (float-sensitive)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const s = new G.VerticalSlider(canvas);
      s.setRange(0, 1);
      s.setBounds(0, 0, 20, 200);
      s.setFloatValue(0.5);
      canvas.doThink();

      const barY = s._bar.y();
      s.dispose();
      return barY;
    });
    // (1 - 0.5) * (200 - 15) = 0.5 * 185 = 92.5 → 92 or 93.
    expect(result).toBeGreaterThanOrEqual(91);
    expect(result).toBeLessThanOrEqual(94);
  });

  test('18 — VerticalSlider: onKeyUp increases value; onKeyDown decreases', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const s = new G.VerticalSlider(canvas);
      s.setRange(0, 100);
      s.setFloatValue(50);
      s.onKeyUp(true);
      const afterUp = s.getFloatValue();
      s.onKeyDown(true);
      const afterDown = s.getFloatValue();
      s.dispose();
      return { afterUp, afterDown };
    });
    expect(result.afterUp).toBe(51);
    expect(result.afterDown).toBe(50);
  });

  // =========================================================================
  // SliderBar
  // =========================================================================

  test('19 — SliderBar: setHorizontal toggles isHorizontal', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const sb = new G.SliderBar(canvas);
      sb.setHorizontal(true);
      const isH = sb.isHorizontal();
      sb.setHorizontal(false);
      const isV = sb.isHorizontal();
      sb.dispose();
      return { isH, isV };
    });
    expect(result.isH).toBe(true);
    expect(result.isV).toBe(false);
  });

  test('20 — SliderBar render: delegates to skin.drawSlideButton (does not throw)', async ({ page }) => {
    const threw = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 30; htmlC.height = 30;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 30, 30);

      try {
        const sb = new G.SliderBar(cvs);
        sb.setHorizontal(true);
        sb.setBounds(0, 0, 15, 30);
        cvs.doThink();
        cvs.redraw();
        cvs.renderCanvas();
        cvs.dispose();
        document.body.removeChild(htmlC);
        return false;
      } catch {
        document.body.removeChild(htmlC);
        return true;
      }
    });
    expect(threw).toBe(false);
  });
});
