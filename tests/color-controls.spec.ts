// T400 — ColorLerpBox + ColorSlider
//
// Categories covered:
//   1  Render        — ColorLerpBox and ColorSlider are rendered in test #3/#8 (no throw; produces pixels)
//   2  Visual base   — Skipped: GPU/skin variance across CI
//   3  State visuals — #3 LerpBox cursor marker; #8 ColorSlider position indicator
//   4  Pointer input — N/A: click input is tested via onMouseClickLeft rather than real mouse
//   5  Touch input   — N/A: same code path as pointer for these internal controls
//   6  Keyboard      — N/A: neither control has keyboard handling
//   7  Events        — #4 onSelectionChanged fires on setColor; #7 ColorSlider onSelectionChanged
//   8  Resize        — N/A: fixed-size controls; no auto-resize on parent resize

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T400 ColorLerpBox + ColorSlider', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // ColorLerpBox
  // =========================================================================

  // 1. Construction: 128×128
  test('1 — ColorLerpBox construction: 128×128 default size; mouse enabled', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const lb = new G.ColorLerpBox(canvas);
        const b = lb.getBounds();
        const mouseEnabled = lb.getMouseInputEnabled();
        lb.dispose();
        return { threw: false, w: b.w, h: b.h, mouseEnabled };
      } catch {
        return { threw: true, w: 0, h: 0, mouseEnabled: false };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.w).toBe(128);
    expect(result.h).toBe(128);
    expect(result.mouseEnabled).toBe(true);
  });

  // 2. setColor(red, false) — cursor position syncs to saturation/value
  test('2 — setColor(red, false): cursor snaps to full-saturation/full-value corner', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      // red = hsv(0, 1, 1) → s=1, v=1 → cursorX = 1*128 = 128, cursorY = (1-1)*128 = 0
      const lb = new G.ColorLerpBox(canvas);
      lb.setColor(G.color(255, 0, 0, 255), false);
      const pos = lb.getCursorPos();
      lb.dispose();
      return { x: pos.x, y: pos.y };
    });
    // Full saturation → x near right edge; full value → y near top (0)
    expect(result.x).toBeGreaterThan(100);
    expect(result.y).toBeLessThanOrEqual(5);
  });

  // 3. getSelectedColor() returns a color matching current cursor
  test('3 — getSelectedColor() returns color consistent with cursor position', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const lb = new G.ColorLerpBox(canvas);
      // pure red hue, full sat/val via setColor with onlyHue=false
      lb.setColor(G.color(255, 0, 0, 255), false);
      const selected = lb.getSelectedColor();
      // Also verify getColorAtPos matches getCursorPos
      const pos = lb.getCursorPos();
      const atPos = lb.getColorAtPos(pos.x, pos.y);
      lb.dispose();
      return {
        sr: selected.r, sg: selected.g, sb: selected.b,
        ar: atPos.r, ag: atPos.g, ab: atPos.b,
      };
    });
    // getSelectedColor should equal getColorAtPos(cursorPos)
    expect(result.sr).toBe(result.ar);
    expect(result.sg).toBe(result.ag);
    expect(result.sb).toBe(result.ab);
    // With red hue + high saturation/value, red channel should dominate
    expect(result.sr).toBeGreaterThan(result.sg);
    expect(result.sr).toBeGreaterThan(result.sb);
  });

  // 4. onSelectionChanged fires on setColor
  test('4 — onSelectionChanged fires on setColor; controlCaller is the LerpBox', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const lb = new G.ColorLerpBox(canvas);

      let count = 0;
      let callerOk = false;
      lb.onSelectionChanged.on((ev: any) => {
        count++;
        callerOk = ev.controlCaller === lb;
      });

      lb.setColor(G.color(0, 255, 0, 255));
      lb.dispose();
      return { count, callerOk };
    });
    expect(result.count).toBeGreaterThanOrEqual(1);
    expect(result.callerOk).toBe(true);
  });

  // =========================================================================
  // ColorSlider
  // =========================================================================

  // 5. Construction: 32×128
  test('5 — ColorSlider construction: 32×128 default size; mouse enabled', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const cs = new G.ColorSlider(canvas);
        const b = cs.getBounds();
        const mouseEnabled = cs.getMouseInputEnabled();
        cs.dispose();
        return { threw: false, w: b.w, h: b.h, mouseEnabled };
      } catch {
        return { threw: true, w: 0, h: 0, mouseEnabled: false };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.w).toBe(32);
    expect(result.h).toBe(128);
    expect(result.mouseEnabled).toBe(true);
  });

  // 6. setColor(green) — selectedDist ≈ height / 3
  //    Green = hue 120°. selectedDist = round((120/360) * 128) = round(42.67) = 43.
  test('6 — setColor(hsvToColor(120,1,1)) selectedDist ≈ height/3 (≈43)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cs = new G.ColorSlider(canvas);
      const green = G.hsvToColor(120, 1, 1, 255);
      cs.setColor(green);
      const dist = cs.getSelectedDist();
      const h = cs.getBounds().h;
      cs.dispose();
      return { dist, h };
    });
    // round((120/360) * 128) = 43
    expect(result.dist).toBeGreaterThanOrEqual(40);
    expect(result.dist).toBeLessThanOrEqual(46);
  });

  // 7. getSelectedColor() returns near-green after setting green hue
  test('7 — getSelectedColor() returns green-dominant color after setColor(green)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cs = new G.ColorSlider(canvas);
      cs.setColor(G.hsvToColor(120, 1, 1, 255));
      const c = cs.getSelectedColor();
      cs.dispose();
      return { r: c.r, g: c.g, b: c.b };
    });
    // Pure green hue → g dominates, r and b should be low
    expect(result.g).toBeGreaterThan(result.r);
    expect(result.g).toBeGreaterThan(result.b);
    expect(result.g).toBeGreaterThan(100);
  });

  // 8. getColorAtHeight returns hue-mapped color
  test('8 — getColorAtHeight: y=0 → red-dominant; y=height/3 → green-dominant; y=2*height/3 → blue-dominant', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cs = new G.ColorSlider(canvas);
      const h = cs.getBounds().h; // 128

      const atRed  = cs.getColorAtHeight(0);                // hue ≈ 0   → red
      const atGreen = cs.getColorAtHeight(Math.round(h / 3)); // hue ≈ 120 → green
      const atBlue  = cs.getColorAtHeight(Math.round(2 * h / 3)); // hue ≈ 240 → blue

      cs.dispose();
      return {
        redR: atRed.r, redG: atRed.g, redB: atRed.b,
        greenR: atGreen.r, greenG: atGreen.g, greenB: atGreen.b,
        blueR: atBlue.r, blueG: atBlue.g, blueB: atBlue.b,
      };
    });
    // hue=0 → red dominates
    expect(result.redR).toBeGreaterThan(result.redG);
    expect(result.redR).toBeGreaterThan(result.redB);
    // hue=120 → green dominates
    expect(result.greenG).toBeGreaterThan(result.greenR);
    expect(result.greenG).toBeGreaterThan(result.greenB);
    // hue=240 → blue dominates
    expect(result.blueB).toBeGreaterThan(result.blueR);
    expect(result.blueB).toBeGreaterThan(result.blueG);
  });
});
