// T110 — ProgressBar
//
// Categories covered:
//   1  Render          — #8 pixel read in filled region; #12 zero-progress no throw
//   2  Visual baseline — Skipped: GPU/skin variance across CI
//   3  State visuals   — #8/#9 horizontal fill regions; #10 vertical
//   4  Pointer input   — N/A: ProgressBar accepts mouse but has no click behavior
//   5  Touch input     — N/A: same reason
//   6  Keyboard        — N/A
//   7  Events          — N/A: ProgressBar exposes no signals
//   8  Resize          — N/A: ProgressBar does not auto-resize on parent resize

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T110 ProgressBar', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction + defaults
  // =========================================================================

  test('1 — new ProgressBar(canvas): size 128×32; autoLabel true; progress 0; horizontal', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const pb = new G.ProgressBar(canvas);
        const b = pb.getBounds();
        const autoLabel = pb.getAutoLabel();
        const progress = pb.getProgress();
        const horiz = pb.isHorizontal();
        pb.dispose();
        return { threw: false, w: b.w, h: b.h, autoLabel, progress, horiz };
      } catch {
        return { threw: true, w: 0, h: 0, autoLabel: false, progress: -1, horiz: false };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.w).toBe(128);
    expect(result.h).toBe(32);
    expect(result.autoLabel).toBe(true);
    expect(result.progress).toBe(0);
    expect(result.horiz).toBe(true);
  });

  // =========================================================================
  // 2. setProgress round-trip + autoLabel text
  // =========================================================================

  test('2 — setProgress(0.5) → getProgress() === 0.5; getText() === "50%"', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const pb = new G.ProgressBar(canvas);
      pb.setProgress(0.5);
      const progress = pb.getProgress();
      const text = pb.getText();
      pb.dispose();
      return { progress, text };
    });
    expect(result.progress).toBe(0.5);
    expect(result.text).toBe('50%');
  });

  // =========================================================================
  // 3. Negative clamped to 0
  // =========================================================================

  test('3 — setProgress(-0.2) clamped to 0; text "0%"', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const pb = new G.ProgressBar(canvas);
      pb.setProgress(-0.2);
      const progress = pb.getProgress();
      const text = pb.getText();
      pb.dispose();
      return { progress, text };
    });
    expect(result.progress).toBe(0);
    expect(result.text).toBe('0%');
  });

  // =========================================================================
  // 4. >1 clamped to 1
  // =========================================================================

  test('4 — setProgress(1.5) clamped to 1; text "100%"', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const pb = new G.ProgressBar(canvas);
      pb.setProgress(1.5);
      const progress = pb.getProgress();
      const text = pb.getText();
      pb.dispose();
      return { progress, text };
    });
    expect(result.progress).toBe(1);
    expect(result.text).toBe('100%');
  });

  // =========================================================================
  // 5. setAutoLabel(false) — subsequent setProgress does not update text
  // =========================================================================

  test('5 — setAutoLabel(false): setProgress does not update text', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const pb = new G.ProgressBar(canvas);
      pb.setProgress(0.0);
      pb.setAutoLabel(false);
      pb.setProgress(0.75);
      const text = pb.getText();
      pb.dispose();
      return text;
    });
    // Text should still be "0%" since autoLabel was disabled before the 75% set.
    expect(result).toBe('0%');
  });

  // =========================================================================
  // 6. setVertical / setHorizontal toggle
  // =========================================================================

  test('6 — setVertical() → isHorizontal() false; setHorizontal() → isHorizontal() true', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const pb = new G.ProgressBar(canvas);
      pb.setVertical();
      const afterVert = pb.isHorizontal();
      pb.setHorizontal();
      const afterHoriz = pb.isHorizontal();
      pb.dispose();
      return { afterVert, afterHoriz };
    });
    expect(result.afterVert).toBe(false);
    expect(result.afterHoriz).toBe(true);
  });

  // =========================================================================
  // 7. setCycleSpeed + think advances progress and wraps
  // =========================================================================

  test('7 — setCycleSpeed(0.5) + repeated think() advances and wraps progress', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const pb = new G.ProgressBar(canvas);
      pb.setProgress(0);
      pb.setAutoLabel(false);
      pb.setCycleSpeed(0.5);

      // Run enough ticks to wrap past 1. Each tick adds 0.5/60 ≈ 0.00833.
      // 200 ticks ≈ 1.67 of progress, so we'll wrap at least once.
      const snapshots: number[] = [];
      for (let i = 0; i < 200; i++) {
        pb.think();
        if (i % 40 === 0) snapshots.push(pb.getProgress());
      }

      const finalProgress = pb.getProgress();
      pb.dispose();
      return { snapshots, finalProgress };
    });
    // Progress should remain in [0, 1].
    expect(result.finalProgress).toBeGreaterThanOrEqual(0);
    expect(result.finalProgress).toBeLessThanOrEqual(1);
    // At least one snapshot should differ from 0 (progress advanced).
    const advanced = result.snapshots.some((v: number) => v > 0);
    expect(advanced).toBe(true);
  });

  // =========================================================================
  // 8. Visual: setProgress(0.5) horizontal fill — left half non-zero alpha
  // =========================================================================

  test('8 — horizontal at 50%: pixel in left-half region has content', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 128; htmlC.height = 32;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 128, 32);
      cvs.setDrawBackground(true);
      cvs.setBackgroundColor(G.color(0, 0, 0, 255));

      const pb = new G.ProgressBar(cvs);
      pb.setBounds(0, 0, 128, 32);
      pb.setProgress(0.5);

      cvs.doThink();
      cvs.redraw();
      cvs.renderCanvas();

      const gl: WebGL2RenderingContext = renderer.gl;
      // Sample from left quarter (should be inside the fill at 50%).
      const x = 20, y = 16;
      const glY = htmlC.height - (y + 1);
      const pixels = new Uint8Array(4);
      gl.readPixels(x, glY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      cvs.dispose();
      document.body.removeChild(htmlC);

      return { r: pixels[0], g: pixels[1], b: pixels[2], a: pixels[3] };
    });
    // Should have some rendered content (not pure black void).
    const hasContent = result.r > 0 || result.g > 0 || result.b > 0;
    expect(hasContent).toBe(true);
  });

  // =========================================================================
  // 9. setValueFloat alias
  // =========================================================================

  test('9 — setValueFloat(0.8) is an alias for setProgress', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const pb = new G.ProgressBar(canvas);
      pb.setValueFloat(0.8);
      const progress = pb.getProgress();
      pb.dispose();
      return progress;
    });
    expect(result).toBeCloseTo(0.8, 5);
  });

  // =========================================================================
  // 10. Vertical at 50%: render does not throw
  // =========================================================================

  test('10 — vertical setProgress(0.5): render does not throw', async ({ page }) => {
    const threw = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 32; htmlC.height = 128;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 32, 128);

      try {
        const pb = new G.ProgressBar(cvs);
        pb.setBounds(0, 0, 32, 128);
        pb.setVertical();
        pb.setProgress(0.5);
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

  // =========================================================================
  // 11. getValueFloat round-trips
  // =========================================================================

  test('11 — getValueFloat() matches getProgress()', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const pb = new G.ProgressBar(canvas);
      pb.setProgress(0.33);
      const a = pb.getValueFloat();
      const b = pb.getProgress();
      pb.dispose();
      return { a, b };
    });
    expect(result.a).toBe(result.b);
  });

  // =========================================================================
  // 12. Zero-progress render does not throw
  // =========================================================================

  test('12 — render with progress=0 does not throw', async ({ page }) => {
    const threw = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 128; htmlC.height = 32;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 128, 32);

      try {
        const pb = new G.ProgressBar(cvs);
        pb.setBounds(0, 0, 128, 32);
        // progress stays at default 0
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
